// backend/src/controllers/cronogramaController.js
const { getDbPoolWithTunnel, executeQueryWithRetry } = require('../lib/db');
const { ensureTables: ensureCronogramaAlertTables, registrarAlerta } = require('../utils/cronogramaAlerts');

// Normaliza o nome da organização para um código canônico usado no banco
const normalizeOrganization = (org) => {
  if (!org) return '';
  const s = String(org).toLowerCase().trim();
  // Se já é "Marajó / Rede Frota", manter como está (organização existente)
  if (org === 'Marajó / Rede Frota') return 'Marajó / Rede Frota';
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
    .replace(/[#ó'Ø=Ý]/g, '') // Remove símbolos estranhos em qualquer lugar
    .replace(/^\d+\.\s*/, '') // Remove numeração existente (ex: "1. ")
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .replace(/^[^\w\u00C0-\u017F]/, '') // Remove qualquer caractere não-alfabético do início (incluindo acentos)
    .replace(/\s+/g, ' ') // Remove espaços múltiplos novamente
    .trim(); // Remove espaços no início e fim
};

// Listar cronogramas filtrados por organização
exports.listarCronogramas = async (req, res) => {
  try {
    // Obter organização do usuário logado
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    let query = `
      SELECT 
        c.*,
        u.nome as responsavel_nome,
        u.email as responsavel_email,
        u.organizacao as responsavel_organizacao,
        u.nome_empresa as responsavel_empresa
      FROM cronograma c
      LEFT JOIN usuarios_cassems u ON c.responsavel_id = u.id
    `;
    
    let params = [];
    const orgFiltro = req.query.organizacao;
    
    // Se não for Portes, filtrar apenas cronogramas da mesma organização
    if (userOrganization && userOrganization !== 'portes') {
      query += ` WHERE c.organizacao = ?`;
      params.push(userOrganization);
      console.log(`🔍 Filtro aplicado para organização: "${userOrganization}"`);
    } else if (userOrganization === 'portes') {
      // Portes pode ver todas ou filtrar por uma específica
      if (orgFiltro && orgFiltro !== 'todos') {
        query += ` WHERE c.organizacao = ?`;
        params.push(orgFiltro);
        console.log(`🔍 Usuário Portes - filtrando por organização: "${orgFiltro}"`);
      } else {
        console.log(`🔍 Usuário Portes - sem filtro de organização (todos)`);
      }
    }
    
    query += ` ORDER BY c.prioridade DESC, c.data_inicio ASC, c.created_at DESC`;
    
    console.log('🔍 Query cronogramas:', query);
    console.log('🔍 Organização do usuário:', userOrganization);
    
    const rows = await executeQueryWithRetry(query, params);
    
    console.log('📋 Cronogramas encontrados:', rows.length);
    if (rows.length > 0) {
      console.log('🔍 Primeiro cronograma (exemplo):', {
        id: rows[0].id,
        titulo: rows[0].titulo,
        organizacao: rows[0].organizacao,
        data_inicio: rows[0].data_inicio,
        data_fim: rows[0].data_fim,
        tipo_data_inicio: typeof rows[0].data_inicio
      });
      
      // Mostrar todas as organizações únicas encontradas
      const organizacoesUnicas = [...new Set(rows.map(row => row.organizacao))];
      console.log('🏢 Organizações encontradas:', organizacoesUnicas);
    }
    
    // Converter BigInt para Number se necessário
    const processedRows = rows.map(row => {
      const processedRow = { ...row };
      Object.keys(processedRow).forEach(key => {
        if (typeof processedRow[key] === 'bigint') {
          processedRow[key] = Number(processedRow[key]);
        }
      });
      return processedRow;
    });
    
    res.json(processedRows);
  } catch (error) {
    console.error('❌ Erro ao listar cronogramas:', error);
    res.status(500).json({
      error: 'Erro ao listar cronogramas',
      details: error.message
    });
  }
};

// Criar novo cronograma
exports.criarCronograma = async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      organizacao,
      fase_atual = 'inicio',
      data_inicio,
      data_fim,
      responsavel_id,
      prioridade = 'media',
      observacoes,
      status = 'pendente',
      motivo_atraso
    } = req.body;
    const userIdHeader = req.headers['x-user-id'] || req.body.created_by;
    const createdByUserId = userIdHeader ? parseInt(userIdHeader, 10) : null;
    
    if (!titulo || !organizacao) {
      return res.status(400).json({
        error: 'Título e organização são obrigatórios'
      });
    }
    
    // Normalizar organização para garantir consistência
    const organizacaoNormalizada = normalizeOrganization(organizacao);
    console.log(`🔍 Organização original: "${organizacao}" -> Normalizada: "${organizacaoNormalizada}"`);
    
    // Limpar título removendo símbolos estranhos
    const tituloLimpo = limparTitulo(titulo);
    console.log(`🔍 Título original: "${titulo}" -> Limpo: "${tituloLimpo}"`);
    
    // Tratar datas vazias como NULL
    const dataInicio = (data_inicio && data_inicio !== '') ? data_inicio : null;
    const dataFim = (data_fim && data_fim !== '') ? data_fim : null;
    
    const result = await executeQueryWithRetry(`
      INSERT INTO cronograma (
        titulo, descricao, organizacao, fase_atual, data_inicio, data_fim,
        responsavel_id, prioridade, observacoes, status, motivo_atraso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tituloLimpo,
      descricao,
      organizacaoNormalizada,
      fase_atual,
      dataInicio,
      dataFim,
      responsavel_id,
      prioridade,
      observacoes,
      status,
      motivo_atraso || null
    ]);
    
    // Buscar o cronograma criado
    const newCronograma = await executeQueryWithRetry(`
      SELECT 
        c.*,
        u.nome as responsavel_nome,
        u.email as responsavel_email,
        u.organizacao as responsavel_organizacao,
        u.nome_empresa as responsavel_empresa
      FROM cronograma c
      LEFT JOIN usuarios_cassems u ON c.responsavel_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);
    
    // Converter BigInt para Number se necessário
    const cronograma = newCronograma[0];
    if (cronograma) {
      Object.keys(cronograma).forEach(key => {
        if (typeof cronograma[key] === 'bigint') {
          cronograma[key] = Number(cronograma[key]);
        }
      });
    }
    
    if (cronograma) {
      await registrarAlerta({
        tipo: 'cronograma',
        cronogramaId: Number(cronograma.id),
        checklistId: null,
        organizacao: cronograma.organizacao || organizacaoNormalizada,
        titulo: `Nova demanda adicionada: ${cronograma.titulo}`,
        descricao: cronograma.descricao || null,
        userId: createdByUserId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Cronograma criado com sucesso',
      data: cronograma
    });
  } catch (error) {
    console.error('❌ Erro ao criar cronograma:', error);
    res.status(500).json({
      error: 'Erro ao criar cronograma',
      details: error.message
    });
  }
};

// Atualizar cronograma
exports.atualizarCronograma = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      descricao,
      fase_atual,
      data_inicio,
      data_fim,
      responsavel_id,
      prioridade,
      status,
      observacoes,
      motivo_atraso
    } = req.body;
    
    
    
    // Construir query dinamicamente para evitar conflitos de collation
    const updates = [];
    const params = [];
    
    if (titulo !== undefined) { 
      const tituloLimpo = limparTitulo(titulo);
      console.log(`🔍 Atualização - Título original: "${titulo}" -> Limpo: "${tituloLimpo}"`);
      updates.push('titulo = ?'); 
      params.push(tituloLimpo); 
    }
    if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao); }
    if (fase_atual !== undefined) { updates.push('fase_atual = ?'); params.push(fase_atual); }
    if (data_inicio !== undefined) { 
      if (data_inicio !== '' && data_inicio !== null) {
        updates.push('data_inicio = ?'); 
        params.push(data_inicio); 
      } else {
        updates.push('data_inicio = NULL'); 
      }
    }
    if (data_fim !== undefined) { 
      if (data_fim !== '' && data_fim !== null) {
        updates.push('data_fim = ?'); 
        params.push(data_fim); 
      } else {
        updates.push('data_fim = NULL'); 
      }
    }
    if (responsavel_id !== undefined) { updates.push('responsavel_id = ?'); params.push(responsavel_id); }
    if (prioridade !== undefined) { updates.push('prioridade = ?'); params.push(prioridade); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (observacoes !== undefined) { updates.push('observacoes = ?'); params.push(observacoes); }
    if (motivo_atraso !== undefined) { updates.push('motivo_atraso = ?'); params.push(motivo_atraso); }
    
    // Sempre atualizar data_ultima_atualizacao e updated_at
    updates.push('data_ultima_atualizacao = CURDATE()');
    updates.push('updated_at = NOW()');
    
    params.push(id);
    
    const updateQuery = `
      UPDATE cronograma 
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    
    await executeQueryWithRetry(updateQuery, params);
    
    // Buscar o cronograma atualizado
    const updatedCronograma = await executeQueryWithRetry(`
      SELECT 
        c.*,
        u.nome as responsavel_nome,
        u.email as responsavel_email,
        u.organizacao as responsavel_organizacao,
        u.nome_empresa as responsavel_empresa
      FROM cronograma c
      LEFT JOIN usuarios_cassems u ON c.responsavel_id = u.id
      WHERE c.id = ?
    `, [id]);
    
    console.log('🔍 Cronograma atualizado retornado:', updatedCronograma[0]);
    
    // Converter BigInt para Number se necessário
    const cronograma = updatedCronograma[0];
    if (cronograma) {
      Object.keys(cronograma).forEach(key => {
        if (typeof cronograma[key] === 'bigint') {
          cronograma[key] = Number(cronograma[key]);
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Cronograma atualizado com sucesso',
      data: cronograma
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar cronograma:', error);
    res.status(500).json({
      error: 'Erro ao atualizar cronograma',
      details: error.message
    });
  }
};

// Buscar cronograma específico
exports.buscarCronograma = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rows = await executeQueryWithRetry(`
      SELECT 
        c.*,
        u.nome as responsavel_nome,
        u.email as responsavel_email,
        u.organizacao as responsavel_organizacao,
        u.nome_empresa as responsavel_empresa
      FROM cronograma c
      LEFT JOIN usuarios_cassems u ON c.responsavel_id = u.id
      WHERE c.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cronograma não encontrado' });
    }
    
    // Converter BigInt para Number se necessário
    const cronograma = rows[0];
    if (cronograma) {
      Object.keys(cronograma).forEach(key => {
        if (typeof cronograma[key] === 'bigint') {
          cronograma[key] = Number(cronograma[key]);
        }
      });
    }
    
    res.json(cronograma);
  } catch (error) {
    console.error('❌ Erro ao buscar cronograma:', error);
    res.status(500).json({
      error: 'Erro ao buscar cronograma',
      details: error.message
    });
  }
};

// Deletar cronograma
exports.deletarCronograma = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQueryWithRetry(
      'DELETE FROM cronograma WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cronograma não encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Cronograma deletado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar cronograma:', error);
    res.status(500).json({
      error: 'Erro ao deletar cronograma',
      details: error.message
    });
  }
};

// Estatísticas do cronograma
exports.estatisticasCronograma = async (req, res) => {
  try {
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    let whereClause = '';
    let params = [];
    
    // Portes vê estatísticas de TODAS as organizações
    if (userOrganization && userOrganization !== 'portes') {
      whereClause = 'WHERE organizacao = ?';
      params.push(userOrganization);
    }
    // Se for Portes, não aplica filtro - vê estatísticas gerais
    
    const stats = await executeQueryWithRetry(`
      SELECT 
        COUNT(*) as total_cronogramas,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as em_andamento,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluidos,
        SUM(CASE WHEN status = 'atrasado' THEN 1 ELSE 0 END) as atrasados,
        COUNT(DISTINCT organizacao) as total_organizacoes
      FROM cronograma 
      ${whereClause}
    `, params);
    
    // Converter BigInt para Number se necessário
    const statsData = stats[0];
    if (statsData) {
      // Converter campos BigInt para Number
      Object.keys(statsData).forEach(key => {
        if (typeof statsData[key] === 'bigint') {
          statsData[key] = Number(statsData[key]);
        }
      });
    }
    
    res.json(statsData);
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas',
      details: error.message
    });
  }
};

// Listar alertas pendentes para o usuário
exports.listarAlertas = async (req, res) => {
  try {
    await ensureCronogramaAlertTables();

    const userIdHeader = req.headers['x-user-id'] || req.query.userId;
    const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Usuário não informado' });
    }

    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao || null;
    const isPortes = (userOrganization || '').toLowerCase() === 'portes';
    let filtroOrganizacao = null;

    if (!isPortes) {
      filtroOrganizacao = userOrganization;
    } else {
      const orgFiltro = req.query.organizacao;
      if (orgFiltro && orgFiltro !== 'todos') {
        filtroOrganizacao = orgFiltro;
      }
    }

    const params = [userId];
    let whereClause = '';

    if (filtroOrganizacao) {
      whereClause = 'WHERE LOWER(a.organizacao) = LOWER(?)';
      params.push(filtroOrganizacao);
    }

    const rows = await executeQueryWithRetry(`
      SELECT 
        a.id,
        a.tipo,
        a.cronograma_id,
        a.checklist_id,
        a.organizacao,
        a.titulo,
        a.descricao,
        a.created_by,
        COALESCE(a.created_by_nome, u.nome) AS created_by_nome,
        a.created_at,
        CASE WHEN ack.id IS NULL THEN 0 ELSE 1 END AS acknowledged,
        ack.acknowledged_at
      FROM cronograma_alertas a
      LEFT JOIN usuarios_cassems u ON a.created_by = u.id
      LEFT JOIN cronograma_alertas_ack ack 
        ON ack.alerta_id = a.id AND ack.user_id = ?
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT 100
    `, params);

    const alertas = Array.isArray(rows) ? rows : [];
    console.log('🔔 Alertas retornados para usuário:', {
      userId,
      filtroOrganizacao,
      total: alertas.length
    });

    const data = alertas.map((alerta) => ({
      id: Number(alerta.id),
      tipo: alerta.tipo,
      cronograma_id: alerta.cronograma_id,
      checklist_id: alerta.checklist_id,
      organizacao: alerta.organizacao,
      titulo: alerta.titulo,
      descricao: alerta.descricao,
      created_by: alerta.created_by,
      created_by_nome: alerta.created_by_nome,
      created_at: alerta.created_at,
      acknowledged: Boolean(alerta.acknowledged),
      acknowledged_at: alerta.acknowledged_at || null
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Erro ao listar alertas do cronograma:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar alertas',
      details: error.message
    });
  }
};

// Marcar alerta como reconhecido
exports.acknowledgeAlerta = async (req, res) => {
  try {
    await ensureCronogramaAlertTables();

    const { id } = req.params;
    const alertaId = parseInt(id, 10);
    const userIdHeader = req.headers['x-user-id'] || req.body.userId;
    const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;

    if (!alertaId || !userId) {
      return res.status(400).json({ success: false, error: 'Dados insuficientes para confirmação' });
    }

    await executeQueryWithRetry(`
      INSERT INTO cronograma_alertas_ack (alerta_id, user_id, acknowledged_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE acknowledged_at = NOW()
    `, [alertaId, userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao confirmar alerta do cronograma:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao confirmar alerta',
      details: error.message
    });
  }
};
