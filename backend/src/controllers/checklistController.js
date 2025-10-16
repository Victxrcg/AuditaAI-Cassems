const { getDbPoolWithTunnel } = require('../lib/db');

// Helper para tratar retorno do query
const safeQuery = async (pool, sql, params = []) => {
  const result = await pool.query(sql, params);
  return Array.isArray(result) ? result[0] : (result.rows || []);
};

// Listar itens do checklist de uma demanda
const listChecklistItems = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    console.log("🟡 listChecklistItems iniciado:", { cronogramaId, userOrg });

    ({ pool, server } = await getDbPoolWithTunnel());
    console.log("🟢 Conexão DB OK");

    const rows = await safeQuery(pool, `
      SELECT id, titulo, descricao, concluido, ordem, created_at, updated_at
      FROM cronograma_checklist 
      WHERE cronograma_id = ? AND organizacao = ?
      ORDER BY ordem ASC, id ASC
    `, [cronogramaId, userOrg]);

    console.log("🟢 Itens encontrados:", rows.length);

    const items = rows.map(item => ({
      ...item,
      concluido: Boolean(item?.concluido ?? 0)
    }));

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error("🔴 Erro em listChecklistItems:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Criar novo item do checklist
const createChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId } = req.params;
    const { titulo, descricao } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'];

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ success: false, error: 'Título é obrigatório' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar próxima ordem
    const orderRows = await safeQuery(pool, `
      SELECT COALESCE(MAX(ordem), 0) + 1 as next_order
      FROM cronograma_checklist 
      WHERE cronograma_id = ? AND organizacao = ?
    `, [cronogramaId, userOrg]);

    const nextOrder = orderRows.length > 0 ? Number(orderRows[0].next_order) : 1;
    console.log("🔍 createChecklistItem - nextOrder:", nextOrder);

    const insertResult = await safeQuery(pool, `
      INSERT INTO cronograma_checklist (
        cronograma_id, titulo, descricao, ordem, created_by, organizacao
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [cronogramaId, titulo, descricao, nextOrder, userId, userOrg]);

    const insertId = insertResult.insertId || (insertResult[0]?.insertId);
    if (!insertId) {
      return res.status(500).json({ success: false, error: 'Erro ao criar item' });
    }

    const newItemRows = await safeQuery(pool, `
      SELECT id, titulo, descricao, concluido, ordem, created_at, updated_at
      FROM cronograma_checklist 
      WHERE id = ?
    `, [insertId]);

    if (!newItemRows || newItemRows.length === 0) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar item criado' });
    }

    const newItem = newItemRows[0];
    res.status(201).json({
      success: true,
      data: {
        ...newItem,
        concluido: Boolean(newItem?.concluido ?? 0)
      }
    });
  } catch (error) {
    console.error('❌ Erro detalhado ao criar item do checklist:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (server) server.close();
  }
};

// Atualizar item do checklist
const updateChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId, itemId } = req.params;
    const { titulo, descricao, concluido, ordem } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    const updateFields = [];
    const updateValues = [];

    if (titulo !== undefined) { updateFields.push('titulo = ?'); updateValues.push(titulo); }
    if (descricao !== undefined) { updateFields.push('descricao = ?'); updateValues.push(descricao); }
    if (concluido !== undefined) { updateFields.push('concluido = ?'); updateValues.push(concluido); }
    if (ordem !== undefined) { updateFields.push('ordem = ?'); updateValues.push(ordem); }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    updateValues.push(cronogramaId, itemId, userOrg);

    await pool.query(`
      UPDATE cronograma_checklist 
      SET ${updateFields.join(', ')}
      WHERE cronograma_id = ? AND id = ? AND organizacao = ?
    `, updateValues);

    const updatedRows = await safeQuery(pool, `
      SELECT id, titulo, descricao, concluido, ordem, created_at, updated_at
      FROM cronograma_checklist 
      WHERE id = ? AND organizacao = ?
    `, [itemId, userOrg]);

    if (!updatedRows || updatedRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item não encontrado' });
    }

    const item = updatedRows[0];
    res.json({
      success: true,
      data: { ...item, concluido: Boolean(item?.concluido ?? 0) }
    });
  } catch (error) {
    console.error('Erro ao atualizar item do checklist:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (server) server.close();
  }
};

// Excluir item do checklist
const deleteChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId, itemId } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    ({ pool, server } = await getDbPoolWithTunnel());

    const deleteResult = await safeQuery(pool, `
      DELETE FROM cronograma_checklist 
      WHERE cronograma_id = ? AND id = ? AND organizacao = ?
    `, [cronogramaId, itemId, userOrg]);

    if (!deleteResult || deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Item não encontrado' });
    }

    res.json({ success: true, message: 'Item excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir item do checklist:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (server) server.close();
  }
};

module.exports = {
  listChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem
};
