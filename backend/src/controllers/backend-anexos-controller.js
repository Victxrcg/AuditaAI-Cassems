// Funcionalidades de Anexos para Compliance Fiscal - Cassems
const { getDbPoolWithTunnel } = require('../lib/db');
const fs = require('fs');
const {
  ensureComplianceDocumentsInfrastructure,
  syncComplianceFolderById,
  saveDocumentFile,
  removeDocumentFileIfExists,
  runQuery,
  getSubpastaIdByTipoAnexo
} = require('../utils/complianceDocuments');

// Função auxiliar para registrar alterações no histórico
const registrarAlteracao = async (pool, complianceId, campo, valorAnterior, valorNovo, userId, organizacao) => {
  try {
    // Verificar se complianceId é válido (não 'null' string)
    if (!complianceId || complianceId === 'null' || complianceId === null) {
      console.warn('⚠️ ComplianceId inválido para histórico:', complianceId);
      return;
    }
    
    await pool.query(`
      INSERT INTO compliance_historico 
      (compliance_id, campo_alterado, valor_anterior, valor_novo, alterado_por, organizacao_alteracao)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [complianceId, campo, valorAnterior, valorNovo, userId, organizacao]);
  } catch (error) {
    console.error('❌ Erro ao registrar alteração no histórico:', error);
  }
};

// Função para sanitizar nome do arquivo
function sanitizeFileName(filename) {
  // Remover caracteres especiais e acentos
  return filename
    .normalize('NFD') // Decompor caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remover diacríticos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Substituir caracteres especiais por _
    .replace(/_+/g, '_') // Remover underscores duplos
    .replace(/^_|_$/g, ''); // Remover underscores do início/fim
}

// Upload de anexo
exports.uploadAnexo = async (req, res) => {
  let pool, server;
  try {
    console.log('🔍 Debug - Upload request recebido:', {
      params: req.params,
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null,
      headers: {
        'x-user-organization': req.headers['x-user-organization'],
        'x-user-id': req.headers['x-user-id']
      }
    });

    if (!req.file) {
      console.error('❌ Nenhum arquivo recebido na requisição');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { complianceId, tipoAnexo } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Ler o arquivo como buffer para armazenar no banco
    const fileData = fs.readFileSync(req.file.path);
    
    console.log('🔍 Debug - Arquivo recebido:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });
    
    // Obter informações do usuário atual dos headers
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'] || '1';
    const currentUser = { 
      id: parseInt(userId), 
      organizacao: userOrg 
    };
    
    console.log('🔍 Debug - User info from headers:', currentUser);
    
    // Sanitizar nome do arquivo para evitar problemas de codificação
    const sanitizedFileName = sanitizeFileName(req.file.originalname);
    console.log('🔍 Debug - Nome original:', req.file.originalname);
    console.log('🔍 Debug - Nome sanitizado:', sanitizedFileName);
    
    // Buscar informações da competência para usar estrutura hierárquica
    const complianceRows = await pool.query(`
      SELECT 
        id,
        competencia_inicio,
        competencia_fim,
        competencia_referencia,
        organizacao_criacao
      FROM compliance_fiscal
      WHERE id = ?
    `, [complianceId]);
    
    const complianceInfo = complianceRows && complianceRows.length > 0 ? complianceRows[0] : null;
    
    // Determinar caminho do arquivo (usar estrutura hierárquica se possível)
    let filePathToSave = req.file.path;
    if (complianceInfo) {
      // Usar estrutura hierárquica por período e categoria
      const savedFile = saveDocumentFile(fileData, sanitizedFileName, complianceId, complianceInfo, tipoAnexo);
      filePathToSave = savedFile.filePath;
      console.log('📁 Arquivo salvo na estrutura hierárquica:', filePathToSave);
    }
    
    // Inserir anexo na tabela compliance_anexos usando a estrutura correta
    const result = await pool.query(`
      INSERT INTO compliance_anexos (
        compliance_id, 
        tipo_anexo, 
        nome_arquivo, 
        caminho_arquivo, 
        file_data, 
        tamanho_arquivo, 
        tipo_mime, 
        created_by,
        uploadado_por,
        organizacao_upload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      complianceId,
      tipoAnexo,
      sanitizedFileName,
      filePathToSave,
      fileData,
      req.file.size,
      req.file.mimetype,
      currentUser.id,
      currentUser.id,
      currentUser.organizacao || 'cassems'
    ]);

    // Converter insertId para Number para evitar problemas de serialização
    const anexoId = Number(result.insertId);

    // Atualizar o campo de anexo na tabela compliance_fiscal
    const anexoField = `${tipoAnexo}_anexo_id`;
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${anexoField} = ?, ultima_alteracao_por = ?, ultima_alteracao_em = NOW()
      WHERE id = ?
    `, [anexoId, currentUser.id, complianceId]);

    // Registrar no histórico que um anexo foi adicionado
    try {
      await registrarAlteracao(
        pool, 
        complianceId, 
        `anexo_${tipoAnexo}`, 
        '[Nenhum arquivo anterior]', 
        `[Arquivo adicionado: ${sanitizedFileName}]`, 
        currentUser.id, 
        currentUser.organizacao || 'cassems'
      );
      console.log('✅ Histórico de anexo registrado com sucesso');
    } catch (histError) {
      console.error('❌ Erro ao registrar histórico de anexo (continuando):', histError.message);
    }

    try {
      await ensureComplianceDocumentsInfrastructure(pool);
      await syncComplianceFolderById(pool, complianceId);

      // Se complianceInfo ainda não foi buscado, buscar agora
      if (!complianceInfo) {
        const complianceRowsRefetch = await runQuery(pool, `
          SELECT 
            id,
            organizacao_criacao,
            pasta_documentos_id,
            created_by,
            competencia_inicio,
            competencia_fim,
            competencia_referencia
          FROM compliance_fiscal
          WHERE id = ?
        `, [complianceId]);

        complianceInfo = Array.isArray(complianceRowsRefetch) && complianceRowsRefetch.length > 0
          ? complianceRowsRefetch[0]
          : null;
      }

      const pastaDocumentosId = complianceInfo?.pasta_documentos_id;

      if (pastaDocumentosId) {
        const pastaRows = await runQuery(pool, `
          SELECT organizacao, titulo
          FROM pastas_documentos
          WHERE id = ?
        `, [pastaDocumentosId]);

        const pastaInfo = Array.isArray(pastaRows) && pastaRows.length > 0 ? pastaRows[0] : null;
        const pastaOrganizacao = pastaInfo?.organizacao || complianceInfo?.organizacao_criacao || currentUser.organizacao || 'cassems';

        // Arquivo já foi salvo na estrutura hierárquica acima, usar o caminho já salvo
        const filePath = filePathToSave;

        // Buscar subpasta correspondente ao tipo de anexo
        let pastaIdParaDocumento = pastaDocumentosId; // Fallback para pasta principal
        try {
          console.log(`🔍 Buscando subpasta para tipo_anexo="${tipoAnexo}" na pasta_pai_id=${pastaDocumentosId}`);
          const subpastaId = await getSubpastaIdByTipoAnexo(pool, pastaDocumentosId, tipoAnexo);
          if (subpastaId) {
            pastaIdParaDocumento = subpastaId;
            console.log(`✅ Documento será vinculado à subpasta: ${subpastaId} (tipo: ${tipoAnexo})`);
          } else {
            console.log(`⚠️ Subpasta não encontrada para ${tipoAnexo}, usando pasta principal ${pastaDocumentosId}`);
          }
        } catch (subpastaError) {
          console.error('❌ Erro ao buscar subpasta, usando pasta principal:', subpastaError);
          console.error('❌ Stack trace:', subpastaError.stack);
        }
        
        console.log(`📁 pastaIdParaDocumento final: ${pastaIdParaDocumento}`);

        try {
          const documentoResult = await runQuery(pool, `
            INSERT INTO documentos (nome_arquivo, caminho, tamanho, mimetype, organizacao, enviado_por, pasta_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            sanitizedFileName,
            filePath,
            req.file.size,
            req.file.mimetype,
            pastaOrganizacao,
            currentUser.id || null,
            pastaIdParaDocumento
          ]);

          const documentoId = documentoResult && documentoResult.insertId
            ? Number(documentoResult.insertId)
            : null;

          if (documentoId) {
            await runQuery(pool, `
              UPDATE compliance_anexos
              SET documento_id = ?
              WHERE id = ?
            `, [documentoId, anexoId]);
            console.log('📁 Documento sincronizado com módulo Documentos:', documentoId);
          } else {
            console.warn('⚠️ Documento criado sem insertId. Mantendo arquivo local.');
          }
        } catch (docError) {
          console.error('❌ Erro ao registrar documento no módulo Documentos:', docError);
          removeDocumentFileIfExists(filePath);
        }
      } else {
        console.warn('⚠️ Pasta de documentos não encontrada para a competência. Documento não sincronizado.');
      }
    } catch (syncError) {
      console.error('⚠️ Erro geral ao sincronizar anexos com Documentos:', syncError);
    }

    // Remover arquivo temporário
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        anexo_id: anexoId,
        filename: sanitizedFileName,
        original_filename: req.file.originalname,
        size: req.file.size,
        tipo_mime: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do anexo:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Limpar arquivo temporário em caso de erro
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Arquivo temporário removido após erro');
      } catch (cleanupError) {
        console.error('❌ Erro ao remover arquivo temporário:', cleanupError);
      }
    }
    
    res.status(500).json({
      error: 'Erro ao fazer upload do anexo',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (server) server.close();
  }
};

// Buscar anexo por ID
exports.getAnexo = async (req, res) => {
  let pool, server;
  try {
    const { anexoId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT nome_arquivo, file_data, tipo_mime, tamanho_arquivo
      FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    const anexo = rows[0];
    
    res.setHeader('Content-Type', anexo.tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${anexo.nome_arquivo}"`);
    res.setHeader('Content-Length', anexo.tamanho_arquivo);
    
    res.send(anexo.file_data);
  } catch (error) {
    console.error(' Erro ao buscar anexo:', error);
    res.status(500).json({
      error: 'Erro ao buscar anexo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Listar anexos de uma competência
exports.listAnexos = async (req, res) => {
  let pool, server;
  try {
    const { complianceId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT id, nome_arquivo, tipo_anexo, tamanho_arquivo, created_at
      FROM compliance_anexos 
      WHERE compliance_id = ?
      ORDER BY created_at DESC
    `, [complianceId]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(' Erro ao listar anexos:', error);
    res.status(500).json({
      error: 'Erro ao listar anexos',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Remover anexo
exports.removeAnexo = async (req, res) => {
  let pool, server;
  try {
    const { anexoId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar informações do anexo
    const anexoRows = await runQuery(pool, `
      SELECT compliance_id, tipo_anexo, nome_arquivo, documento_id
      FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    const anexosArray = Array.isArray(anexoRows) ? anexoRows : (anexoRows ? [anexoRows] : []);

    if (!anexosArray || anexosArray.length === 0) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    const anexo = anexosArray[0];

    if (!anexo || !anexo.tipo_anexo) {
      console.warn('⚠️ Anexo encontrado sem campos esperados:', anexo);
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }
    
    // Obter informações do usuário atual dos headers
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'] || '1';
    const currentUser = { 
      id: parseInt(userId), 
      organizacao: userOrg 
    };
    
    // Remover anexo da tabela compliance_anexos
    try {
      await pool.query(`
        DELETE FROM compliance_anexos 
        WHERE id = ?
      `, [anexoId]);
    } catch (deleteError) {
      console.error('❌ Erro ao remover registro de compliance_anexos:', deleteError);
      throw deleteError;
    }

    // Atualizar campo de anexo na tabela compliance_fiscal
    const anexoField = `${anexo.tipo_anexo}_anexo_id`;
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${anexoField} = NULL 
      WHERE id = ? AND ${anexoField} = ?
    `, [anexo.compliance_id, anexoId]);

    // Registrar no histórico que um anexo foi removido
    try {
      await registrarAlteracao(
        pool, 
        anexo.compliance_id, 
        `anexo_${anexo.tipo_anexo}`, 
        `[Arquivo anterior: ${anexo.nome_arquivo}]`, 
        '[Arquivo removido]', 
        currentUser.id, 
        currentUser.organizacao || 'cassems'
      );
      console.log('✅ Histórico de remoção de anexo registrado com sucesso');
    } catch (histError) {
      console.error('❌ Erro ao registrar histórico de remoção de anexo (continuando):', histError.message);
    }

    if (anexo.documento_id) {
      try {
        await ensureComplianceDocumentsInfrastructure(pool);

        const documentoRows = await runQuery(pool, `
          SELECT caminho 
          FROM documentos
          WHERE id = ?
        `, [anexo.documento_id]);

        const documentoArray = Array.isArray(documentoRows) ? documentoRows : (documentoRows ? [documentoRows] : []);

        const documentoInfo = documentoArray.length > 0
          ? documentoArray[0]
          : null;

        await runQuery(pool, `
          DELETE FROM documentos
          WHERE id = ?
        `, [anexo.documento_id]);

        if (documentoInfo?.caminho) {
          try {
            removeDocumentFileIfExists(documentoInfo.caminho);
          } catch (removeFileError) {
            console.error('⚠️ Erro ao remover arquivo físico sincronizado:', removeFileError);
          }
        }

        console.log('🗑️ Documento sincronizado removido:', anexo.documento_id);
      } catch (docDeleteError) {
        console.error('⚠️ Erro ao remover documento sincronizado do módulo Documentos (continuando):', docDeleteError);
      }
    }

    res.json({
      success: true,
      message: 'Anexo removido com sucesso'
    });
  } catch (error) {
    console.error(' Erro ao remover anexo:', error);
    res.status(500).json({
      error: 'Erro ao remover anexo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Buscar anexos por tipo de competência
exports.getAnexosByTipo = async (req, res) => {
  let pool, server;
  try {
    const { complianceId, tipoAnexo } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT id, nome_arquivo, tipo_anexo, tamanho_arquivo, created_at
      FROM compliance_anexos 
      WHERE compliance_id = ? AND tipo_anexo = ?
      ORDER BY created_at DESC
    `, [complianceId, tipoAnexo]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar anexos por tipo:', error);
    res.status(500).json({
      error: 'Erro ao buscar anexos por tipo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Listar anexos agrupados por categoria
exports.listAnexosByCategory = async (req, res) => {
  let pool, server;
  try {
    const { complianceId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT 
        id, 
        nome_arquivo, 
        tipo_anexo, 
        tamanho_arquivo, 
        tipo_mime,
        created_at,
        uploadado_por,
        organizacao_upload
      FROM compliance_anexos 
      WHERE compliance_id = ?
      ORDER BY tipo_anexo, created_at DESC
    `, [complianceId]);

    // Agrupar por tipo_anexo (categoria)
    const anexosPorCategoria = {};
    
    rows.forEach(anexo => {
      const categoria = anexo.tipo_anexo;
      if (!anexosPorCategoria[categoria]) {
        anexosPorCategoria[categoria] = [];
      }
      anexosPorCategoria[categoria].push(anexo);
    });

    res.json({
      success: true,
      data: {
        categorias: anexosPorCategoria,
        total: rows.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao listar anexos por categoria:', error);
    res.status(500).json({
      error: 'Erro ao listar anexos por categoria',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};
