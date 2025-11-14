// backend/src/controllers/complianceController.js
const { getDbPoolWithTunnel, resetPool, executeQueryWithRetry } = require('../lib/db');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const { simpleParser } = require('mailparser');
const mammoth = require('mammoth');
const {
  ensureComplianceDocumentsInfrastructure,
  createOrUpdateComplianceFolder,
  syncComplianceFolderById,
  migrarDocumentosParaSubpastas
} = require('../utils/complianceDocuments');

// Configurar OpenAI (opcional)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI configurado com sucesso');
  } else {
    console.log('⚠️ OpenAI não configurado - funcionalidades de IA desabilitadas');
  }
} catch (error) {
  console.log('⚠️ Erro ao configurar OpenAI:', error.message);
}

// Função para carregar pdf-parse dinamicamente
let pdfParse = null;
const loadPdfParse = async () => {
  if (!pdfParse) {
    try {
      const imported = require('pdf-parse');
      console.log('🔍 Debug - pdf-parse imported:', typeof imported);
      console.log('🔍 Debug - imported keys:', Object.keys(imported));
      
      // A função principal está em PDFParse (com P maiúsculo)
      pdfParse = imported.PDFParse;
      console.log('🔍 Debug - PDFParse type:', typeof pdfParse);
    } catch (error) {
      console.error('❌ Erro ao carregar pdf-parse:', error);
      throw new Error('pdf-parse não está disponível');
    }
  }
  return pdfParse;
};

// Função auxiliar para registrar alterações no histórico
const registrarAlteracao = async (pool, complianceId, campo, valorAnterior, valorNovo, userId, organizacao) => {
  try {
    // Verificar se complianceId é válido (não 'null' string)
    if (!complianceId || complianceId === 'null' || complianceId === null) {
      console.warn('⚠️ ComplianceId inválido para histórico:', complianceId);
      return;
    }
    
    // Para parecer_texto, não salvar o conteúdo completo, apenas indicar que foi gerado
    let valorAnteriorTratado = valorAnterior;
    let valorNovoTratado = valorNovo;
    
    if (campo === 'parecer_texto') {
      // Se já foi salvo com conteúdo completo, não salvar novamente
      if (valorNovo && valorNovo.length > 100) {
        return;
      }
      valorAnteriorTratado = valorAnterior ? '[Parecer anterior existente]' : '[Nenhum parecer anterior]';
      valorNovoTratado = '[Parecer técnico gerado com IA]';
    }
    
    await pool.query(`
      INSERT INTO compliance_historico 
      (compliance_id, campo_alterado, valor_anterior, valor_novo, alterado_por, organizacao_alteracao)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [complianceId, campo, valorAnteriorTratado, valorNovoTratado, userId, organizacao]);
  } catch (error) {
    console.error('❌ Erro ao registrar alteração no histórico:', error);
  }
};

// Listar todas as competências
exports.listCompetencias = async (req, res) => {
  try {
    console.log('🔍 Iniciando listagem de competências...');
    
    // Obter organização do usuário
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    console.log('🔍 Organização do usuário:', userOrganization);
    console.log('🔍 Headers recebidos:', req.headers);
    console.log('🔍 Query params:', req.query);
    
    let query = `
      SELECT 
        cf.*,
        u.nome as created_by_nome,
        cf.organizacao_criacao as created_by_organizacao,
        u.cor_identificacao as created_by_cor,
        u2.nome as ultima_alteracao_por_nome,
        DATE_FORMAT(cf.competencia_referencia, '%m/%Y') as competencia_formatada,
        DATE_FORMAT(cf.competencia_inicio, '%d/%m/%Y') as competencia_inicio_formatada,
        DATE_FORMAT(cf.competencia_fim, '%d/%m/%Y') as competencia_fim_formatada
      FROM compliance_fiscal cf
      LEFT JOIN usuarios_cassems u ON cf.created_by = u.id
      LEFT JOIN usuarios_cassems u2 ON cf.ultima_alteracao_por = u2.id
    `;
    
    let params = [];
    
    // Se não for Portes, filtrar apenas competências da mesma organização
    // Portes vê TODAS as competências de todas as organizações
    if (userOrganization && userOrganization !== 'portes') {
      query += ` WHERE cf.organizacao_criacao = ?`;
      params.push(userOrganization);
      console.log('🔍 FILTRO APLICADO: Apenas competências da organização:', userOrganization);
    } else {
      console.log('🔍 SEM FILTRO: Mostrando todas as competências (usuário Portes ou sem organização definida)');
    }
    
    query += ` ORDER BY cf.competencia_referencia DESC, cf.created_at DESC`;
    
    console.log('🔍 Query SQL:', query);
    console.log('🔍 Params:', params);
    
    const rows = await executeQueryWithRetry(query, params);
    
    console.log('🔍 Total de competências encontradas:', rows.length);
    console.log('🔍 Primeiras 3 competências:', rows.slice(0, 3).map(r => ({ id: r.id, organizacao_criacao: r.organizacao_criacao })));
    
    // Log adicional para debug
    if (userOrganization && userOrganization !== 'portes') {
      const competenciasFiltradas = rows.filter(r => r.organizacao_criacao === userOrganization);
      console.log('🔍 Competências da organização solicitada:', competenciasFiltradas.length);
      console.log('🔍 Organizações presentes nos resultados:', [...new Set(rows.map(r => r.organizacao_criacao))]);
    }

    console.log('🔍 Debug - Rows retornadas:', rows);
    console.log('🔍 Debug - Tipo de rows:', typeof rows);
    console.log('🔍 Debug - É array?', Array.isArray(rows));

    // Se rows não é um array, converter para array
    let competenciasData = [];
    if (Array.isArray(rows)) {
      competenciasData = rows;
    } else if (rows && typeof rows === 'object') {
      competenciasData = [rows];
    }

    console.log('✅ Competências listadas com sucesso:', competenciasData.length);

    res.json({
      success: true,
      data: competenciasData
    });
  } catch (error) {
    console.error('❌ Erro ao listar competências:', error);
    console.error('❌ Stack trace:', error.stack);
    
    res.status(500).json({
      error: 'Erro ao listar competências',
      details: error.message
    });
  }
};

// Buscar competência por ID
exports.getCompetencia = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT 
        cf.*,
        u.nome as created_by_nome,
        u.organizacao as created_by_organizacao,
        u.cor_identificacao as created_by_cor,
        u2.nome as ultima_alteracao_por_nome,
        DATE_FORMAT(cf.competencia_referencia, '%m/%Y') as competencia_formatada,
        DATE_FORMAT(cf.competencia_inicio, '%d/%m/%Y') as competencia_inicio_formatada,
        DATE_FORMAT(cf.competencia_fim, '%d/%m/%Y') as competencia_fim_formatada
      FROM compliance_fiscal cf
      LEFT JOIN usuarios_cassems u ON cf.created_by = u.id
      LEFT JOIN usuarios_cassems u2 ON cf.ultima_alteracao_por = u2.id
      WHERE cf.id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'Competência não encontrada'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar competência:', error);
    res.status(500).json({
      error: 'Erro ao buscar competência',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Criar nova competência
exports.createCompetencia = async (req, res) => {
  try {
    console.log('🔍 Debug - Iniciando criação de competência');
    console.log('🔍 Debug - Body recebido:', req.body);
    console.log('🔍 Debug - Headers recebidos:', req.headers);

  
    
    const { competencia_referencia, created_by, organizacao_criacao } = req.body;
    
    if (!competencia_referencia || !created_by) {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos',
        details: 'competencia_referencia e created_by são obrigatórios'
      });
    }
    
    // Obter informações do usuário que está criando
    const userRows = await executeQueryWithRetry(`
      SELECT nome, organizacao FROM usuarios_cassems WHERE id = ?
    `, [created_by]);
    
    console.log('🔍 Debug - Usuário encontrado:', userRows[0]);
    
    const userName = userRows[0]?.nome || 'Usuário';
    // Usar organizacao_criacao do body se fornecida, senão usar do usuário
    const userOrg = organizacao_criacao || userRows[0]?.organizacao || 'cassems';
    
    console.log('🔍 Debug - Organização final:', userOrg);
    
    console.log('🔍 Debug - Executando INSERT com:', {
      competencia_referencia,
      created_by,
      userOrg
    });
    
    const result = await executeQueryWithRetry(`
      INSERT INTO compliance_fiscal (competencia_referencia, created_by, organizacao_criacao, status, ultima_alteracao_por, ultima_alteracao_em, ultima_alteracao_organizacao)
      VALUES (?, ?, ?, 'pendente', ?, NOW(), ?)
      `, [competencia_referencia, created_by, userOrg, created_by, userOrg]);

    console.log('🔍 Debug - Resultado do INSERT:', result);
    
    const insertId = result.insertId ? parseInt(result.insertId.toString()) : result.affectedRows;

    let pastaDocumentosId = null;
    try {
      // Obter pool para criar pasta e subpastas
      const { pool: poolForFolder, server: serverForFolder } = await getDbPoolWithTunnel();
      try {
        pastaDocumentosId = await createOrUpdateComplianceFolder(poolForFolder, {
          id: insertId,
          created_by,
          organizacao_criacao: userOrg,
          competencia_referencia,
          competencia_inicio: req.body.competencia_inicio || null,
          competencia_fim: req.body.competencia_fim || null,
          pasta_documentos_id: null,
          organizacao_documentos: req.body.organizacao_documentos || userOrg
        });
        console.log('📁 Pasta de documentos criada/atualizada:', pastaDocumentosId);
      } finally {
        if (serverForFolder) serverForFolder.close();
      }
    } catch (folderError) {
      console.error('⚠️ Erro ao sincronizar pasta de documentos da competência:', folderError);
    }

    res.json({
      success: true,
      data: {
        id: insertId,
        competencia_referencia,
        status: 'pendente',
        organizacao_criacao: userOrg,
        pasta_documentos_id: pastaDocumentosId
      }
    });
  } catch (error) {
    console.error('❌ Erro ao criar competência:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      error: 'Erro ao criar competência',
      details: error.message
    });
  }
};

// Atualizar campo específico
exports.updateField = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const { field, value, anexo_id, userId } = req.body;
    
    if (!field || !userId) {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos',
        details: 'field e userId são obrigatórios'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Obter valor anterior para histórico
    const currentRows = await pool.query(`
      SELECT ${field} FROM compliance_fiscal WHERE id = ?
    `, [id]);
    
    const valorAnterior = currentRows[0]?.[field] || '';

    // Obter informações do usuário
    const userRows = await pool.query(`
      SELECT organizacao FROM usuarios_cassems WHERE id = ?
    `, [userId]);
    
    const userOrg = userRows[0]?.organizacao || 'cassems';

    // Atualizar campo
    const updateQuery = anexo_id 
      ? `UPDATE compliance_fiscal SET ${field} = ?, ${field.replace('_texto', '_anexo_id')} = ?, ultima_alteracao_por = ?, ultima_alteracao_em = NOW() WHERE id = ?`
      : `UPDATE compliance_fiscal SET ${field} = ?, ultima_alteracao_por = ?, ultima_alteracao_em = NOW() WHERE id = ?`;
    
    const updateParams = anexo_id 
      ? [value, anexo_id, userId, id]
      : [value, userId, id];

    await pool.query(updateQuery, updateParams);

    // Registrar alteração no histórico
    try {
    await registrarAlteracao(pool, id, field, valorAnterior, value, userId, userOrg);
      console.log('✅ Histórico registrado com sucesso');
    } catch (histError) {
      console.error('❌ Erro ao registrar histórico (continuando):', histError.message);
      // Não falhar a operação principal por causa do histórico
    }

    if (['competencia_inicio', 'competencia_fim', 'competencia_referencia'].includes(field)) {
      try {
        await syncComplianceFolderById(pool, id);
      } catch (syncError) {
        console.error('⚠️ Erro ao sincronizar pasta de documentos (updateField):', syncError);
      }
    }

    res.json({
      success: true,
      message: 'Campo atualizado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar campo:', error);
    res.status(500).json({
      error: 'Erro ao atualizar campo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Atualizar campo específico de compliance
exports.updateComplianceField = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const { field, value, anexo_id, user_id } = req.body;
    
    console.log('🔍 ===== UPDATE COMPLIANCE FIELD =====');
    console.log('🔍 Debug - field:', field);
    console.log('🔍 Debug - value:', value);
    console.log('🔍 Debug - id:', id);
    console.log('🔍 Debug - user_id:', user_id);
    console.log('🔍 Debug - value type:', typeof value);
    console.log('🔍 Debug - value length:', value ? value.length : 'null/undefined');
    console.log('🔍 ====================================');
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Validação específica para campos de data
    if (field === 'competencia_inicio' || field === 'competencia_fim' || field === 'competencia_referencia') {
      console.log(`🔍 Debug - Validando campo de data: ${field} = ${value}`);
      const date = new Date(value);
      const year = date.getFullYear();
      
      console.log(`🔍 Debug - Data parseada: ${date.toISOString()}, Ano: ${year}`);
      
      if (year < 1900 || year > 2099) {
        console.log(`❌ Debug - Ano inválido: ${year}`);
        return res.status(400).json({
          success: false,
          error: `Ano da ${field === 'competencia_inicio' ? 'data de início' : field === 'competencia_fim' ? 'data de fim' : 'data'} deve estar entre 1900 e 2099`
        });
      }
      console.log(`✅ Debug - Data válida para ${field}`);
    }

    // Mapear campos do frontend para campos do banco PRIMEIRO
    const fieldMapping = {
      'competencia_inicio': 'competencia_inicio',
      'competencia_fim': 'competencia_fim',
      'competencia_referencia': 'competencia_referencia',
      'competencia_referencia_texto': 'competencia_referencia_texto',
      'relatorio_inicial': 'relatorio_inicial_texto',
      'relatorio_faturamento': 'relatorio_faturamento_texto',
      'imposto_compensado': 'imposto_compensado_texto',
      'emails': 'emails_texto',
      'valor_compensado': 'valor_compensado_texto',
      'estabelecimento': 'estabelecimento_texto',
      'resumo_folha_pagamento': 'resumo_folha_pagamento_texto',
      'planilha_quantidade_empregados': 'planilha_quantidade_empregados_texto',
      'decreto_3048_1999_vigente': 'decreto_3048_1999_vigente_texto',
      'solucao_consulta_cosit_79_2023_vigente': 'solucao_consulta_cosit_79_2023_vigente_texto',
      'parecer': 'parecer_texto'
    };

    const dbField = fieldMapping[field];
    if (!dbField) {
      return res.status(400).json({
        error: 'Campo inválido'
      });
    }
    
    // Obter valor anterior para o histórico usando o dbField correto
    const currentData = await pool.query(`
      SELECT ${dbField} FROM compliance_fiscal WHERE id = ?
    `, [id]);
    
    const valorAnterior = currentData[0]?.[dbField] || '';

    // Obter informações do usuário para o histórico
    const userData = await pool.query(`
      SELECT nome, organizacao FROM usuarios_cassems WHERE id = ?
    `, [user_id]);
    
    console.log('🔍 Debug - userData:', userData);
    
    const userName = userData[0]?.nome || 'Usuário';
    const userOrg = userData[0]?.organizacao || 'cassems';
    
    console.log('🔍 Debug - userName:', userName);
    console.log('🔍 Debug - userOrg:', userOrg);

    // Se for competencia_referencia, atualizar diretamente no campo principal
    if (field === 'competencia_referencia') {
      await pool.query(`
        UPDATE compliance_fiscal 
        SET competencia_referencia = ? 
        WHERE id = ?
      `, [value, id]);
      
      console.log('✅ Debug - Competência_referencia atualizada diretamente');
      
      // Registrar no histórico
      if (id && id !== 'null' && id !== null) {
        await registrarAlteracao(pool, id, field, valorAnterior, value, user_id, userOrg);
      } else {
        console.warn('⚠️ ID inválido para histórico:', id);
      }
      
      return res.json({
        success: true,
        message: 'Competência de referência atualizada com sucesso'
      });
    }
    
    // Construir query dinamicamente
    let query = `UPDATE compliance_fiscal SET ${dbField} = ?, ultima_alteracao_por = ?, ultima_alteracao_em = NOW(), ultima_alteracao_organizacao = ?`;
    let params = [value, user_id, userOrg]; // ← user_id em vez de userName
    
    // Se tem anexo, atualizar também o campo de anexo
    if (anexo_id) {
      const anexoField = dbField.replace('_texto', '_anexo_id');
      query += `, ${anexoField} = ?`;
      params.push(anexo_id);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);

    console.log('🔍 Debug - Query final:', query);
    console.log('🔍 Debug - Params:', params);
    
    const result = await pool.query(query, params);
    console.log('🔍 Debug - Resultado da query:', result);
    
    // Registrar no histórico
    try {
      if (id && id !== 'null' && id !== null) {
        await registrarAlteracao(pool, id, field, valorAnterior, value, user_id, userOrg);
        console.log('✅ Histórico registrado com sucesso');
      } else {
        console.warn('⚠️ ID inválido para histórico:', id);
      }
    } catch (histError) {
      console.error('❌ Erro ao registrar histórico (continuando):', histError.message);
      // Não falhar a operação principal por causa do histórico
    }

    if (['competencia_inicio', 'competencia_fim', 'competencia_referencia'].includes(field)) {
      try {
        await syncComplianceFolderById(pool, id);
      } catch (syncError) {
        console.error('⚠️ Erro ao sincronizar pasta de documentos (updateComplianceField):', syncError);
      }
    }

    res.json({
      success: true,
      message: 'Campo atualizado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar campo:', error);
    res.status(500).json({
      error: 'Erro ao atualizar campo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Migrar documentos de uma competência para subpastas
exports.migrarDocumentosCompetencia = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());

    // Buscar pasta_documentos_id da competência
    const competenciaRows = await pool.query(`
      SELECT pasta_documentos_id 
      FROM compliance_fiscal 
      WHERE id = ?
    `, [id]);

    if (!competenciaRows || competenciaRows.length === 0) {
      return res.status(404).json({ error: 'Competência não encontrada' });
    }

    const pastaDocumentosId = competenciaRows[0].pasta_documentos_id;
    if (!pastaDocumentosId) {
      return res.status(400).json({ error: 'Competência não tem pasta de documentos associada' });
    }

    // Executar migração
    const resultado = await migrarDocumentosParaSubpastas(pool, pastaDocumentosId);

    res.json({
      success: true,
      message: 'Migração concluída',
      data: resultado
    });
  } catch (error) {
    console.error('❌ Erro ao migrar documentos:', error);
    res.status(500).json({
      error: 'Erro ao migrar documentos',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Upload de anexo
exports.uploadAnexo = async (req, res) => {
  let pool, server;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { complianceId, tipoAnexo } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Inserir anexo na tabela compliance_anexos
    const result = await pool.query(`
      INSERT INTO compliance_anexos (compliance_id, tipo_anexo, nome_arquivo, caminho_arquivo, tamanho)
      VALUES (?, ?, ?, ?, ?)
    `, [
      complianceId,
      tipoAnexo,
      req.file.originalname,
      req.file.path,
      req.file.size
    ]);

    res.json({
      success: true,
      data: {
        anexo_id: result.insertId,
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do anexo:', error);
    res.status(500).json({
      error: 'Erro ao fazer upload do anexo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Função auxiliar para estimar tokens (aproximação: 1 token ≈ 4 caracteres)
function estimarTokens(texto) {
  return Math.ceil(texto.length / 4);
}

// Função auxiliar para truncar texto baseado em tokens
function truncarPorTokens(texto, maxTokens) {
  const maxCaracteres = maxTokens * 4; // Aproximação conservadora
  if (texto.length <= maxCaracteres) {
    return texto;
  }
  return texto.substring(0, maxCaracteres) + '... [TRUNCADO]';
}

// Função auxiliar para extrair seções relevantes de documentos longos
function extrairSecoesRelevantes(texto, maxTokens = 30000) {
  const maxCaracteres = maxTokens * 4;
  
  if (texto.length <= maxCaracteres) {
    return texto;
  }
  
  console.log(`🔍 Documento muito longo (${texto.length} caracteres), extraindo seções relevantes...`);
  
  // Para documentos muito longos, extrair seções estratégicas
  const linhas = texto.split('\n');
  const secoesRelevantes = [];
  
  // Procurar por seções importantes
  const palavrasChave = [
    'RESUMO', 'EXECUTIVO', 'TOTAL', 'VALOR', 'RAT', 'CNAE', 'ESTABELECIMENTO',
    'CNPJ', 'FUNCIONÁRIO', 'COMPETÊNCIA', 'PAGAMENTO', 'CRÉDITO', 'RECUPERAÇÃO',
    'TABELA', 'ANEXO', 'FUNDAMENTAÇÃO', 'LEGAL', 'PROCEDIMENTO', 'RETIFICAÇÃO',
    'CASSEMS', 'PREVIDÊNCIA', 'INSS', 'RECOLHIMENTO', 'PERÍODO', 'EMPRESA',
    'FOLHA', 'SALÁRIO', 'CONTRIBUIÇÃO', 'ALÍQUOTA', 'IMPOSTO', 'FATURAMENTO',
    'RECEITA', 'DESPESA', 'BALANÇO', 'DEMONSTRATIVO', 'INADIMPLÊNCIA', 'COBRANÇA'
  ];
  
  let contador = 0;
  for (let i = 0; i < linhas.length && contador < maxCaracteres; i++) {
    const linha = linhas[i];
    
    // Incluir linhas com palavras-chave importantes
    const temPalavraChave = palavrasChave.some(palavra => 
      linha.toUpperCase().includes(palavra.toUpperCase())
    );
    
    if (temPalavraChave || contador < maxCaracteres * 0.3) {
      secoesRelevantes.push(linha);
      contador += linha.length + 1;
    }
  }
  
  const resultado = secoesRelevantes.join('\n');
  const resultadoFinal = resultado.length > maxCaracteres 
    ? resultado.substring(0, maxCaracteres) + '... [OTIMIZADO]'
    : resultado;
  
  console.log(`✅ Seções relevantes extraídas: ${resultadoFinal.length} caracteres (${secoesRelevantes.length} linhas)`);
  return resultadoFinal;
}

// Função auxiliar para extrair dados de um arquivo específico
async function extrairDadosArquivo(caminhoArquivo, nomeArquivo) {
  try {
    if (!fs.existsSync(caminhoArquivo)) {
      return { status: 'arquivo_nao_encontrado', conteudo: 'Arquivo não encontrado no servidor' };
    }

    const buffer = fs.readFileSync(caminhoArquivo);
    const extensao = path.extname(nomeArquivo).toLowerCase();
    let conteudo = '';

    if (extensao === '.pdf') {
      try {
        const PDFParseClass = await loadPdfParse();
        console.log('🔍 Debug - PDFParseClass type:', typeof PDFParseClass);
        console.log('🔍 Debug - PDFParseClass constructor:', PDFParseClass?.constructor?.name);
        
        const pdfData = await new PDFParseClass(buffer);
        console.log('🔍 Debug - pdfData type:', typeof pdfData);
        console.log('🔍 Debug - pdfData constructor:', pdfData?.constructor?.name);
        
        // Verificar se o resultado é um array de bytes (dados binários)
        if (Array.isArray(pdfData.text)) {
          console.warn(`⚠️ PDF ${nomeArquivo} retornou dados binários - pode estar protegido ou corrompido`);
          return { status: 'sem_conteudo', conteudo: 'PDF protegido ou corrompido - não foi possível extrair texto' };
        }
        
        // O texto pode estar em diferentes propriedades dependendo da versão
        console.log('🔍 Debug - pdfData structure:', Object.keys(pdfData));
        console.log('🔍 Debug - pdfData.text type:', typeof pdfData.text);
        console.log('🔍 Debug - pdfData.text length:', pdfData.text?.length);
        console.log('🔍 Debug - pdfData.text preview:', pdfData.text?.substring(0, 100));
        
        conteudo = pdfData.text || pdfData.doc?.text || pdfData.toString();
        
        console.log('🔍 Debug - Conteúdo final:', conteudo);
        console.log('🔍 Debug - Tipo do conteúdo final:', typeof conteudo);
        console.log('🔍 Debug - Tamanho do conteúdo final:', conteudo?.length);
        
        if (!conteudo || conteudo === '[object Object]' || conteudo.length < 10) {
          console.warn(`⚠️ Nenhum conteúdo extraído de: ${nomeArquivo}`);
          console.log('🔍 Debug - Conteúdo extraído:', conteudo);
          console.log('🔍 Debug - Tipo do conteúdo:', typeof conteudo);
          console.log('🔍 Debug - Tamanho do conteúdo:', conteudo?.length);
          return { status: 'sem_conteudo', conteudo: 'PDF processado mas sem conteúdo de texto extraível' };
        }
        
        // Log do conteúdo extraído para debug
        console.log(`✅ PDF ${nomeArquivo} - Conteúdo extraído: ${conteudo.length} caracteres`);
        console.log(`🔍 Primeiros 200 caracteres: ${conteudo.substring(0, 200)}`);
      } catch (pdfError) {
        console.error(`Erro ao processar PDF ${nomeArquivo}:`, pdfError.message);
        return { status: 'erro_processamento', conteudo: 'Erro ao processar PDF - arquivo pode estar corrompido' };
      }
    } else if (extensao === '.csv') {
      try {
        const csvData = csv.parse(buffer, { columns: true });
        conteudo = `Dados CSV (${csvData.length} linhas):\n${JSON.stringify(csvData, null, 2)}`;
      } catch (csvError) {
        console.error(`Erro ao processar CSV ${nomeArquivo}:`, csvError.message);
        return { status: 'erro_processamento', conteudo: 'Erro ao processar CSV - formato inválido' };
      }
    } else if (extensao === '.eml') {
      try {
        const email = await simpleParser(buffer);
        conteudo = `Email de: ${email.from?.text || 'N/A'}\nPara: ${email.to?.text || 'N/A'}\nAssunto: ${email.subject || 'N/A'}\nData: ${email.date || 'N/A'}\n\nConteúdo:\n${email.text || email.html || 'Sem conteúdo'}`;
      } catch (emailError) {
        console.error(`Erro ao processar email ${nomeArquivo}:`, emailError.message);
        return { status: 'erro_processamento', conteudo: 'Erro ao processar email - formato inválido' };
      }
    } else if (extensao === '.docx') {
      try {
        console.log(`🔄 Processando DOCX ${nomeArquivo}...`);
        const result = await mammoth.extractRawText({ buffer: buffer });
        conteudo = result.value;
        
        if (!conteudo || conteudo.length < 10) {
          console.warn(`⚠️ Nenhum conteúdo extraído de DOCX: ${nomeArquivo}`);
          return { status: 'sem_conteudo', conteudo: 'DOCX processado mas sem conteúdo de texto extraível' };
        }
        
        console.log(`✅ DOCX ${nomeArquivo} - Conteúdo extraído: ${conteudo.length} caracteres`);
        console.log(`🔍 Primeiros 200 caracteres: ${conteudo.substring(0, 200)}`);
      } catch (docxError) {
        console.error(`Erro ao processar DOCX ${nomeArquivo}:`, docxError.message);
        return { status: 'erro_processamento', conteudo: 'Erro ao processar DOCX - arquivo pode estar corrompido' };
      }
    } else {
      try {
        conteudo = buffer.toString('utf8');
      } catch (textError) {
        return { status: 'erro_processamento', conteudo: 'Arquivo binário - não foi possível extrair texto' };
      }
    }

    return { status: 'processado', conteudo };
  } catch (error) {
    console.error(`Erro ao extrair dados do arquivo ${nomeArquivo}:`, error.message);
    return { status: 'erro_processamento', conteudo: `Erro ao processar: ${error.message}` };
  }
}

// Assistente especializado para Relatório Técnico
async function assistenteRelatorioTecnico(conteudoArquivo, nomeArquivo) {
  if (!conteudoArquivo || conteudoArquivo.includes('Erro ao processar')) {
    return { status: 'erro', dados: 'Não foi possível processar o arquivo' };
  }

  try {
    const prompt = `
Analise o seguinte relatório técnico de recuperação de créditos previdenciários e extraia as informações mais importantes para compliance fiscal:

ARQUIVO: ${nomeArquivo}
CONTEÚDO:
${extrairSecoesRelevantes(conteudoArquivo, 35000)}

Este é um relatório técnico de recuperação de créditos previdenciários que pode conter:
- Análise de recuperação de créditos previdenciários (INSS)
- Dados da empresa (CNPJ, razão social)
- Valores de contribuições previdenciárias
- Períodos de competência analisados
- Análise de folha de pagamento
- Cálculos de alíquotas e percentuais
- Estratégias de recuperação de créditos
- Resultados financeiros e valores recuperados
- Conformidade com legislação previdenciária
- Análise de RAT (Riscos Ambientais do Trabalho)
- Dados de funcionários e estabelecimentos

Extraia e retorne APENAS um JSON com as seguintes informações:
{
  "resumo_executivo": "Resumo em 2-3 linhas do relatório de recuperação de créditos previdenciários",
  "tipo_relatorio": "Tipo específico do relatório (Recuperação de Créditos RAT/Análise de Inadimplência/etc)",
  "empresa_analisada": "Nome da empresa analisada (ex: CASSEMS)",
  "cnpj_empresa": "CNPJ da empresa analisada",
  "periodo_analise": "Período analisado no relatório (ex: 2020-2024)",
  "total_creditos_analisados": "Valor total dos créditos previdenciários analisados",
  "total_recuperado": "Valor total recuperado de contribuições previdenciárias",
  "taxa_recuperacao": "Taxa de recuperação em percentual",
  "estabelecimentos_analisados": ["Lista dos estabelecimentos analisados"],
  "cnpjs_envolvidos": ["Lista dos CNPJs mencionados no relatório"],
  "cnae_principal": "CNAE principal identificado (ex: 8650-0/01)",
  "rat_taxa_aplicada": "Taxa de RAT aplicada (ex: 1%, 2%)",
  "rat_taxa_correta": "Taxa de RAT correta identificada",
  "diferenca_rat": "Diferença entre taxa aplicada e correta",
  "contribuicoes_previdenciarias": {
    "patronal": "Valor das contribuições patronais (20%)",
    "gillrat": "Valor do GILLRAT (2%)",
    "outras_entidades": "Valor das outras entidades (5,8%)",
    "total_contribuicoes": "Total das contribuições previdenciárias"
  },
  "valores_por_ano": {
    "2020": "Valor total recuperado em 2020",
    "2021": "Valor total recuperado em 2021", 
    "2022": "Valor total recuperado em 2022",
    "2023": "Valor total recuperado em 2023",
    "2024": "Valor total recuperado em 2024"
  },
  "funcionarios_por_cargo": {
    "enfermagem": "Total de funcionários de enfermagem",
    "administrativo": "Total de funcionários administrativos",
    "outros": "Total de outros funcionários"
  },
  "principais_achados": ["Lista dos principais achados técnicos sobre recuperação"],
  "pendencias_identificadas": ["Lista de pendências encontradas nos processos"],
  "valores_importantes": ["Valores monetários específicos mencionados"],
  "datas_relevantes": ["Datas importantes mencionadas (vencimentos, pagamentos, etc)"],
  "procedimentos_retificacao": ["Procedimentos de retificação mencionados"],
  "fundamentacao_legal": ["Fundamentação legal citada (ex: IN RFB, Decreto, etc)"],
  "conformidade_geral": "Avaliação geral de conformidade (Conforme/Parcialmente Conforme/Não Conforme)",
  "recomendacoes_tecnicas": ["Recomendações técnicas específicas para melhoria"],
  "riscos_identificados": ["Riscos fiscais, operacionais ou de crédito identificados"],
  "indicadores_performance": ["Indicadores de performance mencionados"],
  "observacoes_legais": ["Observações sobre aspectos legais e regulatórios"],
  "sistemas_utilizados": ["Sistemas mencionados (eSocial, DCOMPWEB, etc)"]
}

IMPORTANTE: 
- Foque em dados quantitativos e qualitativos relevantes
- Identifique valores monetários, percentuais e datas
- Extraia informações sobre estratégias e resultados
- Retorne APENAS o JSON, sem texto adicional
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de relatórios técnicos de recuperação de créditos e compliance fiscal. Extraia informações específicas, quantitativas e qualitativas. Foque em dados financeiros, estratégias e conformidade. Retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.2
    });

    const resposta = completion.choices[0].message.content;
    const dados = JSON.parse(resposta);
    return { status: 'sucesso', dados };
  } catch (error) {
    console.error('Erro no assistente de Relatório Técnico:', error);
    return { status: 'erro', dados: 'Erro ao analisar relatório técnico' };
  }
}

// Assistente especializado para Relatório de Faturamento
async function assistenteRelatorioFaturamento(conteudoArquivo, nomeArquivo) {
  if (!conteudoArquivo || conteudoArquivo.includes('Erro ao processar')) {
    return { status: 'erro', dados: 'Não foi possível processar o arquivo' };
  }

  try {
    const prompt = `
Analise o seguinte relatório de faturamento e extraia dados fiscais importantes:

ARQUIVO: ${nomeArquivo}
CONTEÚDO:
${truncarPorTokens(conteudoArquivo, 25000)}

Extraia e retorne APENAS um JSON com as seguintes informações:
{
  "periodo_faturamento": "Período do faturamento",
  "valor_total_faturado": "Valor total faturado",
  "impostos_devidos": "Valor total de impostos devidos",
  "impostos_pagos": "Valor total de impostos pagos",
  "saldo_impostos": "Saldo de impostos (devido - pago)",
  "principais_clientes": ["Lista dos principais clientes"],
  "atividade_principal": "Descrição da atividade principal",
  "regime_tributario": "Regime tributário identificado",
  "conformidade_fiscal": "Status de conformidade fiscal",
  "observacoes_importantes": ["Observações importantes sobre o faturamento"]
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de relatórios de faturamento fiscal. Extraia dados específicos e estruturados. Retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const resposta = completion.choices[0].message.content;
    const dados = JSON.parse(resposta);
    return { status: 'sucesso', dados };
  } catch (error) {
    console.error('Erro no assistente de Relatório de Faturamento:', error);
    return { status: 'erro', dados: 'Erro ao analisar relatório de faturamento' };
  }
}

// Assistente especializado para Comprovação de Compensações
async function assistenteComprovacaoCompensacoes(conteudoArquivo, nomeArquivo) {
  if (!conteudoArquivo || conteudoArquivo.includes('Erro ao processar')) {
    return { status: 'erro', dados: 'Não foi possível processar o arquivo' };
  }

  try {
    const prompt = `
Analise o seguinte documento de comprovação de compensações e extraia informações fiscais:

ARQUIVO: ${nomeArquivo}
CONTEÚDO:
${truncarPorTokens(conteudoArquivo, 25000)}

Extraia e retorne APENAS um JSON com as seguintes informações:
{
  "tipo_compensacao": "Tipo de compensação identificada",
  "valor_compensado": "Valor total compensado",
  "periodo_compensacao": "Período da compensação",
  "impostos_compensados": ["Lista de impostos compensados"],
  "documentos_comprobatórios": ["Documentos que comprovam a compensação"],
  "status_compensacao": "Status da compensação (Aprovada/Pendente/Rejeitada)",
  "observacoes_compensacao": ["Observações sobre a compensação"],
  "conformidade_legal": "Conformidade com a legislação",
  "prazo_compensacao": "Prazo para compensação se aplicável"
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de documentos de compensação fiscal. Extraia dados específicos e estruturados. Retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const resposta = completion.choices[0].message.content;
    const dados = JSON.parse(resposta);
    return { status: 'sucesso', dados };
  } catch (error) {
    console.error('Erro no assistente de Comprovação de Compensações:', error);
    return { status: 'erro', dados: 'Erro ao analisar comprovação de compensações' };
  }
}

// Assistente especializado para Emails
async function assistenteEmails(conteudoArquivo, nomeArquivo) {
  if (!conteudoArquivo || conteudoArquivo.includes('Erro ao processar')) {
    return { status: 'erro', dados: 'Não foi possível processar o arquivo' };
  }

  try {
    const prompt = `
Analise o seguinte email e extraia informações relevantes para compliance:

ARQUIVO: ${nomeArquivo}
CONTEÚDO:
${truncarPorTokens(conteudoArquivo, 25000)}

Extraia e retorne APENAS um JSON com as seguintes informações:
{
  "assunto": "Assunto do email",
  "remetente": "Remetente do email",
  "destinatario": "Destinatário do email",
  "data_envio": "Data de envio",
  "tipo_comunicacao": "Tipo de comunicação (Fiscal/Operacional/Administrativa)",
  "urgencia": "Nível de urgência (Alta/Média/Baixa)",
  "acoes_solicitadas": ["Ações solicitadas no email"],
  "prazo_resposta": "Prazo para resposta se mencionado",
  "documentos_anexos": ["Documentos mencionados como anexos"],
  "observacoes_importantes": ["Observações importantes do email"]
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de comunicações por email para compliance. Extraia informações específicas e estruturadas. Retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const resposta = completion.choices[0].message.content;
    const dados = JSON.parse(resposta);
    return { status: 'sucesso', dados };
  } catch (error) {
    console.error('Erro no assistente de Emails:', error);
    return { status: 'erro', dados: 'Erro ao analisar email' };
  }
}

// Assistente especializado para Notas Fiscais
async function assistenteNotasFiscais(conteudoArquivo, nomeArquivo) {
  if (!conteudoArquivo || conteudoArquivo.includes('Erro ao processar')) {
    return { status: 'erro', dados: 'Não foi possível processar o arquivo' };
  }

  try {
    const prompt = `
Analise o seguinte documento de notas fiscais e extraia informações fiscais:

ARQUIVO: ${nomeArquivo}
CONTEÚDO:
${truncarPorTokens(conteudoArquivo, 25000)}

Extraia e retorne APENAS um JSON com as seguintes informações:
{
  "numero_nota": "Número da nota fiscal",
  "data_emissao": "Data de emissão",
  "valor_total": "Valor total da nota",
  "valor_impostos": "Valor dos impostos",
  "cliente": "Dados do cliente",
  "servico_produto": "Descrição do serviço/produto",
  "status_nota": "Status da nota (Emitida/Cancelada/Inutilizada)",
  "tipo_operacao": "Tipo de operação (Venda/Serviço/Outros)",
  "observacoes_fiscais": ["Observações fiscais importantes"],
  "conformidade_legal": "Conformidade com a legislação"
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de notas fiscais. Extraia dados específicos e estruturados. Retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const resposta = completion.choices[0].message.content;
    const dados = JSON.parse(resposta);
    return { status: 'sucesso', dados };
  } catch (error) {
    console.error('Erro no assistente de Notas Fiscais:', error);
    return { status: 'erro', dados: 'Erro ao analisar notas fiscais' };
  }
}

// Função auxiliar para analisar documentos anexados
async function analisarDocumentosAnexados(pool, complianceId) {
  try {
    // Buscar todos os anexos da competência
    const [anexos] = await pool.query(`
      SELECT * FROM compliance_anexos 
      WHERE compliance_id = ? 
      ORDER BY tipo_anexo, created_at
    `, [complianceId]);

    const analises = [];

    for (const anexo of anexos) {
      try {
        const caminhoArquivo = anexo.caminho_arquivo;
        if (!fs.existsSync(caminhoArquivo)) {
          analises.push({
            tipo: anexo.tipo_anexo,
            arquivo: anexo.nome_arquivo,
            status: 'arquivo_nao_encontrado',
            conteudo: 'Arquivo não encontrado no servidor'
          });
          continue;
        }

        const buffer = fs.readFileSync(caminhoArquivo);
        const extensao = path.extname(anexo.nome_arquivo).toLowerCase();
        let conteudo = '';

        // Processar diferentes tipos de arquivo
        if (extensao === '.pdf') {
          try {
            const PDFParseClass = await loadPdfParse();
            const pdfData = await new PDFParseClass(buffer);
            // O texto pode estar em diferentes propriedades dependendo da versão
            conteudo = pdfData.text || pdfData.doc?.text || pdfData.toString();
            
            if (!conteudo || conteudo === '[object Object]') {
              console.warn(`⚠️ Nenhum conteúdo extraído de: ${anexo.nome_arquivo}`);
              conteudo = 'PDF processado mas sem conteúdo de texto extraível';
            }
          } catch (pdfError) {
            console.error(`Erro ao processar PDF ${anexo.nome_arquivo}:`, pdfError.message);
            conteudo = 'Erro ao processar PDF - arquivo pode estar corrompido';
          }
        } else if (extensao === '.csv') {
          try {
            const csvData = csv.parse(buffer, { columns: true });
            conteudo = `Dados CSV (${csvData.length} linhas):\n${JSON.stringify(csvData, null, 2)}`;
          } catch (csvError) {
            console.error(`Erro ao processar CSV ${anexo.nome_arquivo}:`, csvError.message);
            conteudo = 'Erro ao processar CSV - formato inválido';
          }
        } else if (extensao === '.eml') {
          try {
            const email = await simpleParser(buffer);
            conteudo = `Email de: ${email.from?.text || 'N/A'}\nPara: ${email.to?.text || 'N/A'}\nAssunto: ${email.subject || 'N/A'}\n\nConteúdo:\n${email.text || email.html || 'Sem conteúdo'}`;
          } catch (emailError) {
            console.error(`Erro ao processar email ${anexo.nome_arquivo}:`, emailError.message);
            conteudo = 'Erro ao processar email - formato inválido';
          }
        } else {
          // Para outros tipos, tentar ler como texto
          try {
            conteudo = buffer.toString('utf8');
          } catch (textError) {
            conteudo = 'Arquivo binário - não foi possível extrair texto';
          }
        }

        analises.push({
          tipo: anexo.tipo_anexo,
          arquivo: anexo.nome_arquivo,
          tamanho: anexo.tamanho,
          status: 'processado',
          conteudo: conteudo.substring(0, 8000) // Aumentar para 8000 caracteres por arquivo
        });

      } catch (error) {
        console.error(`Erro ao processar anexo ${anexo.nome_arquivo}:`, error.message);
        analises.push({
          tipo: anexo.tipo_anexo,
          arquivo: anexo.nome_arquivo,
          status: 'erro_processamento',
          conteudo: `Erro ao processar: ${error.message}`
        });
      }
    }

    return analises;
  } catch (error) {
    console.error('Erro ao analisar documentos anexados:', error);
    return [];
  }
}

// Gerar parecer com IA - VERSÃO COM ASSISTENTES ESPECIALIZADOS
exports.gerarParecer = async (req, res) => {
  let pool, server;
  try {
    // Verificar se OpenAI está disponível
    if (!openai) {
      return res.status(503).json({
        error: 'Serviço de IA temporariamente indisponível',
        details: 'OpenAI não configurado. Entre em contato com o administrador.'
      });
    }

    const { id } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar todos os dados da competência
    const rows = await pool.query(`
      SELECT * FROM compliance_fiscal WHERE id = ?
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: 'Competência não encontrada'
      });
    }

    const competencia = rows[0];
    
    console.log('🔍 Iniciando análise com assistentes especializados...');
    
    // Buscar anexos por tipo
    const [anexos] = await pool.query(`
      SELECT * FROM compliance_anexos 
      WHERE compliance_id = ? 
      ORDER BY tipo_anexo, created_at
    `, [id]);

    // Variáveis para armazenar dados extraídos pelos assistentes
    const dadosExtraidos = {
      relatorio_tecnico: null,
      relatorio_faturamento: null,
      comprovacao_compensacoes: null,
      emails: null,
      notas_fiscais: null
    };

    // Processar cada anexo com o assistente apropriado
    for (const anexo of anexos) {
      console.log(`📄 Processando ${anexo.tipo_anexo}: ${anexo.nome_arquivo}`);
      
      // Extrair dados do arquivo
      const dadosArquivo = await extrairDadosArquivo(anexo.caminho_arquivo, anexo.nome_arquivo);
      
      if (dadosArquivo.status === 'processado') {
        const tokensEstimados = estimarTokens(dadosArquivo.conteudo);
        const tokensOtimizados = estimarTokens(extrairSecoesRelevantes(dadosArquivo.conteudo, 35000));
        console.log(`📊 ${anexo.nome_arquivo}: ${tokensEstimados} tokens originais → ${tokensOtimizados} tokens otimizados`);
      }
      
      if (dadosArquivo.status === 'processado') {
        let resultadoAssistente = null;
        
        // Chamar assistente apropriado baseado no tipo do anexo
        switch (anexo.tipo_anexo) {
          case 'relatorio_inicial':
            resultadoAssistente = await assistenteRelatorioTecnico(dadosArquivo.conteudo, anexo.nome_arquivo);
            if (resultadoAssistente.status === 'sucesso') {
              dadosExtraidos.relatorio_tecnico = resultadoAssistente.dados;
            }
            break;
            
          case 'relatorio_faturamento':
            resultadoAssistente = await assistenteRelatorioFaturamento(dadosArquivo.conteudo, anexo.nome_arquivo);
            if (resultadoAssistente.status === 'sucesso') {
              dadosExtraidos.relatorio_faturamento = resultadoAssistente.dados;
            }
            break;
            
          case 'imposto_compensado':
            resultadoAssistente = await assistenteComprovacaoCompensacoes(dadosArquivo.conteudo, anexo.nome_arquivo);
            if (resultadoAssistente.status === 'sucesso') {
              dadosExtraidos.comprovacao_compensacoes = resultadoAssistente.dados;
            }
            break;
            
          case 'emails':
            resultadoAssistente = await assistenteEmails(dadosArquivo.conteudo, anexo.nome_arquivo);
            if (resultadoAssistente.status === 'sucesso') {
              dadosExtraidos.emails = resultadoAssistente.dados;
            }
            break;
            
          case 'estabelecimento':
            resultadoAssistente = await assistenteNotasFiscais(dadosArquivo.conteudo, anexo.nome_arquivo);
            if (resultadoAssistente.status === 'sucesso') {
              dadosExtraidos.notas_fiscais = resultadoAssistente.dados;
            }
            break;
        }
        
        console.log(`✅ ${anexo.tipo_anexo} processado: ${resultadoAssistente?.status || 'erro'}`);
      }
    }

    // Obter data do período do banco
    const dataPeriodo = competencia.competencia_referencia || 
                       (competencia.competencia_inicio && competencia.competencia_fim ? 
                        `${competencia.competencia_inicio} a ${competencia.competencia_fim}` : 
                        'Não informado');

    // Gerar prompt final robusto com dados extraídos
    const prompt = `
Você é um especialista em compliance fiscal brasileiro com mais de 15 anos de experiência. Gere um parecer técnico profissional e detalhado baseado nos seguintes dados:

## DADOS DA COMPETÊNCIA
**Período de Referência:** ${dataPeriodo}
**Data de Criação:** ${new Date(competencia.created_at).toLocaleDateString('pt-BR')}
**Status Atual:** ${competencia.status || 'Em análise'}

## ANÁLISE DE RELATÓRIO TÉCNICO
${dadosExtraidos.relatorio_tecnico ? `
**Tipo de Relatório:** ${dadosExtraidos.relatorio_tecnico.tipo_relatorio}
**Período de Análise:** ${dadosExtraidos.relatorio_tecnico.periodo_analise}
**Resumo Executivo:** ${dadosExtraidos.relatorio_tecnico.resumo_executivo}
**Total de Créditos Analisados:** ${dadosExtraidos.relatorio_tecnico.total_creditos_analisados}
**Total Recuperado:** ${dadosExtraidos.relatorio_tecnico.total_recuperado}
**Taxa de Recuperação:** ${dadosExtraidos.relatorio_tecnico.taxa_recuperacao}
**Estabelecimentos Analisados:** ${dadosExtraidos.relatorio_tecnico.estabelecimentos_analisados?.join(', ')}
**CNPJs Envolvidos:** ${dadosExtraidos.relatorio_tecnico.cnpjs_envolvidos?.join(', ')}
**CNAE Principal:** ${dadosExtraidos.relatorio_tecnico.cnae_principal}
**Taxa RAT Aplicada:** ${dadosExtraidos.relatorio_tecnico.rat_taxa_aplicada}
**Taxa RAT Correta:** ${dadosExtraidos.relatorio_tecnico.rat_taxa_correta}
**Diferença RAT:** ${dadosExtraidos.relatorio_tecnico.diferenca_rat}
**Valores por Ano:**
${dadosExtraidos.relatorio_tecnico.valores_por_ano ? `
- 2020: ${dadosExtraidos.relatorio_tecnico.valores_por_ano['2020']}
- 2021: ${dadosExtraidos.relatorio_tecnico.valores_por_ano['2021']}
- 2022: ${dadosExtraidos.relatorio_tecnico.valores_por_ano['2022']}
- 2023: ${dadosExtraidos.relatorio_tecnico.valores_por_ano['2023']}
- 2024: ${dadosExtraidos.relatorio_tecnico.valores_por_ano['2024']}
` : ''}
**Funcionários por Cargo:**
${dadosExtraidos.relatorio_tecnico.funcionarios_por_cargo ? `
- Enfermagem: ${dadosExtraidos.relatorio_tecnico.funcionarios_por_cargo.enfermagem}
- Administrativo: ${dadosExtraidos.relatorio_tecnico.funcionarios_por_cargo.administrativo}
- Outros: ${dadosExtraidos.relatorio_tecnico.funcionarios_por_cargo.outros}
` : ''}
**Principais Achados:** ${dadosExtraidos.relatorio_tecnico.principais_achados?.join(', ')}
**Pendências Identificadas:** ${dadosExtraidos.relatorio_tecnico.pendencias_identificadas?.join(', ')}
**Procedimentos de Retificação:** ${dadosExtraidos.relatorio_tecnico.procedimentos_retificacao?.join(', ')}
**Fundamentação Legal:** ${dadosExtraidos.relatorio_tecnico.fundamentacao_legal?.join(', ')}
**Sistemas Utilizados:** ${dadosExtraidos.relatorio_tecnico.sistemas_utilizados?.join(', ')}
**Conformidade Geral:** ${dadosExtraidos.relatorio_tecnico.conformidade_geral}
**Riscos Identificados:** ${dadosExtraidos.relatorio_tecnico.riscos_identificados?.join(', ')}
**Indicadores de Performance:** ${dadosExtraidos.relatorio_tecnico.indicadores_performance?.join(', ')}
**Observações Legais:** ${dadosExtraidos.relatorio_tecnico.observacoes_legais?.join(', ')}
` : '**Status:** Nenhum relatório técnico analisado'}

## ANÁLISE DE RELATÓRIO DE FATURAMENTO
${dadosExtraidos.relatorio_faturamento ? `
**Período de Faturamento:** ${dadosExtraidos.relatorio_faturamento.periodo_faturamento}
**Valor Total Faturado:** ${dadosExtraidos.relatorio_faturamento.valor_total_faturado}
**Impostos Devidos:** ${dadosExtraidos.relatorio_faturamento.impostos_devidos}
**Impostos Pagos:** ${dadosExtraidos.relatorio_faturamento.impostos_pagos}
**Saldo de Impostos:** ${dadosExtraidos.relatorio_faturamento.saldo_impostos}
**Regime Tributário:** ${dadosExtraidos.relatorio_faturamento.regime_tributario}
**Conformidade Fiscal:** ${dadosExtraidos.relatorio_faturamento.conformidade_fiscal}
` : '**Status:** Nenhum relatório de faturamento analisado'}

## ANÁLISE DE COMPROVAÇÃO DE COMPENSAÇÕES
${dadosExtraidos.comprovacao_compensacoes ? `
**Tipo de Compensação:** ${dadosExtraidos.comprovacao_compensacoes.tipo_compensacao}
**Valor Compensado:** ${dadosExtraidos.comprovacao_compensacoes.valor_compensado}
**Período da Compensação:** ${dadosExtraidos.comprovacao_compensacoes.periodo_compensacao}
**Impostos Compensados:** ${dadosExtraidos.comprovacao_compensacoes.impostos_compensados?.join(', ')}
**Status da Compensação:** ${dadosExtraidos.comprovacao_compensacoes.status_compensacao}
**Conformidade Legal:** ${dadosExtraidos.comprovacao_compensacoes.conformidade_legal}
` : '**Status:** Nenhuma comprovação de compensação analisada'}

## ANÁLISE DE COMUNICAÇÕES POR EMAIL
${dadosExtraidos.emails ? `
**Assunto:** ${dadosExtraidos.emails.assunto}
**Remetente:** ${dadosExtraidos.emails.remetente}
**Data de Envio:** ${dadosExtraidos.emails.data_envio}
**Tipo de Comunicação:** ${dadosExtraidos.emails.tipo_comunicacao}
**Urgência:** ${dadosExtraidos.emails.urgencia}
**Ações Solicitadas:** ${dadosExtraidos.emails.acoes_solicitadas?.join(', ')}
` : '**Status:** Nenhuma comunicação por email analisada'}

## ANÁLISE DE NOTAS FISCAIS
${dadosExtraidos.notas_fiscais ? `
**Número da Nota:** ${dadosExtraidos.notas_fiscais.numero_nota}
**Data de Emissão:** ${dadosExtraidos.notas_fiscais.data_emissao}
**Valor Total:** ${dadosExtraidos.notas_fiscais.valor_total}
**Valor dos Impostos:** ${dadosExtraidos.notas_fiscais.valor_impostos}
**Cliente:** ${dadosExtraidos.notas_fiscais.cliente}
**Status da Nota:** ${dadosExtraidos.notas_fiscais.status_nota}
**Conformidade Legal:** ${dadosExtraidos.notas_fiscais.conformidade_legal}
` : '**Status:** Nenhuma nota fiscal analisada'}

## INSTRUÇÕES PARA O PARECER FINAL

Gere um parecer técnico profissional seguindo esta estrutura:

### 1. RESUMO EXECUTIVO
- Síntese dos principais achados baseados nas análises realizadas
- Status geral de conformidade fiscal
- Principais riscos identificados pelos assistentes

### 2. ANÁLISE DETALHADA
- Análise integrada dos dados extraídos pelos assistentes
- Conformidade com a legislação fiscal vigente
- Identificação de inconsistências ou pendências
- Correlação entre os diferentes documentos analisados

### 3. PONTOS DE ATENÇÃO
- Questões que requerem atenção imediata
- Possíveis não conformidades identificadas
- Riscos fiscais específicos encontrados

### 4. RECOMENDAÇÕES
- Ações corretivas necessárias baseadas nas análises
- Melhorias no processo de compliance
- Próximos passos recomendados

### 5. CONCLUSÃO
- Avaliação final da conformidade
- Nível de risco geral
- Recomendação de aprovação ou necessidade de ajustes

**IMPORTANTE:** 
- Use linguagem técnica e profissional
- Cite artigos da legislação quando relevante
- Seja específico e objetivo
- Inclua valores e datas extraídos pelos assistentes
- Mantenha tom formal mas acessível
- Limite o parecer a no máximo 2500 palavras
    `;

    console.log('🤖 Gerando parecer final com IA...');
    
    // Calcular tokens do prompt final
    const tokensPromptFinal = estimarTokens(prompt);
    console.log(`📊 Tokens estimados do prompt final: ${tokensPromptFinal}`);
    
    // Chamar OpenAI com modelo mais avançado
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em compliance fiscal brasileiro com mais de 15 anos de experiência. Gere pareceres técnicos profissionais, detalhados e baseados em evidências extraídas por assistentes especializados. Use linguagem formal mas acessível, cite legislação quando relevante e seja específico em suas recomendações."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4500,
      temperature: 0.3
    });

    const parecer = completion.choices[0].message.content;

    console.log('✅ Parecer final gerado com sucesso');

    // Atualizar o parecer no banco
    await pool.query(`
      UPDATE compliance_fiscal 
      SET parecer_texto = ?, status = 'em_analise', ultima_alteracao_em = NOW()
      WHERE id = ?
    `, [parecer, id]);

    res.json({
      success: true,
      data: {
        parecer,
        status: 'em_analise',
        dados_extraidos: dadosExtraidos,
        resumo: {
          total_anexos: anexos.length,
          assistentes_executados: Object.values(dadosExtraidos).filter(d => d !== null).length,
          periodo_analisado: dataPeriodo
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro ao gerar parecer:', error);
    res.status(500).json({
      error: 'Erro ao gerar parecer',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Atualizar competência_referencia
exports.updateCompetenciaReferencia = async (req, res) => {
  let pool, server;
  try {
    console.log('🔍 Debug - updateCompetenciaReferencia chamada');
    console.log(' Debug - req.params:', req.params);
    console.log('🔍 Debug - req.body:', req.body);
    
    const { id } = req.params;
    const { competencia_referencia } = req.body;
    
    if (!competencia_referencia) {
      console.log('❌ Debug - competencia_referencia não fornecido');
      return res.status(400).json({
        error: 'competencia_referencia é obrigatório'
      });
    }

    // Verificar se é um período (contém |) - se for, não salvar no campo competencia_referencia
    if (competencia_referencia.includes('|')) {
      console.log('⚠️ Debug - Período detectado, não salvando em competencia_referencia:', competencia_referencia);
      return res.json({
        success: true,
        message: 'Período detectado - deve ser salvo nos campos competencia_inicio e competencia_fim'
      });
    }

    console.log('🔍 Debug - Atualizando competência_referencia:', { id, competencia_referencia });

    ({ pool, server } = await getDbPoolWithTunnel());
    
    await pool.query(`
      UPDATE compliance_fiscal 
      SET competencia_referencia = ? 
      WHERE id = ?
    `, [competencia_referencia, id]);

    console.log('✅ Debug - Competência_referencia atualizada com sucesso');

    try {
      await syncComplianceFolderById(pool, id);
    } catch (syncError) {
      console.error('⚠️ Erro ao sincronizar pasta de documentos (updateCompetenciaReferencia):', syncError);
    }

    res.json({
      success: true,
      message: 'Competência de referência atualizada com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar competência_referencia:', error);
    res.status(500).json({
      error: 'Erro ao atualizar competência de referência',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Mapeamento de campos técnicos para títulos amigáveis
const mapearCampoParaTitulo = (campo) => {
  const mapeamento = {
    'competencia_referencia': 'Período',
    'competencia_inicio': 'Data de Início',
    'competencia_fim': 'Data de Fim',
    'competencia_referencia_texto': 'Período',
    'relatorio_inicial_texto': 'Relatório Técnico',
    'relatorio_faturamento_texto': 'Relatório Faturamento',
    'imposto_compensado_texto': 'Comprovação de Compensações',
    'valor_compensado_texto': 'Valor Compensado',
    'emails_texto': 'Comprovação de Email',
    'estabelecimento_texto': 'Notas Fiscais',
    'resumo_folha_pagamento_texto': 'Resumo Folha de Pagamento',
    'planilha_quantidade_empregados_texto': 'Planilha Quantidade Empregados',
    'decreto_3048_1999_vigente_texto': 'Decreto 3048/1999 Vigente',
    'solucao_consulta_cosit_79_2023_vigente_texto': 'Solução Consulta COSIT 79/2023 Vigente',
    'parecer_texto': 'Parecer Final',
    'status': 'Status',
    'observacoes': 'Observações',
    'anexo_relatorio_inicial': 'Anexo - Relatório Técnico',
    'anexo_relatorio_faturamento': 'Anexo - Relatório Faturamento',
    'anexo_imposto_compensado': 'Anexo - Comprovação de Compensações',
    'anexo_emails': 'Anexo - Comprovação de Email',
    'anexo_estabelecimento': 'Anexo - Notas Fiscais',
    'anexo_resumo_folha_pagamento': 'Anexo - Resumo Folha de Pagamento',
    'anexo_planilha_quantidade_empregados': 'Anexo - Planilha Quantidade Empregados',
    'anexo_decreto_3048_1999_vigente': 'Anexo - Decreto 3048/1999 Vigente',
    'anexo_solucao_consulta_cosit_79_2023_vigente': 'Anexo - Solução Consulta COSIT 79/2023 Vigente'
  };
  
  return mapeamento[campo] || campo;
};

// Obter histórico de alterações
exports.getHistorico = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT 
        h.*,
        u.nome as alterado_por_nome,
        u.organizacao as alterado_por_organizacao,
        u.cor_identificacao as alterado_por_cor
      FROM compliance_historico h
      LEFT JOIN usuarios_cassems u ON h.alterado_por = u.id
      WHERE h.compliance_id = ?
      ORDER BY h.alterado_em DESC
    `, [id]);

    // Mapear os campos para títulos amigáveis
    const historicoComTitulos = rows.map(row => ({
      ...row,
      campo_alterado_titulo: mapearCampoParaTitulo(row.campo_alterado)
    }));

    res.json({
      success: true,
      data: historicoComTitulos
    });
  } catch (error) {
    console.error('❌ Erro ao obter histórico:', error);
    res.status(500).json({
      error: 'Erro ao obter histórico',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Adicionar no complianceController.js
exports.generateParecer = async (req, res) => {
  let pool, server;
  try {
    // Verificar se OpenAI está disponível
    if (!openai) {
      return res.status(503).json({
        error: 'Serviço de IA temporariamente indisponível',
        details: 'OpenAI não configurado. Entre em contato com o administrador.'
      });
    }

    const { id: competenciaId } = req.params;
    const { userId, organizacao } = req.body;

    ({ pool, server } = await getDbPoolWithTunnel());

    // Buscar dados da competência
    const competencia = await pool.query(`
      SELECT * FROM compliance_fiscal WHERE id = ?
    `, [competenciaId]);

    if (!competencia || competencia.length === 0) {
      return res.status(404).json({ error: 'Competência não encontrada' });
    }

    const dados = competencia[0];

    // Preparar dados para a IA (validando tipos)
    const dadosParaIA = {};
    const camposParaIA = [
      'competencia_referencia', 'relatorio_inicial_texto', 'relatorio_faturamento_texto',
      'imposto_compensado_texto', 'emails_texto', 'valor_compensado_texto',
      'estabelecimento_texto', 'resumo_folha_pagamento_texto', 'planilha_quantidade_empregados_texto',
      'decreto_3048_1999_vigente_texto', 'solucao_consulta_cosit_79_2023_vigente_texto'
    ];
    
    camposParaIA.forEach(campo => {
      const valor = dados[campo];
      dadosParaIA[campo] = (valor && typeof valor === 'string') ? valor : '';
    });

    // Extrair conteúdo dos arquivos anexados
    console.log('📁 Extraindo conteúdo dos arquivos anexados...');
    const conteudosArquivos = await extrairConteudoArquivos(pool, competenciaId);
    
    // Gerar parecer com IA usando o conteúdo real dos arquivos
    console.log('🤖 Gerando parecer com análise real dos arquivos...');
    const parecer = await generateParecerComIA(dadosParaIA, conteudosArquivos);

    // Salvar parecer no banco
    await pool.query(`
      UPDATE compliance_fiscal 
      SET parecer_texto = ?, updated_at = NOW(), ultima_alteracao_por = ?, ultima_alteracao_em = NOW()
      WHERE id = ?
    `, [parecer, userId, competenciaId]);

    // Registrar alteração no histórico
    await registrarAlteracao(pool, competenciaId, 'parecer_texto', dados.parecer_texto, parecer, userId, organizacao);

    res.json({
      success: true,
      data: { parecer }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar parecer:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (server) server.close();
  }
};

// Função para determinar estratégia de processamento baseada no tamanho
const determinarEstrategiaProcessamento = (tamanhoArquivo, tipoArquivo) => {
  const tamanhoMB = tamanhoArquivo / (1024 * 1024);
  
  if (tamanhoMB > 50) {
    return 'resumo'; // Apenas resumo para arquivos > 50MB
  } else if (tamanhoMB > 10) {
    return 'parcial'; // Processamento parcial para arquivos > 10MB
  } else if (tipoArquivo === '.csv' && tamanhoMB > 5) {
    return 'csv_grande'; // Estratégia especial para CSVs grandes
  } else {
    return 'completo'; // Processamento completo para arquivos menores
  }
};

// Função para extrair conteúdo dos arquivos anexados
const extrairConteudoArquivos = async (pool, competenciaId) => {
  try {
    console.log('🔍 Buscando anexos para competência:', competenciaId);
    
    // Buscar todos os anexos da competência
    const anexos = await pool.query(`
      SELECT 
        ca.*,
        cf.competencia_inicio,
        cf.competencia_fim,
        cf.competencia_referencia
      FROM compliance_anexos ca
      LEFT JOIN compliance_fiscal cf ON ca.compliance_id = cf.id
      WHERE ca.compliance_id = ?
      ORDER BY ca.created_at ASC
    `, [competenciaId]);

    console.log(`📁 Encontrados ${anexos.length} anexos`);

    const conteudos = [];

        for (const anexo of anexos) {
          try {
            console.log(`📄 Processando arquivo: ${anexo.nome_arquivo} (${anexo.tipo_mime}) - ${(anexo.tamanho_arquivo / (1024*1024)).toFixed(2)}MB`);
            
            let conteudo = '';
            const extensao = path.extname(anexo.nome_arquivo).toLowerCase();
            const estrategia = determinarEstrategiaProcessamento(anexo.tamanho_arquivo, extensao);
            
            console.log(`🔧 Estratégia escolhida: ${estrategia}`);
        
        // Extrair conteúdo baseado no tipo de arquivo
        if (anexo.file_data) {
          // Arquivo armazenado no banco (BLOB)
          const buffer = Buffer.from(anexo.file_data);
          
          if (extensao === '.txt') {
            conteudo = buffer.toString('utf-8');
            } else if (extensao === '.csv') {
              if (estrategia === 'resumo') {
                conteudo = `[ARQUIVO CSV MUITO GRANDE - ${(anexo.tamanho_arquivo / (1024*1024)).toFixed(2)}MB] - Apenas resumo disponível`;
              } else if (estrategia === 'csv_grande') {
                // Para CSVs grandes, ler apenas as primeiras linhas
                const csvText = buffer.toString('utf-8');
                const linhas = csvText.split('\n').slice(0, 100); // Primeiras 100 linhas
                const csvParcial = linhas.join('\n');
                const csvData = csv.parse(csvParcial, { 
                  columns: true, 
                  skip_empty_lines: true 
                });
                const totalLinhas = csvText.split('\n').length;
                conteudo = `CSV GRANDE (${csvData.length} linhas de ${totalLinhas} total):\n${JSON.stringify(csvData.slice(0, 10), null, 2)}\n... [${totalLinhas - csvData.length} linhas omitidas]`;
              } else {
                const csvText = buffer.toString('utf-8');
                const csvData = csv.parse(csvText, { 
                  columns: true, 
                  skip_empty_lines: true 
                });
                conteudo = `Dados CSV (${csvData.length} linhas):\n${JSON.stringify(csvData, null, 2)}`;
              }
            } else if (extensao === '.pdf') {
            const PDFParseClass = await loadPdfParse();
            const pdfData = await new PDFParseClass(buffer);
            // O texto pode estar em diferentes propriedades dependendo da versão
            conteudo = pdfData.text || pdfData.doc?.text || pdfData.toString();
            
            if (!conteudo || conteudo === '[object Object]') {
              console.warn(`⚠️ Nenhum conteúdo extraído de PDF`);
              conteudo = 'PDF processado mas sem conteúdo de texto extraível';
            }
          } else if (extensao === '.eml') {
            const email = await simpleParser(buffer);
            conteudo = `Email de: ${email.from?.text || 'N/A'}\nPara: ${email.to?.text || 'N/A'}\nAssunto: ${email.subject || 'N/A'}\n\nConteúdo:\n${email.text || email.html || 'Sem conteúdo'}`;
          } else {
            // Para outros tipos, tentar ler como texto
            conteudo = buffer.toString('utf-8');
          }
        } else if (anexo.caminho_arquivo && fs.existsSync(anexo.caminho_arquivo)) {
          // Arquivo armazenado no sistema de arquivos
          const buffer = fs.readFileSync(anexo.caminho_arquivo);
          
          if (extensao === '.txt') {
            conteudo = buffer.toString('utf-8');
            } else if (extensao === '.csv') {
              if (estrategia === 'resumo') {
                conteudo = `[ARQUIVO CSV MUITO GRANDE - ${(anexo.tamanho_arquivo / (1024*1024)).toFixed(2)}MB] - Apenas resumo disponível`;
              } else if (estrategia === 'csv_grande') {
                // Para CSVs grandes, ler apenas as primeiras linhas
                const csvText = buffer.toString('utf-8');
                const linhas = csvText.split('\n').slice(0, 100); // Primeiras 100 linhas
                const csvParcial = linhas.join('\n');
                const csvData = csv.parse(csvParcial, { 
                  columns: true, 
                  skip_empty_lines: true 
                });
                const totalLinhas = csvText.split('\n').length;
                conteudo = `CSV GRANDE (${csvData.length} linhas de ${totalLinhas} total):\n${JSON.stringify(csvData.slice(0, 10), null, 2)}\n... [${totalLinhas - csvData.length} linhas omitidas]`;
              } else {
                const csvText = buffer.toString('utf-8');
                const csvData = csv.parse(csvText, { 
                  columns: true, 
                  skip_empty_lines: true 
                });
                conteudo = `Dados CSV (${csvData.length} linhas):\n${JSON.stringify(csvData, null, 2)}`;
              }
            } else if (extensao === '.pdf') {
            const PDFParseClass = await loadPdfParse();
            const pdfData = await new PDFParseClass(buffer);
            // O texto pode estar em diferentes propriedades dependendo da versão
            conteudo = pdfData.text || pdfData.doc?.text || pdfData.toString();
            
            if (!conteudo || conteudo === '[object Object]') {
              console.warn(`⚠️ Nenhum conteúdo extraído de PDF`);
              conteudo = 'PDF processado mas sem conteúdo de texto extraível';
            }
          } else if (extensao === '.eml') {
            const email = await simpleParser(buffer);
            conteudo = `Email de: ${email.from?.text || 'N/A'}\nPara: ${email.to?.text || 'N/A'}\nAssunto: ${email.subject || 'N/A'}\n\nConteúdo:\n${email.text || email.html || 'Sem conteúdo'}`;
            } else {
              if (estrategia === 'resumo') {
                conteudo = `[ARQUIVO MUITO GRANDE - ${(anexo.tamanho_arquivo / (1024*1024)).toFixed(2)}MB] - Apenas resumo disponível`;
              } else {
                conteudo = buffer.toString('utf-8');
              }
            }
        }

            if (conteudo && conteudo.trim()) {
              conteudos.push({
                tipo: anexo.tipo_anexo,
                nome: anexo.nome_arquivo,
                mime: anexo.tipo_mime,
                conteudo: conteudo.trim(),
                tamanho: anexo.tamanho_arquivo
              });
              
              console.log(`✅ Conteúdo extraído: ${conteudo.length} caracteres`);
            } else {
              console.log(`⚠️ Nenhum conteúdo extraído de: ${anexo.nome_arquivo}`);
              // Adicionar informação sobre arquivo sem conteúdo extraível
              conteudos.push({
                tipo: anexo.tipo_anexo,
                nome: anexo.nome_arquivo,
                mime: anexo.tipo_mime,
                conteudo: `[ARQUIVO ANEXADO MAS CONTEÚDO NÃO EXTRAÍVEL - ${anexo.tipo_mime}]`,
                tamanho: anexo.tamanho_arquivo
              });
            }
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${anexo.nome_arquivo}:`, error.message);
        conteudos.push({
          tipo: anexo.tipo_anexo,
          nome: anexo.nome_arquivo,
          mime: anexo.tipo_mime,
          conteudo: `[ERRO: Não foi possível extrair o conteúdo deste arquivo - ${error.message}]`,
          tamanho: anexo.tamanho_arquivo
        });
      }
    }

    return conteudos;
  } catch (error) {
    console.error('❌ Erro ao extrair conteúdo dos arquivos:', error);
    return [];
  }
};

// Função para gerar parecer com IA (análise real dos arquivos)
const generateParecerComIA = async (dados, conteudosArquivos = []) => {
  try {
    console.log('🤖 Gerando parecer com IA...');
    
    // Preparar informações da competência
    const periodoInfo = dados.competencia_inicio && dados.competencia_fim 
      ? `${new Date(dados.competencia_inicio).toLocaleDateString('pt-BR')} a ${new Date(dados.competencia_fim).toLocaleDateString('pt-BR')}`
      : dados.competencia_referencia 
        ? new Date(dados.competencia_referencia).toLocaleDateString('pt-BR')
        : 'Não informado';

    // Preparar conteúdo dos arquivos para análise (limitado para evitar limite de tokens)
    let conteudoArquivosTexto = '';
    if (conteudosArquivos.length > 0) {
      conteudoArquivosTexto = '\n\n## CONTEÚDO DOS ARQUIVOS ANEXADOS:\n';
      
      // Limitar drasticamente para evitar limite de tokens (máximo 2 arquivos, 200 caracteres cada)
      conteudosArquivos.slice(0, 2).forEach((arquivo, index) => {
        // Truncar conteúdo drasticamente (máximo 200 caracteres por arquivo)
        const conteudoTruncado = arquivo.conteudo.length > 200 
          ? arquivo.conteudo.substring(0, 200) + '... [TRUNCADO]'
          : arquivo.conteudo;
        
        conteudoArquivosTexto += `\n### ${index + 1}. ${arquivo.nome}\n`;
        conteudoArquivosTexto += `**Resumo:** ${conteudoTruncado}\n`;
        conteudoArquivosTexto += '---\n';
      });
      
      // Limitar total de arquivos se necessário
      if (conteudosArquivos.length > 2) {
        conteudoArquivosTexto += `\n**Nota:** ${conteudosArquivos.length - 2} arquivo(s) adicional(is) foram omitidos para evitar limite de tokens.\n`;
      }
    }

    // Preparar prompt simplificado para a IA (reduzir tokens)
    const prompt = `Analise os dados fiscais e gere um parecer técnico.

PERÍODO: ${periodoInfo}
DADOS: ${JSON.stringify(dados, null, 2)}
${conteudoArquivosTexto}

Gere um parecer técnico em português com: Resumo Executivo, Análise de Conformidade, Recomendações. Baseie-se no conteúdo real dos arquivos.`;

    // Tentar usar OpenAI se disponível
    if (openai) {
      console.log('🚀 Usando OpenAI para análise...');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview", // Modelo com maior contexto (128k tokens)
        messages: [
          {
            role: "system",
            content: "Você é um especialista em compliance fiscal brasileiro."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      });

      const parecerIA = response.choices[0].message.content;
      console.log('✅ Parecer gerado pela IA');
      return parecerIA;
    } else {
      // Fallback: gerar parecer básico baseado no conteúdo real
      console.log('⚠️ OpenAI não disponível, gerando parecer básico...');
      
      // Construir seção de arquivos
      let arquivosSecao = '';
      if (conteudosArquivos.length > 0) {
        arquivosSecao = `### ARQUIVOS ANALISADOS (${conteudosArquivos.length} arquivos)\n\n`;
        conteudosArquivos.forEach((arquivo, index) => {
          arquivosSecao += `**${index + 1}. ${arquivo.nome}** (${arquivo.tipo})\n`;
          arquivosSecao += `- Tipo: ${arquivo.mime}\n`;
          arquivosSecao += `- Tamanho: ${arquivo.tamanho} bytes\n`;
          arquivosSecao += `- Resumo do conteúdo: ${arquivo.conteudo.substring(0, 500)}${arquivo.conteudo.length > 500 ? '...' : ''}\n\n`;
        });
      } else {
        arquivosSecao = '### ARQUIVOS\nNenhum arquivo foi fornecido para análise.\n';
      }

      // Construir seção de observações
      let observacoesSecao = '';
      const observacoes = Object.entries(dados)
        .filter(([key, value]) => value && typeof value === 'string' && value.trim())
        .map(([key, value]) => `- **${key}:** ${value}`);
      
      if (observacoes.length > 0) {
        observacoesSecao = observacoes.join('\n');
      } else {
        observacoesSecao = 'Nenhuma observação foi fornecida.';
      }

      return `# PARECER TÉCNICO DE COMPLIANCE FISCAL

**Data:** ${new Date().toLocaleString('pt-BR')}
**Período de Análise:** ${periodoInfo}

## RESUMO EXECUTIVO

Com base na análise dos documentos fornecidos para o período ${periodoInfo}, foram identificados os seguintes aspectos relacionados ao compliance fiscal.

## ANÁLISE DOS DOCUMENTOS FORNECIDOS

${arquivosSecao}

### OBSERVAÇÕES DOS CAMPOS
${observacoesSecao}

## ANÁLISE DE CONFORMIDADE

### PONTOS POSITIVOS
- Documentação fornecida para o período analisado
- ${conteudosArquivos.length > 0 ? 'Arquivos anexados com conteúdo legível' : 'Estrutura de compliance estabelecida'}

### PONTOS DE ATENÇÃO
${conteudosArquivos.length === 0 ? '- Ausência de documentos de apoio\n- Necessidade de complementação da documentação' : '- Verificar consistência entre documentos\n- Confirmar validade dos dados apresentados'}

## RECOMENDAÇÕES

1. **Validação de Dados:** Verificar a consistência das informações apresentadas
2. **Complementação:** ${conteudosArquivos.length === 0 ? 'Fornecer documentação de apoio para análise completa' : 'Revisar documentos para garantir completude'}
3. **Conformidade:** Aplicar as normas fiscais vigentes
4. **Controle:** Implementar procedimentos de controle interno

## PRÓXIMOS PASSOS

1. Revisar e validar todos os documentos apresentados
2. Corrigir eventuais inconsistências identificadas
3. Completar documentação pendente, se necessário
4. Implementar controles preventivos
5. Agendar próxima revisão de compliance

## CONCLUSÃO

${conteudosArquivos.length > 0 ? 
  'A análise baseada nos documentos fornecidos indica a necessidade de revisão detalhada para garantir conformidade total com a legislação fiscal vigente.' :
  'É recomendável a apresentação de documentação de apoio para uma análise mais precisa do compliance fiscal.'}

---
**Parecer gerado automaticamente em:** ${new Date().toLocaleString('pt-BR')}
**Sistema:** AuditaAI Compliance
**Baseado em:** ${conteudosArquivos.length} arquivo(s) anexado(s) + observações dos campos`;
    }
  } catch (error) {
    console.error('❌ Erro ao gerar parecer:', error);
    
    const periodoInfo = dados.competencia_inicio && dados.competencia_fim 
      ? `${new Date(dados.competencia_inicio).toLocaleDateString('pt-BR')} a ${new Date(dados.competencia_fim).toLocaleDateString('pt-BR')}`
      : 'Não informado';
    
    return `# ERRO NA GERAÇÃO DO PARECER

Ocorreu um erro durante a geração do parecer técnico: ${error.message}

**Dados disponíveis:**
- Período: ${periodoInfo}
- Arquivos anexados: ${conteudosArquivos.length}
- Observações: ${Object.values(dados).filter(val => val && typeof val === 'string' && val.trim()).length} campos preenchidos

Por favor, tente novamente ou entre em contato com o suporte técnico.

---
**Erro ocorrido em:** ${new Date().toLocaleString('pt-BR')}`;
  }
};

// Excluir competência
exports.deleteCompetencia = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const { id } = req.params;
    const { userId, organizacao } = req.body;
    
    console.log('🗑️ Excluindo competência:', { id, userId, organizacao });
    
    // Verificar se a competência existe
    const competencia = await pool.query(
      'SELECT * FROM compliance_fiscal WHERE id = ?',
      [id]
    );
    
    if (!competencia || competencia.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Competência não encontrada'
      });
    }
    
    // Excluir histórico de alterações primeiro
    try {
      await pool.query(
        'DELETE FROM compliance_historico WHERE compliance_id = ?',
        [id]
      );
      console.log('✅ Histórico excluído');
    } catch (error) {
      console.log('⚠️ Erro ao excluir histórico:', error.message);
    }
    
    // Excluir anexos relacionados - USAR compliance_anexos
    try {
      await pool.query(
        'DELETE FROM compliance_anexos WHERE compliance_id = ?',
        [id]
      );
      console.log('✅ Anexos excluídos');
    } catch (error) {
      console.log('⚠️ Erro ao excluir anexos:', error.message);
    }
    
    // Excluir a competência
    await pool.query(
      'DELETE FROM compliance_fiscal WHERE id = ?',
      [id]
    );
    
    console.log('✅ Competência excluída com sucesso:', id);
    
    res.json({
      success: true,
      message: 'Competência excluída com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao excluir competência:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (server) {
      server.close();
    }
  }
};


