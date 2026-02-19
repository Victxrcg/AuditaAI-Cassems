/**
 * Integração Plaud: webhook, resultado de workflow e criação de demandas no cronograma.
 * Fluxo: gravação da reunião no Plaud → workflow (transcrição + AI) → webhook ou busca por workflow_id → criar cronograma.
 */
const crypto = require('crypto');
const plaudConfig = require('../config/plaud');
const { executeQueryWithRetry } = require('../lib/db');
const { ensureTables: ensureCronogramaAlertTables, registrarAlerta } = require('../utils/cronogramaAlerts');

const normalizeOrganization = (org) => {
  if (!org) return '';
  const s = String(org).toLowerCase().trim();
  if (org === 'Marajó / Rede Frota') return 'Marajó / Rede Frota';
  if (s.includes('maraj') || s.includes('rede frota') || s.includes('rede_frota')) return 'rede_frota';
  if (s.includes('cassems')) return 'cassems';
  if (s.includes('porte')) return 'portes';
  return s.replace(/\s+/g, '_');
};

const limparTitulo = (titulo) => {
  if (!titulo) return '';
  return String(titulo)
    .replace(/^[#ó'Ø=Ý\s]+/, '')
    .replace(/[#ó'Ø=Ý]/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/** Gera token da API Plaud (client_id:secret_key em base64, POST /api/oauth/api-token). */
async function getPlaudToken() {
  if (!plaudConfig.clientId || !plaudConfig.secretKey) {
    throw new Error('Plaud: PLAUD_CLIENT_ID e PLAUD_SECRET_KEY são obrigatórios no .env');
  }
  const credentials = Buffer.from(`${plaudConfig.clientId}:${plaudConfig.secretKey}`).toString('base64');
  const res = await fetch(`${plaudConfig.baseUrl}/api/oauth/api-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Plaud token failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.api_token;
}

/**
 * Extrai lista de demandas do resultado do workflow Plaud.
 * Suporta: tasks com task_type ai_etl / ai_summarize onde result seja array ou objeto com array.
 */
function extractDemandasFromWorkflowResult(workflowResult) {
  const tasks = workflowResult.tasks || [];
  const demandas = [];

  for (const task of tasks) {
    const type = (task.task_type || '').toLowerCase();
    const result = task.result;
    if (!result) continue;

    if (type === 'ai_etl' || type === 'ai_summarize') {
      let items = [];
      if (Array.isArray(result)) {
        items = result;
      } else if (result.demandas && Array.isArray(result.demandas)) {
        items = result.demandas;
      } else if (result.items && Array.isArray(result.items)) {
        items = result.items;
      } else if (typeof result === 'object' && result.titulo) {
        items = [result];
      }
      for (const item of items) {
        const titulo = item.titulo || item.title || item.nome || item.name || String(item).slice(0, 200);
        if (!titulo) continue;
        demandas.push({
          titulo: limparTitulo(titulo),
          descricao: item.descricao || item.description || null,
          data_inicio: item.data_inicio || item.dataInicio || item.start_date || null,
          data_fim: item.data_fim || item.dataFim || item.end_date || null,
          responsavel_nome: item.responsavel || item.responsável || item.assignee || null,
        });
      }
    }
  }

  // Se não achou em ai_etl/ai_summarize, tenta pegar transcrição e quebrar em linhas como demandas (fallback)
  if (demandas.length === 0) {
    for (const task of tasks) {
      if ((task.task_type || '').toLowerCase() === 'audio_transcribe' && task.result) {
        const text = typeof task.result === 'string' ? task.result : (task.result.text || task.result.transcript || '');
        if (text) {
          const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
          for (const line of lines) {
            const titulo = line.replace(/^[-*•]\s*/, '').slice(0, 255);
            if (titulo.length >= 3) demandas.push({ titulo, descricao: null, data_inicio: null, data_fim: null, responsavel_nome: null });
          }
        }
        break;
      }
    }
  }

  return demandas;
}

/**
 * POST /api/plaud/webhook – recebe eventos do Plaud (ex.: workflow concluído).
 * Verifica assinatura e, se for workflow completo, pode criar demandas usando metadata.organizacao.
 * Deve ser registrado com express.raw({ type: 'application/json' }) para verificação de assinatura.
 */
exports.webhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const signature = req.headers['plaud-signature'] || req.headers['Plaud-Signature'];

    if (plaudConfig.webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', plaudConfig.webhookSecret);
      hmac.update(rawBody);
      const expected = hmac.digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))) {
        console.warn('[Plaud] Webhook assinatura inválida');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : (req.body || {});
    const eventType = event.event_type || event.type;

    if (eventType === 'workflow.completed' || eventType === 'audio_transcribe.completed') {
      const workflowId = event.data?.workflow_id || event.data?.id;
      const organizacao = event.data?.metadata_json?.organizacao || event.data?.metadata?.organizacao || event.metadata_json?.organizacao;
      if (workflowId && organizacao) {
        try {
          const token = await getPlaudToken();
          const resultRes = await fetch(`${plaudConfig.baseUrl}/api/workflows/${workflowId}/result`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resultRes.ok) {
            const workflowResult = await resultRes.json();
            const demandas = extractDemandasFromWorkflowResult(workflowResult);
            const userId = event.data?.created_by || null;
            for (const d of demandas) {
              await createCronogramaFromDemanda(d, organizacao, userId);
            }
            console.log('[Plaud] Webhook: demandas criadas', demandas.length, 'organizacao', organizacao);
          }
        } catch (err) {
          console.error('[Plaud] Webhook processamento erro:', err);
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('[Plaud] Webhook erro:', err);
    res.status(500).json({ error: err.message });
  }
};

async function createCronogramaFromDemanda(demanda, organizacao, userId) {
  const orgNorm = normalizeOrganization(organizacao);
  await executeQueryWithRetry(
    `INSERT INTO cronograma (titulo, descricao, organizacao, fase_atual, data_inicio, data_fim, prioridade, status)
     VALUES (?, ?, ?, 'inicio', ?, ?, 'media', 'pendente')`,
    [
      demanda.titulo,
      demanda.descricao || null,
      orgNorm,
      demanda.data_inicio || null,
      demanda.data_fim || null,
    ]
  );
  const rows = await executeQueryWithRetry('SELECT id FROM cronograma WHERE titulo = ? AND organizacao = ? ORDER BY id DESC LIMIT 1', [demanda.titulo, orgNorm]);
  const cronogramaId = rows && rows[0] ? Number(rows[0].id) : null;
  if (cronogramaId) {
    await ensureCronogramaAlertTables();
    await registrarAlerta({
      tipo: 'cronograma',
      cronogramaId,
      checklistId: null,
      organizacao: orgNorm,
      titulo: `Nova demanda (Plaud): ${demanda.titulo}`,
      descricao: demanda.descricao || null,
      userId: userId || null,
    });
  }
}

/**
 * GET /api/plaud/workflow/:workflowId/result – busca resultado do workflow e retorna demandas extraídas (pré-visualização).
 */
exports.getWorkflowResult = async (req, res) => {
  try {
    if (!plaudConfig.enabled) {
      return res.status(503).json({ error: 'Integração Plaud não configurada (PLAUD_CLIENT_ID/PLAUD_SECRET_KEY)' });
    }
    const { workflowId } = req.params;
    const token = await getPlaudToken();
    const resultRes = await fetch(`${plaudConfig.baseUrl}/api/workflows/${workflowId}/result`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resultRes.ok) {
      return res.status(resultRes.status).json({ error: 'Workflow não encontrado ou ainda em processamento' });
    }
    const workflowResult = await resultRes.json();
    const demandas = extractDemandasFromWorkflowResult(workflowResult);
    res.json({ workflowId, status: workflowResult.status, demandas });
  } catch (err) {
    console.error('[Plaud] getWorkflowResult:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/plaud/create-from-workflow – cria demandas no cronograma a partir do resultado do workflow.
 * Body: { workflowId, organizacao, created_by? }
 */
exports.createFromWorkflow = async (req, res) => {
  try {
    if (!plaudConfig.enabled) {
      return res.status(503).json({ error: 'Integração Plaud não configurada' });
    }
    const { workflowId, organizacao, created_by: createdBy } = req.body || {};
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : (createdBy ? parseInt(createdBy, 10) : null);

    if (!workflowId || !organizacao) {
      return res.status(400).json({ error: 'workflowId e organizacao são obrigatórios' });
    }

    const token = await getPlaudToken();
    const resultRes = await fetch(`${plaudConfig.baseUrl}/api/workflows/${workflowId}/result`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resultRes.ok) {
      return res.status(400).json({ error: 'Workflow não encontrado ou ainda em processamento' });
    }
    const workflowResult = await resultRes.json();
    const demandas = extractDemandasFromWorkflowResult(workflowResult);
    if (demandas.length === 0) {
      return res.status(200).json({ success: true, message: 'Nenhuma demanda extraída do workflow', created: [] });
    }

    const orgNorm = normalizeOrganization(organizacao);
    const created = [];
    for (const d of demandas) {
      await executeQueryWithRetry(
        `INSERT INTO cronograma (titulo, descricao, organizacao, fase_atual, data_inicio, data_fim, prioridade, status)
         VALUES (?, ?, ?, 'inicio', ?, ?, 'media', 'pendente')`,
        [d.titulo, d.descricao || null, orgNorm, d.data_inicio || null, d.data_fim || null]
      );
      const rows = await executeQueryWithRetry('SELECT id FROM cronograma WHERE titulo = ? AND organizacao = ? ORDER BY id DESC LIMIT 1', [d.titulo, orgNorm]);
      const cronogramaId = rows && rows[0] ? Number(rows[0].id) : null;
      if (cronogramaId) {
        await ensureCronogramaAlertTables();
        await registrarAlerta({
          tipo: 'cronograma',
          cronogramaId,
          checklistId: null,
          organizacao: orgNorm,
          titulo: `Nova demanda (Plaud): ${d.titulo}`,
          descricao: d.descricao || null,
          userId: userId || null,
        });
        created.push({ id: cronogramaId, titulo: d.titulo });
      }
    }

    res.status(201).json({ success: true, message: `${created.length} demanda(s) criada(s)`, created });
  } catch (err) {
    console.error('[Plaud] createFromWorkflow:', err);
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/plaud/config – retorna se a integração está ativa (para o frontend). */
exports.getConfig = (req, res) => {
  res.json({ enabled: plaudConfig.enabled });
};
