// backend/src/controllers/complianceController.js
const { getDbPoolWithTunnel, resetPool, executeQueryWithRetry } = require('../lib/db');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const csv = require('csv-parse/sync');
const { simpleParser } = require('mailparser');

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

// Função auxiliar para registrar alterações no histórico
const registrarAlteracao = async (pool, complianceId, campo, valorAnterior, valorNovo, userId, organizacao) => {
  try {
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

    res.json({
      success: true,
      data: {
        id: insertId,
        competencia_referencia,
        status: 'pendente',
        organizacao_criacao: userOrg
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
      const date = new Date(value);
      const year = date.getFullYear();
      
      if (year < 1900 || year > 2099) {
        return res.status(400).json({
          success: false,
          error: `Ano da ${field === 'competencia_inicio' ? 'data de início' : field === 'competencia_fim' ? 'data de fim' : 'data'} deve estar entre 1900 e 2099`
        });
      }
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
      await registrarAlteracao(pool, id, field, valorAnterior, value, user_id, userOrg,);
      
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

    await pool.query(query, params);
    
    // Registrar no histórico
    try {
      await registrarAlteracao(pool, id, field, valorAnterior, value, user_id, userOrg);
      console.log('✅ Histórico registrado com sucesso');
    } catch (histError) {
      console.error('❌ Erro ao registrar histórico (continuando):', histError.message);
      // Não falhar a operação principal por causa do histórico
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

// Gerar parecer com IA
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
    
    // Preparar dados para a IA
    const dadosCompliance = {
      competencia_referencia: competencia.competencia_referencia,
      relatorio_inicial: competencia.relatorio_inicial_texto,
      relatorio_faturamento: competencia.relatorio_faturamento_texto,
      imposto_compensado: competencia.imposto_compensado_texto,
      valor_compensado: competencia.valor_compensado_texto,
      emails: competencia.emails_texto,
      estabelecimento: competencia.estabelecimento_texto
    };

    // Gerar prompt para a IA
    const prompt = `
      Gere um parecer técnico de compliance fiscal baseado nos seguintes dados:
      
      Competência: ${dadosCompliance.competencia_referencia}
      Relatório Inicial: ${dadosCompliance.relatorio_inicial || 'Não informado'}
      Relatório de Faturamento: ${dadosCompliance.relatorio_faturamento || 'Não informado'}
      Imposto Compensado: ${dadosCompliance.imposto_compensado || 'Não informado'}
      Valor Compensado: ${dadosCompliance.valor_compensado || 'Não informado'}
      Emails: ${dadosCompliance.emails || 'Não informado'}
      Estabelecimento: ${dadosCompliance.estabelecimento || 'Não informado'}
      
      O parecer deve ser profissional, técnico e incluir:
      - Análise dos dados fornecidos
      - Conformidade com a legislação fiscal
      - Recomendações específicas
      - Conclusões e próximos passos
    `;

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em compliance fiscal brasileiro. Gere pareceres técnicos profissionais e detalhados."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });

    const parecer = completion.choices[0].message.content;

    // Atualizar o parecer no banco
    await pool.query(`
      UPDATE compliance_fiscal 
      SET parecer_texto = ?, status = 'em_analise'
      WHERE id = ?
    `, [parecer, id]);

    res.json({
      success: true,
      data: {
        parecer,
        status: 'em_analise'
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

    res.json({
      success: true,
      data: rows
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

    // Preparar dados para a IA
    const dadosParaIA = {
      competencia_referencia: dados.competencia_referencia,
      relatorio_inicial_texto: dados.relatorio_inicial_texto,
      relatorio_faturamento_texto: dados.relatorio_faturamento_texto,
      imposto_compensado_texto: dados.imposto_compensado_texto,
      emails_texto: dados.emails_texto,
      valor_compensado_texto: dados.valor_compensado_texto,
      estabelecimento_texto: dados.estabelecimento_texto,
      resumo_folha_pagamento_texto: dados.resumo_folha_pagamento_texto,
      planilha_quantidade_empregados_texto: dados.planilha_quantidade_empregados_texto,
      decreto_3048_1999_vigente_texto: dados.decreto_3048_1999_vigente_texto,
      solucao_consulta_cosit_79_2023_vigente_texto: dados.solucao_consulta_cosit_79_2023_vigente_texto
    };

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
        console.log(`📄 Processando arquivo: ${anexo.nome_arquivo} (${anexo.tipo_mime})`);
        
        let conteudo = '';
        const extensao = path.extname(anexo.nome_arquivo).toLowerCase();
        
        // Extrair conteúdo baseado no tipo de arquivo
        if (anexo.file_data) {
          // Arquivo armazenado no banco (BLOB)
          const buffer = Buffer.from(anexo.file_data);
          
          if (extensao === '.txt') {
            conteudo = buffer.toString('utf-8');
          } else if (extensao === '.csv') {
            const csvData = csv.parse(buffer.toString('utf-8'), { 
              columns: true, 
              skip_empty_lines: true 
            });
            conteudo = `Dados CSV (${csvData.length} linhas):\n${JSON.stringify(csvData, null, 2)}`;
          } else if (extensao === '.pdf') {
            const pdfData = await pdf(buffer);
            conteudo = pdfData.text;
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
            const csvData = csv.parse(buffer.toString('utf-8'), { 
              columns: true, 
              skip_empty_lines: true 
            });
            conteudo = `Dados CSV (${csvData.length} linhas):\n${JSON.stringify(csvData, null, 2)}`;
          } else if (extensao === '.pdf') {
            const pdfData = await pdf(buffer);
            conteudo = pdfData.text;
          } else if (extensao === '.eml') {
            const email = await simpleParser(buffer);
            conteudo = `Email de: ${email.from?.text || 'N/A'}\nPara: ${email.to?.text || 'N/A'}\nAssunto: ${email.subject || 'N/A'}\n\nConteúdo:\n${email.text || email.html || 'Sem conteúdo'}`;
          } else {
            conteudo = buffer.toString('utf-8');
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

    // Preparar conteúdo dos arquivos para análise
    let conteudoArquivosTexto = '';
    if (conteudosArquivos.length > 0) {
      conteudoArquivosTexto = '\n\n## CONTEÚDO DOS ARQUIVOS ANEXADOS:\n';
      
      conteudosArquivos.forEach((arquivo, index) => {
        conteudoArquivosTexto += `\n### ${index + 1}. ${arquivo.nome} (${arquivo.tipo})\n`;
        conteudoArquivosTexto += `**Tipo:** ${arquivo.mime}\n`;
        conteudoArquivosTexto += `**Tamanho:** ${arquivo.tamanho} bytes\n`;
        conteudoArquivosTexto += `**Conteúdo:**\n${arquivo.conteudo}\n`;
        conteudoArquivosTexto += '---\n';
      });
    }

    // Preparar prompt para a IA
    const prompt = `
Você é um especialista em compliance fiscal brasileiro. Analise os dados fornecidos e gere um parecer técnico detalhado sobre a situação fiscal.

DADOS DA COMPETÊNCIA:
- Período: ${periodoInfo}
- Observações dos campos: ${JSON.stringify(dados, null, 2)}

${conteudoArquivosTexto}

INSTRUÇÕES:
1. Analise TODOS os dados e arquivos fornecidos
2. Identifique pontos de conformidade e não conformidade
3. Forneça recomendações específicas baseadas no conteúdo real dos arquivos
4. Mencione valores, datas e informações específicas encontradas nos documentos
5. Gere um parecer técnico profissional em português brasileiro
6. Estruture o parecer com: Resumo Executivo, Análise Detalhada, Conformidade Fiscal, Recomendações e Próximos Passos

IMPORTANTE: Baseie-se no conteúdo REAL dos arquivos, não em dados genéricos.`;

    // Tentar usar OpenAI se disponível
    if (openai) {
      console.log('🚀 Usando OpenAI para análise...');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em compliance fiscal brasileiro com vasta experiência em análise de documentos fiscais e conformidade tributária."
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
        .filter(([key, value]) => value && value.toString().trim())
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
- Observações: ${Object.values(dados).filter(val => val && val.trim()).length} campos preenchidos

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


