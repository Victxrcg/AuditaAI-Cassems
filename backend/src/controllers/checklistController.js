const { getDbPoolWithTunnel } = require('../lib/db');

// Listar itens do checklist de uma demanda
const listChecklistItems = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    ({ pool, server } = await getDbPoolWithTunnel());

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

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Erro ao listar itens do checklist:', error);
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

// Criar novo item do checklist
const createChecklistItem = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId } = req.params;
    const { titulo, descricao } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'];

    console.log('🔍 Debug - createChecklistItem:', {
      cronogramaId,
      titulo,
      descricao,
      userOrg,
      userId
    });

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Título é obrigatório'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    console.log('🔍 Debug - Pool conectado, verificando tabela...');

    // Verificar se a tabela existe
    try {
      await pool.query('SELECT 1 FROM cronograma_checklist LIMIT 1');
      console.log('✅ Tabela cronograma_checklist existe');
    } catch (tableError) {
      console.error('❌ Erro na tabela cronograma_checklist:', tableError);
      return res.status(500).json({
        success: false,
        error: 'Tabela cronograma_checklist não existe. Execute o script SQL primeiro.'
      });
    }

    // Obter próxima ordem
    console.log('🔍 Debug - Obtendo próxima ordem...');
    const orderResult = await pool.query(`
      SELECT COALESCE(MAX(ordem), 0) + 1 as next_order
      FROM cronograma_checklist 
      WHERE cronograma_id = ? AND organizacao = ?
    `, [cronogramaId, userOrg]);

    console.log('🔍 Debug - Resultado da query ordem:', orderResult);
    console.log('🔍 Debug - Tipo do resultado:', typeof orderResult);
    console.log('🔍 Debug - Length do resultado:', orderResult[0]?.length);
    
    let nextOrder = 1;
    if (orderResult && orderResult[0] && orderResult[0].length > 0) {
      const rawValue = orderResult[0][0].next_order;
      console.log('🔍 Debug - Valor bruto:', rawValue, 'Tipo:', typeof rawValue);
      nextOrder = Number(rawValue);
    }
    console.log('🔍 Debug - Próxima ordem final:', nextOrder);

    console.log('🔍 Debug - Inserindo item...');
    const insertResult = await pool.query(`
      INSERT INTO cronograma_checklist (
        cronograma_id, titulo, descricao, ordem, created_by, organizacao
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [cronogramaId, titulo, descricao, nextOrder, userId, userOrg]);

    console.log('🔍 Debug - Resultado da inserção:', insertResult);
    console.log('🔍 Debug - Item inserido, ID:', insertResult.insertId);

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
    `, [insertResult.insertId]);
    
    console.log('🔍 Debug - Resultado da busca do item:', newItemResult);
    const newItem = newItemResult[0];

    console.log('🔍 Debug - Item criado com sucesso:', newItem[0]);

    res.status(201).json({
      success: true,
      data: newItem[0]
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

    ({ pool, server } = await getDbPoolWithTunnel());

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

    if (updatedItemResult[0].length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item não encontrado'
      });
    }

    res.json({
      success: true,
      data: updatedItemResult[0][0]
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

    ({ pool, server } = await getDbPoolWithTunnel());

    const deleteResult = await pool.query(`
      DELETE FROM cronograma_checklist 
      WHERE cronograma_id = ? AND id = ? AND organizacao = ?
    `, [cronogramaId, itemId, userOrg]);

    if (deleteResult[0].affectedRows === 0) {
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
