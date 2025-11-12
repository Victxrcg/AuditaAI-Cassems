const { getDbPoolWithTunnel } = require('../lib/db');
const { registrarAlerta } = require('../utils/cronogramaAlerts');

// Normaliza o nome da organização para um código canônico usado no banco
const normalizeOrganization = (org) => {
  if (!org) return '';
  const s = String(org).toLowerCase().trim();
  if (s.includes('maraj') || s.includes('rede frota') || s.includes('rede_frota')) return 'rede_frota';
  if (s.includes('cassems')) return 'cassems';
  if (s.includes('porte')) return 'portes';
  // fallback: trocar espaços por underscore
  return s.replace(/\s+/g, '_');
};

// Função para limpar títulos removendo símbolos estranhos
const limparTitulo = (titulo) => {
  if (!titulo) return '';
  
  return titulo
    .replace(/^[#ó'Ø=Ý\s]+/, '') // Remove símbolos estranhos do início
    .replace(/[#ó'Ø=Ý%Ë]/g, '') // Remove símbolos estranhos específicos dos checklists
    .replace(/^\d+\.\s*/, '') // Remove numeração existente (ex: "1. ")
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .replace(/^[^\w\u00C0-\u017F]/, '') // Remove qualquer caractere não-alfabético do início (incluindo acentos)
    .replace(/\s+/g, ' ') // Remove espaços múltiplos novamente
    .trim(); // Remove espaços no início e fim
};

// Helper para tratar retorno do query
const safeQuery = async (pool, sql, params = []) => {
  const result = await pool.query(sql, params);
  console.log("🧩 safeQuery - result:", result);
  console.log("🧩 safeQuery - typeof result:", typeof result);
  console.log("🧩 safeQuery - Array.isArray(result):", Array.isArray(result));
  
  if (Array.isArray(result)) {
    // Para SELECT queries, retorna o array completo
    console.log("🧩 safeQuery - retornando array completo");
    return result;
  } else if (result && result.rows) {
    // Para queries que retornam { rows: [...] }
    return result.rows;
  } else if (result && typeof result === 'object') {
    // Para INSERT/UPDATE/DELETE queries (OkPacket), retorna o objeto diretamente
    console.log("🧩 safeQuery - retornando objeto OkPacket");
    return result;
  } else {
    console.log("🧩 safeQuery - retornando array vazio");
    return [];
  }
};

// Listar itens do checklist de uma demanda
const listChecklistItems = async (req, res) => {
  let pool, server;
  try {
    const { cronogramaId } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const normalizedOrg = normalizeOrganization(userOrg);

    console.log("🟡 listChecklistItems iniciado:", { cronogramaId, userOrg });

    ({ pool, server } = await getDbPoolWithTunnel());
    console.log("🟢 Conexão DB OK");

    let rows;
    if (normalizedOrg === 'portes') {
      rows = await safeQuery(pool, `
        SELECT id, titulo, descricao, concluido, ordem, data_inicio, data_fim, created_at, updated_at
        FROM cronograma_checklist 
        WHERE cronograma_id = ?
        ORDER BY ordem ASC, id ASC
      `, [cronogramaId]);
    } else {
      // Visível se o item foi criado pela mesma org OU se o cronograma pertence à org do usuário
      rows = await safeQuery(pool, `
        SELECT id, titulo, descricao, concluido, ordem, data_inicio, data_fim, created_at, updated_at
        FROM cronograma_checklist cc
        WHERE cc.cronograma_id = ?
          AND (
            cc.organizacao IN (?, ?) OR 
            EXISTS (
              SELECT 1 FROM cronograma c 
              WHERE c.id = cc.cronograma_id AND c.organizacao IN (?, ?)
            )
          )
        ORDER BY ordem ASC, id ASC
      `, [cronogramaId, normalizedOrg, userOrg, normalizedOrg, userOrg]);
    }

    console.log("🟢 Itens encontrados:", rows?.length || 0);
    console.log("🟡 rows:", rows);
    console.log("🟡 typeof rows:", typeof rows);
    console.log("🟡 Array.isArray(rows):", Array.isArray(rows));

    // Garantir que rows seja sempre um array
    const safeRows = Array.isArray(rows) ? rows : [];
    console.log("🟢 safeRows:", safeRows);

    const items = safeRows.map(item => ({
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
    const { titulo, descricao, data_inicio, data_fim } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const normalizedOrg = normalizeOrganization(userOrg);
    const userIdHeader = req.headers['x-user-id'];
    const numericUserId = userIdHeader ? parseInt(userIdHeader, 10) : null;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ success: false, error: 'Título é obrigatório' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Buscar período da demanda principal para validação
    const demandaRows = await safeQuery(pool, `
      SELECT titulo, organizacao, data_inicio, data_fim
      FROM cronograma 
      WHERE id = ?
    `, [cronogramaId]);

    if (demandaRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demanda não encontrada' });
    }

    const demanda = demandaRows[0];
    
    // Validar datas do checklist se a demanda tem período definido
    if (demanda.data_inicio && demanda.data_fim) {
      const demandaInicio = new Date(demanda.data_inicio);
      const demandaFim = new Date(demanda.data_fim);
      
      if (data_inicio) {
        const checklistInicio = new Date(data_inicio);
        if (checklistInicio < demandaInicio) {
          return res.status(400).json({ 
            success: false, 
            error: `A data de início deve ser posterior a ${demandaInicio.toLocaleDateString('pt-BR')}` 
          });
        }
        if (checklistInicio > demandaFim) {
          return res.status(400).json({ 
            success: false, 
            error: `A data de início deve ser anterior a ${demandaFim.toLocaleDateString('pt-BR')}` 
          });
        }
      }

      if (data_fim) {
        const checklistFim = new Date(data_fim);
        if (checklistFim < demandaInicio) {
          return res.status(400).json({ 
            success: false, 
            error: `A data de fim deve ser posterior a ${demandaInicio.toLocaleDateString('pt-BR')}` 
          });
        }
        if (checklistFim > demandaFim) {
          return res.status(400).json({ 
            success: false, 
            error: `A data de fim deve ser anterior a ${demandaFim.toLocaleDateString('pt-BR')}` 
          });
        }
      }

      if (data_inicio && data_fim) {
        const checklistInicio = new Date(data_inicio);
        const checklistFim = new Date(data_fim);
        if (checklistFim < checklistInicio) {
          return res.status(400).json({ 
            success: false, 
            error: 'A data de fim deve ser posterior à data de início' 
          });
        }
      }
    }

    // Verificar próxima ordem
    const orderRows = await safeQuery(pool, `
      SELECT COALESCE(MAX(ordem), 0) + 1 as next_order
      FROM cronograma_checklist 
      WHERE cronograma_id = ? AND (organizacao = ? OR organizacao = ?)
    `, [cronogramaId, normalizedOrg, userOrg]);

    const nextOrder = orderRows.length > 0 ? Number(orderRows[0].next_order) : 1;
    console.log("🔍 createChecklistItem - nextOrder:", nextOrder);

    // Limpar título e descrição removendo símbolos estranhos
    const tituloLimpo = limparTitulo(titulo);
    const descricaoLimpa = descricao ? limparTitulo(descricao) : descricao;
    console.log(`🔍 Checklist - Título original: "${titulo}" -> Limpo: "${tituloLimpo}"`);
    if (descricao) {
      console.log(`🔍 Checklist - Descrição original: "${descricao}" -> Limpa: "${descricaoLimpa}"`);
    }

    const insertResult = await safeQuery(pool, `
      INSERT INTO cronograma_checklist (
        cronograma_id, titulo, descricao, ordem, data_inicio, data_fim, created_by, organizacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [cronogramaId, tituloLimpo, descricaoLimpa, nextOrder, data_inicio, data_fim, numericUserId, normalizedOrg]);

    const insertId = insertResult.insertId || (insertResult[0]?.insertId);
    if (!insertId) {
      return res.status(500).json({ success: false, error: 'Erro ao criar item' });
    }

    const newItemRows = await safeQuery(pool, `
      SELECT id, titulo, descricao, concluido, ordem, data_inicio, data_fim, created_at, updated_at
      FROM cronograma_checklist 
      WHERE id = ?
    `, [insertId]);

    if (!newItemRows || newItemRows.length === 0) {
      return res.status(500).json({ success: false, error: 'Erro ao buscar item criado' });
    }

    const newItem = newItemRows[0];

    // Normalizar organização da demanda para garantir consistência
    const demandaOrgNormalizada = demanda.organizacao 
      ? normalizeOrganization(demanda.organizacao) 
      : normalizedOrg;
    const alertaOrganizacao = demandaOrgNormalizada || normalizedOrg;
    
    console.log('🔔 Criando alerta de checklist:', {
      tipo: 'checklist',
      cronogramaId: Number(cronogramaId),
      checklistId: Number(newItem.id),
      organizacao: alertaOrganizacao,
      organizacaoOriginal: demanda.organizacao,
      organizacaoNormalizada: demandaOrgNormalizada,
      titulo: `Checklist adicionado: ${tituloLimpo}`,
      userId: numericUserId
    });
    
    await registrarAlerta({
      tipo: 'checklist',
      cronogramaId: Number(cronogramaId),
      checklistId: Number(newItem.id),
      organizacao: alertaOrganizacao,
      titulo: `Checklist adicionado: ${tituloLimpo}`,
      descricao: demanda.titulo ? `Demanda: ${demanda.titulo}` : null,
      userId: numericUserId
    });

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
    const { titulo, descricao, concluido, ordem, data_inicio, data_fim } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const normalizedOrg = normalizeOrganization(userOrg);

    // Somente usuários Portes podem editar
    if (normalizedOrg !== 'portes') {
      return res.status(403).json({ success: false, error: 'Sem permissão para editar' });
    }

    const updateFields = [];
    const updateValues = [];

    if (titulo !== undefined) { 
      const tituloLimpo = limparTitulo(titulo);
      console.log(`🔍 Atualização Checklist - Título original: "${titulo}" -> Limpo: "${tituloLimpo}"`);
      updateFields.push('titulo = ?'); 
      updateValues.push(tituloLimpo); 
    }
    if (descricao !== undefined) { 
      const descricaoLimpa = limparTitulo(descricao);
      console.log(`🔍 Atualização Checklist - Descrição original: "${descricao}" -> Limpa: "${descricaoLimpa}"`);
      updateFields.push('descricao = ?'); 
      updateValues.push(descricaoLimpa); 
    }
    if (concluido !== undefined) { updateFields.push('concluido = ?'); updateValues.push(concluido); }
    if (ordem !== undefined) { updateFields.push('ordem = ?'); updateValues.push(ordem); }
    if (data_inicio !== undefined) { updateFields.push('data_inicio = ?'); updateValues.push(data_inicio); }
    if (data_fim !== undefined) { updateFields.push('data_fim = ?'); updateValues.push(data_fim); }

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
      SELECT id, titulo, descricao, concluido, ordem, data_inicio, data_fim, created_at, updated_at
      FROM cronograma_checklist 
      WHERE id = ?
    `, [itemId]);

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
    const normalizedOrg = normalizeOrganization(userOrg);

    // Somente usuários Portes podem excluir
    if (normalizedOrg !== 'portes') {
      return res.status(403).json({ success: false, error: 'Sem permissão para excluir' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    const deleteResult = await safeQuery(pool, `
      DELETE FROM cronograma_checklist 
      WHERE cronograma_id = ? AND id = ?
    `, [cronogramaId, itemId]);

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
