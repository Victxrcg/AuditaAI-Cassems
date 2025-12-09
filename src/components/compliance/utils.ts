import { ComplianceItem, Competencia } from './types';
import { listAnexos, getTipoAnexoFromItemId } from '@/services/anexosService';
import { formatDateBR, formatDateTimeBR } from '@/utils/dateUtils';

// Carregar estado dos cards do localStorage
export const loadCardsState = (): Record<string, any> => {
  try {
    const savedState = localStorage.getItem('compliance-cards-state');
    return savedState ? JSON.parse(savedState) : {};
  } catch (error) {
    console.error('Erro ao carregar estado dos cards:', error);
    return {};
  }
};

// Inicializar itens de compliance
export const initializeComplianceItems = (): ComplianceItem[] => {
  const defaultItems: ComplianceItem[] = [
    { id: '1', title: 'Período', description: 'Informe o período fiscal referente à competência.', status: 'pendente', isExpanded: false },
    { id: '2', title: 'Relatório Técnico', description: 'Anexe o relatório técnico inicial.', status: 'pendente', isExpanded: false },
    { id: '3', title: 'Relatório Faturamento', description: 'Anexe o relatório de faturamento.', status: 'pendente', isExpanded: false },
    { id: '4', title: 'Comprovação de Compensações', description: 'Anexe documentos que comprovem as compensações.', status: 'pendente', isExpanded: false },
    { id: '6', title: 'Comprovação de Email', description: 'Informe os dados do email enviado.', status: 'pendente', isExpanded: false },
    { id: '7', title: 'Notas Fiscais Enviadas', description: 'Anexe as notas fiscais enviadas.', status: 'pendente', isExpanded: false },
    { id: '8', title: 'Parecer Final', description: 'Gere o parecer final com IA ou preencha manualmente.', status: 'pendente', isExpanded: false }
  ];

  const savedState = loadCardsState();

  return defaultItems.map(item => {
    const savedItemState = savedState[item.id];
    if (savedItemState) {
      return {
        ...item,
        ...savedItemState,
        isExpanded: savedItemState.isExpanded ?? false
      };
    }
    return item;
  });
};

// Verificar se pode gerar parecer IA
export const canGenerateAIParecer = async (
  complianceItems: ComplianceItem[], 
  competenciaId: string | null
): Promise<boolean> => {
  const requiredSteps = ['1', '2', '3', '4', '6', '7'];
  
  for (const stepId of requiredSteps) {
    const step = complianceItems.find(item => item.id === stepId);
    if (!step) return false;
    
    const hasData = Boolean(
      (step.valor && step.valor.trim()) ||
      (step.data && step.data.trim()) ||
      (step.observacoes && step.observacoes.trim())
    );
    let hasAnexos = false;
    
    if (competenciaId) {
      try {
        const tipoAnexo = getTipoAnexoFromItemId(stepId);
        const anexosData = await listAnexos(competenciaId);
        const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
        hasAnexos = filteredAnexos.length > 0;
      } catch (error) {
        console.error('Erro ao verificar anexos:', error);
      }
    }
    
    if (!hasData && !hasAnexos) {
      return false;
    }
  }
  
  return true;
};

// Verificar se uma etapa pode ser acessada
export const canAccessStep = async (
  itemId: string, 
  complianceItems: ComplianceItem[], 
  competenciaId: string | null
): Promise<boolean> => {
  const stepOrder = ['1', '2', '3', '4', '6', '7', '8'];
  
  if (itemId === '1') return true;
  
  const currentIndex = stepOrder.indexOf(itemId);
  if (currentIndex === -1) return true;
  
  const previousStepId = stepOrder[currentIndex - 1];
  const previousStep = complianceItems.find(item => item.id === previousStepId);
  
  if (!previousStep) return true;
  
  const hasData = Boolean(
    (previousStep.data && previousStep.data.trim()) ||
    (previousStep.valor && previousStep.valor.trim()) ||
    (previousStep.observacoes && previousStep.observacoes.trim())
  );
  
  let hasAnexos = false;
  if (competenciaId) {
    try {
      const tipoAnexo = getTipoAnexoFromItemId(previousStepId);
      const anexosData = await listAnexos(competenciaId);
      const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
      hasAnexos = filteredAnexos.length > 0;
    } catch (error) {
      console.error('Erro ao verificar anexos:', error);
    }
  }
  
  return hasData || hasAnexos;
};

// Formatar nome da organização
export const formatOrganizationName = (org: string | undefined) => {
  if (!org) return 'Organização';
  
  const nomes: Record<string, string> = {
    'portes': 'PORTES',
    'cassems': 'CASSEMS',
    'rede_frota': 'MARAJÓ / REDE FROTA'
  };
  
  return nomes[org.toLowerCase()] || org.toUpperCase().replace(/_/g, ' ');
};

// Clarear cor hex
export const lightenColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.15)`;
};

// Escurecer cor hex
export const darkenColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (val: number) => Math.max(0, Math.floor(val * 0.6));
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
};

// Funções getOrganizationBadge e getEditIndicator movidas para components.tsx
// (elas retornam JSX e precisam estar em um arquivo .tsx)

// Obter nome do tipo de compliance
export const getTipoComplianceName = (tipo?: string): string => {
  const names: Record<string, string> = {
    'rat-fat': 'RAT e FAP',
    'subvencao-fiscal': 'Subvenção Fiscal',
    'terceiros': 'Terceiros',
    'creditos-nao-alocados': 'Créditos não alocados',
    'icms-equalizacao': 'ICMS e Equalização'
  };
  return names[tipo || ''] || 'Compliance';
};

import { LeiVigente } from './types';

// Obter leis vigentes
export const getLeisVigentes = (tipo?: string): LeiVigente[] => {
  if (!tipo) return [];
  
  const leis: Record<string, LeiVigente[]> = {
    'rat-fat': [
      {
        titulo: 'Decreto 3.048/1999',
        descricao: 'Regulamenta a Previdência Social e estabelece normas para o regime geral de previdência social.',
        link: 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm'
      },
      {
        titulo: 'Solução de Consulta COSIT 79/2023',
        descricao: 'Orientações sobre consulta de CNPJ e procedimentos fiscais vigentes.',
        link: 'http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?facetsExistentes=&orgaosSelecionados=&tiposAtosSelecionados=&lblTiposAtosSelecionados=&ordemColuna=&ordemDirecao=&tipoConsulta=formulario&tipoAtoFacet=&siglaOrgaoFacet=&anoAtoFacet=&termoBusca=consulta+cnpj&numero_ato=79&tipoData=1&dt_inicio=&dt_fim=&ano_ato=&p=1&optOrdem=relevancia&p=1'
      }
    ],
    'subvencao-fiscal': [
      {
        titulo: 'Lei nº 12.973/2014 (art. 30)',
        descricao: 'Prevê, para empresas tributadas com base no lucro real, que subvenções para investimento — sob certas condições — poderiam deixar de integrar a base de cálculo do IRPJ/CSLL.',
        link: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12973.htm'
      },
      {
        titulo: 'Lei Complementar nº 160/2017',
        descricao: 'Inclui no art. 30 da Lei 12.973/2014 (§§ 4º e 5º) que os benefícios fiscais ou financeiro-fiscais relativos ao ICMS concedidos por Estados ou DF são considerados subvenção para investimento.',
        link: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp160.htm'
      },
      {
        titulo: 'Lei nº 14.789/2023',
        descricao: 'Conhecida como "Lei das Subvenções". Altera o regime tributário das subvenções para investimento, revoga o art. 30 da Lei 12.973/2014, cria regime de crédito fiscal para subvenções para investimento, restringe tratamento de subvenções para custeio. Vigente a partir de 1º de janeiro de 2024.',
        link: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14789.htm'
      },
      {
        titulo: 'Solução de Consulta COSIT nº 216/2025',
        descricao: 'A RFB define que os créditos presumidos de ICMS, mesmo que historicamente tratados como subvenção para investimento, integram as bases de cálculo do IRPJ e CSLL a partir de 1º/1/2024, por ausência de previsão legal que permita sua exclusão.',
        link: 'http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?numero_ato=216&ano_ato=2025'
      },
      {
        titulo: 'Solução de Consulta COSIT nº 223/2025',
        descricao: 'Confirma a impossibilidade de exclusão das receitas de subvenções para investimento (inclusive crédito presumido de ICMS) da base do IRPJ, CSLL, PIS/Pasep e Cofins a partir de 1º/1/2024, nos termos da Lei 14.789/2023.',
        link: 'http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?numero_ato=223&ano_ato=2025'
      },
      {
        titulo: 'Solução de Consulta COSIT nº 11/2025',
        descricao: 'Tratou do tema das subvenções governamentais, especialmente à luz da nova legislação (Lei 14.789/2023) e evolução do tratamento jurídico-tributário.',
        link: 'http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?numero_ato=11&ano_ato=2025'
      },
      {
        titulo: 'Solução de Consulta COSIT nº 202/2025',
        descricao: 'Sobre subvenção para investimento / benefício fiscal de ICMS.',
        link: 'http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?numero_ato=202&ano_ato=2025'
      }
    ],
    'terceiros': [
      {
        titulo: 'Lei a definir',
        descricao: 'Leis específicas para compliance e gestão de terceiros serão definidas em breve.'
      }
    ],
    'creditos-nao-alocados': [
      {
        titulo: 'Código Tributário Nacional – CTN (Lei nº 5.172/1966)',
        descricao: 'Artigos 165 a 169 – dão o direito à restituição do tributo pago indevidamente ou a maior, inclusive nos casos de: erro na identificação do sujeito passivo; erro na alíquota, no cálculo do montante ou na elaboração de documentos de arrecadação. Esses dispositivos são a base jurídica para tratar o crédito que aparece como "não alocado": na prática, ele costuma ser justamente pagamento indevido ou a maior.',
        link: 'https://www.planalto.gov.br/ccivil_03/leis/l5172.htm'
      },
      {
        titulo: 'Lei nº 9.430/1996 – arts. 73 e 74',
        descricao: 'Art. 73 – disciplina a restituição e o ressarcimento de tributos administrados pela Receita Federal e de pagamentos efetuados indevidamente. Art. 74 – trata da compensação desses créditos com outros tributos federais, mediante pedido do contribuinte (base legal do PER/DCOMP). Em resumo: a lei diz que qualquer pagamento indevido ou a maior (inclusive aqueles que resultam em "crédito não alocado") pode ser restituído ou compensado, desde que respeitados os requisitos e prazos.',
        link: 'https://www.planalto.gov.br/ccivil_03/leis/l9430.htm'
      },
      {
        titulo: 'Lei nº 12.527/2011 (Lei de Acesso à Informação – LAI) + Tema 582/STF',
        descricao: 'A LAI garante acesso a informações de interesse do próprio contribuinte em bancos de dados públicos. O STF, no RE 673.707/MG (Tema 582), firmou tese de que o habeas data é meio adequado para obter os dados sobre pagamentos de tributos constantes de sistemas como o SINCOR (Sistema de Conta‑Corrente de Pessoa Jurídica da RFB). Na prática: isso fundamenta o direito de acesso ao extrato SINCOR para identificar créditos/pagamentos não alocados.',
        link: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm'
      }
    ],
    'icms-equalizacao': [
      {
        titulo: 'Lei a definir',
        descricao: 'Leis específicas para ICMS e Equalização serão definidas em breve.'
      }
    ]
  };
  
  return leis[tipo] || [];
};

// Obter status das leis vigentes
export const getStatusLeisVigentes = (tipo?: string): string => {
  if (!tipo) return '';
  
  const status: Record<string, string> = {
    'rat-fat': 'Ambas as legislações estão vigentes e devem ser observadas nos procedimentos de compliance fiscal.',
    'subvencao-fiscal': 'Todas as legislações estão vigentes e devem ser observadas nos procedimentos de compliance fiscal. A Lei 14.789/2023 passou a vigorar para fatos geradores a partir de 01/01/2024.',
    'terceiros': 'Aguardando definição das legislações específicas.',
    'creditos-nao-alocados': 'Todas as legislações estão vigentes e devem ser observadas nos procedimentos de compliance fiscal. O CTN estabelece a base jurídica para restituição de tributos pagos indevidamente, a Lei 9.430/1996 disciplina a restituição e compensação de créditos, e a LAI garante o acesso às informações necessárias para identificar créditos não alocados.',
    'icms-equalizacao': 'Aguardando definição das legislações específicas para ICMS e Equalização.'
  };
  
  return status[tipo] || '';
};

