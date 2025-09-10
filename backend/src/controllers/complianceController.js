// backend/src/controllers/complianceController.js
const { getDbPoolWithTunnel } = require('../lib/db');

// Listar todas as competências
exports.listCompetencias = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT 
        cf.*,
        u.nome as created_by_nome,
        DATE_FORMAT(cf.competencia_referencia, '%m/%Y') as competencia_formatada
      FROM compliance_fiscal cf
      LEFT JOIN usuarios_cassems u ON cf.created_by = u.id
      ORDER BY cf.competencia_referencia DESC, cf.created_at DESC
    `);

    console.log('🔍 Debug - Rows retornadas:', rows);
    console.log('🔍 Debug - Tipo de rows:', typeof rows);
    console.log(' Debug - É array?', Array.isArray(rows));

    // Se rows não é um array, converter para array
    let competenciasData = [];
    if (Array.isArray(rows)) {
      competenciasData = rows;
    } else if (rows && typeof rows === 'object') {
      competenciasData = [rows];
    }

    res.json({
      success: true,
      data: competenciasData
    });
  } catch (error) {
    console.error('❌ Erro ao listar competências:', error);
    res.status(500).json({
      error: 'Erro ao listar competências',
      details: error.message
    });
  } finally {
    if (server) server.close();
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
        DATE_FORMAT(cf.competencia_referencia, '%m/%Y') as competencia_formatada
      FROM compliance_fiscal cf
      LEFT JOIN usuarios_cassems u ON cf.created_by = u.id
      WHERE cf.id = ?
    `, [id]);

    console.log('🔍 Debug - Rows retornadas:', rows);
    console.log('🔍 Debug - Rows length:', rows ? rows.length : 'undefined');

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
  let pool, server;
  try {
    console.log('🔍 Debug - Iniciando criação de competência');
    console.log(' Debug - Body recebido:', req.body);
    
    const { competencia_referencia, created_by } = req.body;
    
    if (!competencia_referencia || !created_by) {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos',
        details: 'competencia_referencia e created_by são obrigatórios'
      });
    }
    
    console.log('🔍 Debug - Dados validados:', { competencia_referencia, created_by });
    
    ({ pool, server } = await getDbPoolWithTunnel());
    console.log('🔍 Debug - Pool obtido com sucesso');
    
    const result = await pool.query(`
      INSERT INTO compliance_fiscal (competencia_referencia, created_by, status)
      VALUES (?, ?, 'pendente')
    `, [competencia_referencia, created_by]);

    console.log('🔍 Debug - Query executada com sucesso');
    console.log('🔍 Debug - Resultado da inserção:', result);
    console.log('🔍 Debug - Tipo do resultado:', typeof result);
    console.log(' Debug - É array?', Array.isArray(result));
    console.log('🔍 Debug - Keys do resultado:', Object.keys(result));

    // O MariaDB retorna o resultado diretamente
    const insertId = result.insertId ? parseInt(result.insertId.toString()) : result.affectedRows;

    console.log('🔍 Debug - Insert ID:', insertId);

    res.json({
      success: true,
      data: {
        id: insertId,
        competencia_referencia,
        status: 'pendente'
      }
    });
  } catch (error) {
    console.error('❌ Erro ao criar competência:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      error: 'Erro ao criar competência',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Atualizar campo específico
exports.updateField = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const { field, value, anexo_id } = req.body;
    
    // Validar campo
    const validFields = [
      'competencia_referencia_texto',
      'relatorio_inicial_texto',
      'relatorio_faturamento_texto',
      'imposto_compensado_texto',
      'emails_texto',
      'valor_compensado_texto',
      'estabelecimento_texto',
      'resumo_folha_pagamento_texto',
      'planilha_quantidade_empregados_texto',
      'decreto_3048_1999_vigente_texto',
      'solucao_consulta_cosit_79_2023_vigente_texto',
      'parecer_texto'
    ];

    if (!validFields.includes(field)) {
      return res.status(400).json({
        error: 'Campo inválido'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Construir query dinamicamente
    let query = `UPDATE compliance_fiscal SET ${field} = ?`;
    let params = [value];
    
    // Se tem anexo, atualizar também o campo de anexo
    if (anexo_id) {
      const anexoField = field.replace('_texto', '_anexo_id');
      query += `, ${anexoField} = ?`;
      params.push(anexo_id);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);

    await pool.query(query, params);

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
    const { field, value, anexo_id } = req.body;
    
    console.log('🔍 Debug - updateComplianceField chamada');
    console.log('🔍 Debug - field:', field);
    console.log('🔍 Debug - value:', value);
    console.log('🔍 Debug - id:', id);
    
    // Se for competencia_referencia, atualizar diretamente no campo principal
    if (field === 'competencia_referencia') {
      ({ pool, server } = await getDbPoolWithTunnel());
      
      await pool.query(`
        UPDATE compliance_fiscal 
        SET competencia_referencia = ? 
        WHERE id = ?
      `, [value, id]);
      
      console.log('✅ Debug - Competência_referencia atualizada diretamente');
      
      return res.json({
        success: true,
        message: 'Competência de referência atualizada com sucesso'
      });
    }
    
    // Mapear campos do frontend para campos do banco
    const fieldMapping = {
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

    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Construir query dinamicamente
    let query = `UPDATE compliance_fiscal SET ${dbField} = ?`;
    let params = [value];
    
    // Se tem anexo, atualizar também o campo de anexo
    if (anexo_id) {
      const anexoField = dbField.replace('_texto', '_anexo_id');
      query += `, ${anexoField} = ?`;
      params.push(anexo_id);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);

    await pool.query(query, params);

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
    
    // TODO: Implementar integração com IA
    // Por enquanto, vamos gerar um parecer básico
    const parecer = `
      PARECER TÉCNICO - COMPETÊNCIA ${competencia.competencia_referencia}
      
      Baseado nos dados fornecidos:
      - Competência de Referência: ${competencia.competencia_referencia}
      - Relatório Inicial: ${competencia.relatorio_inicial_texto || 'Não informado'}
      - Relatório de Faturamento: ${competencia.relatorio_faturamento_texto || 'Não informado'}
      - Imposto Compensado: ${competencia.imposto_compensado_texto || 'Não informado'}
      - Valor Compensado: ${competencia.valor_compensado_texto || 'Não informado'}
      
      [Aqui será implementada a integração com IA para gerar o parecer completo]
    `;

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


