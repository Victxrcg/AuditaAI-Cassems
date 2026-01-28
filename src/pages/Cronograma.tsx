import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  addHeader,
  addFooter,
  addSectionTitle,
  addBodyText,
  addListItem,
  addDivider,
  addTable,
  addLayoutBackgroundToAllPages,
  ensureSpace,
  LAYOUT_COLORS,
  LAYOUT_CONFIG
} from '@/utils/pdfLayoutUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { 
  listChecklistItems, 
  toggleChecklistItem,
  updateChecklistItem,
  type ChecklistItem
} from '@/services/checklistService';
import Checklist from '@/components/Checklist';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  Users,
  Target,
  Filter,
  RefreshCw,
  BarChart3,
  Building,
  AlertTriangle,
  List,
  ChevronDown,
  ChevronUp,
  User,
  GripVertical,
  CheckSquare,
  Download,
  ArrowLeft
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CronogramaItem {
  id: number;
  titulo: string;
  descricao?: string;
  organizacao: string;
  fase_atual: string;
  data_inicio?: string;
  data_fim?: string;
  status: 'pendente' | 'em_andamento' | 'concluido' | 'atrasado';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  responsavel_id?: number;
  responsavel_nome?: string;
  responsavel_email?: string;
  responsavel_empresa?: string;
  observacoes?: string;
  motivo_atraso?: string;
  // Parte com o atraso na demanda (quem está devendo ação)
  parte_responsavel_atraso?: 'portes' | 'empresa' | null;
  data_ultima_atualizacao?: string;
  created_at: string;
  updated_at: string;
}

interface Estatisticas {
  total_cronogramas: number;
  pendentes: number;
  em_andamento: number;
  concluidos: number;
  atrasados: number;
  progresso_medio: number;
  total_organizacoes: number;
  atrasados_portes?: number;
  atrasados_empresa?: number;
}

interface CronogramaAlerta {
  id: number;
  tipo: 'cronograma' | 'checklist';
  cronograma_id: number;
  checklist_id?: number | null;
  organizacao: string;
  titulo: string;
  descricao?: string | null;
  created_at: string;
  created_by?: number | null;
  created_by_nome?: string | null;
  acknowledged: boolean;
  acknowledged_at?: string | null;
}

const Cronograma = () => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';
  const [cronogramas, setCronogramas] = useState<CronogramaItem[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [editingCronograma, setEditingCronograma] = useState<CronogramaItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingCronograma, setViewingCronograma] = useState<CronogramaItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [isDelayExpanded, setIsDelayExpanded] = useState(false);
  const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedOrganizationForPDF, setSelectedOrganizationForPDF] = useState<string>('todos');
  const [selectedStatusForPDF, setSelectedStatusForPDF] = useState<string>('todos');
  const [selectedStatusForNonPortesPDF, setSelectedStatusForNonPortesPDF] = useState<string>('todos');
  const [selectedMes, setSelectedMes] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>('');
  const [tipoOverview, setTipoOverview] = useState<'geral' | 'por_mes'>('geral');
  const [usarIA, setUsarIA] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [loadingMesIA, setLoadingMesIA] = useState(false);
  // Estados para o overview com streaming
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [overviewText, setOverviewText] = useState('');
  const [overviewStatus, setOverviewStatus] = useState('');
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);
  const [overviewMetadata, setOverviewMetadata] = useState<any>(null);
  const overviewTextRef = useRef<HTMLDivElement>(null);
  const alertasBuscadosRef = useRef<boolean>(false);
  const [organizacoes, setOrganizacoes] = useState<any[]>([]);
  
  // Scroll automático quando novo texto chega
  useEffect(() => {
    if (overviewTextRef.current && isGeneratingOverview) {
      overviewTextRef.current.scrollTop = overviewTextRef.current.scrollHeight;
    }
  }, [overviewText, isGeneratingOverview]);
  const [organizacaoSelecionada, setOrganizacaoSelecionada] = useState<string | null>(null);
  const [mostrarSelecaoEmpresa, setMostrarSelecaoEmpresa] = useState(false);
  const [loadingOrganizacoes, setLoadingOrganizacoes] = useState(false);
  const [alertasPendentes, setAlertasPendentes] = useState<CronogramaAlerta[]>([]);
  const [alertasLoading, setAlertasLoading] = useState(false);
  const [ackLoadingId, setAckLoadingId] = useState<number | null>(null);
  const [ackAllLoading, setAckAllLoading] = useState(false);
  const [paginaAlertas, setPaginaAlertas] = useState(1);
  const ALERTAS_POR_PAGINA = 3;
  const initialFormData = () => ({
    titulo: '',
    descricao: '',
    organizacao: currentUser?.organizacao || 'cassems',
    fase_atual: 'inicio',
    data_inicio: '',
    data_fim: '',
    status: 'pendente',
    prioridade: 'media',
    observacoes: '',
    motivo_atraso: '',
    parte_responsavel_atraso: null as 'portes' | 'empresa' | null,
    responsavel_id: null as number | null
  });

  const [formData, setFormData] = useState(initialFormData());
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todos');
  const [filtroOrganizacao, setFiltroOrganizacao] = useState<string>('todos');
  const [filtrosExpanded, setFiltrosExpanded] = useState<boolean>(true);
  const { toast } = useToast();

  // Carregar usuário atual
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
    
    // Se for usuário Portes, verificar se houve novo login
    if (user?.organizacao === 'portes') {
      const ultimoLoginTimestamp = localStorage.getItem('ultimo_login_timestamp');
      const ultimoAcessoTimestamp = localStorage.getItem('ultimo_acesso_cronograma_timestamp');
      
      // Verificar se houve novo login (timestamp de login é mais recente que último acesso)
      const houveNovoLogin = ultimoLoginTimestamp && 
        (!ultimoAcessoTimestamp || parseInt(ultimoLoginTimestamp) > parseInt(ultimoAcessoTimestamp));
      
      if (houveNovoLogin) {
        // Novo login: sempre mostrar cards primeiro
        setMostrarSelecaoEmpresa(true);
        setOrganizacaoSelecionada(null);
        // Limpar seleção salva ao relogar
        localStorage.removeItem('cronograma-empresa-selecionada');
      } else {
        // Navegação normal: carregar empresa selecionada salva
        const empresaSalva = localStorage.getItem('cronograma-empresa-selecionada');
        if (empresaSalva) {
          setOrganizacaoSelecionada(empresaSalva);
          setMostrarSelecaoEmpresa(false);
        } else {
          // Se não tem empresa salva, mostrar cards
          setMostrarSelecaoEmpresa(true);
          setOrganizacaoSelecionada(null);
        }
      }
      
      // Salvar timestamp do acesso atual
      localStorage.setItem('ultimo_acesso_cronograma_timestamp', Date.now().toString());
    } else {
      // Usuários não-Portes vão direto para o cronograma da sua organização
      setOrganizacaoSelecionada(user?.organizacao || 'cassems');
      setMostrarSelecaoEmpresa(false);
    }
  }, []);

  // Buscar organizações cadastradas
  useEffect(() => {
    const fetchOrganizacoes = async () => {
      // Só buscar se for usuário Portes
      if (currentUser?.organizacao !== 'portes') {
        return;
      }

      setLoadingOrganizacoes(true);
      try {
        const res = await fetch(`${API_BASE}/organizacoes`, {
          headers: {
            'x-user-organization': currentUser?.organizacao || 'portes'
          }
        });
        
        if (res.ok) {
          const response = await res.json();
          // A API pode retornar { success: true, data: [...] } ou diretamente um array
          const data = response.data || response;
          const organizacoesArray = Array.isArray(data) ? data : [];
          // Filtrar apenas organizações ativas
          const organizacoesAtivas = organizacoesArray.filter((org: any) => org.ativa !== false);
          setOrganizacoes(organizacoesAtivas);
        } else {
          console.error('Erro ao buscar organizações:', res.status);
          setOrganizacoes([]);
        }
      } catch (error) {
        console.error('Erro ao buscar organizações:', error);
        setOrganizacoes([]);
      } finally {
        setLoadingOrganizacoes(false);
      }
    };

    if (currentUser?.organizacao === 'portes') {
      fetchOrganizacoes();
    }
  }, [currentUser, API_BASE]);

  // Carregar ordem salva das demandas
  useEffect(() => {
    const savedOrder = localStorage.getItem('cronograma-order');
    if (savedOrder) {
      try {
        setOrdemDemandas(JSON.parse(savedOrder));
      } catch (error) {
        console.error('Erro ao carregar ordem das demandas:', error);
      }
    }
  }, []);

  // Carregar cronogramas
  const fetchCronogramas = async (org?: string) => {
    setLoading(true);
    try {
      // Se for Portes e tiver organização selecionada, usar ela
      // Se não for Portes, usar a organização do usuário
      let orgParaBuscar: string;
      if (currentUser?.organizacao === 'portes') {
        orgParaBuscar = org || organizacaoSelecionada || 'todos';
      } else {
        orgParaBuscar = currentUser?.organizacao || 'cassems';
      }
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const res = await fetch(`${API_BASE}/cronograma?organizacao=${orgParaBuscar}`, {
        headers: {
          'x-user-organization': userOrg
        }
      });
      
      if (!res.ok) {
        console.error('Erro ao buscar cronogramas:', res.status, res.statusText);
        setCronogramas([]);
        return;
      }
      
      const data = await res.json();
      setCronogramas(data);
    } catch (error) {
      console.error('Erro na requisição:', error);
      setCronogramas([]);
      toast({
        title: "Erro",
        description: "Erro ao carregar cronogramas",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  // Carregar cronogramas apenas uma vez ao montar ou quando a organização selecionada mudar
  useEffect(() => {
    if (!currentUser) return;

    // Chamar fetchCronogramas apenas uma vez ao montar ou quando organização mudar
    fetchCronogramas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, organizacaoSelecionada]); // Depender apenas de valores estáveis

  // Verificar periodicamente se há cronogramas que precisam ser atualizados para "atrasado"
  useEffect(() => {
    if (!currentUser || cronogramas.length === 0) return;

    const verificarAtrasos = () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const temAtrasos = cronogramas.some(cronograma => {
        if (!cronograma.data_fim || cronograma.status === 'concluido' || cronograma.status === 'atrasado') {
          return false;
        }
        const dataFim = new Date(cronograma.data_fim);
        dataFim.setHours(0, 0, 0, 0);
        return dataFim < hoje;
      });

      // Se houver cronogramas que precisam ser atualizados, recarregar
      if (temAtrasos) {
        fetchCronogramas();
      }
    };

    // Verificar imediatamente
    verificarAtrasos();

    // Verificar a cada hora (3600000 ms)
    const interval = setInterval(verificarAtrasos, 3600000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cronogramas.length, currentUser?.id]);
  

  // Buscar usuários para atribuição
  const fetchUsuarios = async () => {
    try {
      const userOrg = currentUser?.organizacao || 'cassems';
      const res = await fetch(`${API_BASE}/usuarios?organizacao=${userOrg}`, {
        headers: {
          'x-user-organization': userOrg
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  // Carregar estatísticas
  const fetchEstatisticas = async () => {
    try {
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const res = await fetch(`${API_BASE}/cronograma/estatisticas?organizacao=${userOrg}`, {
        headers: {
          'x-user-organization': userOrg
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setEstatisticas(data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };


  // Função para gerar PDF do overview das demandas
  const gerarOverviewPDF = async (organizacaoSelecionada?: string, statusSelecionado?: string) => {
    try {
      // Usar organização passada como parâmetro ou o filtro atual
      const orgParaFiltrar = organizacaoSelecionada || filtroOrganizacao;
      const statusParaFiltrar = statusSelecionado || 'todos';
      
      // Buscar dados formatados da API
      const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      
      // Construir URL baseada no tipo de usuário
      let url = `${baseUrl}/pdf/dados-cronograma`;
      const params = new URLSearchParams();
      
      if (currentUser?.organizacao === 'portes') {
        // Usuário Portes pode especificar organização
        params.append('organizacao', orgParaFiltrar);
      }
      
      // Adicionar filtro de status se não for 'todos'
      if (statusParaFiltrar !== 'todos') {
        params.append('status', statusParaFiltrar);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      // Para usuários não-Portes, não enviar parâmetro organizacao - o backend usará x-user-organization
      
      console.log('📄 Gerando PDF para organização:', orgParaFiltrar);
      console.log('📄 Gerando PDF para status:', statusParaFiltrar);
      console.log('📄 Tipo de usuário:', currentUser?.organizacao);
      console.log('📄 URL da API:', url);
      
      const response = await fetch(url, {
        headers: {
          'x-user-organization': currentUser?.organizacao || 'cassems',
          'x-user-id': currentUser?.id || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar dados para PDF');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar dados');
      }
      
      const { resumo, organizacoes, statsPorOrganizacao, metadata } = data.data;
      
      console.log('📄 Dados recebidos da API:', {
        resumo,
        organizacoes: Object.keys(organizacoes),
        statsPorOrganizacao,
        metadata
      });
      
      // Debug: verificar se os dados estão filtrados corretamente
      console.log('📄 Verificando filtro de status:', {
        statusSolicitado: statusParaFiltrar,
        totalDemandas: resumo.totalDemandas,
        demandasConcluidas: resumo.demandasConcluidas,
        demandasEmAndamento: resumo.demandasEmAndamento,
        demandasPendentes: resumo.demandasPendentes,
        demandasAtrasadas: resumo.demandasAtrasadas
      });
      
      // Se não há demandas para a organização selecionada
      if (resumo.totalDemandas === 0) {
        alert('Não há demandas para a organização selecionada.');
        return;
      }
      
      // Criar um novo documento PDF com configurações otimizadas para Unicode
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // Configurar fonte que suporta melhor os caracteres especiais
      pdf.setFont('helvetica');
      
      // IMPORTANTE: Adicionar background PRIMEIRO (antes de qualquer conteúdo)
      // Isso garante que o layout fique atrás e o conteúdo seja escrito por cima
      try {
        pdf.addImage('/layout-background.png', 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
      } catch (error) {
        console.warn('Erro ao carregar background, continuando sem ele:', error);
      }
      
      // Adicionar cabeçalho com layout do documento Word
      let yPosition = addHeader(pdf);
      
      // Título principal
      yPosition = addSectionTitle(pdf, 'OVERVIEW DO CRONOGRAMA DE DEMANDAS', yPosition, 1);
      
      // Informações do documento
      yPosition = addBodyText(pdf, `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, yPosition, {
        fontSize: 11,
        color: LAYOUT_COLORS.lightGray
      });
      
      yPosition = addBodyText(pdf, `Organização: ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'Sistema'}`, yPosition, {
        fontSize: 12,
        isBold: true
      });
      
      yPosition = addDivider(pdf, yPosition);
      
      // RESUMO EXECUTIVO
      if (statusParaFiltrar !== 'todos') {
        const statusLabel = statusParaFiltrar === 'concluido' ? 'Concluídas' : 
                           statusParaFiltrar === 'em_andamento' ? 'Em Andamento' :
                           statusParaFiltrar === 'pendente' ? 'Pendentes' :
                           statusParaFiltrar === 'atrasado' ? 'Atrasadas' : statusParaFiltrar;
        yPosition = addSectionTitle(pdf, `RESUMO EXECUTIVO - DEMANDAS ${statusLabel.toUpperCase()}`, yPosition, 2);
      } else {
        yPosition = addSectionTitle(pdf, 'RESUMO EXECUTIVO', yPosition, 2);
      }
      
      // Métricas principais em tabela
      const headers = ['Total', 'Concluídas', 'Em Andamento', 'Pendentes', 'Atrasadas'];
      const statsRow = [
        resumo.totalDemandas.toString(),
        resumo.demandasConcluidas.toString(),
        resumo.demandasEmAndamento.toString(),
        resumo.demandasPendentes.toString(),
        resumo.demandasAtrasadas.toString()
      ];
      
      yPosition = addTable(pdf, headers, [statsRow], yPosition, {
        fontSize: 11
      });
      
      if (statusParaFiltrar !== 'todos') {
        yPosition = addBodyText(pdf, 
          `Todas as ${resumo.totalDemandas} demandas são ${statusParaFiltrar === 'concluido' ? 'concluídas' : 
                                                           statusParaFiltrar === 'em_andamento' ? 'em andamento' :
                                                           statusParaFiltrar === 'pendente' ? 'pendentes' :
                                                           statusParaFiltrar === 'atrasado' ? 'atrasadas' : statusParaFiltrar}`, 
          yPosition, {
          fontSize: 12,
          isBold: true
        });
      } else {
        yPosition = addBodyText(pdf, `Percentual de Conclusão: ${resumo.percentualConclusao}%`, yPosition, {
          fontSize: 12,
          isBold: true,
          color: LAYOUT_COLORS.primary
        });
      }
      
      yPosition = addDivider(pdf, yPosition);
      
      // MÉTRICAS ADICIONAIS (apenas se não houver filtro de status)
      if (statusParaFiltrar === 'todos' && resumo.totalChecklists !== undefined) {
        yPosition = addSectionTitle(pdf, 'MÉTRICAS DE CHECKLISTS', yPosition, 3);
        
        const checklistsInfo = [
          `Total de Checklists: ${resumo.totalChecklists || 0}`,
          `Checklists Concluídos: ${resumo.checklistsConcluidos || 0}`,
          `Percentual de Conclusão: ${resumo.percentualChecklists || 0}%`
        ];
        
        yPosition = addListItem(pdf, checklistsInfo, yPosition, {
          fontSize: 10,
          indent: 5
        });
        
        yPosition = addDivider(pdf, yPosition);
      }
      
      // DEMANDAS POR PRIORIDADE
      if (statusParaFiltrar === 'todos' && resumo.demandasPorPrioridade) {
        yPosition = addSectionTitle(pdf, 'DISTRIBUIÇÃO POR PRIORIDADE', yPosition, 3);
        
        const prioridadesInfo = [
          `Crítica: ${resumo.demandasPorPrioridade.critica || 0}`,
          `Alta: ${resumo.demandasPorPrioridade.alta || 0}`,
          `Média: ${resumo.demandasPorPrioridade.media || 0}`,
          `Baixa: ${resumo.demandasPorPrioridade.baixa || 0}`
        ];
        
        yPosition = addListItem(pdf, prioridadesInfo, yPosition, {
          fontSize: 10,
          indent: 5
        });
        
        yPosition = addDivider(pdf, yPosition);
      }
      
      // ALERTAS DE PRAZO
      if (statusParaFiltrar === 'todos' && resumo.demandasProximasPrazo !== undefined && resumo.demandasSemPrazo !== undefined && 
          (resumo.demandasProximasPrazo > 0 || resumo.demandasSemPrazo > 0)) {
        yPosition = addSectionTitle(pdf, 'ALERTAS DE PRAZO', yPosition, 3);
        
        const alertasInfo: string[] = [];
        if (resumo.demandasProximasPrazo > 0) {
          alertasInfo.push(`⚠️ ${resumo.demandasProximasPrazo} demanda(s) com prazo nos próximos 7 dias`);
        }
        if (resumo.demandasSemPrazo > 0) {
          alertasInfo.push(`⚠️ ${resumo.demandasSemPrazo} demanda(s) sem prazo definido`);
        }
        
        if (alertasInfo.length > 0) {
          yPosition = addListItem(pdf, alertasInfo, yPosition, {
            fontSize: 10,
            indent: 5
          });
        }
        
        yPosition = addDivider(pdf, yPosition);
      }
      
      // DETALHES POR ORGANIZAÇÃO
      yPosition = addSectionTitle(pdf, 'DETALHES POR ORGANIZAÇÃO', yPosition, 2);
      
      Object.keys(organizacoes).forEach(organizacao => {
        const demandasOrg = organizacoes[organizacao];
        const orgStats = statsPorOrganizacao && statsPorOrganizacao[organizacao] 
          ? statsPorOrganizacao[organizacao]
          : null;
        
        yPosition = addSectionTitle(pdf, `ORGANIZAÇÃO: ${organizacao.toUpperCase()}`, yPosition, 3);
        
        // Usar estatísticas calculadas se disponíveis, senão calcular
        const concluidasOrg = orgStats ? orgStats.concluidas : demandasOrg.filter(c => c.status === 'concluido').length;
        const emAndamentoOrg = orgStats ? orgStats.emAndamento : demandasOrg.filter(c => c.status === 'em_andamento').length;
        const pendentesOrg = orgStats ? orgStats.pendentes : demandasOrg.filter(c => c.status === 'pendente').length;
        const atrasadasOrg = orgStats ? orgStats.atrasadas : demandasOrg.filter(c => c.status === 'atrasado').length;
        
        const orgHeaders = ['Total', 'Concluídas', 'Em Andamento', 'Pendentes', 'Atrasadas', '% Conclusão'];
        const orgStatsRow = [
          demandasOrg.length.toString(),
          concluidasOrg.toString(),
          emAndamentoOrg.toString(),
          pendentesOrg.toString(),
          atrasadasOrg.toString(),
          orgStats ? `${orgStats.percentualConclusao}%` : '0%'
        ];
        
        yPosition = addTable(pdf, orgHeaders, [orgStatsRow], yPosition, {
          fontSize: 10
        });
        
        // Adicionar informações de checklists se disponível
        if (orgStats && orgStats.checklistsTotal > 0) {
          yPosition = addBodyText(pdf, 
            `Checklists: ${orgStats.checklistsConcluidos}/${orgStats.checklistsTotal} concluídos (${orgStats.percentualChecklists}%)`, 
            yPosition, {
            fontSize: 9,
            color: LAYOUT_COLORS.lightGray
          });
        }
        
        // Listar demandas da organização de forma resumida
        const demandasList: string[] = [];
        demandasOrg.forEach((demanda, index) => {
          const statusLabel = {
            'concluido': '[✓]',
            'em_andamento': '[→]',
            'pendente': '[○]',
            'atrasado': '[⚠]'
          }[demanda.status] || '[?]';
          
          const prioridadeLabel = demanda.prioridade === 'critica' ? '🔴' :
                                  demanda.prioridade === 'alta' ? '🟠' :
                                  demanda.prioridade === 'media' ? '🟡' : '🟢';
          
          let itemText = `${statusLabel} ${prioridadeLabel} ${index + 1}. ${demanda.titulo}`;
          itemText += ` | ${demanda.responsavel_nome || 'Sem responsável'}`;
          if (demanda.data_fim) {
            const prazo = new Date(demanda.data_fim).toLocaleDateString('pt-BR');
            itemText += ` | Prazo: ${prazo}`;
          }
          
          // Adicionar informações de checklists se houver
          if (demanda.checklists && demanda.checklists.length > 0) {
            const checklistsConcluidos = demanda.checklists.filter(c => c.concluido).length;
            itemText += ` | Checklists: ${checklistsConcluidos}/${demanda.checklists.length}`;
          }
          
          demandasList.push(itemText);
        });
        
        yPosition = addListItem(pdf, demandasList, yPosition, {
          fontSize: 9,
          indent: 5
        });
        
        yPosition = addDivider(pdf, yPosition);
      });
      
      // Rodapé em todas as páginas
      // (O background já foi adicionado no início de cada página, antes do conteúdo)
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        addFooter(pdf, i, totalPages);
      }
      
      // Salvar o PDF
      const escopoNome = orgParaFiltrar === 'todos' ? 'todas-organizacoes' : orgParaFiltrar.toLowerCase().replace(/\s+/g, '-');
      const statusNome = statusParaFiltrar === 'todos' ? 'todos-status' : statusParaFiltrar;
      const fileName = `overview-cronograma-${escopoNome}-${statusNome}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o PDF. Tente novamente.');
    }
  };

  // Função para lidar com o clique no botão de gerar overview
  const handleGerarOverviewClick = () => {
    if (currentUser?.organizacao === 'portes') {
      // Usuário Portes: abrir modal de seleção de organização e status
      setIsOrganizationModalOpen(true);
    } else {
      // Usuários não-Portes: abrir modal apenas para seleção de status
      setIsStatusModalOpen(true);
    }
  };

  // Função para gerar overview com streaming
  const gerarOverviewStream = async (organizacaoSelecionada?: string, statusSelecionado?: string) => {
    try {
      setIsOverviewModalOpen(true);
      setOverviewText('');
      setOverviewStatus('Preparando...');
      setIsGeneratingOverview(true);
      setOverviewMetadata(null);

      const orgParaFiltrar = organizacaoSelecionada || filtroOrganizacao;
      const statusParaFiltrar = statusSelecionado || 'todos';

      const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const url = `${baseUrl}/pdf/gerar-overview-stream`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser?.organizacao || 'cassems',
          'x-user-id': currentUser?.id || '',
        },
        body: JSON.stringify({
          organizacao: orgParaFiltrar,
          status: statusParaFiltrar
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao iniciar geração do overview');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }

      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Processar buffer restante antes de sair
          if (buffer.trim()) {
            const remainingLines = buffer.split('\n');
            for (const line of remainingLines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (currentEvent === 'chunk' && data.text) {
                    setOverviewText(prev => prev + data.text);
                  }
                } catch (e) {
                  // Ignorar
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Processar linhas completas (terminadas com \n)
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          
          // Linha vazia indica fim de evento SSE
          if (line.trim() === '') {
            currentEvent = '';
            continue;
          }
          
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.substring(6);
              const data = JSON.parse(dataStr);
              
              // Processar baseado no tipo de evento
              if (currentEvent === 'status' || (!currentEvent && data.message && !data.text && !data.fullText)) {
                setOverviewStatus(data.message || 'Processando...');
              } else if (currentEvent === 'chunk' || (!currentEvent && data.text)) {
                // Text chunk - atualizar imediatamente para ver streaming
                setOverviewText(prev => {
                  const newText = prev + (data.text || '');
                  // Forçar re-render
                  return newText;
                });
              } else if (currentEvent === 'complete' || (!currentEvent && data.fullText)) {
                if (data.fullText) {
                  setOverviewText(data.fullText);
                }
                if (data.periodo || data.metadata) {
                  setOverviewMetadata(data);
                }
                setOverviewStatus('Concluído!');
                setIsGeneratingOverview(false);
              } else if (currentEvent === 'error' || (!currentEvent && data.message && data.message.toLowerCase().includes('erro'))) {
                throw new Error(data.message || 'Erro ao gerar overview');
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Ignorar erros de parsing JSON
                continue;
              }
              console.error('Erro ao processar evento:', e, 'Linha:', line);
              throw e;
            }
          }
        }
      }

    } catch (error) {
      console.error('Erro ao gerar overview:', error);
      setOverviewStatus('Erro ao gerar overview');
      setIsGeneratingOverview(false);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : 'Erro ao gerar overview',
        variant: "destructive"
      });
    }
  };

  // Função para baixar o overview gerado como PDF
  const baixarOverviewGerado = () => {
    if (!overviewText) return;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    pdf.setFont('helvetica');

    // Adicionar background
    try {
      pdf.addImage('/layout-background.png', 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
    } catch (error) {
      console.warn('Erro ao carregar background:', error);
    }

    let yPosition = addHeader(pdf);
    yPosition = addSectionTitle(pdf, 'OVERVIEW DO CRONOGRAMA - RESUMO GERADO POR IA', yPosition, 1);

    if (overviewMetadata?.periodo) {
      yPosition = addBodyText(pdf, 
        `Período: ${overviewMetadata.periodo.inicioFormatado} até ${overviewMetadata.periodo.fimFormatado}`, 
        yPosition, {
        fontSize: 11,
        color: LAYOUT_COLORS.lightGray
      });
    }

    yPosition = addDivider(pdf, yPosition);

    // Converter markdown para texto simples e adicionar ao PDF
    const lines = overviewText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        // Linha vazia - adicionar pequeno espaçamento
        yPosition += 2;
        continue;
      }
      
      if (line.startsWith('## ')) {
        // Título de seção
        yPosition = addSectionTitle(pdf, line.substring(3), yPosition, 2);
      } else if (line.startsWith('### ')) {
        // Título com ### (caso ainda apareça)
        yPosition = addSectionTitle(pdf, line.substring(4), yPosition, 3);
      } else if (line.includes(' - ') && 
                 !line.startsWith('#') && 
                 !line.startsWith('*') && 
                 !line.includes('Status:') && 
                 !line.includes('Prioridade:') &&
                 !line.match(/^[✅🔄⚠️⏳]/)) {
        // Título de demanda: linha que contém " - " (nome - responsável)
        // e não começa com #, *, não contém Status/Prioridade, não começa com emoji
        const isNextLineStatus = i + 1 < lines.length && lines[i + 1].includes('Status:');
        if (isNextLineStatus || line.trim().length > 10) {
          // Destacar título da demanda
          yPosition = addSectionTitle(pdf, line.trim(), yPosition, 3);
        } else {
          yPosition = addBodyText(pdf, line.trim(), yPosition, {
            fontSize: 11,
            isBold: true
          });
        }
      } else if (line.startsWith('**') && line.endsWith('**')) {
        // Texto em negrito
        yPosition = addBodyText(pdf, line.replace(/\*\*/g, ''), yPosition, {
          fontSize: 11,
          isBold: true
        });
      } else {
        // Texto normal
        const cleanLine = line.replace(/[✅🔄⚠️⏳]/g, '').trim();
        if (cleanLine) {
          yPosition = addBodyText(pdf, cleanLine, yPosition, {
            fontSize: 10
          });
        }
      }
    }

    // Rodapé
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      addFooter(pdf, i, totalPages);
    }

    const escopoNome = overviewMetadata?.metadata?.organizacaoFiltro === 'todos' 
      ? 'todas-organizacoes' 
      : (overviewMetadata?.metadata?.organizacaoFiltro || 'organizacao').toLowerCase().replace(/\s+/g, '-');
    const fileName = `overview-cronograma-ia-${escopoNome}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    toast({
      title: "Download concluído",
      description: "O overview foi baixado com sucesso.",
    });
  };

  // Função para gerar PDF com análise de IA
  const gerarOverviewPDFComIA = async (organizacaoSelecionada?: string, statusSelecionado?: string) => {
    let loadingToastRef: { dismiss: () => void } | null = null;
    try {
      setLoadingIA(true);
      const orgParaFiltrar = organizacaoSelecionada || filtroOrganizacao;
      const statusParaFiltrar = statusSelecionado || 'todos';

      const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const url = `${baseUrl}/pdf/analisar-cronograma-ia`;

      loadingToastRef = toast({
        title: "Analisando com IA",
        description: "Aguarde enquanto geramos o overview com análise inteligente...",
        duration: Infinity, // Manter o toast visível até ser fechado manualmente
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser?.organizacao || 'cassems',
          'x-user-id': currentUser?.id || '',
        },
        body: JSON.stringify({
          organizacao: orgParaFiltrar,
          status: statusParaFiltrar
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao analisar cronograma com IA');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar análise');
      }

      const { analise, periodo, resumoMensal, resumoMensalDetalhado, statsPorOrganizacao, isComparativo, metadata } = data.data;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.setFont('helvetica');
      
      // IMPORTANTE: Adicionar background PRIMEIRO (antes de qualquer conteúdo)
      // Isso garante que o layout fique atrás e o conteúdo seja escrito por cima
      try {
        pdf.addImage('/layout-background.png', 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
      } catch (error) {
        console.warn('Erro ao carregar background, continuando sem ele:', error);
      }
      
      // Adicionar cabeçalho com layout do documento Word
      let yPosition = addHeader(pdf);

      // Título principal
      yPosition = addSectionTitle(pdf, 'OVERVIEW DO CRONOGRAMA - ANÁLISE INTELIGENTE', yPosition, 1);
      
      // Informações do documento
      yPosition = addBodyText(pdf, `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, yPosition, {
        fontSize: 10,
        color: LAYOUT_COLORS.lightGray
      });
      
      yPosition = addBodyText(pdf, `Período analisado: ${periodo.inicioFormatado} até ${periodo.fimFormatado}`, yPosition, {
        fontSize: 11,
        isBold: true
      });
      
      yPosition = addBodyText(pdf, `Organização: ${currentUser?.nome_empresa || currentUser?.organizacao_nome || currentUser?.organizacao || 'Sistema'}`, yPosition, {
        fontSize: 12,
        isBold: true
      });
      
      yPosition = addDivider(pdf, yPosition);

      // Seção: Status Atual do Projeto com barras de progresso
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = LAYOUT_CONFIG.margin;
      const contentWidth = pageWidth - (margin * 2);
      
      // Função auxiliar para barras de progresso
      const drawProgress = (label: string, percent: number) => {
        const barWidth = contentWidth;
        const barHeight = 6;
        const barX = margin;
        const barY = yPosition + 6;
        const pct = Math.max(0, Math.min(100, Math.round(percent)));

        // Título
        yPosition = addBodyText(pdf, `${label}  ${pct}%`, yPosition, {
          fontSize: 11,
          isBold: true,
          color: LAYOUT_COLORS.primary
        });
        yPosition -= 8; // Ajustar para posicionar a barra

        // Fundo
        pdf.setDrawColor(...LAYOUT_COLORS.border);
        pdf.setFillColor(235, 238, 245);
        pdf.rect(barX, barY, barWidth, barHeight, 'FD');

        // Progresso
        const fillWidth = (barWidth * pct) / 100;
        pdf.setFillColor(...LAYOUT_COLORS.secondary);
        pdf.rect(barX, barY, fillWidth, barHeight, 'F');

        yPosition = barY + barHeight + 8;
      };

      // Cálculo de resumo geral
      let totalFeitosPeriodo = 0;
      let totalPendentesPeriodo = 0;
      if (Array.isArray(resumoMensal) && resumoMensal.length > 0) {
        totalFeitosPeriodo = resumoMensal.reduce((s: number, m: any) => s + (m.totalConcluido || 0), 0);
        totalPendentesPeriodo = resumoMensal.reduce((s: number, m: any) => s + (m.totalPendente || 0), 0);
      }
      const totalPeriodo = totalFeitosPeriodo + totalPendentesPeriodo;
      const pctGeral = totalPeriodo > 0 ? (totalFeitosPeriodo / totalPeriodo) * 100 : 0;

      yPosition = addSectionTitle(pdf, 'STATUS ATUAL DO PROJETO', yPosition, 2);
      drawProgress('Progresso Geral', pctGeral);

      // Barras por mês (mostra últimos 6 meses do resumo retornado)
      const mesesParaMostrar = Array.isArray(resumoMensal) ? resumoMensal.slice(-6) : [];
      mesesParaMostrar.forEach((m: any) => {
        const tot = (m.totalConcluido || 0) + (m.totalPendente || 0);
        const pct = tot > 0 ? (m.totalConcluido / tot) * 100 : 0;
        drawProgress(`${m.mes}`, pct);
      });

      yPosition = addDivider(pdf, yPosition);

      // Processar análise da IA agrupando blocos de demanda para evitar quebras
      const analiseLinhas = analise.split('\n');
      let blocoAtual: string[] = [];
      
      const processarBloco = (bloco: string[], yPos: number): number => {
        if (bloco.length === 0) return yPos;
        
        // Calcular altura aproximada do bloco
        const alturaEstimada = bloco.reduce((acc, linha) => {
          const t = linha.trim();
          if (t.startsWith('### ')) return acc + 20; // Título de demanda
          if (t.startsWith('## ')) return acc + 18; // Título de seção
          if (t.startsWith('[OK]') || t.startsWith('[PENDENTE]') || t.startsWith('[EM ANDAMENTO]') || t.startsWith('[ATRASADA]')) {
            return acc + 15; // Linha com marcador
          }
          return acc + 12; // Linha normal
        }, 0);
        
        // Garantir espaço antes de processar o bloco completo
        yPos = ensureSpace(pdf, yPos, alturaEstimada);
        
        // Processar cada linha do bloco
        bloco.forEach((linha: string) => {
          const t = linha.trim();
          // Cabeçalhos Markdown
          if (t.startsWith('### ')) {
            yPos = addSectionTitle(pdf, t.replace(/^###\s+/, ''), yPos, 3);
            return;
          }
          if (t.startsWith('## ')) {
            yPos = addSectionTitle(pdf, t.replace(/^##\s+/, ''), yPos, 2);
            return;
          }
          // Marcadores de status
          if (t.startsWith('[OK]')) {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 12,
              isBold: true,
              color: LAYOUT_COLORS.accent
            });
            return;
          }
          if (t.startsWith('[PENDENTE]') || t.startsWith('[EM ANDAMENTO]') || t.startsWith('[ATRASADA]')) {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 12,
              isBold: true,
              color: LAYOUT_COLORS.warning
            });
            return;
          }
          // Fallback para emojis antigos, caso venham
          if (linha.includes('✅') || t.includes('O QUE FOI FEITO')) {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 12,
              isBold: true,
              color: LAYOUT_COLORS.accent
            });
          } else if (linha.includes('⏳') || t.includes('O QUE NÃO FOI FEITO')) {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 12,
              isBold: true,
              color: LAYOUT_COLORS.warning
            });
          } else {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 11
            });
          }
        });
        
        return yPos;
      };
      
      analiseLinhas.forEach((linha: string, index: number) => {
        const t = linha.trim();
        const isNovaDemanda = t.startsWith('### ');
        const isNovaSecao = t.startsWith('## ') && !t.startsWith('### ');
        
        // Se encontrou nova demanda ou seção, processar bloco anterior
        if ((isNovaDemanda || isNovaSecao) && blocoAtual.length > 0) {
          yPosition = processarBloco(blocoAtual, yPosition);
          blocoAtual = [];
        }
        
        // Adicionar linha ao bloco atual
        blocoAtual.push(linha);
        
        // Se é última linha, processar bloco final
        if (index === analiseLinhas.length - 1) {
          yPosition = processarBloco(blocoAtual, yPosition);
        }
      });

      yPosition = addDivider(pdf, yPosition);

      if (isComparativo && statsPorOrganizacao) {
        yPosition = addSectionTitle(pdf, 'COMPARAÇÃO ENTRE ORGANIZAÇÕES', yPosition, 2);
        const comparacaoRows: string[][] = [];
        Object.entries(statsPorOrganizacao).forEach(([org, stats]: [string, any]) => {
          comparacaoRows.push([
            org.toUpperCase(),
            stats.total.toString(),
            `${stats.concluidas} (${stats.percentualConclusao}%)`,
            `${stats.checklistsConcluidos}/${stats.checklistsTotal} (${stats.percentualChecklists}%)`
          ]);
        });
        const comparacaoHeaders = ['Organização', 'Total', 'Concluídas', 'Checklists'];
        yPosition = addTable(pdf, comparacaoHeaders, comparacaoRows, yPosition, {
          fontSize: 10
        });
        yPosition = addDivider(pdf, yPosition);
      }

      yPosition = addSectionTitle(pdf, 'ESTATÍSTICAS RESUMIDAS', yPosition, 2);
      const statsList: string[] = [];
      statsList.push(`Total de Demandas: ${metadata.totalDemandas}`);
      if (resumoMensal.length > 0) {
        const totalConcluido = resumoMensal.reduce((sum, m) => sum + m.totalConcluido, 0);
        const totalPendente = resumoMensal.reduce((sum, m) => sum + m.totalPendente, 0);
        statsList.push(`Itens concluídos no período: ${totalConcluido}`);
        statsList.push(`Itens pendentes no período: ${totalPendente}`);
      }
      yPosition = addListItem(pdf, statsList, yPosition, {
        fontSize: 11
      });

      // Rodapé em todas as páginas
      // (O background já foi adicionado no início de cada página, antes do conteúdo)
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        addFooter(pdf, i, totalPages);
      }

      const escopoNome = orgParaFiltrar === 'todos' ? 'todas-organizacoes' : orgParaFiltrar.toLowerCase().replace(/\s+/g, '-');
      const statusNome = statusParaFiltrar === 'todos' ? 'todos-status' : statusParaFiltrar;
      const fileName = `overview-cronograma-ia-${escopoNome}-${statusNome}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      // Fechar toast de loading antes de mostrar o de sucesso
      if (loadingToastRef) {
        try {
          loadingToastRef.dismiss();
          // Aguardar um momento para garantir que o toast foi fechado
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {}
      }
      toast({
        title: "PDF gerado com sucesso!",
        description: "O overview com análise de IA foi baixado.",
      });

    } catch (error: any) {
      console.error('Erro ao gerar PDF com IA:', error);
      // Fechar toast de loading antes de mostrar o de erro
      if (loadingToastRef) {
        try {
          loadingToastRef.dismiss();
          // Aguardar um momento para garantir que o toast foi fechado
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {}
      }
      toast({
        title: "Erro ao gerar PDF",
        description: error.message || "Erro ao gerar o PDF com análise de IA. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingIA(false);
    }
  };

  // Função para confirmar e baixar PDF após seleção no modal (mantida para compatibilidade)
  const confirmarDownloadPDF = () => {
    confirmarDownloadPDFAtualizado();
  };

  // Função para confirmar e baixar PDF para usuários não-Portes (apenas status)
  const confirmarDownloadPDFNonPortes = () => {
    setIsStatusModalOpen(false);
    // Sempre usar streaming para gerar overview
    gerarOverviewStream(undefined, selectedStatusForNonPortesPDF);
    setUsarIA(false);
  };

  // Função para gerar PDF com análise por mês específico
  const gerarOverviewPorMesPDF = async (organizacaoSelecionada?: string, ano?: string, mes?: string) => {
    let loadingToastRef: { dismiss: () => void } | null = null;
    try {
      if (!ano || !mes) {
        toast({
          title: "Erro",
          description: "Por favor, selecione ano e mês",
          variant: "destructive"
        });
        return;
      }

      setLoadingMesIA(true);
      const orgParaFiltrar = organizacaoSelecionada || filtroOrganizacao;

      const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const url = `${baseUrl}/pdf/analisar-cronograma-por-mes-ia`;

      loadingToastRef = toast({
        title: "Analisando com IA",
        description: `Analisando demandas e checklists do mês ${mes}/${ano}...`,
        duration: Infinity,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser?.organizacao || 'cassems',
          'x-user-id': currentUser?.id || '',
        },
        body: JSON.stringify({
          organizacao: orgParaFiltrar,
          status: 'todos',
          ano: parseInt(ano),
          mes: parseInt(mes)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao analisar cronograma por mês com IA');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar análise');
      }

      const { analise, mes: mesNome, estatisticas } = data.data;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      pdf.setFont('helvetica');
      
      // IMPORTANTE: Adicionar background PRIMEIRO (antes de qualquer conteúdo)
      // Isso garante que o layout fique atrás e o conteúdo seja escrito por cima
      try {
        pdf.addImage('/layout-background.png', 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
      } catch (error) {
        console.warn('Erro ao carregar background, continuando sem ele:', error);
      }
      
      // Adicionar cabeçalho com layout do documento Word
      let yPosition = addHeader(pdf);

      // Título principal - formato compacto
      const tituloCompacto = `OVERVIEW DO CRONOGRAMA - ${mesNome.toUpperCase()}`;
      yPosition = addSectionTitle(pdf, tituloCompacto, yPosition, 1);
      
      // Informações do documento serão adicionadas no footer
      const infoTexto = `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} | Organização: ${currentUser?.nome_empresa || currentUser?.organizacao_nome || currentUser?.organizacao || 'Sistema'}`;
      
      yPosition += 2; // Espaço mínimo antes da seção
      
      // Estatísticas do mês - formato simplificado e compacto em uma linha
      yPosition = addSectionTitle(pdf, 'ESTATÍSTICAS DO MÊS', yPosition, 2);
      
      // Formato compacto em uma linha única
      const statsTexto = `Total Iniciadas: ${estatisticas.totalDemandas} | Concluídas no Mês: ${estatisticas.demandasConcluidas} | Em Andamento: ${estatisticas.demandasEmAndamento} | Checklists: ${estatisticas.checklistsConcluidos}`;
      
      yPosition = addBodyText(pdf, statsTexto, yPosition, {
        fontSize: 10
      });
      
      yPosition += 2; // Espaço mínimo antes da análise

      // Processar análise da IA agrupando blocos de demanda para evitar quebras
      const analiseLinhas = analise.split('\n');
      let blocoAtual: string[] = [];
      
      const processarBloco = (bloco: string[], yPos: number): number => {
        if (bloco.length === 0) return yPos;
        
        // Calcular altura aproximada do bloco
        const alturaEstimada = bloco.reduce((acc, linha) => {
          const t = linha.trim();
          if (t.startsWith('### ')) return acc + 20; // Título de demanda
          if (t.startsWith('## ')) return acc + 18; // Título de seção
          if (t.startsWith('[OK]') || t.startsWith('[PENDENTE]') || t.startsWith('[EM ANDAMENTO]') || t.startsWith('[ATRASADA]')) {
            return acc + 15; // Linha com marcador
          }
          return acc + 12; // Linha normal
        }, 0);
        
        // Garantir espaço antes de processar o bloco completo
        yPos = ensureSpace(pdf, yPos, alturaEstimada);
        
        // Processar cada linha do bloco
        bloco.forEach((linha: string) => {
          const t = linha.trim();
          
          // Ignorar linhas que são títulos duplicados do overview
          if (t.includes('# OVERVIEW DO CRONOGRAMA') || t.match(/^#+\s*OVERVIEW/i)) {
            return;
          }
          
          if (t.startsWith('### ')) {
            yPos = addSectionTitle(pdf, t.replace(/^###\s+/, ''), yPos, 3);
            return;
          }
          if (t.startsWith('## ')) {
            yPos = addSectionTitle(pdf, t.replace(/^##\s+/, ''), yPos, 2);
            return;
          }
          if (t.startsWith('[OK]')) {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 12,
              isBold: true,
              color: LAYOUT_COLORS.accent
            });
            return;
          }
          if (t.startsWith('[PENDENTE]') || t.startsWith('[EM ANDAMENTO]') || t.startsWith('[ATRASADA]')) {
            yPos = addBodyText(pdf, linha, yPos, {
              fontSize: 12,
              isBold: true,
              color: LAYOUT_COLORS.warning
            });
            return;
          }
          yPos = addBodyText(pdf, linha, yPos, {
            fontSize: 11
          });
        });
        
        return yPos;
      };
      
      analiseLinhas.forEach((linha: string, index: number) => {
        const t = linha.trim();
        const isNovaDemanda = t.startsWith('### ');
        const isNovaSecao = t.startsWith('## ') && !t.startsWith('### ');
        
        // Se encontrou nova demanda ou seção, processar bloco anterior
        if ((isNovaDemanda || isNovaSecao) && blocoAtual.length > 0) {
          yPosition = processarBloco(blocoAtual, yPosition);
          blocoAtual = [];
        }
        
        // Adicionar linha ao bloco atual
        blocoAtual.push(linha);
        
        // Se é última linha, processar bloco final
        if (index === analiseLinhas.length - 1) {
          yPosition = processarBloco(blocoAtual, yPosition);
        }
      });

      // Rodapé em todas as páginas
      // (O background já foi adicionado no início de cada página, antes do conteúdo)
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        addFooter(pdf, i, totalPages, infoTexto);
      }

      const escopoNome = orgParaFiltrar === 'todos' ? 'todas-organizacoes' : orgParaFiltrar.toLowerCase().replace(/\s+/g, '-');
      const fileName = `overview-cronograma-${mesNome.toLowerCase().replace(/\s+/g, '-')}-${escopoNome}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      if (loadingToastRef) {
        try {
          loadingToastRef.dismiss();
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {}
      }

      toast({
        title: "Sucesso!",
        description: `PDF gerado com sucesso para ${mesNome}`,
      });

    } catch (error: any) {
      console.error('Erro ao gerar PDF por mês:', error);
      if (loadingToastRef) {
        try {
          loadingToastRef.dismiss();
        } catch (e) {}
      }
      toast({
        title: "Erro",
        description: error.message || 'Erro ao gerar PDF por mês',
        variant: "destructive"
      });
    } finally {
      setLoadingMesIA(false);
    }
  };

  // Função para confirmar download PDF (modificada para suportar ambos os tipos)
  const confirmarDownloadPDFAtualizado = () => {
    setIsOrganizationModalOpen(false);
    setIsStatusModalOpen(false); // Also close status modal for non-Portes
    
    // Se houver organização selecionada, usar ela; caso contrário, usar a selecionada no modal
    const orgParaUsar = organizacaoSelecionada || selectedOrganizationForPDF;
    
    if (tipoOverview === 'por_mes') {
      if (!selectedAno || !selectedMes) {
        toast({
          title: "Erro",
          description: "Por favor, selecione ano e mês",
          variant: "destructive"
        });
        return;
      }
      gerarOverviewPorMesPDF(orgParaUsar, selectedAno, selectedMes);
    } else {
      // Sempre usar streaming para overview geral
      gerarOverviewStream(orgParaUsar, selectedStatusForPDF);
    }
    setUsarIA(false);
    setTipoOverview('geral');
  };

  // Função para carregar itens do checklist
  const loadChecklistItems = async (cronogramaId: number) => {
    try {
      setChecklistLoading(true);
      console.log('🔍 Carregando checklist para cronograma:', cronogramaId);
      const items = await listChecklistItems(cronogramaId);
      console.log('🔍 Itens carregados:', items);
      // Ordenar por ordem antes de definir
      const sortedItems = [...items].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      setChecklistItems(sortedItems);
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar itens do checklist",
        variant: "destructive",
      });
    } finally {
      setChecklistLoading(false);
    }
  };

  // Função para alternar status de conclusão de um item
  const toggleChecklistItemStatus = async (itemId: number, concluido: boolean) => {
    if (!viewingCronograma) return;
    
    try {
      await toggleChecklistItem(viewingCronograma.id, itemId, concluido);
      // Recarregar a lista de itens
      await loadChecklistItems(viewingCronograma.id);
      toast({
        title: "Sucesso",
        description: concluido ? "Item marcado como concluído" : "Item marcado como pendente",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar item do checklist:', error);
      const message = (error && (error.message || error.toString())) || '';
      // Silenciar toast para erros de permissão (403/forbidden)
      if (/403|forbid|permiss/i.test(message)) {
        return;
      }
      toast({
        title: "Erro",
        description: "Erro ao atualizar item do checklist",
        variant: "destructive",
      });
    }
  };

  // Função para reordenar itens do checklist
  const handleChecklistDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!viewingCronograma || !over || active.id === over.id) return;

    const oldIndex = checklistItems.findIndex(item => item.id === active.id);
    const newIndex = checklistItems.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reordenar localmente
    const reorderedItems = arrayMove(checklistItems, oldIndex, newIndex);
    
    // Atualizar ordem sequencialmente
    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      ordem: index + 1
    }));

    setChecklistItems(updatedItems);

    // Persistir no backend
    try {
      // Atualizar apenas itens que mudaram de posição
      const itemsToUpdate = updatedItems.filter((item, idx) => {
        const originalItem = checklistItems.find(orig => orig.id === item.id);
        return originalItem && originalItem.ordem !== item.ordem;
      });

      await Promise.all(
        itemsToUpdate.map(item =>
          updateChecklistItem(viewingCronograma.id, item.id, { ordem: item.ordem })
        )
      );

      toast({
        title: "Sucesso",
        description: "Ordem do checklist atualizada",
      });
    } catch (error) {
      console.error('Erro ao salvar ordem do checklist:', error);
      // Reverter em caso de erro
      setChecklistItems(checklistItems);
      toast({
        title: "Erro",
        description: "Erro ao salvar nova ordem do checklist",
        variant: "destructive",
      });
      // Recarregar do servidor
      await loadChecklistItems(viewingCronograma.id);
    }
  };

  // Componente Sortable para item do checklist
  const SortableChecklistItem = ({ item, disabled = false }: { item: ChecklistItem; disabled?: boolean }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id, disabled });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 lg:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 w-full min-h-[80px] sm:min-h-[100px] lg:min-h-[120px] overflow-hidden"
      >
        <div className={disabled ? "flex-shrink-0 mt-0.5 opacity-40" : "flex-shrink-0 cursor-grab active:cursor-grabbing mt-0.5"}
          {...(!disabled ? attributes : {})}
          {...(!disabled ? listeners : {})}
        >
          <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-gray-400 hover:text-gray-600" />
        </div>
        <button
          onClick={() => toggleChecklistItemStatus(item.id, !item.concluido)}
          className={`flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${
            item.concluido
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {item.concluido && <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
        </button>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 break-words ${item.concluido ? 'line-through text-gray-500' : 'text-gray-700'}`}>
            {item.titulo}
          </p>
          {item.descricao && (
            <p className={`text-xs leading-relaxed line-clamp-2 sm:line-clamp-3 overflow-hidden break-words ${item.concluido ? 'text-gray-400' : 'text-gray-500'}`}>
              {item.descricao}
            </p>
          )}
          {(item.data_inicio || item.data_fim) && (
            <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 lg:gap-3 mt-1.5 sm:mt-2 text-xs ${item.concluido ? 'text-gray-400' : 'text-gray-500'}`}>
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
              {item.data_inicio && (
                <span className="break-words">Início: {formatDateForDisplay(item.data_inicio)}</span>
              )}
              {item.data_fim && (
                <span className="break-words">Fim: {formatDateForDisplay(item.data_fim)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (currentUser && organizacaoSelecionada) {
      fetchCronogramas();
      fetchEstatisticas();
      fetchUsuarios();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.organizacao, organizacaoSelecionada]);

  // Expandir automaticamente meses com demandas quando os dados ou filtros mudarem
  useEffect(() => {
    if (cronogramas.length > 0) {
      expandirMesesComDemandas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cronogramas.length, filtroStatus, filtroPrioridade, filtroOrganizacao]);

  // Ativar IA automaticamente quando os modais abrirem
  useEffect(() => {
    if (isOrganizationModalOpen || isStatusModalOpen) {
      setUsarIA(true);
    }
  }, [isOrganizationModalOpen, isStatusModalOpen]);

  // Carregar checklist quando o modal de visualização abrir
  useEffect(() => {
    if (isViewDialogOpen && viewingCronograma) {
      loadChecklistItems(viewingCronograma.id);
      // Resetar página de alertas quando abrir um novo cronograma
      setPaginaAlertas(1);
      // Expandir automaticamente o campo "Motivo do Atraso" se a demanda estiver em atraso
      if (viewingCronograma.motivo_atraso || viewingCronograma.status === 'atrasado') {
        setIsDelayExpanded(true);
      } else {
        setIsDelayExpanded(false);
      }
    }
  }, [isViewDialogOpen, viewingCronograma]);

  // Recarregar organizações quando o modal de criação/edição abrir (apenas para usuários Portes)
  useEffect(() => {
    if (!isEditDialogOpen || currentUser?.organizacao !== 'portes') return;
    
    const reloadOrgs = async () => {
      setLoadingOrganizacoes(true);
      try {
        const res = await fetch(`${API_BASE}/organizacoes`, {
          headers: {
            'x-user-organization': currentUser?.organizacao || 'portes'
          }
        });
        
        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;
          const organizacoesArray = Array.isArray(data) ? data : [];
          const organizacoesAtivas = organizacoesArray.filter((org: any) => org.ativa !== false);
          setOrganizacoes(organizacoesAtivas);
        }
      } catch (error) {
        console.error('Erro ao recarregar organizações:', error);
      } finally {
        setLoadingOrganizacoes(false);
      }
    };
    
    reloadOrgs();
  }, [isEditDialogOpen, currentUser?.organizacao, API_BASE]);
  
  // Resetar página de alertas quando abrir um novo cronograma
  useEffect(() => {
    if (isViewDialogOpen && viewingCronograma) {
      setPaginaAlertas(1);
    }
  }, [isViewDialogOpen, viewingCronograma?.id]);

  // Filtrar alertas por cronograma se houver um cronograma sendo visualizado
  const alertasFiltrados = useMemo(() => {
    if (viewingCronograma?.id) {
      return alertasPendentes.filter(alerta => alerta.cronograma_id === viewingCronograma.id);
    }
    return alertasPendentes;
  }, [alertasPendentes, viewingCronograma?.id]);

  // Calcular paginação dos alertas
  const totalPaginasAlertas = Math.ceil(alertasFiltrados.length / ALERTAS_POR_PAGINA);
  const inicioAlertas = (paginaAlertas - 1) * ALERTAS_POR_PAGINA;
  const fimAlertas = inicioAlertas + ALERTAS_POR_PAGINA;
  const alertasPaginaAtual = alertasFiltrados.slice(inicioAlertas, fimAlertas);

  // Função para formatar data para exibição sem problemas de timezone
  const formatDateForDisplay = (dateString: string | null) => {
    if (!dateString) return 'Não definida';
    try {
      // Se já está no formato DD/MM/YYYY, retornar como está
      if (typeof dateString === 'string' && dateString.includes('/')) {
        return dateString;
      }
      
      // Se está no formato ISO completo (YYYY-MM-DDTHH:MM:SS.000Z), extrair apenas a data
      if (typeof dateString === 'string' && dateString.includes('T')) {
        const datePart = dateString.split('T')[0]; // Pega apenas YYYY-MM-DD
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
      }
      
      // Se está no formato YYYY-MM-DD, converter sem usar new Date() para evitar problemas de fuso horário
      if (typeof dateString === 'string' && dateString.includes('-')) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
      }
      
      // Para outros formatos, usar new Date() como fallback
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Não definida';
      
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data para exibição:', error);
      return 'Não definida';
    }
  };

  // Função para converter data para formato YYYY-MM-DD preservando timezone local
  const formatDateForInput = (dateString: string | Date | null) => {
    if (!dateString) return '';
    try {
      let date: Date;
      
      // Se já é uma Date object
      if (dateString instanceof Date) {
        date = dateString;
      } 
      // Se é string, criar Date object
      else {
        // Se é uma string ISO (termina com Z), tratar como UTC mas preservar a data
        if (typeof dateString === 'string' && dateString.endsWith('Z')) {
          // Extrair apenas a parte da data (YYYY-MM-DD) antes do T
          const datePart = dateString.split('T')[0];
          return datePart; // Retornar diretamente sem conversão
        }
        date = new Date(dateString);
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Usar métodos locais para evitar problemas de timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return '';
    }
  };

  // Atualizar formData quando editingCronograma muda
  useEffect(() => {
    if (editingCronograma) {
      console.log('🔍 Debug - editingCronograma recebido:', editingCronograma);
      console.log('🔍 Debug - data_inicio original:', editingCronograma.data_inicio);
      console.log('🔍 Debug - data_fim original:', editingCronograma.data_fim);
      
      const dataInicioFormatada = formatDateForInput(editingCronograma.data_inicio || '');
      const dataFimFormatada = formatDateForInput(editingCronograma.data_fim || '');
      
      console.log('🔍 Debug - data_inicio formatada:', dataInicioFormatada);
      console.log('🔍 Debug - data_fim formatada:', dataFimFormatada);
      
      setFormData({
        titulo: editingCronograma.titulo,
        descricao: editingCronograma.descricao || '',
        organizacao: editingCronograma.organizacao,
        fase_atual: editingCronograma.fase_atual,
        data_inicio: dataInicioFormatada,
        data_fim: dataFimFormatada,
        status: editingCronograma.status,
        prioridade: editingCronograma.prioridade,
        observacoes: editingCronograma.observacoes || '',
        motivo_atraso: editingCronograma.motivo_atraso || '',
        parte_responsavel_atraso: editingCronograma.parte_responsavel_atraso ?? null,
        responsavel_id: editingCronograma.responsavel_id || null
      });
    } else {
      setFormData(initialFormData());
    }
  }, [editingCronograma, currentUser]);

  // Limpar motivo_atraso quando status não for "atrasado"
  useEffect(() => {
    if (formData.status !== 'atrasado' && formData.motivo_atraso) {
      setFormData(prev => ({ ...prev, motivo_atraso: '' }));
    }
  }, [formData.status]);

  // Função para normalizar organização (igual ao backend) - DEVE ESTAR ANTES DO USO
  const normalizeOrganization = (org: string) => {
    if (!org) return '';
    const s = String(org).toLowerCase().trim();
    if (s.includes('maraj') || s.includes('rede frota') || s.includes('rede_frota')) return 'rede_frota';
    if (s.includes('cassems')) return 'cassems';
    if (s.includes('porte')) return 'portes';
    // fallback: trocar espaços por underscore
    return s.replace(/\s+/g, '_');
  };

  // Obter organizações únicas para filtro (apenas para Portes)
  const organizacoesUnicas = [...new Set(cronogramas.map(c => c.organizacao))];

  // Filtrar cronogramas ("Todos" deve incluir concluídos)
  const cronogramasFiltrados = cronogramas.filter(cronograma => {
    const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
    const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
    // Se houver organização selecionada, filtrar por ela (normalizada)
    let organizacaoMatch = true;
    if (organizacaoSelecionada && currentUser?.organizacao === 'portes') {
      const orgNormalizada = normalizeOrganization(cronograma.organizacao || '');
      organizacaoMatch = orgNormalizada === normalizeOrganization(organizacaoSelecionada);
    } else if (filtroOrganizacao !== 'todos') {
      organizacaoMatch = normalizeOrganization(cronograma.organizacao || '') === normalizeOrganization(filtroOrganizacao);
    }
    return statusMatch && prioridadeMatch && organizacaoMatch;
  });

  // Separar cronogramas em ativos e concluídos para exibição
  const cronogramasAtivos = cronogramas.filter(c => c.status !== 'concluido');
  const cronogramasConcluidos = cronogramas.filter(c => c.status === 'concluido');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'em_andamento':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'atrasado':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pendente: 'secondary',
      em_andamento: 'default',
      concluido: 'default',
      atrasado: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadgeInfo = (status: string) => {
    const variants = {
      pendente: { variant: 'status-pendente', text: 'PENDENTE' },
      em_andamento: { variant: 'status-em-andamento', text: 'EM ANDAMENTO' },
      concluido: { variant: 'status-concluido', text: 'CONCLUÍDO' },
      atrasado: { variant: 'status-atrasado', text: 'ATRASADO' }
    } as const;

    return variants[status as keyof typeof variants] || { variant: 'status-pendente', text: 'PENDENTE' };
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const variants = {
      baixa: { variant: 'priority-baixa', text: 'BAIXA' },
      media: { variant: 'priority-media', text: 'MÉDIA' },
      alta: { variant: 'priority-alta', text: 'ALTA' },
      urgente: { variant: 'priority-urgente', text: 'URGENTE' },
      critica: { variant: 'priority-urgente', text: 'CRÍTICA' } // Manter compatibilidade
    } as const;

    const badgeInfo = variants[prioridade as keyof typeof variants] || variants.baixa;

    return (
      <Badge variant={badgeInfo.variant as any} className="text-xs">
        {badgeInfo.text}
      </Badge>
    );
  };

  const getPriorityBadgeInfo = (prioridade: string) => {
    const variants = {
      baixa: { variant: 'priority-baixa', text: 'BAIXA' },
      media: { variant: 'priority-media', text: 'MÉDIA' },
      alta: { variant: 'priority-alta', text: 'ALTA' },
      urgente: { variant: 'priority-urgente', text: 'URGENTE' },
      critica: { variant: 'priority-urgente', text: 'CRÍTICA' } // Manter compatibilidade
    } as const;

    return variants[prioridade as keyof typeof variants] || { variant: 'priority-baixa', text: 'BAIXA' };
  };

  const getFaseBadge = (fase: string) => {
    const fases = {
      inicio: { label: 'Início', color: 'bg-gray-100 text-gray-800' },
      planejamento: { label: 'Planejamento', color: 'bg-blue-100 text-blue-800' },
      execucao: { label: 'Execução', color: 'bg-yellow-100 text-yellow-800' },
      revisao: { label: 'Revisão', color: 'bg-purple-100 text-purple-800' },
      conclusao: { label: 'Conclusão', color: 'bg-green-100 text-green-800' }
    };

    const faseConfig = fases[fase as keyof typeof fases] || { label: `${fase}`, color: 'bg-gray-100 text-gray-800' };

    return (
      <Badge className={faseConfig.color}>
        {faseConfig.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const calcularDiasAtraso = (dataFim: string) => {
    if (!dataFim) return 0;
    const hoje = new Date();
    const fim = new Date(dataFim);
    const diffTime = hoje.getTime() - fim.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Formatar nome da organização para exibição (ex.: "rede_frota" -> "REDE FROTA")
  const formatOrgLabel = (org?: string | null) => {
    if (!org) return 'EMPRESA';
    return org.replace(/_/g, ' ').toUpperCase();
  };

  // Cor da barra do cronograma considerando quem está com a bola
  const getBarColorClass = (item: CronogramaItem) => {
    if (item.status !== 'atrasado') {
      // Mantém cores atuais para outros status (ajuste se já tiver lógica própria)
      if (item.status === 'concluido') return 'bg-green-500';
      if (item.status === 'em_andamento') return 'bg-blue-500';
      if (item.status === 'pendente') return 'bg-gray-300';
      return 'bg-gray-300';
    }

    if (item.parte_responsavel_atraso === 'empresa') {
      // Atraso na ponta do cliente/fornecedor
      return 'bg-orange-500';
    }

    // Atraso sob responsabilidade da Portes (ou não informado)
    return 'bg-red-500';
  };

  // Determinar com quem está a "bola" (responsabilidade principal)
  const getBolaComLabel = (cronograma: CronogramaItem) => {
    // Se a empresa responsável explicitamente for Portes
    if (cronograma.responsavel_empresa && cronograma.responsavel_empresa.toLowerCase().includes('portes')) {
      return 'Portes';
    }

    // Se a organização do cronograma for Portes
    if (cronograma.organizacao && cronograma.organizacao.toLowerCase().includes('portes')) {
      return 'Portes';
    }

    // Caso contrário, considerar que a bola está com a empresa cliente
    return 'Empresa';
  };

  const normalizeFileName = (name?: string | null) => {
    if (!name) return '';
    try {
      if (/Ã|Â|â|œ|/.test(name)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return decodeURIComponent(escape(name));
      }
      return name;
    } catch (_e) {
      return name;
    }
  };

  const fetchAlertas = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      setAlertasLoading(true);
      const userOrg = currentUser.organizacao || 'cassems';
      const params: string[] = [];

      // Para usuários Portes, usar organização selecionada ou filtro
      // Para outros usuários, sempre usar a organização do usuário
      if (userOrg === 'portes') {
        const orgFiltro = (organizacaoSelecionada && organizacaoSelecionada !== 'todos')
          ? organizacaoSelecionada
          : (filtroOrganizacao !== 'todos' ? filtroOrganizacao : null);
        if (orgFiltro) {
          params.push(`organizacao=${encodeURIComponent(orgFiltro)}`);
        }
      } else {
        // Para usuários não-Portes, sempre filtrar pela organização do usuário
        params.push(`organizacao=${encodeURIComponent(userOrg)}`);
      }

      const query = params.length ? `?${params.join('&')}` : '';

      const response = await fetch(`${API_BASE}/cronograma/alertas${query}`, {
        headers: {
          'x-user-organization': userOrg,
          'x-user-id': currentUser.id?.toString() || ''
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar alertas');
      }

      const data = await response.json();
      const lista = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      const pendentes = (lista as CronogramaAlerta[]).filter(alerta => !alerta.acknowledged);
      
      setAlertasPendentes(pendentes);
      // Resetar para primeira página quando os alertas mudarem
      setPaginaAlertas(1);
    } catch (error) {
      console.error('Erro ao carregar alertas do cronograma:', error);
    } finally {
      setAlertasLoading(false);
    }
  }, [API_BASE, currentUser, filtroOrganizacao, organizacaoSelecionada]);

  // Carregar alertas apenas uma vez quando a página carregar
  useEffect(() => {
    if (!currentUser?.id) return;
    // Carregar alertas apenas uma vez ao entrar na página
    if (!alertasBuscadosRef.current) {
      fetchAlertas();
      alertasBuscadosRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]); // Buscar apenas quando o usuário estiver disponível

  const acknowledgeAlerta = useCallback(async (alertaId: number) => {
    if (!currentUser?.id) return;
    try {
      setAckLoadingId(alertaId);
      const response = await fetch(`${API_BASE}/cronograma/alertas/${alertaId}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser.organizacao || 'cassems',
          'x-user-id': currentUser.id?.toString() || ''
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao confirmar alerta');
      }

      setAlertasPendentes(prev => prev.filter(alerta => alerta.id !== alertaId));
    } catch (error) {
      console.error('Erro ao confirmar alerta do cronograma:', error);
    } finally {
      setAckLoadingId(null);
    }
  }, [API_BASE, currentUser]);

  const acknowledgeTodosAlertas = useCallback(async () => {
    if (alertasPendentes.length === 0) return;
    try {
      setAckAllLoading(true);
      await Promise.all(alertasPendentes.map(alerta => acknowledgeAlerta(alerta.id)));
    } finally {
      setAckAllLoading(false);
    }
  }, [acknowledgeAlerta, alertasPendentes]);

  // Salvar cronograma (criar ou editar)
  const salvarCronograma = async () => {
    try {
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const url = editingCronograma 
        ? `${API_BASE}/cronograma/${editingCronograma.id}`
        : `${API_BASE}/cronograma`;
      
      const method = editingCronograma ? 'PUT' : 'POST';
      
      // Preparar dados para envio (remover datas vazias)
      const dadosParaEnvio = {
        ...formData,
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null
      };
      
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': userOrg,
          'x-user-id': currentUser?.id?.toString() || ''
        },
        body: JSON.stringify(dadosParaEnvio)
      });

      if (response.ok) {
        const responseData = await response.json();
        
        toast({
          title: "Sucesso",
          description: editingCronograma ? "Cronograma atualizado com sucesso!" : "Cronograma criado com sucesso!",
        });
        setIsEditDialogOpen(false);
        setEditingCronograma(null);
        // Resetar formulário para próxima criação
        setFormData(initialFormData());
        fetchCronogramas();
        fetchEstatisticas();
      } else {
        const errorData = await response.text();
        throw new Error(`Erro ${response.status}: ${errorData}`);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar cronograma:', error);
      toast({
        title: "Erro",
        description: `Erro ao salvar cronograma: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Estado para controlar o modal de confirmação de exclusão
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cronogramaToDelete, setCronogramaToDelete] = useState<CronogramaItem | null>(null);

  // Estado para alternar entre modos de visualização
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');
  
  
  // Estado para controlar fases expandidas
  const [fasesExpandidas, setFasesExpandidas] = useState<Set<string>>(new Set());
  
  // Estado para busca
  const [busca, setBusca] = useState('');
  
  // Estado para controlar grupos de mês expandidos
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());
  
  // Estado para controlar a ordem das demandas por organização (drag & drop)
  const [ordemDemandas, setOrdemDemandas] = useState<Record<string, number[]>>({});
  
  // Estado para controlar a largura da coluna de organização/demanda
  const [colunaLargura, setColunaLargura] = useState(320); // Largura padrão em pixels
  const [isResizing, setIsResizing] = useState(false);
  const [isColumnWidthLoaded, setIsColumnWidthLoaded] = useState(false);
  
  // Funções para redimensionamento da coluna
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    // Calcular a largura baseada na posição do mouse relativa ao início da página
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    const containerRect = timelineContainer.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    
    // Limites: 200px a 600px, baseado na posição do mouse
    const newWidth = Math.max(200, Math.min(600, mouseX));
    setColunaLargura(newWidth);
    
    // Salvar em tempo real para garantir persistência
    localStorage.setItem('cronograma-coluna-largura', newWidth.toString());
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    // Salvar a largura final no localStorage com validação
    const finalWidth = Math.max(200, Math.min(600, colunaLargura));
    localStorage.setItem('cronograma-coluna-largura', finalWidth.toString());
    console.log('🔍 Largura da coluna salva no localStorage:', finalWidth + 'px');
  };

  // Função para resetar a largura da coluna para o padrão
  const resetColumnWidth = () => {
    const defaultWidth = 320;
    setColunaLargura(defaultWidth);
    localStorage.setItem('cronograma-coluna-largura', defaultWidth.toString());
    console.log('🔍 Largura da coluna resetada para o padrão:', defaultWidth + 'px');
  };

  // Carregar largura da coluna salva no localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem('cronograma-coluna-largura');
    if (savedWidth) {
      const width = parseInt(savedWidth);
      // Validar se a largura está dentro dos limites permitidos
      if (width >= 200 && width <= 600 && !isNaN(width)) {
        setColunaLargura(width);
        console.log('🔍 Largura da coluna carregada do localStorage:', width + 'px');
      } else {
        console.log('🔍 Largura inválida no localStorage, usando padrão:', width);
        // Limpar valor inválido do localStorage
        localStorage.removeItem('cronograma-coluna-largura');
      }
    } else {
      console.log('🔍 Nenhuma largura salva encontrada, usando padrão: 320px');
    }
    setIsColumnWidthLoaded(true);
  }, []);

  // Adicionar event listeners para redimensionamento
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      // Adicionar classe para indicar que está redimensionando
      document.body.classList.add('resizing-column');
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Remover classe de redimensionamento
      document.body.classList.remove('resizing-column');
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing-column');
    };
  }, [isResizing]);
  
  // Função normalizeOrganization movida para cima (antes do filtro)

  // Somente usuários da PORTES podem reordenar na timeline
  const podeReordenar = (currentUser?.organizacao || '').toLowerCase() === 'portes';

  // Sensores para drag & drop com suporte melhorado para produção
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Debug para ambiente de produção
  useEffect(() => {
    console.log('🔍 Ambiente:', import.meta.env.MODE);
    console.log('🔍 URL atual:', window.location.href);
    console.log('🔍 User Agent:', navigator.userAgent);
    console.log('🔍 Touch support:', 'ontouchstart' in window);
    console.log('🔍 Pointer events:', 'onpointerdown' in window);
    console.log('🔍 Pode reordenar:', podeReordenar);
  }, [podeReordenar]);

  // Função para aplicar ordem personalizada aos cronogramas
  const aplicarOrdemPersonalizada = (cronogramas: CronogramaItem[], organizacao: string) => {
    const ordemCustomizada = ordemDemandas[organizacao];
    if (!ordemCustomizada || ordemCustomizada.length === 0) {
      return cronogramas;
    }

    // Criar um mapa para ordenação eficiente
    const ordemMap = new Map(ordemCustomizada.map((id, index) => [id, index]));
    
    // Separar cronogramas que estão na ordem customizada dos que não estão
    const cronogramasComOrdem: CronogramaItem[] = [];
    const cronogramasSemOrdem: CronogramaItem[] = [];
    
    cronogramas.forEach(cronograma => {
      if (ordemMap.has(cronograma.id)) {
        cronogramasComOrdem.push(cronograma);
      } else {
        cronogramasSemOrdem.push(cronograma);
      }
    });
    
    // Ordenar os que têm ordem customizada
    cronogramasComOrdem.sort((a, b) => {
      const ordemA = ordemMap.get(a.id) ?? 999;
      const ordemB = ordemMap.get(b.id) ?? 999;
      return ordemA - ordemB;
    });
    
    // Adicionar os que não têm ordem ao final
    return [...cronogramasComOrdem, ...cronogramasSemOrdem];
  };

  // Função para lidar com o fim do drag & drop
  const handleDragEnd = (event: DragEndEvent) => {
    console.log('🔍 handleDragEnd chamado');
    console.log('🔍 podeReordenar:', podeReordenar);
    console.log('🔍 currentUser:', currentUser);
    console.log('🔍 organizacao do usuário:', currentUser?.organizacao);
    
    if (!podeReordenar) {
      console.log('❌ Usuário não tem permissão para reordenar');
      return; // Sem permissão para reordenar
    }
    
    const { active, over } = event;
    console.log('🔍 active.id:', active.id);
    console.log('🔍 over?.id:', over?.id);

    if (active.id !== over?.id) {
      // Encontrar a organização do item sendo arrastado
      const activeItem = cronogramas.find(c => c.id === active.id);
      const overItem = cronogramas.find(c => c.id === over?.id);
      
      if (!activeItem || !overItem) {
        console.log('❌ Item ativo ou item de destino não encontrado');
        return;
      }

      const organizacao = normalizeOrganization(activeItem.organizacao || 'outros');
      console.log('🔍 organizacao do item:', organizacao);
      console.log('🔍 organizacao original:', activeItem.organizacao);
      console.log('🔍 nome da empresa do item:', activeItem.responsavel_empresa);
      console.log('🔍 organizacao normalizada:', organizacao);
      
      // Verificar se é MARAJÓ / REDE FROTA
      if (organizacao === 'rede_frota') {
        console.log('🔍 Item é da MARAJÓ / REDE FROTA');
        console.log('🔍 Verificando se há problemas específicos...');
      }
      
      // Obter todos os cronogramas da organização atual
      const cronogramasDaOrganizacao = cronogramas
        .filter(c => {
          const cronogramaOrg = normalizeOrganization(c.organizacao || '');
          return cronogramaOrg === organizacao;
        });

      console.log('🔍 cronogramas da organização:', cronogramasDaOrganizacao);
      console.log('🔍 Todos os cronogramas:', cronogramas.map(c => ({
        id: c.id,
        organizacao: c.organizacao,
        organizacao_normalizada: normalizeOrganization(c.organizacao || '')
      })));

      // Obter a ordem atual para esta organização (usando a ordem aplicada)
      const cronogramasOrdenados = aplicarOrdemPersonalizada(cronogramasDaOrganizacao, organizacao);
      const currentOrder = cronogramasOrdenados.map(c => c.id);

      console.log('🔍 ordem atual:', currentOrder);
      console.log('🔍 cronogramas ordenados:', cronogramasOrdenados.map(c => ({ id: c.id, titulo: c.titulo })));

      // Verificar se os IDs estão presentes na ordem atual
      const activeId = active.id as number;
      const overId = over?.id as number;
      
      // Se algum ID não está na ordem atual, adicionar ao final
      let updatedOrder = [...currentOrder];
      if (!updatedOrder.includes(activeId)) {
        updatedOrder.push(activeId);
        console.log('🔍 Adicionando active.id à ordem:', activeId);
      }
      if (!updatedOrder.includes(overId)) {
        updatedOrder.push(overId);
        console.log('🔍 Adicionando over.id à ordem:', overId);
      }

      // Encontrar os índices na ordem atualizada
      const oldIndex = updatedOrder.indexOf(activeId);
      const newIndex = updatedOrder.indexOf(overId);

      console.log('🔍 oldIndex:', oldIndex, 'newIndex:', newIndex);
      console.log('🔍 active.id:', activeId, 'over.id:', overId);
      console.log('🔍 ordem atualizada:', updatedOrder);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Reordenar usando arrayMove
        const newOrder = arrayMove(updatedOrder, oldIndex, newIndex);
        console.log('🔍 nova ordem:', newOrder);
        
        // Atualizar o estado
        setOrdemDemandas(prev => ({
          ...prev,
          [organizacao]: newOrder
        }));

        // Salvar no localStorage para persistir a ordem
        const savedOrder = { ...ordemDemandas, [organizacao]: newOrder };
        localStorage.setItem('cronograma-order', JSON.stringify(savedOrder));
        
        console.log('✅ Ordem atualizada com sucesso');
        console.log('🔍 Estado salvo no localStorage:', savedOrder);
      } else {
        console.log('❌ Índices inválidos - oldIndex:', oldIndex, 'newIndex:', newIndex);
        console.log('❌ Verificando se os IDs estão na ordem atualizada...');
        console.log('❌ active.id na ordem:', updatedOrder.includes(activeId));
        console.log('❌ over.id na ordem:', updatedOrder.includes(overId));
        console.log('❌ Ordem atualizada completa:', updatedOrder);
      }
    }
  };

  // Componente para item arrastável na timeline
  const SortableTimelineItem = ({ 
    cronograma, 
    organizacao, 
    dataInicio, 
    dataFim, 
    posicao, 
    coresStatus,
    posicaoHoje
  }: {
    cronograma: CronogramaItem;
    organizacao: string;
    dataInicio: Date | null;
    dataFim: Date | null;
    posicao: { inicio: string; largura: string; colunaInicio: number; colunaFim: number };
    coresStatus: Record<string, string>;
    posicaoHoje: number | null;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: cronograma.id, disabled: !podeReordenar });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div 
        ref={setNodeRef}
        style={style}
        className={`flex items-center h-12 sm:h-14 lg:h-16 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden ${isDragging ? 'z-50' : ''}`}
      >
        <div 
          className="px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm text-gray-700 border-r overflow-hidden"
          style={{ width: `${Math.max(colunaLargura, 120)}px`, minWidth: '120px' }}
        >
          <div className="flex flex-col gap-1 sm:gap-1.5 lg:gap-2 min-w-0">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 flex-1 min-w-0">
                {/* Handle de arrastar */}
                {podeReordenar && (
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    title="Arrastar para reordenar"
                  >
                    <GripVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                  </div>
                )}
                <span 
                  className="truncate cursor-pointer hover:text-blue-600 transition-colors flex-1 block max-w-full text-xs sm:text-sm"
                  onClick={() => {
                    setViewingCronograma(cronograma);
                    setIsViewDialogOpen(true);
                  }}
                  title={`Clique para visualizar: ${cronograma.titulo}`}
                >
                  {cronograma.titulo}
                </span>
              </div>
              <Badge 
                variant={getStatusBadgeInfo(cronograma.status).variant as any}
                className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5"
              >
                {getStatusBadgeInfo(cronograma.status).text}
              </Badge>
            </div>
            {cronograma.responsavel_nome && (
              <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                {cronograma.responsavel_nome}
              </div>
            )}
          </div>
        </div>
        
        {/* Timeline bar interativa */}
        <div className="relative flex-1 h-full">
          {dataInicio && dataFim && (
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 h-6 sm:h-7 lg:h-8 rounded-lg ${getBarColorClass(cronograma)} shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-white hover:scale-105 overflow-hidden`}
              style={{
                left: posicao.inicio,
                width: posicao.largura,
                minWidth: '40px'
              }}
              onClick={() => {
                setViewingCronograma(cronograma);
                setIsViewDialogOpen(true);
              }}
              title={`${cronograma.titulo}
             Status: ${getStatusBadgeInfo(cronograma.status).text}
             Período: ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}
            ${cronograma.responsavel_nome ? `Responsável: ${cronograma.responsavel_nome}` : 'Sem responsável'}
            ${cronograma.motivo_atraso ? `Atraso: ${cronograma.motivo_atraso}` : ''}
             Clique para editar`}
            >
              <span className="text-white text-[10px] sm:text-xs font-medium px-1 sm:px-2 whitespace-nowrap overflow-hidden text-ellipsis block">
                {cronograma.titulo}
              </span>
            </div>
          )}
          
          {/* Linha do tempo atual */}
          {posicaoHoje !== null && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{
                left: `${posicaoHoje}%`
              }}
              title={`Hoje: ${new Date().toLocaleDateString('pt-BR')}`}
            />
          )}
        </div>
      </div>
    );
  };

  // Item não arrastável (para usuários sem permissão)
  const ReadonlyTimelineItem = ({ 
    cronograma, 
    dataInicio, 
    dataFim, 
    posicao, 
    coresStatus,
    posicaoHoje
  }: {
    cronograma: CronogramaItem;
    dataInicio: Date | null;
    dataFim: Date | null;
    posicao: { inicio: string; largura: string; colunaInicio: number; colunaFim: number };
    coresStatus: Record<string, string>;
    posicaoHoje: number | null;
  }) => {
    return (
      <div className={`flex items-center h-12 sm:h-14 lg:h-16 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden`}>
        <div 
          className="px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm text-gray-700 border-r overflow-hidden"
          style={{ width: `${Math.max(colunaLargura, 120)}px`, minWidth: '120px' }}
        >
          <div className="flex flex-col gap-1 sm:gap-1.5 lg:gap-2">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
              <span 
                className="truncate cursor-pointer hover:text-blue-600 transition-colors flex-1 text-xs sm:text-sm"
                onClick={() => {
                  setViewingCronograma(cronograma);
                  setIsViewDialogOpen(true);
                }}
                title={`Clique para visualizar: ${cronograma.titulo}`}
              >
                {cronograma.titulo}
              </span>
              <Badge 
                variant={getStatusBadgeInfo(cronograma.status).variant as any}
                className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5"
              >
                {getStatusBadgeInfo(cronograma.status).text}
              </Badge>
            </div>
            {cronograma.responsavel_nome && (
              <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                {cronograma.responsavel_nome}
              </div>
            )}
          </div>
        </div>
        <div className="relative flex-1 h-full">
          {dataInicio && dataFim && (
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 h-6 sm:h-7 lg:h-8 rounded-lg ${coresStatus[cronograma.status]} shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-white hover:scale-105 overflow-hidden`}
              style={{ left: posicao.inicio, width: posicao.largura, minWidth: '40px' }}
              onClick={() => {
                setViewingCronograma(cronograma);
                setIsViewDialogOpen(true);
              }}
              title={`${cronograma.titulo}\nStatus: ${getStatusBadgeInfo(cronograma.status).text}\nPeríodo: ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}`}
            >
              <span className="text-white text-[10px] sm:text-xs font-medium px-1 sm:px-2 whitespace-nowrap overflow-hidden text-ellipsis block">
                {cronograma.titulo}
              </span>
            </div>
          )}
          {posicaoHoje !== null && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{
                left: `${posicaoHoje}%`
              }}
              title={`Hoje: ${new Date().toLocaleDateString('pt-BR')}`}
            />
          )}
        </div>
      </div>
    );
  };

  // Função para agrupar cronogramas por mês
  const agruparPorMes = (cronogramas: CronogramaItem[]) => {
    const grupos: Record<string, CronogramaItem[]> = {};
    
    cronogramas.forEach(cronograma => {
      const dataFim = cronograma.data_fim ? new Date(cronograma.data_fim) : new Date();
      const chaveMes = `${dataFim.toLocaleDateString('pt-BR', { month: 'short' })}/${dataFim.getFullYear()}`;
      
      if (!grupos[chaveMes]) {
        grupos[chaveMes] = [];
      }
      grupos[chaveMes].push(cronograma);
    });
    
    // Ordenar por data de forma cronológica (mais antigo primeiro)
    const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => {
      // Mapeamento dos meses para números
      const meses = {
        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
      };
      
      // Remover ponto final se existir (ex: "nov." -> "nov")
      const mesA = a.split('/')[0].toLowerCase().replace('.', '');
      const anoA = parseInt(a.split('/')[1]);
      const mesB = b.split('/')[0].toLowerCase().replace('.', '');
      const anoB = parseInt(b.split('/')[1]);
      
      // Primeiro compara o ano
      if (anoA !== anoB) {
        return anoA - anoB;
      }
      
      // Se o ano for igual, compara o mês
      const numMesA = meses[mesA as keyof typeof meses] || 0;
      const numMesB = meses[mesB as keyof typeof meses] || 0;
      
      return numMesA - numMesB;
    });
    
    return gruposOrdenados;
  };

  // Função para alternar expansão de grupo
  const toggleGrupo = (chaveGrupo: string) => {
    const novosGrupos = new Set(gruposExpandidos);
    if (novosGrupos.has(chaveGrupo)) {
      novosGrupos.delete(chaveGrupo);
    } else {
      novosGrupos.add(chaveGrupo);
    }
    setGruposExpandidos(novosGrupos);
  };

  // Função para expandir/recolher todos
  const expandirTodos = () => {
    const cronogramasFiltrados = cronogramas.filter(cronograma => {
      const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
      const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
      const organizacaoMatch = filtroOrganizacao === 'todos' || cronograma.organizacao === filtroOrganizacao;
      const buscaMatch = !busca || cronograma.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                        (cronograma.responsavel_nome && cronograma.responsavel_nome.toLowerCase().includes(busca.toLowerCase()));
      return statusMatch && prioridadeMatch && organizacaoMatch && buscaMatch;
    });
    
    const grupos = agruparPorMes(cronogramasFiltrados);
    const todasChaves = grupos.map(([chave]) => chave);
    setGruposExpandidos(new Set(todasChaves));
  };

  // Função para expandir automaticamente meses com demandas
  const expandirMesesComDemandas = () => {
    const cronogramasFiltrados = cronogramas.filter(cronograma => {
      const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
      const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
      const organizacaoMatch = filtroOrganizacao === 'todos' || cronograma.organizacao === filtroOrganizacao;
      const buscaMatch = !busca || cronograma.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                        (cronograma.responsavel_nome && cronograma.responsavel_nome.toLowerCase().includes(busca.toLowerCase()));
      return statusMatch && prioridadeMatch && organizacaoMatch && buscaMatch;
    });
    
    const grupos = agruparPorMes(cronogramasFiltrados);
    const mesesComDemandas = grupos.map(([chave]) => chave);
    setGruposExpandidos(new Set(mesesComDemandas));
  };

  const recolherTodos = () => {
    setGruposExpandidos(new Set());
  };

  // Função para obter cor do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: 'bg-green-500', label: 'Concluído' };
      case 'em_andamento':
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'bg-blue-500', label: 'Em andamento' };
      case 'atrasado':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'bg-yellow-500', label: 'Em risco' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'bg-gray-500', label: 'Não iniciado' };
    }
  };

  // Função para calcular progresso baseado no status
  const calcularProgresso = (cronograma: CronogramaItem) => {
    switch (cronograma.status) {
      case 'concluido':
        return 100;
      case 'em_andamento':
        // Se tem data de início e fim, calcular progresso baseado no tempo
        if (cronograma.data_inicio && cronograma.data_fim) {
          const inicio = new Date(cronograma.data_inicio);
          const fim = new Date(cronograma.data_fim);
          const hoje = new Date();
          const total = fim.getTime() - inicio.getTime();
          const decorrido = hoje.getTime() - inicio.getTime();
          
          // Se já passou do prazo, considerar 100% mas manter status
          if (decorrido > total) {
            return 100;
          }
          
          const progresso = Math.max(0, Math.min(100, (decorrido / total) * 100));
          return Math.round(progresso);
        }
        return 40; // Progresso médio se não tiver datas
      case 'atrasado':
        // Se tem datas, calcular progresso baseado no tempo
        if (cronograma.data_inicio && cronograma.data_fim) {
          const inicio = new Date(cronograma.data_inicio);
          const fim = new Date(cronograma.data_fim);
          const hoje = new Date();
          const total = fim.getTime() - inicio.getTime();
          const decorrido = hoje.getTime() - inicio.getTime();
          
          if (total > 0) {
            const progresso = Math.max(0, Math.min(100, (decorrido / total) * 100));
            return Math.round(progresso);
          }
        }
        return 30; // Progresso baixo para atrasados
      default:
        return 0; // Não iniciado
    }
  };

  // Função para obter label do status para dashboard
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'concluido':
        return { text: 'Finalizado', color: 'text-green-600' };
      case 'em_andamento':
        return { text: 'Em Andamento', color: 'text-orange-600' };
      case 'atrasado':
        return { text: 'Em Risco', color: 'text-red-600' };
      default:
        return { text: 'Pendente', color: 'text-gray-600' };
    }
  };


  // Função para renderizar a nova visualização em lista
  const renderListView = () => {
    // Filtrar cronogramas com busca
    const cronogramasFiltradosComBusca = cronogramas.filter(cronograma => {
      const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
      const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
      const organizacaoMatch = filtroOrganizacao === 'todos' || cronograma.organizacao === filtroOrganizacao;
      const buscaMatch = !busca || cronograma.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                        (cronograma.responsavel_nome && cronograma.responsavel_nome.toLowerCase().includes(busca.toLowerCase()));
      return statusMatch && prioridadeMatch && organizacaoMatch && buscaMatch;
    });

    const grupos = agruparPorMes(cronogramasFiltradosComBusca);

    return (
      <div className="space-y-6">
        {/* Timeline de atividades */}
        <div className="space-y-4">
          {grupos.map(([mesAno, cronogramasDoMes]) => {
            const isExpanded = gruposExpandidos.has(mesAno);
            
            return (
              <div key={mesAno} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Cabeçalho do grupo */}
                <div 
                  className="bg-gray-50 px-4 lg:px-6 py-3 lg:py-4 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGrupo(mesAno)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div className={`w-2 h-2 rounded-full ${isExpanded ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900">
                        {mesAno}
                      </h3>
                      <span className="text-xs lg:text-sm text-gray-500">
                        {cronogramasDoMes.length} atividade{cronogramasDoMes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg 
                        className={`h-4 w-4 lg:h-5 lg:w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Lista de atividades */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {cronogramasDoMes.map((cronograma) => {
                      const statusColor = getStatusColor(cronograma.status);
                      const dataInicio = cronograma.data_inicio ? new Date(cronograma.data_inicio) : null;
                      const dataFim = cronograma.data_fim ? new Date(cronograma.data_fim) : null;
                      
                      return (
                        <div 
                          key={cronograma.id} 
                          className="p-4 lg:p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setViewingCronograma(cronograma);
                            setIsViewDialogOpen(true);
                          }}
                          title="Clique para visualizar detalhes"
                        >
                          <div className="flex items-start gap-3 lg:gap-4">
                            {/* Indicador visual */}
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-2 h-2 lg:w-3 lg:h-3 rounded-full ${statusColor.icon}`}></div>
                            </div>

                            {/* Conteúdo da atividade */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2 lg:gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 min-w-0">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] lg:text-[11px] font-medium bg-gray-100 text-gray-700 flex-shrink-0 w-fit">
                                      <Building className="h-3 w-3 mr-1" />
                                      {(cronograma.organizacao || '').replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                    <h4 
                                      className="text-base lg:text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors truncate"
                                      onClick={() => {
                                        setViewingCronograma(cronograma);
                                        setIsViewDialogOpen(true);
                                      }}
                                      title="Clique para visualizar detalhes"
                                    >
                                      {cronograma.titulo}
                                    </h4>
                                  </div>
                                  
                                  {/* Status badges */}
                                  <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className={`inline-flex items-center px-2 lg:px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                                      {cronograma.status === 'concluido' && (
                                        <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {cronograma.status === 'em_andamento' && (
                                        <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {cronograma.status === 'atrasado' && (
                                        <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {cronograma.status === 'pendente' && (
                                        <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {statusColor.label}
                                    </span>
                                    
                                    {(cronograma.status === 'em_andamento' || cronograma.status === 'pendente') && (
                                      <span className="inline-flex items-center px-2 lg:px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium bg-orange-100 text-orange-800">
                                        <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Aguardando ação
                                      </span>
                                    )}
                                    
                                    {cronograma.status === 'atrasado' && (
                                      <span className="px-2 lg:px-2.5 py-0.5 rounded-full text-[10px] lg:text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300 inline-flex items-center gap-1">
                                        🏀 BOLA COM: MARAJÓ / REDE FROTA - Murilo e T.I
                                      </span>
                                    )}
                                  </div>

                                  {/* Resumo rápido do motivo do atraso */}
                                  {cronograma.status === 'atrasado' && cronograma.motivo_atraso && (
                                    <p className="mb-2 text-[11px] lg:text-xs text-red-700 line-clamp-1">
                                      <span className="font-semibold">Motivo:</span>{' '}
                                      {cronograma.motivo_atraso}
                                    </p>
                                  )}

                                  {/* Datas */}
                                  <div className="text-xs lg:text-sm text-gray-600">
                                    {dataInicio && dataFim ? (
                                      <span>
                                        {dataInicio.toLocaleDateString('pt-BR')} — {dataFim.toLocaleDateString('pt-BR')}
                                      </span>
                                    ) : dataFim ? (
                                      <span>
                                        {dataFim.toLocaleDateString('pt-BR')}
                                      </span>
                                    ) : (
                                      <span>Sem data definida</span>
                                    )}
                                  </div>
                                </div>

                                {/* Botões de ação */}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCronograma(cronograma);
                                      setIsEditDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog(cronograma);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mensagem quando não há resultados */}
        {grupos.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhuma atividade encontrada</h3>
            <p className="text-gray-500">
              {busca || filtroStatus !== 'todos' || filtroPrioridade !== 'todos' 
                ? 'Tente ajustar os filtros ou termo de busca.'
                : 'Não há atividades cadastradas no momento.'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  // Função para renderizar a visualização em timeline (Gantt)
  const renderTimelineView = () => {
    // Usar cronogramas filtrados diretamente
    const cronogramasParaTimeline = cronogramasFiltrados;
    
    // Agrupar cronogramas por organização
    const cronogramasPorOrganizacao = cronogramasParaTimeline.reduce((acc, cronograma) => {
      const org = normalizeOrganization(cronograma.organizacao || 'outros');
      if (!acc[org]) acc[org] = [];
      acc[org].push(cronograma);
      return acc;
    }, {} as Record<string, CronogramaItem[]>);

    // Aplicar ordem personalizada para cada organização
    const cronogramasOrdenadosPorOrganizacao = Object.entries(cronogramasPorOrganizacao).reduce((acc, [org, cronogramas]) => {
      acc[org] = aplicarOrdemPersonalizada(cronogramas, org);
      return acc;
    }, {} as Record<string, CronogramaItem[]>);

    // Calcular período de visualização dinamicamente baseado nas demandas
    let inicioPeriodo: Date | null = null;
    let fimPeriodo: Date | null = null;
    
    // Encontrar a data mais antiga e a mais recente entre todas as demandas
    cronogramasParaTimeline.forEach(cronograma => {
      if (cronograma.data_inicio) {
        const dataInicio = new Date(cronograma.data_inicio);
        // Pegar o primeiro dia do mês de início
        const inicioMes = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
        if (!inicioPeriodo || inicioMes < inicioPeriodo) {
          inicioPeriodo = inicioMes;
        }
      }
      
      if (cronograma.data_fim) {
        const dataFim = new Date(cronograma.data_fim);
        // Pegar o primeiro dia do mês seguinte à data fim (para incluir o mês completo)
        // Isso garante que o mês onde a demanda termina seja incluído
        const fimMes = new Date(dataFim.getFullYear(), dataFim.getMonth() + 1, 1);
        if (!fimPeriodo || fimMes > fimPeriodo) {
          fimPeriodo = fimMes;
        }
      }
    });
    
    // Se não houver demandas, usar período padrão (últimos 6 meses até próximos 6 meses)
    if (!inicioPeriodo || !fimPeriodo) {
      const hoje = new Date();
      inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - 6, 1);
      fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0);
    }
    // Não adicionar margens extras - mostrar apenas os meses com demandas
    
    // Gerar meses do período - apenas os meses que têm demandas
    const timeUnits: Date[] = [];
    if (inicioPeriodo && fimPeriodo) {
      const currentDate = new Date(inicioPeriodo);
      // fimPeriodo já é o primeiro dia do mês seguinte, então vamos até antes dele
      const fimMesComparacao = new Date(fimPeriodo);
      fimMesComparacao.setMonth(fimMesComparacao.getMonth() - 1);
      
      while (currentDate <= fimMesComparacao) {
        timeUnits.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Cores por organização (fases)
    const coresOrganizacao: Record<string, { bg: string; text: string; light: string }> = {
      'portes': { bg: '#3B82F6', text: '#FFFFFF', light: '#EFF6FF' },
      'cassems': { bg: '#10B981', text: '#FFFFFF', light: '#ECFDF5' },
      'rede_frota': { bg: '#8B5CF6', text: '#FFFFFF', light: '#F3E8FF' },
      'outros': { bg: '#6B7280', text: '#FFFFFF', light: '#F9FAFB' }
    };

    // Função para alternar expansão de fase
    const toggleFase = (organizacao: string) => {
      const novasFases = new Set(fasesExpandidas);
      if (novasFases.has(organizacao)) {
        novasFases.delete(organizacao);
      } else {
        novasFases.add(organizacao);
      }
      setFasesExpandidas(novasFases);
    };

    // Cores por status (harmonizadas com os badges)
    const coresStatus: Record<string, string> = {
      'pendente': 'bg-gray-500',
      'em_andamento': 'bg-blue-500',
      'concluido': 'bg-green-500',
      'atrasado': 'bg-red-500'
    };

    // Calcular posição da data atual (linha vermelha)
    const hoje = new Date();
    const hojeNoPeriodo = hoje >= inicioPeriodo && hoje <= fimPeriodo;
    const posicaoHoje = hojeNoPeriodo 
      ? ((hoje.getTime() - inicioPeriodo.getTime()) / (fimPeriodo.getTime() - inicioPeriodo.getTime())) * 100
      : null;

    // Função para calcular posição da barra
    const calcularPosicaoBarra = (dataInicio: Date | null, dataFim: Date | null) => {
      if (!dataInicio || !dataFim) {
        return { inicio: '0%', largura: '0%', colunaInicio: 0, colunaFim: 1 };
      }
      
      const inicioRelativo = Math.max(0, dataInicio.getTime() - inicioPeriodo.getTime());
      const fimRelativo = Math.min(dataFim.getTime() - inicioPeriodo.getTime(), fimPeriodo.getTime() - inicioPeriodo.getTime());
      const larguraTotal = fimPeriodo.getTime() - inicioPeriodo.getTime();
      
      const inicioPercentual = inicioRelativo / larguraTotal;
      const fimPercentual = fimRelativo / larguraTotal;
      const larguraPercentual = fimPercentual - inicioPercentual;
      
      // Usar percentuais para largura flexível
      const colunaInicio = Math.floor(inicioPercentual * timeUnits.length);
      const colunaFim = Math.ceil(fimPercentual * timeUnits.length);
      
      return { 
        inicio: `${(inicioPercentual * 100).toFixed(2)}%`, 
        largura: `${(larguraPercentual * 100).toFixed(2)}%`, 
        colunaInicio, 
        colunaFim 
      };
    };

    return (
      <div className="space-y-6">
        {/* Cabeçalho da Timeline */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-4 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl break-words">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  Timeline de Demandas
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm lg:text-base mt-1 break-words">
                  {filtroStatus === 'apenas_concluidas' 
                    ? `Visualização temporal das tarefas concluídas (${cronogramasConcluidos.length} tarefas)`
                    : `Visualização temporal das demandas por organização${podeReordenar ? ' - Arraste para reordenar' : ''}`
                  }
                </CardDescription>
              </div>
              
              {/* Controles da timeline */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {Object.keys(cronogramasOrdenadosPorOrganizacao).length} org.
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {cronogramasParaTimeline.length} demandas
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetColumnWidth}
                  className="text-xs h-7 lg:h-6 px-2 whitespace-nowrap"
                  title="Resetar largura da coluna para o padrão"
                >
                  <span className="hidden sm:inline">Resetar Coluna</span>
                  <span className="sm:hidden">Resetar</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
        {/* Timeline Header */}
        <div className="w-full timeline-container overflow-x-auto">
          <div className="w-full min-w-[600px]">
                {/* Header dos meses */}
                <div className="flex border-b-2 border-gray-200">
                  <div 
                    className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 font-semibold text-gray-700 bg-gray-100 border-r flex-shrink-0 relative"
                    style={{ width: `${Math.max(colunaLargura, 120)}px`, minWidth: '120px' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm lg:text-base">Demanda</span>
                    </div>
                    {/* Handle de redimensionamento */}
                    <div
                      className={`absolute top-0 right-0 w-3 h-full cursor-col-resize transition-all group ${
                        isResizing 
                          ? 'bg-blue-500 opacity-100' 
                          : 'bg-gray-300 hover:bg-blue-500 opacity-0 hover:opacity-100'
                      }`}
                      onMouseDown={handleMouseDown}
                      title="Arraste para redimensionar a coluna"
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div className={`w-0.5 h-8 transition-colors ${
                          isResizing ? 'bg-white' : 'bg-gray-400 group-hover:bg-white'
                        }`}></div>
                      </div>
                    </div>
                  </div>
                  {timeUnits.map((timeUnit, index) => (
                    <div key={index} className="px-1 sm:px-1.5 lg:px-2 py-2 sm:py-3 lg:py-4 text-center font-semibold text-gray-700 bg-gray-50 border-r flex-1 min-w-[50px] sm:min-w-[60px] lg:min-w-[80px]">
                      <span className="text-[10px] sm:text-xs lg:text-sm">
                        {timeUnit.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Linhas das organizações */}
                {podeReordenar ? (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    {Object.entries(cronogramasOrdenadosPorOrganizacao).map(([organizacao, cronogramasOrg]) => (
                  <div key={organizacao} className="border-b border-gray-100">
                    {/* Header da organização */}
                    <div className="flex items-center h-10 sm:h-12 lg:h-16 bg-gray-100 hover:bg-gray-50 transition-colors">
                      <div 
                        className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 font-semibold text-gray-900 border-r flex-shrink-0"
                        style={{ width: `${Math.max(colunaLargura, 120)}px`, minWidth: '120px' }}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full ${coresOrganizacao[organizacao] || 'bg-gray-400'}`}></div>
                          <span className="truncate text-xs sm:text-sm lg:text-base font-medium">
                            {organizacao.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {timeUnits.map((_, index) => (
                        <div key={index} className="border-r flex-1 min-w-[50px] sm:min-w-[60px] lg:min-w-[80px]"></div>
                      ))}
                    </div>

                    {/* Linhas das demandas */}
                    <SortableContext items={cronogramasOrg.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      {cronogramasOrg.map((cronograma) => {
                        const dataInicio = cronograma.data_inicio ? new Date(cronograma.data_inicio) : null;
                        const dataFim = cronograma.data_fim ? new Date(cronograma.data_fim) : null;
                        
                        const posicao = calcularPosicaoBarra(dataInicio, dataFim);

                        return (
                          <SortableTimelineItem
                            key={cronograma.id}
                            cronograma={cronograma}
                            organizacao={organizacao}
                            dataInicio={dataInicio}
                            dataFim={dataFim}
                            posicao={posicao}
                            coresStatus={coresStatus}
                            posicaoHoje={posicaoHoje}
                          />
                        );
                      })}
                    </SortableContext>
                  </div>
                ))}
                  </DndContext>
                ) : (
                  Object.entries(cronogramasOrdenadosPorOrganizacao).map(([organizacao, cronogramasOrg]) => (
                    <div key={organizacao} className="border-b border-gray-100">
                      {/* Header da organização */}
                      <div className="flex items-center h-10 sm:h-12 lg:h-16 bg-gray-100 hover:bg-gray-50 transition-colors">
                        <div 
                          className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 lg:py-4 font-semibold text-gray-900 border-r flex-shrink-0"
                          style={{ width: `${Math.max(colunaLargura, 120)}px`, minWidth: '120px' }}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full ${coresOrganizacao[organizacao] || 'bg-gray-400'}`}></div>
                            <span className="truncate text-xs sm:text-sm lg:text-base font-medium">
                              {organizacao.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {timeUnits.map((_, index) => (
                          <div key={index} className="border-r flex-1 min-w-[50px] sm:min-w-[60px] lg:min-w-[80px]"></div>
                        ))}
                      </div>

                      {/* Linhas das demandas (somente leitura) */}
                      {cronogramasOrg.map((cronograma) => {
                        const dataInicio = cronograma.data_inicio ? new Date(cronograma.data_inicio) : null;
                        const dataFim = cronograma.data_fim ? new Date(cronograma.data_fim) : null;
                        const posicao = calcularPosicaoBarra(dataInicio, dataFim);
                        return (
                          <ReadonlyTimelineItem
                            key={cronograma.id}
                            cronograma={cronograma}
                            dataInicio={dataInicio}
                            dataFim={dataFim}
                            posicao={posicao}
                            coresStatus={coresStatus}
                            posicaoHoje={posicaoHoje}
                          />
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  };

  // Abrir modal de confirmação de exclusão
  const openDeleteDialog = (cronograma: CronogramaItem) => {
    setCronogramaToDelete(cronograma);
    setIsDeleteDialogOpen(true);
  };

  // Confirmar exclusão
  const confirmDelete = async () => {
    if (!cronogramaToDelete) return;

    try {
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const response = await fetch(`${API_BASE}/cronograma/${cronogramaToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-organization': userOrg
        }
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Cronograma excluído com sucesso!",
        });
        fetchCronogramas();
        fetchEstatisticas();
        setIsDeleteDialogOpen(false);
        setCronogramaToDelete(null);
      } else {
        throw new Error('Erro ao excluir cronograma');
      }
    } catch (error) {
      console.error('Erro ao excluir cronograma:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir cronograma",
        variant: "destructive",
      });
    }
  };

  // Função para selecionar empresa
  const handleSelecionarEmpresa = (organizacao: any) => {
    setOrganizacaoSelecionada(organizacao.codigo);
    setMostrarSelecaoEmpresa(false);
    // Salvar seleção no localStorage para persistir
    localStorage.setItem('cronograma-empresa-selecionada', organizacao.codigo);
  };

  // Se for usuário Portes e ainda não selecionou empresa, mostrar tela de seleção
  if (mostrarSelecaoEmpresa && currentUser?.organizacao === 'portes') {
    return (
      <ErrorBoundary>
        <div className="p-3 sm:p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                Selecione uma Empresa
              </h1>
              <p className="text-gray-600 text-base lg:text-lg">
                Escolha a empresa para visualizar o cronograma de demandas
              </p>
            </div>

            {loadingOrganizacoes ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : organizacoes.length === 0 ? (
              <div className="text-center py-20">
                <Building className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">Nenhuma organização cadastrada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {organizacoes.map((org) => (
                  <Card
                    key={org.id}
                    className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-2 hover:border-blue-500 overflow-hidden"
                    onClick={() => handleSelecionarEmpresa(org)}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{
                            backgroundColor: org.logo_url ? 'transparent' : (org.cor_identificacao || '#3B82F6'),
                            opacity: org.logo_url ? 1 : 0.1
                          }}
                        >
                          {org.logo_url ? (
                            <img
                              src={(() => {
                                if (org.logo_url.startsWith('http')) {
                                  return org.logo_url;
                                }
                                // Se logo_url começa com /api, remover /api para evitar duplicação
                                const logoPath = org.logo_url.startsWith('/api') 
                                  ? org.logo_url.substring(4)
                                  : org.logo_url;
                                return `${API_BASE}${logoPath}`;
                              })()}
                              alt={`Logo ${org.nome}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Se a imagem falhar ao carregar, esconder e mostrar o ícone
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  // Criar ícone Building como fallback
                                  const iconWrapper = document.createElement('div');
                                  iconWrapper.innerHTML = `
                                    <svg class="h-6 w-6 sm:h-8 sm:w-8" style="color: ${org.cor_identificacao || '#3B82F6'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                                    </svg>
                                  `;
                                  parent.appendChild(iconWrapper.firstElementChild);
                                }
                              }}
                            />
                          ) : (
                            <Building
                              className="h-6 w-6 sm:h-8 sm:w-8"
                              style={{
                                color: org.cor_identificacao || '#3B82F6'
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 break-words">
                            {org.nome}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                              Acessar Cronograma
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl lg:text-3xl font-bold">Cronograma de Demandas</h1>
          </div>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            {currentUser?.organizacao === 'portes' && organizacaoSelecionada
              ? `Demandas da ${organizacoes.find(o => o.codigo === organizacaoSelecionada)?.nome || organizacaoSelecionada.toUpperCase()}`
              : currentUser?.organizacao === 'portes'
              ? 'Selecione uma empresa para visualizar o cronograma'
              : `Demandas da ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'sua organização'}`
            }
          </p>
          {currentUser?.organizacao === 'portes' && organizacaoSelecionada ? (
            <p className="text-xs lg:text-sm text-green-600 mt-1">
              Visualizando cronograma da empresa selecionada.
            </p>
          ) : currentUser?.organizacao === 'portes' ? (
            <p className="text-xs lg:text-sm text-green-600 mt-1">
              Acesso completo a todos os cronogramas do sistema.
            </p>
          ) : (
            <p className="text-xs lg:text-sm text-blue-600 mt-1">
              Visualizando as demandas.
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {/* Botões de alternância de visualização */}
          <div className="flex bg-gray-100 rounded-lg p-1 shadow-sm border border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={`flex items-center transition-all duration-300 ${
                viewMode === 'list' 
                  ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600 transform scale-105 ring-2 ring-blue-200' 
                  : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900 hover:scale-105'
              } rounded-md px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium relative group`}
              title="Visualização em lista - Organizada por grupos de mês"
              aria-pressed={viewMode === 'list'}
            >
              <List className={`h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2 transition-transform duration-200 ${
                viewMode === 'list' ? 'scale-110' : ''
              }`} />
              <span className="hidden sm:inline">Lista</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Visualização em lista
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center transition-all duration-300 ${
                viewMode === 'timeline' 
                  ? 'bg-blue-500 text-white shadow-md hover:bg-blue-600 transform scale-105 ring-2 ring-blue-200' 
                  : 'hover:bg-gray-200 text-gray-700 hover:text-gray-900 hover:scale-105'
              } rounded-md px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium relative group`}
              title="Visualização em timeline - Cronograma visual por organização"
              aria-pressed={viewMode === 'timeline'}
            >
              <BarChart3 className={`h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2 transition-transform duration-200 ${
                viewMode === 'timeline' ? 'scale-110' : ''
              }`} />
              <span className="hidden sm:inline">Timeline</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Visualização em timeline
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </Button>
          </div>
          
          {/* Controles adicionais */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleGerarOverviewClick} 
              disabled={loading || loadingMesIA} 
              className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <BarChart3 className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
              Gerar Overview
            </Button>
            <Button 
              onClick={() => {
                setEditingCronograma(null);
                setFormData(initialFormData());
                setIsEditDialogOpen(true);
              }} 
              className="text-xs lg:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline">Nova Demanda</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium break-words">Total de Demandas</CardTitle>
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 ml-2" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold break-words">{estatisticas.total_cronogramas}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium break-words">Em Andamento</CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0 ml-2" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-blue-600 break-words">{estatisticas.em_andamento}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium break-words">Concluídos</CardTitle>
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 ml-2" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-green-600 break-words">{estatisticas.concluidos}</div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium break-words">Atrasados</CardTitle>
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0 ml-2" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-red-600 break-words">
                {estatisticas.atrasados}
              </div>
              <div className="mt-2 space-y-1 text-xs sm:text-sm">
                <p className="text-red-700 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  Portes:{' '}
                  <span className="font-semibold">
                    {estatisticas.atrasados_portes ?? 0}
                  </span>
                </p>
                <p className="text-orange-700 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                  Cliente:{' '}
                  <span className="font-semibold">
                    {estatisticas.atrasados_empresa ?? 0}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="overflow-hidden">
        <CardHeader 
          className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setFiltrosExpanded(!filtrosExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              Filtros
            </CardTitle>
            {filtrosExpanded ? (
              <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
            )}
          </div>
        </CardHeader>
        {filtrosExpanded && (
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
            <div className="w-full min-w-0">
              <Label htmlFor="status-filter" className="text-xs sm:text-sm font-medium">Status</Label>
              <Select key={`status-${viewMode}-${filtroStatus}`} value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="mt-1 h-9 sm:h-10 text-xs sm:text-sm w-full">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full min-w-0">
              <Label htmlFor="prioridade-filter" className="text-xs sm:text-sm font-medium">Prioridade</Label>
              <Select key={`prioridade-${viewMode}-${filtroPrioridade}`} value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger className="mt-1 h-9 sm:h-10 text-xs sm:text-sm w-full">
                  <SelectValue placeholder="Todas as prioridades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {currentUser?.organizacao === 'portes' && (
              <div className="w-full min-w-0">
                <Label htmlFor="organizacao-filter" className="text-xs sm:text-sm font-medium">Organização</Label>
                <Select key={`org-${viewMode}-${filtroOrganizacao}`} value={filtroOrganizacao} onValueChange={setFiltroOrganizacao}>
                  <SelectTrigger className="mt-1 h-9 sm:h-10 text-xs sm:text-sm w-full">
                    <SelectValue placeholder="Todas as organizações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {organizacoesUnicas.map(org => (
                      <SelectItem key={org} value={org}>
                        {org.charAt(0).toUpperCase() + org.slice(1).replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            </div>
            
            {/* Contador de tarefas concluídas */}
            {filtroStatus === 'apenas_concluidas' && (
              <div className="mt-4 flex items-center gap-4 w-full">
                <div className="text-xs sm:text-sm text-gray-600 break-words">
                  ({cronogramasConcluidos.length} tarefa{cronogramasConcluidos.length !== 1 ? 's' : ''} concluída{cronogramasConcluidos.length !== 1 ? 's' : ''})
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Conteúdo baseado no modo de visualização */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'list' ? (
        renderListView()
      ) : (
        renderTimelineView()
      )}

      {/* Dialog de Edição/Criação */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 lg:pt-6 pb-3 sm:pb-4 border-b">
            <DialogTitle className="text-base sm:text-lg lg:text-xl break-words">
              {editingCronograma ? 'Editar Demanda' : 'Nova Demanda'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm lg:text-base break-words mt-1">
              {editingCronograma ? 'Modifique os dados da demanda abaixo.' : 'Preencha os dados para criar uma nova demanda.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 lg:py-6 -mx-3 sm:mx-0">
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="lg:col-span-2">
                  <Label htmlFor="titulo" className="text-xs sm:text-sm font-medium">Título *</Label>
                  <Input
                    id="titulo"
                    value={formData.titulo}
                    onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                    placeholder="Digite o título da demanda"
                    className="mt-1.5 text-xs sm:text-sm"
                  />
                </div>
                
                <div className="lg:col-span-2">
                  <Label htmlFor="descricao" className="text-xs sm:text-sm font-medium">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Descreva a demanda em detalhes"
                    rows={3}
                    className="mt-1.5 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="organizacao" className="text-xs sm:text-sm font-medium">Organização</Label>
                  <Select
                    value={formData.organizacao}
                    onValueChange={(value) => setFormData({...formData, organizacao: value})}
                  >
                    <SelectTrigger className="mt-1.5 h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione a organização" />
                    </SelectTrigger>
                  <SelectContent>
                    {/* Se for usuário Portes, mostrar todas as organizações da lista */}
                    {currentUser?.organizacao === 'portes' ? (
                      <>
                        {organizacoes.length > 0 ? (
                          organizacoes
                            .filter((org: any) => org.ativa !== false) // Filtrar apenas organizações ativas
                            .map((org: any) => {
                              // Usar codigo como valor principal, com fallback para organizacao
                              const orgValue = org.codigo || org.organizacao || org.nome?.toLowerCase().replace(/\s+/g, '_');
                              const orgName = org.nome || org.organizacao || org.codigo;
                              return (
                                <SelectItem key={org.codigo || org.id} value={orgValue}>
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4" />
                                    {orgName}
                                  </div>
                                </SelectItem>
                              );
                            })
                        ) : (
                          <>
                            {/* Fallback enquanto carrega ou se não houver organizações */}
                            <SelectItem value={currentUser?.organizacao || 'cassems'}>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {currentUser?.nome_empresa || currentUser?.organizacao_nome || 'CASSEMS'}
                              </div>
                            </SelectItem>
                            <SelectItem value="portes">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                PORTES
                              </div>
                            </SelectItem>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Para usuários não-Portes, mostrar apenas sua organização e Portes */}
                        <SelectItem value={currentUser?.organizacao || 'cassems'}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {currentUser?.nome_empresa || currentUser?.organizacao_nome || 
                             (currentUser?.organizacao === 'portes' ? 'PORTES' : 
                              currentUser?.organizacao === 'cassems' ? 'CASSEMS' : 
                              currentUser?.organizacao === 'rede_frota' ? 'MARAJÓ / REDE FROTA' : 
                              'SUA ORGANIZAÇÃO')}
                          </div>
                        </SelectItem>
                        <SelectItem value="portes">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            PORTES
                          </div>
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1.5 break-words">
                    {currentUser?.organizacao !== 'portes' 
                      ? 'Você pode criar demandas para sua organização ou para a Portes'
                      : 'Selecione a organização para a demanda'
                    }
                  </p>
                </div>

                <div>
                  <Label htmlFor="fase_atual" className="text-xs sm:text-sm font-medium">Fase Atual</Label>
                  <Select
                    value={formData.fase_atual}
                    onValueChange={(value) => setFormData({...formData, fase_atual: value})}
                  >
                    <SelectTrigger className="mt-1.5 h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione a fase" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inicio">Início</SelectItem>
                    <SelectItem value="planejamento">Planejamento</SelectItem>
                    <SelectItem value="execucao">Execução</SelectItem>
                    <SelectItem value="revisao">Revisão</SelectItem>
                    <SelectItem value="conclusao">Conclusão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status" className="text-xs sm:text-sm font-medium">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({...formData, status: value})}
                  >
                    <SelectTrigger className="mt-1.5 h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="prioridade" className="text-xs sm:text-sm font-medium">Prioridade</Label>
                  <Select
                    value={formData.prioridade}
                    onValueChange={(value) => setFormData({...formData, prioridade: value})}
                  >
                    <SelectTrigger className="mt-1.5 h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione a prioridade" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="data_inicio" className="text-xs sm:text-sm font-medium">Data de Início</Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                    className="mt-1.5 text-xs sm:text-sm h-9 sm:h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="data_fim" className="text-xs sm:text-sm font-medium">Data de Fim</Label>
                  <Input
                    id="data_fim"
                    type="date"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
                    className="mt-1.5 text-xs sm:text-sm h-9 sm:h-10"
                  />
                </div>

                <div className="lg:col-span-2">
                  <Label htmlFor="responsavel_id" className="text-xs sm:text-sm font-medium">Responsável</Label>
                  <Select
                    value={formData.responsavel_id?.toString() || 'none'}
                    onValueChange={(value) => setFormData({...formData, responsavel_id: value === 'none' ? null : parseInt(value)})}
                  >
                    <SelectTrigger className="mt-1.5 h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Não atribuído
                      </div>
                    </SelectItem>
                    {usuarios.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id.toString()}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {usuario.nome}
                          {usuario.nome_empresa && (
                            <span className="text-xs text-gray-500">({usuario.nome_empresa})</span>
                          )}
                        </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-2">
                  <Label htmlFor="observacoes" className="text-xs sm:text-sm font-medium">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    placeholder="Observações gerais sobre a demanda"
                    rows={3}
                    className="mt-1.5 text-xs sm:text-sm"
                  />
                </div>

                {formData.status === 'atrasado' && (
                  <div className="lg:col-span-2">
                    <Label htmlFor="motivo_atraso" className="text-xs sm:text-sm font-medium">Motivo do Atraso *</Label>
                    <Textarea
                      id="motivo_atraso"
                      value={formData.motivo_atraso}
                      onChange={(e) => setFormData({ ...formData, motivo_atraso: e.target.value })}
                      placeholder="Explique o motivo do atraso (obrigatório quando status é 'atrasado')"
                      rows={2}
                      className="mt-1.5 text-xs sm:text-sm border-red-200 focus:border-red-500"
                    />
                    <p className="text-xs text-red-600 mt-1.5 break-words">
                      Este campo é obrigatório quando o status é "Atrasado"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer com Botões */}
          <div className="flex-shrink-0 border-t bg-gray-50/50 px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingCronograma(null);
                }}
                className="text-xs sm:text-sm w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                onClick={salvarCronograma} 
                disabled={
                  !formData.titulo.trim() || 
                  (formData.status === 'atrasado' && (!formData.motivo_atraso.trim() || !formData.parte_responsavel_atraso))
                }
                className="text-xs sm:text-sm w-full sm:w-auto"
              >
                {editingCronograma ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="relative flex-shrink-0 px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 lg:pt-6 pb-3 sm:pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl break-words flex-1 min-w-0">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="break-words">{viewingCronograma?.titulo}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words mt-2">
              Detalhes da demanda selecionada
            </DialogDescription>
          </DialogHeader>
          
          {viewingCronograma && (
            <>
              {/* Destaque de atraso no topo */}
              {viewingCronograma.status === 'atrasado' && (
                <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
                  <Card className="border-l-4 border-red-500 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-red-700 flex items-center gap-2 text-sm sm:text-base">
                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                        Demanda Atrasada
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2 text-xs sm:text-sm">
                      <p>
                        <strong>🏀 Bola com:</strong> MARAJÓ / REDE FROTA - Murilo e T.I
                      </p>

                      {viewingCronograma.motivo_atraso && (
                        <p>
                          <strong>Motivo:</strong> {viewingCronograma.motivo_atraso}
                        </p>
                      )}

                      <p className="text-[11px] text-gray-600">
                        Última atualização:{' '}
                        {viewingCronograma.updated_at
                          ? new Date(viewingCronograma.updated_at).toLocaleString('pt-BR')
                          : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 lg:py-6">
                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-4 lg:gap-6">
                {/* Grid 1: Informações da Demanda */}
                <div className="flex flex-col min-h-0">
                  {/* Área scrollável de conteúdo */}
                  <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                  {/* Status e Prioridade */}
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">Status:</span>
                      <Badge 
                        variant={getStatusBadgeInfo(viewingCronograma.status).variant as any}
                        className="text-xs whitespace-nowrap"
                      >
                        {getStatusBadgeInfo(viewingCronograma.status).text}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">Prioridade:</span>
                      <Badge 
                        variant={getPriorityBadgeInfo(viewingCronograma.prioridade).variant as any}
                        className="text-xs whitespace-nowrap"
                      >
                        {getPriorityBadgeInfo(viewingCronograma.prioridade).text}
                      </Badge>
                    </div>
                  </div>

                  {/* Descrição */}
                  {viewingCronograma.descricao && (
                    <div className="w-full">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-2 break-words">Descrição</h3>
                      <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2 sm:p-3 rounded-lg leading-relaxed break-words">
                        {viewingCronograma.descricao}
                      </p>
                    </div>
                  )}

                  {/* Informações do Período e Responsável */}
                  <div className="flex flex-col gap-3 sm:gap-4 w-full">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
                      <div className="w-full min-w-0">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2 break-words">Data de Início</h3>
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-700 break-words">
                            {formatDateForDisplay(viewingCronograma.data_inicio)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full min-w-0">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2 break-words">Data de Fim</h3>
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-700 break-words">
                            {formatDateForDisplay(viewingCronograma.data_fim)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full min-w-0">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2 break-words">Responsável</h3>
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-xs sm:text-sm text-gray-700 break-words">
                          {viewingCronograma.responsavel_nome || 'Não definido'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Motivo do Atraso */}
                  {viewingCronograma.motivo_atraso && (
                    <div className="w-full">
                      <button
                        onClick={() => setIsDelayExpanded(!isDelayExpanded)}
                        className="flex items-center justify-between w-full text-left mb-2 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <h3 className="text-xs sm:text-sm font-medium text-red-600 break-words">Motivo do Atraso</h3>
                        <ChevronDown 
                          className={`h-4 w-4 sm:h-5 sm:w-5 text-red-500 transition-transform flex-shrink-0 ${
                            isDelayExpanded ? 'rotate-180' : ''
                          }`} 
                        />
                      </button>
                      
                      {isDelayExpanded && (
                        <div className="bg-red-50 border border-red-200 p-2 sm:p-3 rounded-lg w-full">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium text-red-700 break-words">Atraso Identificado</span>
                          </div>
                          <p className="text-xs sm:text-sm text-red-700 leading-relaxed break-words">
                            {viewingCronograma.motivo_atraso}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de Progresso */}
                  {checklistItems.length > 0 && (
                    <div className="w-full">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-2">
                        <span className="text-xs sm:text-sm font-medium text-gray-600 break-words">
                          Progresso: {checklistItems.filter(item => item.concluido).length}/{checklistItems.length} itens concluídos
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">
                          {Math.round((checklistItems.filter(item => item.concluido).length / checklistItems.length) * 100)}%
                        </span>
                      </div>
                      <Progress 
                        value={(checklistItems.filter(item => item.concluido).length / checklistItems.length) * 100} 
                        className="h-2 [&>div]:bg-green-500 w-full"
                      />
                    </div>
                  )}

                  {/* Observações */}
                  {viewingCronograma.observacoes && (
                    <div className="w-full">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-2 break-words">Observações</h3>
                      <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2 sm:p-3 rounded-lg leading-relaxed break-words">
                        {viewingCronograma.observacoes}
                      </p>
                    </div>
                  )}

                  </div>
                </div>

              {/* Grid 2: Checklist */}
              <div className="flex flex-col min-h-0">
                <div className="flex flex-col gap-2 mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-700 break-words">Checklist da Demanda</h3>
                  {(viewingCronograma?.data_inicio || viewingCronograma?.data_fim) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="break-words">
                        {viewingCronograma.data_inicio && viewingCronograma.data_fim
                          ? `${formatDateForDisplay(viewingCronograma.data_inicio)} a ${formatDateForDisplay(viewingCronograma.data_fim)}`
                          : viewingCronograma.data_inicio
                          ? `Início: ${formatDateForDisplay(viewingCronograma.data_inicio)}`
                          : viewingCronograma.data_fim
                          ? `Fim: ${formatDateForDisplay(viewingCronograma.data_fim)}`
                          : null
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Lista de itens do checklist */}
                <div className="space-y-2 sm:space-y-3">
                  {checklistLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : checklistItems.length > 0 ? (
                    currentUser?.organizacao === 'portes' ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleChecklistDragEnd}
                      >
                        <SortableContext
                          items={checklistItems.map(item => item.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="flex flex-col gap-2 sm:gap-3 w-full">
                            {checklistItems.map((item) => (
                              <SortableChecklistItem key={item.id} item={item} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="flex flex-col gap-2 sm:gap-3 w-full">
                        {checklistItems.map((item) => (
                          <SortableChecklistItem key={item.id} item={item} disabled={true} />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="text-center py-4 sm:py-6 text-gray-500 px-2">
                      <CheckSquare className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs sm:text-sm break-words">Nenhum item no checklist</p>
                      <p className="text-xs text-gray-400 mt-1 break-words px-2">
                        Clique no botão "Checklist" abaixo para adicionar itens
                      </p>
                    </div>
                  )}
                </div>
              </div>
              </div>
              </div>
              
              {/* Footer com Botões de Ação */}
              <div className="flex-shrink-0 border-t bg-gray-50/50 px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                {currentUser?.organizacao === 'portes' ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    {/* Botão Checklist à esquerda */}
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (viewingCronograma) {
                          setIsViewDialogOpen(false);
                          setIsChecklistOpen(true);
                        }
                      }}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 text-xs sm:text-sm w-full sm:w-auto order-3 sm:order-1"
                    >
                      <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      Checklist
                    </Button>

                    {/* Botões de ação à direita */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2">
                      <Button
                        onClick={() => {
                          setViewingCronograma(null);
                          setIsViewDialogOpen(false);
                          setEditingCronograma(viewingCronograma);
                          setIsEditDialogOpen(true);
                        }}
                        className="text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setIsViewDialogOpen(false);
                          setCronogramaToDelete(viewingCronograma);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm w-full sm:w-auto"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-0"></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta demanda? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Informações do cronograma */}
            {cronogramaToDelete && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-semibold text-gray-900 mb-2">{cronogramaToDelete.titulo}</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>Organização:</strong> {cronogramaToDelete.organizacao?.toUpperCase()}</p>
                  <p><strong>Status:</strong> {cronogramaToDelete.status}</p>
                  <p><strong>Prioridade:</strong> {cronogramaToDelete.prioridade}</p>
                  {cronogramaToDelete.data_inicio && (
                    <p><strong>Data de Início:</strong> {new Date(cronogramaToDelete.data_inicio).toLocaleDateString('pt-BR')}</p>
                  )}
                  {cronogramaToDelete.data_fim && (
                    <p><strong>Data de Fim:</strong> {new Date(cronogramaToDelete.data_fim).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Alerta de atenção */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-2">ATENÇÃO: Todos os dados relacionados serão excluídos permanentemente:</h4>
                  <ul className="space-y-1 text-sm text-yellow-700">
                    <li>• Dados da demanda</li>
                    <li>• Histórico de alterações</li>
                    <li>• Observações e comentários</li>
                    <li>• Motivos de atraso registrados</li>
                    <li>• Progresso e fases</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setCronogramaToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Sim, Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal do Checklist */}
      {viewingCronograma && (
        <Checklist
          cronogramaId={viewingCronograma.id}
          isOpen={isChecklistOpen}
          onClose={() => {
            setIsChecklistOpen(false);
            // Volta para o modal de visualização da demanda
            setIsViewDialogOpen(true);
          }}
        />
      )}

      {/* Modal de Seleção de Organização para PDF */}
      <Dialog open={isOrganizationModalOpen} onOpenChange={setIsOrganizationModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 lg:gap-3 text-base lg:text-lg break-words">
              <Download className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 flex-shrink-0" />
              Configurar Overview PDF
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm lg:text-base break-words mt-1">
              Escolha o tipo de overview e configure os filtros desejados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 -mr-1 sm:mr-0">
            <div className="space-y-4 lg:space-y-6">
            {/* Tipo de Overview */}
            <div className="space-y-2 lg:space-y-3">
              <Label htmlFor="tipo-overview-select" className="text-xs sm:text-sm lg:text-base font-medium">Tipo de Overview</Label>
              <Select value={tipoOverview} onValueChange={(value: 'geral' | 'por_mes') => {
                setTipoOverview(value);
                // Preencher com mês atual se selecionar por mês
                if (value === 'por_mes') {
                  const hoje = new Date();
                  if (!selectedAno) setSelectedAno(hoje.getFullYear().toString());
                  if (!selectedMes) setSelectedMes((hoje.getMonth() + 1).toString());
                }
              }}>
                <SelectTrigger className="h-9 sm:h-10 lg:h-12 text-xs sm:text-sm">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Overview Geral</SelectItem>
                  <SelectItem value="por_mes">Overview por Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Seleção de organização - apenas se não houver organização já selecionada */}
            {!organizacaoSelecionada && (
              <div className="space-y-2 lg:space-y-3">
                <Label htmlFor="org-pdf-select" className="text-xs sm:text-sm lg:text-base font-medium">Organização</Label>
                <Select value={selectedOrganizationForPDF} onValueChange={setSelectedOrganizationForPDF}>
                  <SelectTrigger className="h-9 sm:h-10 lg:h-12 text-xs sm:text-sm">
                    <SelectValue placeholder="Selecione uma organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as organizações</SelectItem>
                    {organizacoesUnicas.map(org => (
                      <SelectItem key={org} value={org}>
                        {org.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
      
            {/* Campos condicionais baseados no tipo */}
            {tipoOverview === 'geral' ? (
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="status-pdf-select" className="text-xs sm:text-sm lg:text-base font-medium">Status das Demandas</Label>
                <Select value={selectedStatusForPDF} onValueChange={setSelectedStatusForPDF}>
                  <SelectTrigger className="h-9 sm:h-10 lg:h-12 text-xs sm:text-sm">
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as demandas</SelectItem>
                    <SelectItem value="concluido">Concluídas</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="atrasado">Atrasadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2 lg:space-y-3">
                  <Label htmlFor="ano-select" className="text-xs sm:text-sm lg:text-base font-medium">Ano</Label>
                  <Select value={selectedAno} onValueChange={setSelectedAno}>
                    <SelectTrigger className="h-9 sm:h-10 lg:h-12 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecione o ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const ano = new Date().getFullYear() - 2 + i;
                        return (
                          <SelectItem key={ano} value={ano.toString()}>
                            {ano}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2 lg:space-y-3">
                  <Label htmlFor="mes-select" className="text-sm lg:text-base font-medium">Mês</Label>
                  <Select value={selectedMes} onValueChange={setSelectedMes}>
                    <SelectTrigger className="h-10 lg:h-12">
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: '1', label: 'Janeiro' },
                        { value: '2', label: 'Fevereiro' },
                        { value: '3', label: 'Março' },
                        { value: '4', label: 'Abril' },
                        { value: '5', label: 'Maio' },
                        { value: '6', label: 'Junho' },
                        { value: '7', label: 'Julho' },
                        { value: '8', label: 'Agosto' },
                        { value: '9', label: 'Setembro' },
                        { value: '10', label: 'Outubro' },
                        { value: '11', label: 'Novembro' },
                        { value: '12', label: 'Dezembro' }
                      ].map(mes => (
                        <SelectItem key={mes.value} value={mes.value}>
                          {mes.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {/* Informações do overview selecionado */}
            {tipoOverview === 'por_mes' && selectedAno && selectedMes && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-medium text-purple-800">
                      Análise Inteligente por Mês
                    </p>
                    <p className="text-xs sm:text-sm text-purple-600 mt-2">
                      A Inteligência Artificial irá analisar todas as demandas e checklists do mês {selectedMes}/{selectedAno}, 
                      incluindo análises detalhadas das descrições e listando todos os pontos concluídos.
                      {selectedOrganizationForPDF !== 'todos' && (
                        <span className="block mt-1">
                          <strong>Organização:</strong> {selectedOrganizationForPDF.toUpperCase()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tipoOverview === 'geral' && (
              <>
                {selectedOrganizationForPDF !== 'todos' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex-shrink-0">
                        <Building className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-medium text-blue-800">
                          Overview específico para: {selectedOrganizationForPDF.toUpperCase()}
                        </p>
                        <p className="text-xs sm:text-sm text-blue-600 mt-2">
                          Será gerado um PDF contendo apenas as demandas desta organização.
                          {selectedStatusForPDF !== 'todos' && (
                            <span className="block mt-1">
                              <strong>Status filtrado:</strong> {selectedStatusForPDF === 'concluido' ? 'Concluídas' : 
                                                              selectedStatusForPDF === 'em_andamento' ? 'Em Andamento' :
                                                              selectedStatusForPDF === 'pendente' ? 'Pendentes' :
                                                              selectedStatusForPDF === 'atrasado' ? 'Atrasadas' : selectedStatusForPDF}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedOrganizationForPDF === 'todos' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex-shrink-0">
                        <Building className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-medium text-green-800">
                          Overview completo de todas as organizações
                        </p>
                        <p className="text-xs sm:text-sm text-green-600 mt-2">
                          Será gerado um PDF contendo todas as demandas de todas as organizações.
                          {selectedStatusForPDF !== 'todos' && (
                            <span className="block mt-1">
                              <strong>Status filtrado:</strong> {selectedStatusForPDF === 'concluido' ? 'Concluídas' : 
                                                              selectedStatusForPDF === 'em_andamento' ? 'Em Andamento' :
                                                              selectedStatusForPDF === 'pendente' ? 'Pendentes' :
                                                              selectedStatusForPDF === 'atrasado' ? 'Atrasadas' : selectedStatusForPDF}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Informação sobre geração com IA */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex-shrink-0">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-purple-800">
                        Geração com Inteligência Artificial
                      </p>
                      <p className="text-xs sm:text-sm text-purple-600 mt-1">
                        O overview será gerado automaticamente pela IA com análise inteligente do que está sendo feito. Você poderá ver o resumo sendo gerado em tempo real.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-3 sm:pt-4 border-t flex-shrink-0 mt-auto">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsOrganizationModalOpen(false);
                setUsarIA(false);
                setTipoOverview('geral');
              }}
              className="w-full sm:w-auto px-4 sm:px-6 text-sm sm:text-base"
              disabled={loadingIA || loadingMesIA}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarDownloadPDFAtualizado}
              className={`w-full sm:w-auto px-4 sm:px-6 text-sm sm:text-base ${tipoOverview === 'por_mes' || usarIA ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"}`}
              disabled={loadingIA || loadingMesIA || (tipoOverview === 'por_mes' && (!selectedAno || !selectedMes))}
            >
              {loadingIA || loadingMesIA ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin flex-shrink-0" />
                  <span className="truncate">Analisando com Inteligência Artificial...</span>
                </>
              ) : (
                <>
                  {tipoOverview === 'por_mes' ? (
                    <>
                      <Calendar className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Gerar Overview</span>
                    </>
                  ) : usarIA ? (
                    <>
                      <TrendingUp className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Baixar Overview com IA</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                      <span className="truncate">Baixar Overview</span>
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Seleção de Status para PDF (Usuários não-Portes) */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 lg:gap-3 text-base lg:text-lg break-words">
              <Download className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 flex-shrink-0" />
              Configurar Overview PDF
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm lg:text-base break-words mt-1">
              Escolha o status das demandas para incluir no overview PDF da sua organização.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 -mr-1 sm:mr-0">
            <div className="space-y-4 lg:space-y-6">
              <div className="space-y-2 lg:space-y-3">
                <Label htmlFor="status-non-portes-pdf-select" className="text-xs sm:text-sm lg:text-base font-medium">Status das Demandas</Label>
                <Select value={selectedStatusForNonPortesPDF} onValueChange={setSelectedStatusForNonPortesPDF}>
                  <SelectTrigger className="h-9 sm:h-10 lg:h-12 text-xs sm:text-sm">
                    <SelectValue placeholder="Selecione um status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as demandas</SelectItem>
                    <SelectItem value="concluido">Concluídas</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="atrasado">Atrasadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="flex-shrink-0">
                    <Building className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm lg:text-base font-medium text-blue-800 break-words">
                      Overview da sua organização: {(currentUser?.nome_empresa || currentUser?.organizacao_nome || currentUser?.organizacao || 'Sistema').toUpperCase()}
                    </p>
                    <p className="text-xs sm:text-sm text-blue-600 mt-2 break-words">
                      Será gerado um PDF contendo as demandas da sua organização.
                      {selectedStatusForNonPortesPDF !== 'todos' && (
                        <span className="block mt-1">
                          <strong>Status filtrado:</strong> {selectedStatusForNonPortesPDF === 'concluido' ? 'Concluídas' : 
                                                          selectedStatusForNonPortesPDF === 'em_andamento' ? 'Em Andamento' :
                                                          selectedStatusForNonPortesPDF === 'pendente' ? 'Pendentes' :
                                                          selectedStatusForNonPortesPDF === 'atrasado' ? 'Atrasadas' : selectedStatusForNonPortesPDF}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Opção de IA */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 mt-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm lg:text-base font-medium text-purple-800 break-words">
                        Análise Inteligente com Inteligência Artificial
                      </p>
                      <p className="text-xs sm:text-sm text-purple-600 mt-1 break-words">
                        Ative para gerar um relatório com análise mensal inteligente do que foi feito e o que falta fazer, incluindo análise de checklists.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={usarIA}
                    onCheckedChange={setUsarIA}
                    className="flex-shrink-0 sm:ml-4 self-start sm:self-center"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-3 sm:pt-4 border-t flex-shrink-0 mt-auto">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsStatusModalOpen(false);
                setUsarIA(false);
              }}
              className="w-full sm:w-auto text-xs sm:text-sm"
              disabled={loadingIA}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarDownloadPDFNonPortes}
              className={`w-full sm:w-auto text-xs sm:text-sm ${usarIA ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"}`}
              disabled={loadingIA}
            >
              {loadingIA ? (
                <>
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2 animate-spin flex-shrink-0" />
                  <span className="hidden sm:inline">Analisando com Inteligência Artificial...</span>
                  <span className="sm:hidden">Analisando...</span>
                </>
              ) : (
                <>
                  {usarIA ? (
                    <>
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Baixar Overview com Inteligência Artificial</span>
                      <span className="sm:hidden">Baixar com IA</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">Baixar Overview</span>
                      <span className="sm:hidden">Baixar</span>
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Overview sendo gerado */}
      <Dialog open={isOverviewModalOpen} onOpenChange={setIsOverviewModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 lg:gap-3 text-base lg:text-lg break-words">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 flex-shrink-0" />
              Overview do Cronograma
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm lg:text-base break-words mt-1">
              {isGeneratingOverview ? 'A IA está gerando o resumo das demandas...' : 'Resumo gerado com sucesso!'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 sm:pr-2 -mr-1 sm:mr-0">
            {isGeneratingOverview && overviewStatus && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-800">{overviewStatus}</span>
                </div>
              </div>
            )}
            
            {overviewText ? (
              <div 
                ref={overviewTextRef}
                className="prose prose-sm max-w-none overflow-y-auto max-h-[60vh]"
                style={{ scrollBehavior: 'smooth' }}
              >
                <div 
                  key={`overview-${overviewText.length}`}
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ minHeight: '200px' }}
                  dangerouslySetInnerHTML={{ 
                    __html: overviewText
                      // Processar títulos de seção (##)
                      .replace(/## (.*?)(\n|$)/g, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
                      // Remover ### mas manter como título com espaçamento (caso ainda apareça de versões antigas)
                      .replace(/### (.*?)(\n|$)/g, '<div class="text-base font-semibold mt-4 mb-2 pt-2">$1</div>')
                      // Detectar títulos de demandas: linha que contém " - " (nome - responsável)
                      // e não começa com #, *, não contém "Status:" ou "Prioridade:"
                      .replace(/^([^#\n*✅🔄⚠️⏳][^\n]* - [^\n]+)(\n|$)/gm, (match, title) => {
                        const trimmed = title.trim();
                        // Verificar se não é linha de status/prioridade ou emoji
                        if (!trimmed.includes('Status:') && 
                            !trimmed.includes('Prioridade:') && 
                            !trimmed.includes('**') &&
                            trimmed.length > 5) {
                          return `<div class="text-base font-semibold mt-4 mb-2 pt-2">${trimmed}</div>`;
                        }
                        return match;
                      })
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/✅/g, '<span class="text-green-600">✅</span>')
                      .replace(/🔄/g, '<span class="text-blue-600">🔄</span>')
                      .replace(/⚠️/g, '<span class="text-yellow-600">⚠️</span>')
                      .replace(/⏳/g, '<span class="text-gray-600">⏳</span>')
                      // Manter múltiplas linhas vazias para espaçamento entre demandas
                      .replace(/\n\n+/g, '<br><br>')
                      .replace(/\n/g, '<br>')
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Aguardando início da geração...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-3 sm:pt-4 border-t flex-shrink-0 mt-auto">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsOverviewModalOpen(false);
                setOverviewText('');
                setOverviewStatus('');
                setOverviewMetadata(null);
              }}
              className="w-full sm:w-auto px-4 sm:px-6 text-sm sm:text-base"
            >
              Fechar
            </Button>
            {!isGeneratingOverview && overviewText && (
              <Button 
                onClick={baixarOverviewGerado}
                className="w-full sm:w-auto px-4 sm:px-6 text-sm sm:text-base bg-blue-600 hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </ErrorBoundary>
  );
};

export default Cronograma;