// backend/src/controllers/pdfController.js
const { getDbPoolWithTunnel } = require('../lib/db');

// Configurar OpenAI (opcional)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI configurado com sucesso no pdfController');
  } else {
    console.log('⚠️ OpenAI não configurado - funcionalidades de IA desabilitadas');
  }
} catch (error) {
  console.log('⚠️ Erro ao configurar OpenAI:', error.message);
}

// Função para limpar títulos removendo símbolos estranhos e normalizando caracteres
const limparTitulo = (titulo) => {
  if (!titulo) return '';
  
  return titulo
    .replace(/^[#ó'Ø=Ý\s]+/, '') // Remove símbolos estranhos do início
    .replace(/[#ó'Ø=Ý]/g, '') // Remove símbolos estranhos em qualquer lugar
    .replace(/^\d+\.\s*/, '') // Remove numeração existente (ex: "1. ")
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .replace(/^[^\w\u00C0-\u017F]/, '') // Remove qualquer caractere não-alfabético do início (incluindo acentos)
    .replace(/\s+/g, ' ') // Remove espaços múltiplos novamente
    .normalize('NFC') // Normalizar caracteres Unicode
    .trim(); // Remove espaços no início e fim
};

// Função para limpar títulos de checklist
const limparTituloChecklist = (titulo) => {
  if (!titulo) return '';
  
  return titulo
    .replace(/[#ó'Ø=Ý%Ë]/g, '') // Remove símbolos estranhos específicos dos checklists
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .normalize('NFC') // Normalizar caracteres Unicode
    .trim(); // Remove espaços no início e fim
};

// Endpoint para obter dados formatados para PDF
exports.obterDadosParaPDF = async (req, res) => {
  let pool, server;
  try {
    const { organizacao, status } = req.query;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    
    console.log('📄 Gerando dados para PDF - Organização solicitada:', organizacao || 'todas');
    console.log('📄 Gerando dados para PDF - Status solicitado:', status || 'todos');
    console.log('📄 Organização do usuário:', userOrg);
    console.log('📄 userOrg === "portes":', userOrg === 'portes');
    console.log('📄 Tipo de userOrg:', typeof userOrg);
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Query para buscar cronogramas
    let query = `
      SELECT 
        c.*,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM cronograma c
      LEFT JOIN usuarios_cassems u ON c.responsavel_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtrar por organização baseado no usuário
    if (userOrg === 'portes') {
      console.log('🔓 Usuário Portes - pode ver todas as organizações');
      // Usuário Portes pode ver todas as organizações ou filtrar por uma específica
      if (organizacao && organizacao !== 'todos') {
        query += ` AND c.organizacao = ?`;
        params.push(organizacao);
        console.log(`🔓 Filtrando por organização específica: ${organizacao}`);
      } else {
        console.log('🔓 Sem filtro - retornando todas as organizações');
      }
    } else {
      console.log('🔒 Usuário não-Portes - aplicando filtro de segurança');
      // Usuários não-Portes só podem ver dados da sua própria organização
      query += ` AND c.organizacao = ?`;
      params.push(userOrg);
      console.log(`🔒 Usuário ${userOrg} - limitado aos dados da própria organização`);
    }
    
    // Filtrar por status se especificado
    if (status && status !== 'todos') {
      query += ` AND c.status = ?`;
      params.push(status);
      console.log(`📄 Filtrando por status: ${status}`);
    }
    
    query += ` ORDER BY c.prioridade DESC, c.data_inicio ASC, c.created_at DESC`;
    
    console.log('📄 Query final:', query);
    console.log('📄 Parâmetros:', params);
    
    const cronogramas = await pool.query(query, params);
    console.log(`📋 Encontrados ${cronogramas.length} cronogramas`);
    
    // Debug: mostrar organizações dos primeiros cronogramas
    if (cronogramas.length > 0) {
      const organizacoesEncontradas = [...new Set(cronogramas.map(c => c.organizacao))];
      console.log('📋 Organizações encontradas:', organizacoesEncontradas);
      console.log('📋 Primeiro cronograma:', {
        id: cronogramas[0].id,
        titulo: cronogramas[0].titulo,
        organizacao: cronogramas[0].organizacao
      });
    }
    
    // Processar cada cronograma
    const cronogramasFormatados = [];
    
    for (const cronograma of cronogramas) {
      // Limpar título
      const tituloLimpo = limparTitulo(cronograma.titulo);
      
      // Buscar checklists
      const checklists = await pool.query(`
        SELECT id, titulo, descricao, concluido, ordem
        FROM cronograma_checklist 
        WHERE cronograma_id = ?
        ORDER BY ordem ASC
      `, [cronograma.id]);
      
      // Processar checklists
      const checklistsFormatados = checklists.map(item => ({
        id: item.id,
        titulo: limparTituloChecklist(item.titulo),
        descricao: item.descricao ? limparTituloChecklist(item.descricao) : null,
        concluido: Boolean(item.concluido),
        ordem: item.ordem
      }));
      
      // Criar objeto formatado
      const cronogramaFormatado = {
        id: cronograma.id,
        titulo: tituloLimpo,
        descricao: cronograma.descricao,
        organizacao: cronograma.organizacao,
        status: cronograma.status,
        prioridade: cronograma.prioridade,
        fase_atual: cronograma.fase_atual,
        data_inicio: cronograma.data_inicio,
        data_fim: cronograma.data_fim,
        responsavel_nome: cronograma.responsavel_nome || 'Não definido',
        responsavel_email: cronograma.responsavel_email,
        observacoes: cronograma.observacoes,
        motivo_atraso: cronograma.motivo_atraso,
        created_at: cronograma.created_at,
        updated_at: cronograma.updated_at,
        checklists: checklistsFormatados
      };
      
      cronogramasFormatados.push(cronogramaFormatado);
    }
    
    // Calcular estatísticas baseado no filtro aplicado
    const totalDemandas = cronogramasFormatados.length;
    
    let demandasConcluidas, demandasEmAndamento, demandasPendentes, demandasAtrasadas, percentualConclusao;
    
    if (status && status !== 'todos') {
      // Se há filtro de status, mostrar apenas as estatísticas relevantes
      if (status === 'concluido') {
        demandasConcluidas = totalDemandas;
        demandasEmAndamento = 0;
        demandasPendentes = 0;
        demandasAtrasadas = 0;
        percentualConclusao = 100;
      } else if (status === 'em_andamento') {
        demandasConcluidas = 0;
        demandasEmAndamento = totalDemandas;
        demandasPendentes = 0;
        demandasAtrasadas = 0;
        percentualConclusao = 0;
      } else if (status === 'pendente') {
        demandasConcluidas = 0;
        demandasEmAndamento = 0;
        demandasPendentes = totalDemandas;
        demandasAtrasadas = 0;
        percentualConclusao = 0;
      } else if (status === 'atrasado') {
        demandasConcluidas = 0;
        demandasEmAndamento = 0;
        demandasPendentes = 0;
        demandasAtrasadas = totalDemandas;
        percentualConclusao = 0;
      }
    } else {
      // Sem filtro de status, calcular todas as estatísticas
      demandasConcluidas = cronogramasFormatados.filter(c => c.status === 'concluido').length;
      demandasEmAndamento = cronogramasFormatados.filter(c => c.status === 'em_andamento').length;
      demandasPendentes = cronogramasFormatados.filter(c => c.status === 'pendente').length;
      demandasAtrasadas = cronogramasFormatados.filter(c => c.status === 'atrasado').length;
      percentualConclusao = totalDemandas > 0 ? Math.round((demandasConcluidas / totalDemandas) * 100) : 0;
    }
    
    console.log('📊 Estatísticas calculadas:', {
      totalDemandas,
      demandasConcluidas,
      demandasEmAndamento,
      demandasPendentes,
      demandasAtrasadas,
      percentualConclusao,
      filtroStatus: status
    });
    
    // Agrupar por organização
    const organizacoes = {};
    cronogramasFormatados.forEach(cronograma => {
      if (!organizacoes[cronograma.organizacao]) {
        organizacoes[cronograma.organizacao] = [];
      }
      organizacoes[cronograma.organizacao].push(cronograma);
    });
    
    // Resposta formatada
    const resposta = {
      success: true,
      data: {
        resumo: {
          totalDemandas,
          demandasConcluidas,
          demandasEmAndamento,
          demandasPendentes,
          demandasAtrasadas,
          percentualConclusao
        },
        organizacoes,
        cronogramas: cronogramasFormatados,
        metadata: {
          geradoEm: new Date().toISOString(),
          organizacaoFiltro: organizacao || 'todas',
          usuarioOrganizacao: userOrg
        }
      }
    };
    
    console.log('✅ Dados para PDF gerados com sucesso');
    
    // Garantir encoding UTF-8 na resposta
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(resposta);
    
  } catch (error) {
    console.error('❌ Erro ao gerar dados para PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar dados para PDF',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Função auxiliar para agrupar cronogramas por mês (suporta multi-mês)
const agruparPorMes = (cronogramasFormatados) => {
  const porMes = {};

  const monthCode = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const ensureMonth = (code) => {
    if (!porMes[code]) {
      porMes[code] = {
        mes: code,
        demandasIniciadas: [],
        demandasConcluidas: [],
        demandasEmAndamento: [],
        demandasPendentes: [],
        demandasAtrasadas: [],
        emExecucao: [], // multi-mês
        checklistsConcluidos: [],
        checklistsPendentes: []
      };
    }
    return porMes[code];
  };

  const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

  const addRangeMonths = (start, end, fn) => {
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);
    for (let d = new Date(s); d <= e; d.setMonth(d.getMonth() + 1)) {
      fn(monthCode(d));
    }
  };

  const hoje = new Date();

  cronogramasFormatados.forEach(cronograma => {
    const di = cronograma.data_inicio ? new Date(cronograma.data_inicio) : null;
    const df = cronograma.data_fim ? new Date(cronograma.data_fim) : null;

    // 1) Demanda concluída: entra em emExecucao em todos os meses entre início e fim, e em Concluídas no mês do fim
    if (di) {
      const rangeEnd = df || hoje;
      addRangeMonths(di, rangeEnd, (code) => {
        const bucket = ensureMonth(code);
        // Regra 2b: se está atrasada e sem data_fim, NÃO duplicar em emExecucao
        if (!(cronograma.status === 'atrasado' && !df)) {
          // Evitar duplicidade
          if (!bucket.emExecucao.find(d => d.id === cronograma.id)) {
            bucket.emExecucao.push(cronograma);
          }
        }
      });
    }

    // 2) Marcar início
    if (di) {
      ensureMonth(monthCode(di)).demandasIniciadas.push(cronograma);
    }

    // 3) Conclusão no mês de fim
    if (cronograma.status === 'concluido') {
      let baseConclusao = df || (cronograma.updated_at ? new Date(cronograma.updated_at) : di || hoje);
      const code = monthCode(baseConclusao);
      const bucket = ensureMonth(code);
      bucket.demandasConcluidas.push(cronograma);

      // Checklists concluídos/pendentes associados à conclusão
      if (cronograma.checklists && cronograma.checklists.length > 0) {
        cronograma.checklists.forEach(checklist => {
          if (checklist.concluido) {
            bucket.checklistsConcluidos.push({ titulo: checklist.titulo, demanda: cronograma.titulo, demandaId: cronograma.id });
          } else {
            bucket.checklistsPendentes.push({ titulo: checklist.titulo, demanda: cronograma.titulo, demandaId: cronograma.id });
          }
        });
      }
    }

    // 4) Pendentes e Atrasadas do mês atual (rastro)
    const codeAtual = monthCode(hoje);
    const bucketAtual = ensureMonth(codeAtual);
    if (cronograma.status === 'pendente') {
      if (!bucketAtual.demandasPendentes.find(d => d.id === cronograma.id)) bucketAtual.demandasPendentes.push(cronograma);
    }
    if (cronograma.status === 'atrasado') {
      if (!bucketAtual.demandasAtrasadas.find(d => d.id === cronograma.id)) bucketAtual.demandasAtrasadas.push(cronograma);
    }
  });

  return porMes;
};

// Função para analisar cronograma com IA
const analisarCronogramaComIA = async (cronogramasFormatados, organizacoes, userOrg, organizacaoFiltro) => {
  try {
    // Verificar se OpenAI está disponível
    if (!openai) {
      throw new Error('OpenAI não configurado');
    }
    
    // Identificar período completo
    let primeiraData = null;
    let ultimaData = null;
    
    cronogramasFormatados.forEach(cronograma => {
      if (cronograma.data_inicio) {
        const data = new Date(cronograma.data_inicio);
        if (!primeiraData || data < primeiraData) {
          primeiraData = data;
        }
      }
      if (cronograma.data_fim) {
        const data = new Date(cronograma.data_fim);
        if (!ultimaData || data > ultimaData) {
          ultimaData = data;
        }
      }
      if (cronograma.updated_at) {
        const data = new Date(cronograma.updated_at);
        if (!ultimaData || data > ultimaData) {
          ultimaData = data;
        }
      }
    });
    
    if (!primeiraData || !ultimaData) {
      throw new Error('Não foi possível identificar o período do cronograma');
    }
    
    // Agrupar por mês
    const dadosPorMes = agruparPorMes(cronogramasFormatados);
    
    // Calcular estatísticas por organização (para comparação se Portes)
    const statsPorOrganizacao = {};
    const organizacoesList = Object.keys(organizacoes);
    
    organizacoesList.forEach(org => {
      const demandas = organizacoes[org];
      const total = demandas.length;
      const concluidas = demandas.filter(d => d.status === 'concluido').length;
      const emAndamento = demandas.filter(d => d.status === 'em_andamento').length;
      const pendentes = demandas.filter(d => d.status === 'pendente').length;
      const atrasadas = demandas.filter(d => d.status === 'atrasado').length;
      
      // Contar checklists concluídos
      let checklistsTotal = 0;
      let checklistsConcluidos = 0;
      demandas.forEach(d => {
        if (d.checklists) {
          checklistsTotal += d.checklists.length;
          checklistsConcluidos += d.checklists.filter(c => c.concluido).length;
        }
      });
      
      statsPorOrganizacao[org] = {
        total,
        concluidas,
        emAndamento,
        pendentes,
        atrasadas,
        percentualConclusao: total > 0 ? Math.round((concluidas / total) * 100) : 0,
        checklistsTotal,
        checklistsConcluidos,
        percentualChecklists: checklistsTotal > 0 ? Math.round((checklistsConcluidos / checklistsTotal) * 100) : 0
      };
    });
    
    // Ordenar meses cronologicamente
    const mesesOrdenados = Object.keys(dadosPorMes).sort();
    
    // Preparar dados resumidos por mês para a IA
    const resumoMensal = mesesOrdenados.map((mes, idx) => {
      const dados = dadosPorMes[mes];
      const [ano, mesNum] = mes.split('-');
      const nomeMes = new Date(ano, parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      // Métricas de fluxo
      const anteriores = idx > 0 ? dadosPorMes[mesesOrdenados[idx-1]] : null;
      const novasNoMes = (dados.demandasIniciadas || []).length;
      const concluidasNoMes = (dados.demandasConcluidas || []).length;
      const emExec = (dados.emExecucao || []);
      const carregadasDoMesAnterior = anteriores ? (emExec.filter(d => new Date(d.data_inicio) < new Date(ano, parseInt(mesNum)-1, 1)).length) : 0;
      // Roladas: continuam após o fim do mês e não foram concluídas nele
      const fimDoMes = new Date(parseInt(ano), parseInt(mesNum), 0);
      const roladasProximoMes = emExec.filter(d => (!d.data_fim || new Date(d.data_fim) > fimDoMes) && !dados.demandasConcluidas.find(x => x.id === d.id)).length;
      
      return {
        mes: nomeMes,
        mesCodigo: mes,
        emExecucao: emExec.map(d => ({
          titulo: d.titulo,
          responsavel: d.responsavel_nome || 'Não definido',
          organizacao: d.organizacao,
          inicio: d.data_inicio || null,
          fim: d.data_fim || null
        })),
        demandasConcluidas: dados.demandasConcluidas.map(d => ({
          titulo: d.titulo,
          responsavel: d.responsavel_nome || 'Não definido',
          organizacao: d.organizacao,
          inicio: d.data_inicio || null,
          fim: d.data_fim || d.updated_at || null,
          duracaoDias: d.data_inicio && (d.data_fim || d.updated_at)
            ? Math.max(1, Math.ceil((new Date(d.data_fim || d.updated_at) - new Date(d.data_inicio)) / (1000*60*60*24)))
            : null
        })),
        checklistsConcluidos: dados.checklistsConcluidos.map(c => ({
          titulo: c.titulo,
          demanda: c.demanda
        })),
        demandasPendentes: dados.demandasPendentes.map(d => ({
          titulo: d.titulo,
          responsavel: d.responsavel_nome || 'Não definido',
          organizacao: d.organizacao,
          inicio: d.data_inicio || null,
          diasEmAberto: d.data_inicio ? Math.max(0, Math.ceil((new Date() - new Date(d.data_inicio)) / (1000*60*60*24))) : null
        })),
        demandasAtrasadas: dados.demandasAtrasadas.map(d => ({
          titulo: d.titulo,
          responsavel: d.responsavel_nome || 'Não definido',
          organizacao: d.organizacao,
          motivoAtraso: d.motivo_atraso || 'Não informado',
          inicio: d.data_inicio || null,
          diasEmAtraso: d.data_inicio ? Math.max(0, Math.ceil((new Date() - new Date(d.data_inicio)) / (1000*60*60*24))) : null
        })),
        checklistsPendentes: dados.checklistsPendentes.map(c => ({
          titulo: c.titulo,
          demanda: c.demanda
        })),
        totalConcluido: dados.demandasConcluidas.length + dados.checklistsConcluidos.length,
        totalPendente: dados.demandasPendentes.length + dados.demandasAtrasadas.length + dados.checklistsPendentes.length,
        metricasFluxo: {
          novasNoMes,
          concluidasNoMes,
          carregadasDoMesAnterior,
          roladasProximoMes
        }
      };
    });

    // Estatísticas detalhadas por mês (para auditoria)
    const resumoMensalDetalhado = mesesOrdenados.map(mes => {
      const dados = dadosPorMes[mes];
      const [ano, mesNum] = mes.split('-');
      const nomeMes = new Date(ano, parseInt(mesNum) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      const concluidas = dados.demandasConcluidas || [];
      const atrasadas = dados.demandasAtrasadas || [];
      const pendentes = dados.demandasPendentes || [];
      const totalDemandas = concluidas.length + atrasadas.length + pendentes.length;

      // Duração média (dias) considerando apenas concluídas com datas válidas
      const duracoes = concluidas
        .map(d => d.data_inicio && (d.data_fim || d.updated_at)
          ? Math.max(1, Math.ceil((new Date(d.data_fim || d.updated_at) - new Date(d.data_inicio)) / (1000*60*60*24)))
          : null)
        .filter(v => typeof v === 'number');
      const duracaoMediaDias = duracoes.length > 0 ? +(duracoes.reduce((a,b) => a+b, 0) / duracoes.length).toFixed(1) : null;

      // Responsável mais ativo (por conclusões no mês)
      const porResp = {};
      concluidas.forEach(d => {
        const nome = d.responsavel_nome || 'Não definido';
        porResp[nome] = (porResp[nome] || 0) + 1;
      });
      let responsavelMaisAtivo = null;
      let maxCount = 0;
      Object.entries(porResp).forEach(([nome, qtd]) => {
        if (qtd > maxCount) { maxCount = qtd; responsavelMaisAtivo = nome; }
      });

      return {
        mes: mes,
        mesLabel: nomeMes,
        totalDemandas,
        concluidas: concluidas.length,
        atrasadas: atrasadas.length,
        pendentes: pendentes.length,
        duracaoMediaDias,
        responsavelMaisAtivo: responsavelMaisAtivo || null
      };
    });

    // Ranking de responsáveis (geral do período)
    const ranking = {};
    cronogramasFormatados.forEach(d => {
      const nome = d.responsavel_nome || 'Não definido';
      if (!ranking[nome]) ranking[nome] = { nome, concluidas: 0, atrasadas: 0 };
      if (d.status === 'concluido') ranking[nome].concluidas += 1;
      if (d.status === 'atrasado') ranking[nome].atrasadas += 1;
    });
    const topResponsaveis = Object.values(ranking)
      .sort((a, b) => (b.concluidas - a.concluidas) || (a.atrasadas - b.atrasadas))
      .slice(0, 10);

    // Logs ricos em dev
    try {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.table((cronogramasFormatados || []).slice(0, 10).map(c => ({ id: c.id, titulo: c.titulo, status: c.status, org: c.organizacao, checklists: (c.checklists||[]).length })));
        // eslint-disable-next-line no-console
        console.log('📈 Meses agrupados:', mesesOrdenados);
      }
    } catch {}
    
    // Montar prompt para a IA
    const isComparativo = userOrg === 'portes' && organizacaoFiltro === 'todos';
    
    let prompt = `Você é um especialista em análise de cronogramas e gestão de projetos. Analise os dados e gere um relatório claro para pessoas leigas, em pt-BR, seguindo EXATAMENTE o formato abaixo em Markdown.

PERÍODO ANALISADO: ${primeiraData.toLocaleDateString('pt-BR')} até ${ultimaData.toLocaleDateString('pt-BR')}

${isComparativo ? `VISUALIZANDO DADOS DE MÚLTIPLAS ORGANIZAÇÕES: ${organizacoesList.join(', ')}` : `ORGANIZAÇÃO: ${organizacoesList[0] || 'N/A'}`}

DADOS POR MÊS (JSON):
${JSON.stringify(resumoMensal, null, 2)}

${isComparativo ? `COMPARAÇÃO ENTRE ORGANIZAÇÕES (JSON):
${JSON.stringify(statsPorOrganizacao, null, 2)}` : ''}

REQUISITOS DE FORMATO (OBRIGATÓRIO):
- Use Markdown com os seguintes títulos/seções fixas:
  # OVERVIEW DO CRONOGRAMA – ANÁLISE INTELIGENTE
  ## Resumo Executivo
  - Veredito geral do período (satisfatório, moderado, crítico, instável) e por quê.
  ## Período
  ## Por Mês
    ### Mês/Ano (ex.: março/2025)
      O QUE FOI FEITO
      O QUE ESTÁ EM ANDAMENTO
      O QUE NÃO FOI FEITO
      Checklists
      Tendência (uma linha): comportamento do mês (ex.: mais atrasos, melhora de produtividade, estabilidade)
  ## Estatísticas Resumidas
  ${isComparativo ? '## Comparativo\n' : ''}
- Nas listas de cada mês, prefixe os bullets exatamente com:
(Nao mostrar a legenda de [OK] e [PENDENTE])
  - [OK] para itens concluídos
  - [PENDENTE] para itens pendentes/atrasados
- Limite a no máximo 5 bullets por lista; se houver mais, escreva: "e mais X itens".
- Não invente dados; use somente o conteúdo fornecido.
- Linguagem simples, objetiva, sem jargões.

CONTEÚDO ESPERADO:
1) Resumo Executivo: 3–5 linhas sobre o período.
2) Período: datas inicial e final.
3) Por Mês: para cada mês presente no JSON, inclua:
   - O QUE FOI FEITO: com [OK] "Demanda — Responsável". Se houver campos de duração (início/fim), indique entre parênteses: "(de INÍCIO a FIM — DURACAO dias)".
   - O QUE NÃO FOI FEITO: até 5 bullets com [PENDENTE] "Demanda — Responsável". Para demandas atrasadas, SEMPRE incluir o motivo do atraso se disponível: "(motivo: MOTIVO)".
   - Checklists: informe totais concluídos vs pendentes.
   - Tendência: 1 frase simples.
4) Estatísticas Resumidas: números agregados do período.
${isComparativo ? '5) Comparativo entre Organizações: ranking e destaques.\n' : ''}5) Recomendações: 3–5 ações objetivas.

Exemplo (ilustrativo do formato, não invente dados):
## Por Mês
### janeiro/2025
O QUE FOI FEITO
- [OK] Ajuste do módulo X — Maria
O QUE NÃO FOI FEITO
- [EM ANDAMENTO] Integração Y — João
- [PENDENTE] Integração Z — João (motivo: MOTIVO) *As vezes ainda nao tem inicio definido, ou ainda nao se iniciou*
Checklists
- Concluídos: 3 | Pendentes: 1`;

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você gera relatórios em pt-BR, para leigos, sempre em Markdown determinístico com títulos H1/H2/H3, bullets prefixados com [OK]/[PENDENTE], sem emojis, sem jargões."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 6000,
      temperature: 0.2
    });
    
    const analiseIA = completion.choices[0].message.content;
    
    return {
      analise: analiseIA,
      periodo: {
        inicio: primeiraData.toISOString(),
        fim: ultimaData.toISOString(),
        inicioFormatado: primeiraData.toLocaleDateString('pt-BR'),
        fimFormatado: ultimaData.toLocaleDateString('pt-BR')
      },
      resumoMensal,
      resumoMensalDetalhado,
      topResponsaveis,
      statsPorOrganizacao: isComparativo ? statsPorOrganizacao : null,
      isComparativo
    };
    
  } catch (error) {
    console.error('❌ Erro ao analisar cronograma com IA:', error);
    throw error;
  }
};

// Endpoint para analisar cronograma com IA
exports.analisarCronogramaIA = async (req, res) => {
  let pool, server;
  try {
    // Verificar se OpenAI está disponível
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'Serviço de IA temporariamente indisponível',
        details: 'OpenAI não configurado. Entre em contato com o administrador.'
      });
    }
    
    const { organizacao, status } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    
    console.log('🤖 Iniciando análise com IA - Organização solicitada:', organizacao || 'todas');
    console.log('🤖 Status solicitado:', status || 'todos');
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Query para buscar cronogramas (mesma lógica do obterDadosParaPDF)
    let query = `
      SELECT 
        c.*,
        u.nome as responsavel_nome,
        u.email as responsavel_email
      FROM cronograma c
      LEFT JOIN usuarios_cassems u ON c.responsavel_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filtrar por organização baseado no usuário
    if (userOrg === 'portes') {
      if (organizacao && organizacao !== 'todos') {
        query += ` AND c.organizacao = ?`;
        params.push(organizacao);
      }
    } else {
      query += ` AND c.organizacao = ?`;
      params.push(userOrg);
    }
    
    // Filtrar por status se especificado
    if (status && status !== 'todos') {
      query += ` AND c.status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY c.prioridade DESC, c.data_inicio ASC, c.created_at DESC`;
    
    const cronogramas = await pool.query(query, params);
    console.log(`📋 Encontrados ${cronogramas.length} cronogramas para análise`);
    
    if (cronogramas.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum cronograma encontrado para análise'
      });
    }
    
    // Processar cada cronograma (mesma lógica do obterDadosParaPDF)
    const cronogramasFormatados = [];
    
    for (const cronograma of cronogramas) {
      const tituloLimpo = limparTitulo(cronograma.titulo);
      
      const checklists = await pool.query(`
        SELECT id, titulo, descricao, concluido, ordem, updated_at
        FROM cronograma_checklist 
        WHERE cronograma_id = ?
        ORDER BY ordem ASC
      `, [cronograma.id]);
      
      const checklistsFormatados = checklists.map(item => ({
        id: item.id,
        titulo: limparTituloChecklist(item.titulo),
        descricao: item.descricao ? limparTituloChecklist(item.descricao) : null,
        concluido: Boolean(item.concluido),
        ordem: item.ordem,
        updated_at: item.updated_at
      }));
      
      const cronogramaFormatado = {
        id: cronograma.id,
        titulo: tituloLimpo,
        descricao: cronograma.descricao,
        organizacao: cronograma.organizacao,
        status: cronograma.status,
        prioridade: cronograma.prioridade,
        fase_atual: cronograma.fase_atual,
        data_inicio: cronograma.data_inicio,
        data_fim: cronograma.data_fim,
        responsavel_nome: cronograma.responsavel_nome || 'Não definido',
        responsavel_email: cronograma.responsavel_email,
        observacoes: cronograma.observacoes,
        motivo_atraso: cronograma.motivo_atraso,
        created_at: cronograma.created_at,
        updated_at: cronograma.updated_at,
        checklists: checklistsFormatados
      };
      
      cronogramasFormatados.push(cronogramaFormatado);
    }
    
    // Agrupar por organização
    const organizacoes = {};
    cronogramasFormatados.forEach(cronograma => {
      if (!organizacoes[cronograma.organizacao]) {
        organizacoes[cronograma.organizacao] = [];
      }
      organizacoes[cronograma.organizacao].push(cronograma);
    });
    
    // Analisar com IA
    console.log('🤖 Enviando dados para análise da IA...');
    const resultadoIA = await analisarCronogramaComIA(
      cronogramasFormatados,
      organizacoes,
      userOrg,
      organizacao || 'todos'
    );
    
    console.log('✅ Análise com IA concluída com sucesso');
    
    res.json({
      success: true,
      data: {
        analise: resultadoIA.analise,
        periodo: resultadoIA.periodo,
        resumoMensal: resultadoIA.resumoMensal,
          resumoMensalDetalhado: resultadoIA.resumoMensalDetalhado,
          topResponsaveis: resultadoIA.topResponsaveis,
        statsPorOrganizacao: resultadoIA.statsPorOrganizacao,
        isComparativo: resultadoIA.isComparativo,
        metadata: {
          totalDemandas: cronogramasFormatados.length,
          organizacaoFiltro: organizacao || 'todas',
          usuarioOrganizacao: userOrg,
          geradoEm: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao analisar cronograma com IA:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao analisar cronograma com IA',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};
