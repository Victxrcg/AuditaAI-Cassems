const { getDbPoolWithTunnel } = require('../lib/db');

// 🟢 Listar itens do checklist de uma demanda
const listChecklistItems = async (req, res) => {
  let pool, server;
  try {
    console.log("🟡 listChecklistItems iniciado:", req.params);
    const { cronogramaId } = req.params;

    console.log("🟡 Conectando ao banco...");
    ({ pool, server } = await getDbPoolWithTunnel());
    console.log("🟢 Conexão DB OK");

    console.log("🟡 Executando query...");
    const [rows] = await pool.query(`
      SELECT 
        id,
        titulo,
        descricao,
        concluido,
        ordem,
        created_at,
        updated_at
      FROM cronograma_checklist 
      WHERE cronograma_id = ?
      ORDER BY ordem ASC, id ASC
    `, [cronogramaId]);

    console.log("🟢 Itens encontrados:", rows.length);

    // Converter concluido para boolean
    const items = rows.map(item => ({
      ...item,
      concluido: Boolean(item?.concluido ?? 0)
    }));

    res.json({ success: true, data: items });
  } catch (error) {
    console.error("🔴 Erro em listChecklistItems:", error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// 🟢 Criar novo item do checklist
const createChecklistItem = async (req, res) => {
  let pool, server;
  try {
    console.log("🟡 createChecklistItem iniciado:", req.params, req.body);
    const { cronogramaId } = req.params;
    const { titulo, descricao } = req.body;
    const userId = req.headers['x-user-id'];

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Título é obrigatório'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    console.log("🟢 Conexão DB OK");

    // Obter próxima ordem
    const [orderRows] = await pool.query(`
      SELECT COALESCE(MAX(ordem), 0) + 1 AS next_order
      FROM cronograma_checklist
      WHERE cronograma_id = ?
    `, [cronogramaId]);

    const nextOrder = orderRows[0]?.next_order || 1;
    console.log("🟡 Próxima ordem:", nextOrder);

    // Inserir novo item
    const [insertResult] = await pool.query(`
      INSERT INTO cronograma_checklist (
        cronograma_id, titulo, descricao, ordem, created_by
      ) VALUES (?, ?, ?, ?, ?)
    `, [cronogramaId, titulo, descricao, nextOrder, userId]);

    console.log("🟢 Novo item inserido com ID:", insertResult.insertId);

    // Buscar item criado
    const [newItemRows] = await pool.query(`
      SELECT 
        id,
        titulo,
        descricao,
        concluido,
        ordem,
        created_at,
        updated_at
      FROM cronograma_checklist 
      WHERE id = ?
    `, [insertResult.insertId]);

    const newItem = newItemRows[0] || {};
    const itemData = {
      ...newItem,
      concluido: Boolean(newItem?.concluido ?? 0)
    };

    res.status(201).json({ success: true, data: itemData });
  } catch (error) {
    console.error('❌ Erro ao criar item do checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// 🟢 Atualizar item do checklist
const updateChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId, itemId } = req.params;
    const { titulo, descricao, concluido, ordem } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (titulo !== undefined) {
      updateFields.push('titulo = ?');
      updateValues.push(titulo);
    }
    if (descricao !== undefined) {
      updateFields.push('descricao = ?');
      updateValues.push(descricao);
    }
    if (concluido !== undefined) {
      updateFields.push('concluido = ?');
      updateValues.push(concluido);
    }
    if (ordem !== undefined) {
      updateFields.push('ordem = ?');
      updateValues.push(ordem);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo para atualizar'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    updateValues.push(cronogramaId, itemId);

    await pool.query(`
      UPDATE cronograma_checklist 
      SET ${updateFields.join(', ')}
      WHERE cronograma_id = ? AND id = ?
    `, updateValues);

    const [updatedItemRows] = await pool.query(`
      SELECT 
        id,
        titulo,
        descricao,
        concluido,
        ordem,
        created_at,
        updated_at
      FROM cronograma_checklist 
      WHERE id = ?
    `, [itemId]);

    if (updatedItemRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item não encontrado'
      });
    }

    const item = updatedItemRows[0];
    const itemData = {
      ...item,
      concluido: Boolean(item?.concluido ?? 0)
    };

    res.json({ success: true, data: itemData });
  } catch (error) {
    console.error('Erro ao atualizar item do checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  } finally {
    if (server) server.close();
  }
};

// 🟢 Excluir item do checklist
const deleteChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId, itemId } = req.params;

    ({ pool, server } = await getDbPoolWithTunnel());

    const [deleteResult] = await pool.query(`
      DELETE FROM cronograma_checklist 
      WHERE cronograma_id = ? AND id = ?
    `, [cronogramaId, itemId]);

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item não encontrado'
      });
    }

    res.json({ success: true, message: 'Item excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir item do checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
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