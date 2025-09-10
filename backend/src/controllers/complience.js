const { getDbPoolWithTunnel } = require('../lib/db');

// Listar todas as competências de compliance
exports.listarCompliance = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [rows] = await pool.query(`
      SELECT 
        cf.*,
        u.nome as created_by_nome
      FROM compliance_fiscal cf
      LEFT JOIN usuarios_cassems u ON cf.created_by = u.id
      ORDER BY cf.competencia_referencia DESC, cf.created_at DESC
    `);
    
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar compliance:', err);
    res.status(500).json({ 
      error: 'Erro ao buscar dados de compliance', 
      details: err.message 
    });
  }
};

// Buscar uma competência específica
exports.buscarCompliance = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [rows] = await pool.query(`
      SELECT 
        cf.*,
        u.nome as created_by_nome
      FROM compliance_fiscal cf
      LEFT JOIN usuarios_cassems u ON cf.created_by = u.id
      WHERE cf.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Competência não encontrada' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Erro ao buscar compliance:', err);
    res.status(500).json({ 
      error: 'Erro ao buscar competência', 
      details: err.message 
    });
  }
};

// Criar nova competência
exports.criarCompliance = async (req, res) => {
  let pool, server;
  try {
    const {
      competencia_referencia,
      relatorio_inicial_texto,
      relatorio_faturamento_texto,
      imposto_compensado_texto,
      emails_texto,
      valor_compensado_texto,
      estabelecimento_texto,
      resumo_folha_pagamento_texto,
      planilha_quantidade_empregados_texto,
      decreto_3048_1999_vigente_texto,
      solucao_consulta_cosit_79_2023_vigente_texto,
      parecer_texto,
      status = 'pendente'
    } = req.body;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const [result] = await pool.query(`
      INSERT INTO compliance_fiscal (
        competencia_referencia,
        relatorio_inicial_texto,
        relatorio_faturamento_texto,
        imposto_compensado_texto,
        emails_texto,
        valor_compensado_texto,
        estabelecimento_texto,
        resumo_folha_pagamento_texto,
        planilha_quantidade_empregados_texto,
        decreto_3048_1999_vigente_texto,
        solucao_consulta_cosit_79_2023_vigente_texto,
        parecer_texto,
        status,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      competencia_referencia,
      relatorio_inicial_texto || null,
      relatorio_faturamento_texto || null,
      imposto_compensado_texto || null,
      emails_texto || null,
      valor_compensado_texto || null,
      estabelecimento_texto || null,
      resumo_folha_pagamento_texto || null,
      planilha_quantidade_empregados_texto || null,
      decreto_3048_1999_vigente_texto || null,
      solucao_consulta_cosit_79_2023_vigente_texto || null,
      parecer_texto || null,
      status,
      1 // TODO: Pegar do usuário logado
    ]);
    
    // Buscar o registro criado
    const [newRecord] = await pool.query(`
      SELECT * FROM compliance_fiscal WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Competência criada com sucesso',
      data: newRecord[0]
    });
  } catch (err) {
    console.error('❌ Erro ao criar compliance:', err);
    res.status(500).json({ 
      error: 'Erro ao criar competência', 
      details: err.message 
    });
  }
};

// Atualizar competência
exports.atualizarCompliance = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remover campos que não devem ser atualizados
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;
    
    // Adicionar updated_at
    updateData.updated_at = new Date();
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Construir query dinamicamente
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${setClause}
      WHERE id = ?
    `, [...values, id]);
    
    // Buscar o registro atualizado
    const [updatedRecord] = await pool.query(`
      SELECT * FROM compliance_fiscal WHERE id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Competência atualizada com sucesso',
      data: updatedRecord[0]
    });
  } catch (err) {
    console.error('❌ Erro ao atualizar compliance:', err);
    res.status(500).json({ 
      error: 'Erro ao atualizar competência', 
      details: err.message 
    });
  }
};

// Deletar competência
exports.deletarCompliance = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    await pool.query('DELETE FROM compliance_fiscal WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Competência deletada com sucesso'
    });
  } catch (err) {
    console.error('❌ Erro ao deletar compliance:', err);
    res.status(500).json({ 
      error: 'Erro ao deletar competência', 
      details: err.message 
    });
  }
};

// Upload de anexo
exports.uploadAnexo = async (req, res) => {
  let pool, server;
  try {
    const { complianceId, tipoAnexo } = req.params;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Inserir anexo
    const [result] = await pool.query(`
      INSERT INTO compliance_anexos (
        compliance_id,
        nome_arquivo,
        caminho_arquivo,
        file_data,
        tamanho_arquivo,
        tipo_mime,
        tipo_anexo,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      complianceId,
      file.originalname,
      file.path,
      file.buffer,
      file.size,
      file.mimetype,
      tipoAnexo,
      1 // TODO: Pegar do usuário logado
    ]);
    
    // Atualizar o campo de anexo na tabela principal
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${tipoAnexo}_anexo_id = ?
      WHERE id = ?
    `, [result.insertId, complianceId]);
    
    res.json({
      success: true,
      message: 'Anexo enviado com sucesso',
      anexoId: result.insertId
    });
  } catch (err) {
    console.error('❌ Erro ao fazer upload:', err);
    res.status(500).json({ 
      error: 'Erro ao fazer upload do anexo', 
      details: err.message 
    });
  }
};