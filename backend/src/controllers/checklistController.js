const { getDbPoolWithTunnel } = require('../lib/db');

// Listar itens do checklist de uma demanda
const listChecklistItems = async (req, res) => {
  let pool, server;
  try {
    console.log("🟡 listChecklistItems iniciado:", req.params);
    const { cronogramaId } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    console.log("🟡 Parâmetros:", { cronogramaId, userOrg });

    console.log("🟡 Conectando ao banco...");
    [pool, server] = await getDbPoolWithTunnel();
    console.log("🟢 Conexão DB OK");

    console.log("🟡 Executando query...");
    const result = await pool.query(`
      SELECT 
        id,
        titulo,
        descricao,
        concluido,
        ordem,
        created_at,
        updated_at
      FROM cronograma_checklist 
      WHERE cronograma_id = ? AND organizacao = ?
      ORDER BY ordem ASC, id ASC
    `, [cronogramaId, userOrg]);

    console.log("🟢 Query executada com sucesso");
    console.log("🧩 Tipo de result:", typeof result);
    console.log("🧩 result é array?", Array.isArray(result));
    console.log("🧩 Conteúdo result:", result);

    // Leitura defensiva do resultado
    const rows = Array.isArray(result) ? result[0] : (result.rows || []);
    console.log("🟡 Rows extraídas:", rows);
    console.log("🟡 Quantidade de itens:", rows?.length || 'undefined');
    console.log("🟡 Tipo de rows:", typeof rows);
    console.log("🟡 É array?", Array.isArray(rows));

    // Converter concluido de number para boolean
    console.log("🟡 Processando itens...");
    const items = rows.map(item => ({
      ...item,
      concluido: Boolean(item?.concluido ?? 0)
    }));
    
    console.log("🟢 Items processados:", items);
    console.log("🟢 Quantidade final:", items.length);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error("🔴 Erro em listChecklistItems:", error);
    console.error("🔴 Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  } finally {
    if (server) {
      console.log("🟡 Fechando conexão...");
      server.close();
    }
  }
};

// Criar novo item do checklist
const createChecklistItem = async (req, res) => {
  let pool, server;
  try {
    console.log("🟡 createChecklistItem iniciado:", req.params, req.body);
    const { cronogramaId } = req.params;
    const { titulo, descricao } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'];
    console.log("🟡 Parâmetros:", { cronogramaId, titulo, descricao, userOrg, userId });

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Título é obrigatório'
      });
    }

    console.log("🟡 Conectando ao banco...");
    [pool, server] = await getDbPoolWithTunnel();
    console.log("🟢 Conexão DB OK");

    // Verificar se a tabela existe
    try {
      await pool.query('SELECT 1 FROM cronograma_checklist LIMIT 1');
    } catch (tableError) {
      return res.status(500).json({
        success: false,
        error: 'Tabela cronograma_checklist não existe. Execute o script SQL primeiro.'
      });
    }

    // Obter próxima ordem
    console.log("🟡 Buscando próxima ordem...");
    const orderResult = await pool.query(`
      SELECT COALESCE(MAX(ordem), 0) + 1 as next_order
      FROM cronograma_checklist 
      WHERE cronograma_id = ? AND organizacao = ?
    `, [cronogramaId, userOrg]);
    
    console.log("🧩 orderResult:", orderResult);
    const orderRows = Array.isArray(orderResult) ? orderResult[0] : (orderResult.rows || []);
    console.log("🟡 orderRows extraídas:", orderRows);
    
    let nextOrder = 1;
    if (orderRows && orderRows.length > 0) {
      const rawValue = orderRows[0].next_order;
      nextOrder = Number(rawValue);
    }
    
    console.log("🟡 nextOrder calculado:", nextOrder);

    // Inserir novo item
    console.log("🟡 Inserindo novo item...");
    const insertResult = await pool.query(`
      INSERT INTO cronograma_checklist (
        cronograma_id, titulo, descricao, ordem, created_by, organizacao
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [cronogramaId, titulo, descricao, nextOrder, userId, userOrg]);

    console.log("🧩 insertResult:", insertResult);
    const insertData = Array.isArray(insertResult) ? insertResult[0] : insertResult;
    console.log("🟡 insertData:", insertData);
    console.log("🟡 insertId:", insertData.insertId);

    // Buscar item criado
    console.log("🟡 Buscando item criado...");
    const newItemResult = await pool.query(`
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
    `, [insertData.insertId]);
    
    console.log("🧩 newItemResult:", newItemResult);
    const newItemRows = Array.isArray(newItemResult) ? newItemResult[0] : (newItemResult.rows || []);
    console.log("🟡 newItemRows extraídas:", newItemRows);
    
    // Validação robusta
    if (!Array.isArray(newItemRows) || newItemRows.length === 0) {
      console.error('⚠️ Nenhum registro retornado ao buscar item criado.');
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar item criado'
      });
    }
    
    const newItem = newItemRows[0] || {};
    console.log("🟡 newItem:", newItem);
    
    const itemData = {
      ...newItem,
      concluido: Boolean(newItem?.concluido ?? 0)
    };
    
    console.log("🟢 itemData final:", itemData);

    res.status(201).json({
      success: true,
      data: itemData
    });
  } catch (error) {
    console.error('❌ Erro detalhado ao criar item do checklist:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  } finally {
    if (server) {
      server.close();
    }
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

    [pool, server] = await getDbPoolWithTunnel();

    updateValues.push(cronogramaId, itemId, userOrg);

    await pool.query(`
      UPDATE cronograma_checklist 
      SET ${updateFields.join(', ')}
      WHERE cronograma_id = ? AND id = ? AND organizacao = ?
    `, updateValues);

    const updatedItemResult = await pool.query(`
      SELECT 
        id,
        titulo,
        descricao,
        concluido,
        ordem,
        created_at,
        updated_at
      FROM cronograma_checklist 
      WHERE id = ? AND organizacao = ?
    `, [itemId, userOrg]);

    console.log("🧩 updatedItemResult:", updatedItemResult);
    const updatedItemRows = Array.isArray(updatedItemResult) ? updatedItemResult[0] : (updatedItemResult.rows || []);
    console.log("🟡 updatedItemRows extraídas:", updatedItemRows);

    if (!Array.isArray(updatedItemRows) || updatedItemRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item não encontrado'
      });
    }

    const item = updatedItemRows[0] || {};
    const itemData = {
      ...item,
      concluido: Boolean(item?.concluido ?? 0)
    };

    res.json({
      success: true,
      data: itemData
    });
  } catch (error) {
    console.error('Erro ao atualizar item do checklist:', error);
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

// Excluir item do checklist
const deleteChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId, itemId } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    [pool, server] = await getDbPoolWithTunnel();

    const deleteResult = await pool.query(`
      DELETE FROM cronograma_checklist 
      WHERE cronograma_id = ? AND id = ? AND organizacao = ?
    `, [cronogramaId, itemId, userOrg]);

    console.log("🧩 deleteResult:", deleteResult);
    const deleteData = Array.isArray(deleteResult) ? deleteResult[0] : deleteResult;
    console.log("🟡 deleteData:", deleteData);

    if (deleteData.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Item excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir item do checklist:', error);
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

module.exports = {
  listChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem
};
