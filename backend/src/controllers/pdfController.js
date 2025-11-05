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
    
    // Preparar dados completos de demandas para análise
    const demandasCompletas = cronogramasFormatados.map(d => ({
      titulo: d.titulo,
      descricao: d.descricao || 'Sem descrição',
      responsavel: d.responsavel_nome || 'Não definido',
      status: d.status,
      dataInicio: d.data_inicio,
      dataFim: d.data_fim,
      motivoAtraso: d.motivo_atraso || null,
      checklists: d.checklists || [],
      faseAtual: d.fase_atual || null
    }));

    let prompt = `Você é um especialista em análise de cronogramas. Gere um relatório SIMPLES, DIRETO e RÁPIDO em pt-BR, seguindo EXATAMENTE este formato:

PERÍODO: ${primeiraData.toLocaleDateString('pt-BR')} até ${ultimaData.toLocaleDateString('pt-BR')}

${isComparativo ? `ORGANIZAÇÕES: ${organizacoesList.join(', ')}` : `ORGANIZAÇÃO: ${organizacoesList[0] || 'N/A'}`}

DADOS COMPLETOS DAS DEMANDAS:
${JSON.stringify(demandasCompletas, null, 2)}

FORMATO OBRIGATÓRIO (Markdown):

## Resumo do Período
[Máximo 5 linhas. Resumo geral do que aconteceu no período, sem enrolação.]

## Demandas

Para CADA demanda, use EXATAMENTE este formato:

### [Nome da Demanda] - ([Responsável])

**Status:** [concluída/em andamento/atrasada/pendente]

**Descrição:** [Breve resumo da demanda em 1-2 linhas]

[Se concluída:]
- Concluída em: [data de conclusão]
- Checklists concluídos: [resumo dos checklists concluídos, listando apenas os que foram concluídos]

[Se em andamento:]
- Ainda em andamento. [Breve explicação do status atual]
- Checklists: [resumo dos checklists - quais concluídos e quais pendentes]

[Se atrasada:]
- Atrasada. Motivo: [motivo do atraso se disponível]
- Checklists: [resumo dos checklists - quais concluídos e quais pendentes]

[Se pendente:]
- Pendente. [Breve explicação]
- Checklists: [resumo dos checklists pendentes]

REGRAS IMPORTANTES:
- Seja DIRETO. Sem enrolação.
- Máximo 3-4 linhas por demanda.
- Se a demanda tem data_inicio, ela JÁ INICIOU. Nunca diga "ainda não iniciou" se tiver data_inicio.
- Para checklists concluídos, liste apenas os títulos em 1 linha: "Checklists concluídos: X, Y, Z"
- Para checklists pendentes, liste apenas os títulos em 1 linha: "Checklists pendentes: X, Y, Z"
- Use linguagem simples e objetiva.
- NÃO invente dados. Use apenas o que está no JSON.`;

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você gera relatórios SIMPLES, DIRETOS e RÁPIDOS em pt-BR, para leigos, sempre em Markdown determinístico. Sem enrolação. Foco em clareza e objetividade. Use apenas os dados fornecidos."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 6000,
      temperature: 0.2
    });
    
    const analiseIA = completion.choices[0].message.content;
    
    // Calcular top responsáveis com contagem de concluídas e atrasadas
    const responsaveisCount = {};
    cronogramasFormatados.forEach(c => {
      const nome = c.responsavel_nome || 'Não definido';
      if (!responsaveisCount[nome]) {
        responsaveisCount[nome] = { concluidas: 0, atrasadas: 0 };
      }
      if (c.status === 'concluido') {
        responsaveisCount[nome].concluidas += 1;
      } else if (c.status === 'atrasado') {
        responsaveisCount[nome].atrasadas += 1;
      }
    });
    const topResponsaveis = Object.entries(responsaveisCount)
      .sort((a, b) => (b[1].concluidas + b[1].atrasadas) - (a[1].concluidas + a[1].atrasadas))
      .slice(0, 5)
      .map(([nome, stats]) => ({ nome, concluidas: stats.concluidas, atrasadas: stats.atrasadas }));
    
    return {
      analise: analiseIA,
      periodo: {
        inicio: primeiraData.toISOString(),
        fim: ultimaData.toISOString(),
        inicioFormatado: primeiraData.toLocaleDateString('pt-BR'),
        fimFormatado: ultimaData.toLocaleDateString('pt-BR')
      },
      resumoMensal,
      resumoMensalDetalhado: resumoMensal.map(r => ({
        ...r,
        mesLabel: r.mes, // Adicionar mesLabel para compatibilidade com frontend
        totalDemandas: (r.demandasConcluidas || []).length + (r.demandasPendentes || []).length + (r.demandasAtrasadas || []).length,
        concluidas: (r.demandasConcluidas || []).length,
        atrasadas: (r.demandasAtrasadas || []).length,
        pendentes: (r.demandasPendentes || []).length
      })),
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
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Erro ao analisar cronograma com IA',
      details: error.message || 'Erro desconhecido',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  } finally {
    // Fechar apenas o tunnel (server), se existir
    // NÃO fechar o pool, pois é compartilhado e usado por outras requisições
    if (server) {
      try {
        server.close();
      } catch (err) {
        console.error('Erro ao fechar tunnel:', err);
      }
    }
  }
};

// Função para analisar cronograma por mês específico com IA
const analisarCronogramaPorMesComIA = async (cronogramasFormatados, organizacoes, userOrg, organizacaoFiltro, ano, mes) => {
  try {
    // Verificar se OpenAI está disponível
    if (!openai) {
      throw new Error('OpenAI não configurado');
    }
    
    // Filtrar cronogramas que INICIARAM no mês especificado
    const mesCode = `${ano}-${String(mes).padStart(2, '0')}`;
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59);
    
    // Focar apenas em demandas que INICIARAM no mês selecionado
    const cronogramasDoMes = cronogramasFormatados.filter(c => {
      const di = c.data_inicio ? new Date(c.data_inicio) : null;
      if (!di) return false;
      
      // Incluir apenas se iniciou no mês especificado
      return di >= inicioMes && di <= fimMes;
    });
    
    if (cronogramasDoMes.length === 0) {
      throw new Error(`Nenhuma demanda iniciada no mês ${mes}/${ano}`);
    }
    
    // Buscar checklists concluídos no mês
    const checklistsConcluidosNoMes = [];
    const demandasComChecklists = [];
    
    cronogramasDoMes.forEach(demanda => {
      if (demanda.checklists && demanda.checklists.length > 0) {
        const checklistsDoMes = demanda.checklists.filter(c => {
          if (!c.concluido) return false;
          if (c.updated_at) {
            const dataChecklist = new Date(c.updated_at);
            return dataChecklist >= inicioMes && dataChecklist <= fimMes;
          }
          // Se não tem updated_at, verificar se a demanda foi concluída no mês
          if (demanda.status === 'concluido' && demanda.data_fim) {
            const dataFim = new Date(demanda.data_fim);
            return dataFim >= inicioMes && dataFim <= fimMes;
          }
          return false;
        });
        
        if (checklistsDoMes.length > 0) {
          checklistsConcluidosNoMes.push(...checklistsDoMes.map(c => ({
            titulo: c.titulo,
            descricao: c.descricao,
            demanda: demanda.titulo,
            demandaId: demanda.id,
            demandaDescricao: demanda.descricao
          })));
        }
        
        demandasComChecklists.push({
          ...demanda,
          checklistsConcluidos: checklistsDoMes
        });
      }
    });
    
    // Preparar dados detalhados para a IA
    // Demandas que iniciaram no mês e foram concluídas no mesmo mês
    // Usar updated_at (data real de conclusão) quando status é 'concluido'
    const demandasConcluidasNoMes = cronogramasDoMes.filter(d => {
      if (d.status !== 'concluido') return false;
      
      // Usar updated_at como data de conclusão real
      if (!d.updated_at) return false;
      
      const dataConclusao = new Date(d.updated_at);
      
      // Verificar se a data de conclusão está dentro do período de data_inicio/data_fim
      const di = d.data_inicio ? new Date(d.data_inicio) : null;
      const df = d.data_fim ? new Date(d.data_fim) : null;
      
      // Se tem data_inicio, verificar se a conclusão está depois do início
      if (di && dataConclusao < di) return false;
      
      // Se tem data_fim, verificar se a conclusão está antes do fim (ou no mesmo dia)
      if (df) {
        const dfEnd = new Date(df);
        dfEnd.setHours(23, 59, 59, 999);
        if (dataConclusao > dfEnd) return false;
      }
      
      // Verificar se a conclusão foi no mês especificado
      return dataConclusao >= inicioMes && dataConclusao <= fimMes;
    });
    
    // Demandas que iniciaram no mês mas foram concluídas depois do mês
    // Usar updated_at (data real de conclusão) quando status é 'concluido'
    const demandasIniciadasNoMesConcluidasDepois = cronogramasDoMes.filter(d => {
      if (d.status !== 'concluido') return false;
      
      // Usar updated_at como data de conclusão real
      if (!d.updated_at) return false;
      
      const dataConclusao = new Date(d.updated_at);
      
      // Verificar se a data de conclusão está dentro do período de data_inicio/data_fim
      const di = d.data_inicio ? new Date(d.data_inicio) : null;
      const df = d.data_fim ? new Date(d.data_fim) : null;
      
      // Se tem data_inicio, verificar se a conclusão está depois do início
      if (di && dataConclusao < di) return false;
      
      // Se tem data_fim, verificar se a conclusão está antes do fim (ou no mesmo dia)
      if (df) {
        const dfEnd = new Date(df);
        dfEnd.setHours(23, 59, 59, 999);
        if (dataConclusao > dfEnd) return false;
      }
      
      // Verificar se a conclusão foi depois do mês especificado
      return dataConclusao > fimMes;
    });
    
    // Demandas que iniciaram no mês e ainda estão em andamento
    const demandasEmAndamentoNoMes = cronogramasDoMes.filter(d => {
      return d.status === 'em_andamento' || d.status === 'pendente' || d.status === 'atrasado';
    });
    
    // Demandas que iniciaram no mês e ainda estão pendentes
    const demandasPendentesNoMes = cronogramasDoMes.filter(d => {
      return d.status === 'pendente';
    });
    
    // Demandas que iniciaram no mês e estão atrasadas
    const demandasAtrasadasNoMes = cronogramasDoMes.filter(d => {
      return d.status === 'atrasado';
    });
    
    const nomeMes = new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    // Montar prompt específico para o mês
    const isComparativo = userOrg === 'portes' && organizacaoFiltro === 'todos';
    const organizacoesList = Object.keys(organizacoes);
    
    // Preparar dados completos das demandas do mês
    const demandasCompletasMes = cronogramasDoMes.map(d => ({
      titulo: d.titulo,
      descricao: d.descricao || 'Sem descrição',
      responsavel: d.responsavel_nome || 'Não definido',
      status: d.status,
      dataInicio: d.data_inicio,
      dataFim: d.data_fim,
      motivoAtraso: d.motivo_atraso || null,
      checklists: d.checklists || [],
      faseAtual: d.fase_atual || null,
      concluidaNoMes: demandasConcluidasNoMes.some(c => c.id === d.id),
      concluidaDepois: demandasIniciadasNoMesConcluidasDepois.some(c => c.id === d.id),
      mesConclusao: d.data_fim ? new Date(d.data_fim).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : null
    }));

    let prompt = `Você é um especialista em análise de cronogramas. Gere um relatório SIMPLES, DIRETO e RÁPIDO em pt-BR, seguindo EXATAMENTE este formato:

MÊS ANALISADO: ${nomeMes} (${mesCode})

${isComparativo ? `ORGANIZAÇÕES: ${organizacoesList.join(', ')}` : `ORGANIZAÇÃO: ${organizacoesList[0] || 'N/A'}`}

IMPORTANTE: Este relatório analisa APENAS demandas que INICIARAM no mês ${nomeMes}. 
Demandas que iniciaram em outros meses mas estiveram ativas neste mês NÃO são incluídas.

DADOS COMPLETOS DAS DEMANDAS DO MÊS:
${JSON.stringify(demandasCompletasMes, null, 2)}

FORMATO OBRIGATÓRIO (Markdown):

## Resumo do Mês
[Máximo 5 linhas. Resumo geral do que aconteceu no mês ${nomeMes}, sem enrolação.]

## Demandas

Para CADA demanda que iniciou no mês ${nomeMes}, use EXATAMENTE este formato:

### [Nome da Demanda] - ([Responsável])

**Status:** [concluída/em andamento/atrasada/pendente]

**Descrição:** [Breve resumo da demanda em 1-2 linhas]

[Se concluída no mesmo mês:]
- Concluída em: ${nomeMes}
- Checklists concluídos: [resumo dos checklists concluídos no mês, listando apenas os que foram concluídos]

[Se concluída depois do mês:]
- Iniciada em ${nomeMes}, concluída em: [mês de conclusão]
- Checklists concluídos: [resumo dos checklists concluídos, listando apenas os que foram concluídos]

[Se em andamento:]
- Ainda em andamento. [Breve explicação do status atual]
- Checklists: [resumo dos checklists - quais concluídos e quais pendentes]

[Se atrasada:]
- Atrasada. Motivo: [motivo do atraso se disponível]
- Checklists: [resumo dos checklists - quais concluídos e quais pendentes]

[Se pendente:]
- Pendente. [Breve explicação]
- Checklists: [resumo dos checklists pendentes]

REGRAS IMPORTANTES:
- Seja DIRETO. Sem enrolação.
- Máximo 3-4 linhas por demanda.
- Se a demanda tem data_inicio no mês ${nomeMes}, ela JÁ INICIOU. Nunca diga "ainda não iniciou".
- Para checklists concluídos, liste apenas os títulos em 1 linha: "Checklists concluídos: X, Y, Z"
- Para checklists pendentes, liste apenas os títulos em 1 linha: "Checklists pendentes: X, Y, Z"
- Use linguagem simples e objetiva.
- NÃO invente dados. Use apenas o que está no JSON.`;

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você gera relatórios SIMPLES, DIRETOS e RÁPIDOS em pt-BR, para leigos, sempre em Markdown determinístico. Sem enrolação. Foco em clareza e objetividade. Use apenas os dados fornecidos."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 6000,
      temperature: 0.2
    });
    
    const analiseIA = completion.choices[0].message.content;
    
    return {
      analise: analiseIA,
      mes: nomeMes,
      mesCodigo: mesCode,
      demandasConcluidas: demandasConcluidasNoMes.length,
      demandasIniciadasConcluidasDepois: demandasIniciadasNoMesConcluidasDepois.length,
      demandasEmAndamento: demandasEmAndamentoNoMes.length,
      checklistsConcluidos: checklistsConcluidosNoMes.length,
      totalDemandas: cronogramasDoMes.length,
      dadosDetalhados: {
        demandasConcluidas: demandasConcluidasNoMes,
        demandasIniciadasConcluidasDepois: demandasIniciadasNoMesConcluidasDepois,
        demandasEmAndamento: demandasEmAndamentoNoMes,
        checklistsConcluidos: checklistsConcluidosNoMes
      }
    };
    
  } catch (error) {
    console.error('❌ Erro ao analisar cronograma por mês com IA:', error);
    throw error;
  }
};

// Endpoint para analisar cronograma por mês específico com IA
exports.analisarCronogramaPorMesIA = async (req, res) => {
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
    
    const { organizacao, status, ano, mes } = req.body;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    
    if (!ano || !mes) {
      return res.status(400).json({
        success: false,
        error: 'Ano e mês são obrigatórios',
        details: 'Forneça ano (ex: 2025) e mês (1-12)'
      });
    }
    
    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);
    
    if (mesNum < 1 || mesNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Mês inválido',
        details: 'Mês deve estar entre 1 e 12'
      });
    }
    
    console.log(`🤖 Iniciando análise com IA para mês ${mes}/${ano} - Organização solicitada:`, organizacao || 'todas');
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
    
    // Processar cada cronograma
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
    
    // Analisar com IA para o mês específico
    console.log(`🤖 Enviando dados para análise da IA do mês ${mes}/${ano}...`);
    const resultadoIA = await analisarCronogramaPorMesComIA(
      cronogramasFormatados,
      organizacoes,
      userOrg,
      organizacao || 'todos',
      anoNum,
      mesNum
    );
    
    console.log('✅ Análise com IA concluída com sucesso');
    
    res.json({
      success: true,
      data: {
        analise: resultadoIA.analise,
        mes: resultadoIA.mes,
        mesCodigo: resultadoIA.mesCodigo,
        estatisticas: {
          totalDemandas: resultadoIA.totalDemandas,
          demandasConcluidas: resultadoIA.demandasConcluidas,
          demandasIniciadasConcluidasDepois: resultadoIA.demandasIniciadasConcluidasDepois || 0,
          demandasEmAndamento: resultadoIA.demandasEmAndamento,
          checklistsConcluidos: resultadoIA.checklistsConcluidos
        },
        dadosDetalhados: resultadoIA.dadosDetalhados,
        metadata: {
          organizacaoFiltro: organizacao || 'todas',
          usuarioOrganizacao: userOrg,
          geradoEm: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao analisar cronograma por mês com IA:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Erro ao analisar cronograma por mês com IA',
      details: error.message || 'Erro desconhecido',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  } finally {
    if (server) {
      try {
        server.close();
      } catch (err) {
        console.error('Erro ao fechar tunnel:', err);
      }
    }
  }
};
