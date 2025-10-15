// Funcionalidades de Anexos para Compliance Fiscal - Cassems
const { getDbPoolWithTunnel } = require('../lib/db');
const fs = require('fs');

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
      req.file.path,
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
      SET ${anexoField} = ? 
      WHERE id = ?
    `, [anexoId, complianceId]);

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
    const anexoRows = await pool.query(`
      SELECT compliance_id, tipo_anexo
      FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    if (!anexoRows || anexoRows.length === 0) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    const anexo = anexoRows[0];
    
    // Remover anexo da tabela compliance_anexos
    await pool.query(`
      DELETE FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    // Atualizar campo de anexo na tabela compliance_fiscal
    const anexoField = `${anexo.tipo_anexo}_anexo_id`;
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${anexoField} = NULL 
      WHERE id = ? AND ${anexoField} = ?
    `, [anexo.compliance_id, anexoId]);

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
    console.error(' Erro ao buscar anexos por tipo:', error);
    res.status(500).json({
      error: 'Erro ao buscar anexos por tipo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};
