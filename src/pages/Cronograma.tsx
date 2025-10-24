import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import { 
  listChecklistItems, 
  toggleChecklistItem,
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
  User,
  GripVertical,
  CheckSquare,
  Download
} from 'lucide-react';

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
  const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false);
  const [selectedOrganizationForPDF, setSelectedOrganizationForPDF] = useState<string>('todos');
  const [selectedStatusForPDF, setSelectedStatusForPDF] = useState<string>('todos');
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
    responsavel_id: null as number | null
  });

  const [formData, setFormData] = useState(initialFormData());
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todos');
  const [filtroOrganizacao, setFiltroOrganizacao] = useState<string>('todos');
  const { toast } = useToast();

  // Carregar usuário atual
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

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
  const fetchCronogramas = async () => {
    setLoading(true);
    try {
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const res = await fetch(`${API_BASE}/cronograma?organizacao=${userOrg}`, {
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
      
      const { resumo, organizacoes, metadata } = data.data;
      
      console.log('📄 Dados recebidos da API:', {
        resumo,
        organizacoes: Object.keys(organizacoes),
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
      
      // Configurações do PDF
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      let yPosition = margin;
      
      // Função para adicionar texto com quebra de linha e suporte melhorado para Unicode
      const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
        // Limpar e normalizar texto para evitar caracteres problemáticos
        const cleanText = text
          .replace(/[^\x00-\x7F\u00C0-\u017F\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\u2190-\u21FF]/g, '') // Manter apenas caracteres latinos e símbolos comuns
          .replace(/\s+/g, ' ') // Normalizar espaços
          .trim();
        
        pdf.setFontSize(fontSize);
        if (isBold) {
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }
        
        // Usar splitTextToSize para quebra de linha automática
        const lines = pdf.splitTextToSize(cleanText, contentWidth);
        
        // Adicionar cada linha ao PDF
        lines.forEach((line: string) => {
          pdf.text(line, margin, yPosition);
          yPosition += fontSize * 0.4 + 2; // Espaçamento entre linhas
          
          // Verificar se precisa de nova página
          if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            yPosition = margin;
          }
        });
        
        yPosition += 3; // Espaço adicional após o texto
      };
      
      // Função para adicionar uma linha de tabela simples
      const addTableRow = (items: string[], fontSize: number = 10) => {
        const colWidth = contentWidth / items.length;
        
        items.forEach((item, index) => {
          const x = margin + (index * colWidth);
          const cleanItem = item
            .replace(/[^\x00-\x7F\u00C0-\u017F\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\u2190-\u21FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          pdf.setFontSize(fontSize);
          pdf.text(cleanItem, x, yPosition);
        });
        
        yPosition += fontSize * 0.4 + 5;
        
        // Verificar se precisa de nova página
        if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };
      
      // Cabeçalho
      addText('OVERVIEW DO CRONOGRAMA DE DEMANDAS', 22, true);
      addText(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 12);
      addText(`Organização: ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'Sistema'}`, 14, true);
      
      // Mostrar escopo do relatório
      if (orgParaFiltrar === 'todos') {
        addText('Escopo: Todas as organizações', 14, true);
      } else {
        addText(`Escopo: ${orgParaFiltrar.toUpperCase()}`, 14, true);
      }
      
      // Mostrar filtro de status se aplicável
      if (statusParaFiltrar !== 'todos') {
        const statusLabel = statusParaFiltrar === 'concluido' ? 'Concluídas' : 
                           statusParaFiltrar === 'em_andamento' ? 'Em Andamento' :
                           statusParaFiltrar === 'pendente' ? 'Pendentes' :
                           statusParaFiltrar === 'atrasado' ? 'Atrasadas' : statusParaFiltrar;
        addText(`Filtro de Status: ${statusLabel}`, 14, true);
      }
      
      addText('', 5); // Espaço
      
      // Estatísticas gerais
      if (statusParaFiltrar !== 'todos') {
        const statusLabel = statusParaFiltrar === 'concluido' ? 'Concluídas' : 
                           statusParaFiltrar === 'em_andamento' ? 'Em Andamento' :
                           statusParaFiltrar === 'pendente' ? 'Pendentes' :
                           statusParaFiltrar === 'atrasado' ? 'Atrasadas' : statusParaFiltrar;
        addText(`RESUMO - DEMANDAS ${statusLabel.toUpperCase()}`, 16, true);
      } else {
        addText('RESUMO GERAL', 16, true);
      }
      
      addTableRow([
        `Total: ${resumo.totalDemandas}`,
        `Concluídas: ${resumo.demandasConcluidas}`,
        `Em Andamento: ${resumo.demandasEmAndamento}`,
        `Pendentes: ${resumo.demandasPendentes}`,
        `Atrasadas: ${resumo.demandasAtrasadas}`
      ], 12);
      
      if (statusParaFiltrar !== 'todos') {
        addText(`Todas as ${resumo.totalDemandas} demandas são ${statusParaFiltrar === 'concluido' ? 'concluídas' : 
                                                               statusParaFiltrar === 'em_andamento' ? 'em andamento' :
                                                               statusParaFiltrar === 'pendente' ? 'pendentes' :
                                                               statusParaFiltrar === 'atrasado' ? 'atrasadas' : statusParaFiltrar}`, 12, true);
      } else {
        addText(`Percentual de Conclusão: ${resumo.percentualConclusao}%`, 14, true);
      }
      
      addText('', 5); // Espaço
      
      // Detalhes por organização
      Object.keys(organizacoes).forEach(organizacao => {
        const demandasOrg = organizacoes[organizacao];
        
        addText(`ORGANIZAÇÃO: ${organizacao.toUpperCase()}`, 16, true);
        
        const concluidasOrg = demandasOrg.filter(c => c.status === 'concluido').length;
        const emAndamentoOrg = demandasOrg.filter(c => c.status === 'em_andamento').length;
        const pendentesOrg = demandasOrg.filter(c => c.status === 'pendente').length;
        const atrasadasOrg = demandasOrg.filter(c => c.status === 'atrasado').length;
        
        addTableRow([
          `Total: ${demandasOrg.length}`,
          `Concluídas: ${concluidasOrg}`,
          `Em Andamento: ${emAndamentoOrg}`,
          `Pendentes: ${pendentesOrg}`,
          `Atrasadas: ${atrasadasOrg}`
        ], 10);
        
        // Listar demandas da organização (usando dados da API já limpos)
        demandasOrg.forEach((demanda, index) => {
          const statusEmoji = {
            'concluido': '✅',
            'em_andamento': '🔄',
            'pendente': '⏳',
            'atrasado': '❌'
          }[demanda.status] || '❓';
          
          // Usar o título já limpo pela API
          addText(`${statusEmoji} ${index + 1}. ${demanda.titulo}`, 14);
          if (demanda.descricao) {
            addText(`   Descrição: ${demanda.descricao}`, 12);
          }
          addText(`   Responsável: ${demanda.responsavel_nome || 'Não definido'}`, 12);
          addText(`   Prazo: ${demanda.data_fim ? new Date(demanda.data_fim).toLocaleDateString('pt-BR') : 'Não definido'}`, 12);
          
          // Incluir checklists (já formatados pela API)
          if (demanda.checklists && demanda.checklists.length > 0) {
            addText(`   Checklist (${demanda.checklists.length} itens):`, 12);
            demanda.checklists.forEach((item, itemIndex) => {
              const itemStatus = item.concluido ? '✓' : '○';
              // Usar títulos já limpos pela API
              addText(`     ${itemIndex + 1}. ${itemStatus} ${item.titulo}`, 11);
              if (item.descricao) {
                addText(`        ${item.descricao}`, 10);
              }
            });
          }
          
          addText('', 3); // Espaço pequeno
        });
        
        addText('', 5); // Espaço entre organizações
      });
      
      // Rodapé
      const totalPages = pdf.internal.pages.length - 1; // jsPDF usa array 0-indexed
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pdf.internal.pageSize.getHeight() - 10);
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

  // Função para lidar com o clique no botão de overview PDF
  const handleOverviewPDFClick = () => {
    if (currentUser?.organizacao === 'portes') {
      // Usuário Portes: abrir modal de seleção
      setIsOrganizationModalOpen(true);
    } else {
      // Outros usuários: baixar diretamente
      gerarOverviewPDF();
    }
  };

  // Função para confirmar e baixar PDF após seleção no modal
  const confirmarDownloadPDF = () => {
    setIsOrganizationModalOpen(false);
    gerarOverviewPDF(selectedOrganizationForPDF, selectedStatusForPDF);
  };

  // Função para carregar itens do checklist
  const loadChecklistItems = async (cronogramaId: number) => {
    try {
      setChecklistLoading(true);
      console.log('🔍 Carregando checklist para cronograma:', cronogramaId);
      const items = await listChecklistItems(cronogramaId);
      console.log('🔍 Itens carregados:', items);
      setChecklistItems(items);
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
    } catch (error) {
      console.error('Erro ao atualizar item do checklist:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar item do checklist",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchCronogramas();
      fetchEstatisticas();
      fetchUsuarios();
    }
  }, [currentUser]);

  // Expandir automaticamente meses com demandas quando os dados ou filtros mudarem
  useEffect(() => {
    if (cronogramas.length > 0) {
      expandirMesesComDemandas();
    }
  }, [cronogramas, filtroStatus, filtroPrioridade, filtroOrganizacao]);

  // Carregar checklist quando o modal de visualização abrir
  useEffect(() => {
    if (isViewDialogOpen && viewingCronograma) {
      loadChecklistItems(viewingCronograma.id);
    }
  }, [isViewDialogOpen, viewingCronograma]);

  // Função para converter data para formato YYYY-MM-DD
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
        date = new Date(dateString);
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const formatted = date.toISOString().split('T')[0];
      return formatted;
    } catch (error) {
      return '';
    }
  };

  // Atualizar formData quando editingCronograma muda
  useEffect(() => {
    if (editingCronograma) {
      
      setFormData({
        titulo: editingCronograma.titulo,
        descricao: editingCronograma.descricao || '',
        organizacao: editingCronograma.organizacao,
        fase_atual: editingCronograma.fase_atual,
        data_inicio: formatDateForInput(editingCronograma.data_inicio || ''),
        data_fim: formatDateForInput(editingCronograma.data_fim || ''),
        status: editingCronograma.status,
        prioridade: editingCronograma.prioridade,
        observacoes: editingCronograma.observacoes || '',
        motivo_atraso: editingCronograma.motivo_atraso || '',
        responsavel_id: editingCronograma.responsavel_id || null
      });
    } else {
      setFormData({
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
        responsavel_id: null
      });
    }
  }, [editingCronograma, currentUser]);

  // Limpar motivo_atraso quando status não for "atrasado"
  useEffect(() => {
    if (formData.status !== 'atrasado' && formData.motivo_atraso) {
      setFormData(prev => ({ ...prev, motivo_atraso: '' }));
    }
  }, [formData.status]);

  // Obter organizações únicas para filtro (apenas para Portes)
  const organizacoesUnicas = [...new Set(cronogramas.map(c => c.organizacao))];

  // Filtrar cronogramas ("Todos" deve incluir concluídos)
  const cronogramasFiltrados = cronogramas.filter(cronograma => {
    const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
    const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
    const organizacaoMatch = filtroOrganizacao === 'todos' || cronograma.organizacao === filtroOrganizacao;
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
          'x-user-organization': userOrg
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
  
  // Somente usuários da PORTES podem reordenar na timeline
  const podeReordenar = (currentUser?.organizacao || '').toLowerCase() === 'portes';

  // Sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Função para aplicar ordem personalizada aos cronogramas
  const aplicarOrdemPersonalizada = (cronogramas: CronogramaItem[], organizacao: string) => {
    const ordemCustomizada = ordemDemandas[organizacao];
    if (!ordemCustomizada || ordemCustomizada.length === 0) {
      return cronogramas;
    }

    // Criar um mapa para ordenação eficiente
    const ordemMap = new Map(ordemCustomizada.map((id, index) => [id, index]));
    
    return [...cronogramas].sort((a, b) => {
      const ordemA = ordemMap.get(a.id) ?? 999;
      const ordemB = ordemMap.get(b.id) ?? 999;
      return ordemA - ordemB;
    });
  };

  // Função para lidar com o fim do drag & drop
  const handleDragEnd = (event: DragEndEvent) => {
    if (!podeReordenar) return; // Sem permissão para reordenar
    const { active, over } = event;

    if (active.id !== over?.id) {
      // Encontrar a organização do item sendo arrastado
      const activeItem = cronogramas.find(c => c.id === active.id);
      if (!activeItem) return;

      const organizacao = activeItem.organizacao || 'outros';
      
      // Obter a ordem atual para esta organização
      const currentOrder = ordemDemandas[organizacao] || cronogramas
        .filter(c => c.organizacao === organizacao)
        .map(c => c.id);

      // Encontrar os índices
      const oldIndex = currentOrder.indexOf(active.id as number);
      const newIndex = currentOrder.indexOf(over?.id as number);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Reordenar usando arrayMove
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        
        // Atualizar o estado
        setOrdemDemandas(prev => ({
          ...prev,
          [organizacao]: newOrder
        }));

        // Salvar no localStorage para persistir a ordem
        const savedOrder = { ...ordemDemandas, [organizacao]: newOrder };
        localStorage.setItem('cronograma-order', JSON.stringify(savedOrder));
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
    inicioPeriodo,
    fimPeriodo
  }: {
    cronograma: CronogramaItem;
    organizacao: string;
    dataInicio: Date | null;
    dataFim: Date | null;
    posicao: { inicio: string; largura: string; colunaInicio: number; colunaFim: number };
    coresStatus: Record<string, string>;
    inicioPeriodo: Date;
    fimPeriodo: Date;
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
        className={`flex items-center h-16 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden ${isDragging ? 'z-50' : ''}`}
      >
        <div className="w-80 px-4 py-3 text-sm text-gray-700 border-r overflow-hidden">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-nowrap min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Handle de arrastar */}
                {podeReordenar && (
                  <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab hover:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
                    title="Arrastar para reordenar"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <span 
                  className="truncate cursor-pointer hover:text-blue-600 transition-colors flex-1 block max-w-full"
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
                className="text-xs whitespace-nowrap flex-shrink-0 ml-2"
              >
                {getStatusBadgeInfo(cronograma.status).text}
              </Badge>
            </div>
            {cronograma.responsavel_nome && (
              <div className="text-xs text-gray-500 truncate">
                {cronograma.responsavel_nome}
              </div>
            )}
          </div>
        </div>
        
        {/* Timeline bar interativa */}
        <div className="relative flex-1 h-full">
          {dataInicio && dataFim && (
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 h-8 rounded-lg ${coresStatus[cronograma.status]} shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-white hover:scale-105 overflow-hidden`}
              style={{
                left: posicao.inicio,
                width: posicao.largura,
                minWidth: '60px'
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
              <span className="text-white text-xs font-medium px-2 whitespace-nowrap overflow-hidden text-ellipsis block">
                {cronograma.titulo}
              </span>
            </div>
          )}
          
          {/* Linha do tempo atual */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{
              left: `${((new Date().getTime() - inicioPeriodo.getTime()) / (fimPeriodo.getTime() - inicioPeriodo.getTime())) * 100}%`
            }}
            title={`Hoje: ${new Date().toLocaleDateString('pt-BR')}`}
          />
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
    inicioPeriodo,
    fimPeriodo
  }: {
    cronograma: CronogramaItem;
    dataInicio: Date | null;
    dataFim: Date | null;
    posicao: { inicio: string; largura: string; colunaInicio: number; colunaFim: number };
    coresStatus: Record<string, string>;
    inicioPeriodo: Date;
    fimPeriodo: Date;
  }) => {
    return (
      <div className={`flex items-center h-16 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden`}>
        <div className="w-80 px-4 py-3 text-sm text-gray-700 border-r">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span 
                className="truncate cursor-pointer hover:text-blue-600 transition-colors flex-1"
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
                className="text-xs whitespace-nowrap"
              >
                {getStatusBadgeInfo(cronograma.status).text}
              </Badge>
            </div>
            {cronograma.responsavel_nome && (
              <div className="text-xs text-gray-500 truncate">
                {cronograma.responsavel_nome}
              </div>
            )}
          </div>
        </div>
        <div className="relative flex-1 h-full">
          {dataInicio && dataFim && (
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 h-8 rounded-lg ${coresStatus[cronograma.status]} shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-white hover:scale-105 overflow-hidden`}
              style={{ left: posicao.inicio, width: posicao.largura, minWidth: '60px' }}
              onClick={() => {
                setViewingCronograma(cronograma);
                setIsViewDialogOpen(true);
              }}
              title={`${cronograma.titulo}\nStatus: ${getStatusBadgeInfo(cronograma.status).text}\nPeríodo: ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}`}
            >
              <span className="text-white text-xs font-medium px-2 whitespace-nowrap overflow-hidden text-ellipsis block">
                {cronograma.titulo}
              </span>
            </div>
          )}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{
              left: `${((new Date().getTime() - inicioPeriodo.getTime()) / (fimPeriodo.getTime() - inicioPeriodo.getTime())) * 100}%`
            }}
            title={`Hoje: ${new Date().toLocaleDateString('pt-BR')}`}
          />
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
      
      console.log(`Comparando: ${a} (${mesA}/${anoA}) vs ${b} (${mesB}/${anoB})`);
      
      // Primeiro compara o ano
      if (anoA !== anoB) {
        console.log(`Anos diferentes: ${anoA} vs ${anoB}, retornando ${anoA - anoB}`);
        return anoA - anoB;
      }
      
      // Se o ano for igual, compara o mês
      const numMesA = meses[mesA as keyof typeof meses] || 0;
      const numMesB = meses[mesB as keyof typeof meses] || 0;
      console.log(`Anos iguais: ${anoA}, comparando meses: ${mesA}(${numMesA}) vs ${mesB}(${numMesB}), retornando ${numMesA - numMesB}`);
      
      return numMesA - numMesB;
    });
    
    // Debug: log da ordenação
    console.log('Grupos ordenados:', gruposOrdenados.map(([mes]) => mes));
    console.log('Timestamp:', new Date().toISOString());
    
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
                  className="bg-gray-50 px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGrupo(mesAno)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isExpanded ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {mesAno}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {cronogramasDoMes.length} atividade{cronogramasDoMes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg 
                        className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
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
                          className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setViewingCronograma(cronograma);
                            setIsViewDialogOpen(true);
                          }}
                          title="Clique para visualizar detalhes"
                        >
                          <div className="flex items-start gap-4">
                            {/* Indicador visual */}
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-3 h-3 rounded-full ${statusColor.icon}`}></div>
                            </div>

                            {/* Conteúdo da atividade */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 min-w-0">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 flex-shrink-0">
                                      <Building className="h-3 w-3 mr-1" />
                                      {(cronograma.organizacao || '').replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                    <h4 
                                      className="text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors truncate"
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
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                                      {cronograma.status === 'concluido' && (
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {cronograma.status === 'em_andamento' && (
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {cronograma.status === 'atrasado' && (
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {cronograma.status === 'pendente' && (
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {statusColor.label}
                                    </span>
                                    
                                    {(cronograma.status === 'em_andamento' || cronograma.status === 'pendente') && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Aguardando ação
                                      </span>
                                    )}
                                  </div>

                                  {/* Datas */}
                                  <div className="text-sm text-gray-600">
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
      const org = cronograma.organizacao || 'outros';
      if (!acc[org]) acc[org] = [];
      acc[org].push(cronograma);
      return acc;
    }, {} as Record<string, CronogramaItem[]>);

    // Aplicar ordem personalizada para cada organização
    const cronogramasOrdenadosPorOrganizacao = Object.entries(cronogramasPorOrganizacao).reduce((acc, [org, cronogramas]) => {
      acc[org] = aplicarOrdemPersonalizada(cronogramas, org);
      return acc;
    }, {} as Record<string, CronogramaItem[]>);

    // Calcular período de visualização (fixo em meses)
    const hoje = new Date();
    
    // Visualização por meses (período fixo)
    const mesesVisiveis = 8; // 8 meses
    const inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - Math.floor(mesesVisiveis / 2), 1);
    const fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + Math.floor(mesesVisiveis / 2), 0);
    
    // Gerar meses do período
    const timeUnits: Date[] = [];
    const currentDate = new Date(inicioPeriodo);
    while (currentDate <= fimPeriodo) {
      timeUnits.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Timeline de Demandas
                </CardTitle>
                <CardDescription>
                  {filtroStatus === 'apenas_concluidas' 
                    ? `Visualização temporal das tarefas concluídas (${cronogramasConcluidos.length} tarefas)`
                    : `Visualização temporal das demandas por organização${podeReordenar ? ' - Arraste para reordenar' : ''}`
                  }
                </CardDescription>
              </div>
              
            </div>
          </CardHeader>
          <CardContent>
        {/* Timeline Header */}
        <div className="w-full">
          <div className="w-full">
                {/* Header dos meses */}
                <div className="flex border-b-2 border-gray-200">
                  <div className="w-80 px-4 py-4 font-semibold text-gray-700 bg-gray-100 border-r">
                    Organização / Demanda
                  </div>
                  {timeUnits.map((timeUnit, index) => (
                    <div key={index} className="px-2 py-4 text-center font-semibold text-gray-700 bg-gray-50 border-r flex-1">
                      {timeUnit.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
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
                    <div className="flex items-center h-16 bg-gray-100">
                      <div className="w-80 px-4 py-4 font-semibold text-gray-900 border-r">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${coresOrganizacao[organizacao] || 'bg-gray-400'}`}></div>
                          <span className="truncate">{organizacao.toUpperCase()}</span>
                        </div>
                      </div>
                      {timeUnits.map((_, index) => (
                        <div key={index} className="border-r flex-1"></div>
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
                            inicioPeriodo={inicioPeriodo}
                            fimPeriodo={fimPeriodo}
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
                      <div className="flex items-center h-16 bg-gray-100">
                        <div className="w-80 px-4 py-4 font-semibold text-gray-900 border-r">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${coresOrganizacao[organizacao] || 'bg-gray-400'}`}></div>
                            <span className="truncate">{organizacao.toUpperCase()}</span>
                          </div>
                        </div>
                        {timeUnits.map((_, index) => (
                          <div key={index} className="border-r flex-1"></div>
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
                            inicioPeriodo={inicioPeriodo}
                            fimPeriodo={fimPeriodo}
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

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cronograma de Demandas</h1>
          <p className="text-gray-600">
            {currentUser?.organizacao === 'portes' 
              ? 'Gerencie todas as demandas de todas as organizações' 
              : `Demandas da ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'sua organização'}`
            }
          </p>
          {currentUser?.organizacao === 'portes' ? (
            <p className="text-sm text-green-600 mt-1">
              Acesso completo a todos os cronogramas do sistema.
            </p>
          ) : (
            <p className="text-sm text-blue-600 mt-1">
              Visualizando as demandas.
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {/* Botões de alternância de visualização */}
          <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className={`flex items-center ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 text-gray-800'} rounded-md px-3`}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 text-gray-800'} rounded-md px-3 relative`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Timeline
            </Button>
          </div>
          
          {/* Controles adicionais */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCronogramas} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
            <Button variant="outline" onClick={handleOverviewPDFClick} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              {filtroOrganizacao === 'todos' ? 'Baixar Overview' : `Overview PDF (${filtroOrganizacao})`}
            </Button>
            <Button onClick={() => {
              setEditingCronograma(null);
              // Garantir formulário limpo ao abrir nova demanda
              setFormData(initialFormData());
              setIsEditDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Demanda
            </Button>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estatisticas.total_cronogramas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{estatisticas.em_andamento}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estatisticas.concluidos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estatisticas.atrasados}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="status-filter">Status</Label>
              <Select key={`status-${viewMode}-${filtroStatus}`} value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
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
            <div className="flex-1">
              <Label htmlFor="prioridade-filter">Prioridade</Label>
              <Select key={`prioridade-${viewMode}-${filtroPrioridade}`} value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger>
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
              <div className="flex-1">
                <Label htmlFor="organizacao-filter">Organização</Label>
                <Select key={`org-${viewMode}-${filtroOrganizacao}`} value={filtroOrganizacao} onValueChange={setFiltroOrganizacao}>
                  <SelectTrigger>
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
            <div className="mt-4 flex items-center gap-4">
              <div className="text-sm text-gray-600">
                ({cronogramasConcluidos.length} tarefa{cronogramasConcluidos.length !== 1 ? 's' : ''} concluída{cronogramasConcluidos.length !== 1 ? 's' : ''})
              </div>
            </div>
          )}
        </CardContent>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCronograma ? 'Editar Demanda' : 'Nova Demanda'}
            </DialogTitle>
            <DialogDescription>
              {editingCronograma ? 'Modifique os dados da demanda abaixo.' : 'Preencha os dados para criar uma nova demanda.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                  placeholder="Digite o título da demanda"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Descreva a demanda em detalhes"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="organizacao">Organização</Label>
                <Select
                  value={formData.organizacao}
                  onValueChange={(value) => setFormData({...formData, organizacao: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Sempre mostrar a organização do usuário */}
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
                    
                    {/* Sempre mostrar PORTES como opção adicional */}
                    {currentUser?.organizacao !== 'portes' && (
                      <SelectItem value="portes">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          PORTES
                        </div>
                      </SelectItem>
                    )}
                    
                    {/* Mostrar outras organizações se for Portes */}
                    {currentUser?.organizacao === 'portes' && (
                      <>
                        <SelectItem value="cassems">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            CASSEMS
                          </div>
                        </SelectItem>
                        <SelectItem 
                          value="Marajó / Rede Frota" 
                          className="marajo-item"
                          style={{
                            ['--marajo-hide-indicator' as any]: 'none'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            MARAJÓ / REDE FROTA
                          </div>
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {currentUser?.organizacao !== 'portes' 
                    ? 'Você pode criar demandas para sua organização ou para a Portes'
                    : 'Selecione a organização para a demanda'
                  }
                </p>
              </div>

              <div>
                <Label htmlFor="fase_atual">Fase Atual</Label>
                <Select
                  value={formData.fase_atual}
                  onValueChange={(value) => setFormData({...formData, fase_atual: value})}
                >
                  <SelectTrigger>
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
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
                >
                  <SelectTrigger>
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
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(value) => setFormData({...formData, prioridade: value})}
                >
                  <SelectTrigger>
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
                <Label htmlFor="data_inicio">Data de Início</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="data_fim">Data de Fim</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="responsavel_id">Responsável</Label>
                <Select
                  value={formData.responsavel_id?.toString() || 'none'}
                  onValueChange={(value) => setFormData({...formData, responsavel_id: value === 'none' ? null : parseInt(value)})}
                >
                  <SelectTrigger>
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

              <div className="md:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                  placeholder="Observações gerais sobre a demanda"
                  rows={3}
                />
              </div>

              {formData.status === 'atrasado' && (
                <div className="md:col-span-2">
                  <Label htmlFor="motivo_atraso">Motivo do Atraso *</Label>
                  <Textarea
                    id="motivo_atraso"
                    value={formData.motivo_atraso}
                    onChange={(e) => setFormData({...formData, motivo_atraso: e.target.value})}
                    placeholder="Explique o motivo do atraso (obrigatório quando status é 'atrasado')"
                    rows={2}
                    className="border-red-200 focus:border-red-500"
                  />
                  <p className="text-xs text-red-600 mt-1">
                    Este campo é obrigatório quando o status é "Atrasado"
                  </p>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingCronograma(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={salvarCronograma} 
                disabled={
                  !formData.titulo.trim() || 
                  (formData.status === 'atrasado' && !formData.motivo_atraso.trim())
                }
              >
                {editingCronograma ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="relative">
            {viewingCronograma && currentUser?.organizacao === 'portes' && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute right-16 top-2 bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setIsViewDialogOpen(false);
                  setCronogramaToDelete(viewingCronograma);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            )}
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              {viewingCronograma?.titulo}
            </DialogTitle>
            <DialogDescription>
              Detalhes da demanda selecionada
            </DialogDescription>
          </DialogHeader>
          
          {viewingCronograma && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-6">
              {/* Status e Prioridade */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <Badge 
                    variant={getStatusBadgeInfo(viewingCronograma.status).variant as any}
                    className="text-xs"
                  >
                    {getStatusBadgeInfo(viewingCronograma.status).text}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Prioridade:</span>
                  <Badge 
                    variant={getPriorityBadgeInfo(viewingCronograma.prioridade).variant as any}
                    className="text-xs"
                  >
                    {getPriorityBadgeInfo(viewingCronograma.prioridade).text}
                  </Badge>
                </div>
              </div>

              {/* Descrição */}
              {viewingCronograma.descricao && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Descrição</h3>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm leading-relaxed">
                    {viewingCronograma.descricao}
                  </p>
                </div>
              )}

              {/* Informações do Período */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Data de Início</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {viewingCronograma.data_inicio 
                        ? new Date(viewingCronograma.data_inicio).toLocaleDateString('pt-BR')
                        : 'Não definida'
                      }
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Data de Fim</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {viewingCronograma.data_fim 
                        ? new Date(viewingCronograma.data_fim).toLocaleDateString('pt-BR')
                        : 'Não definida'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Responsável */}
              {viewingCronograma.responsavel_nome && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Responsável</h3>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{viewingCronograma.responsavel_nome}</span>
                  </div>
                </div>
              )}

              {/* Organização */}
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Organização</h3>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700 capitalize">
                    {viewingCronograma.organizacao?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Motivo do Atraso */}
              {viewingCronograma.motivo_atraso && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Motivo do Atraso</h3>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-700">Atraso Identificado</span>
                    </div>
                    <p className="text-red-700 text-sm leading-relaxed">
                      {viewingCronograma.motivo_atraso}
                    </p>
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <h3 className="text-sm font-medium text-gray-600 mb-3">Checklist da Demanda</h3>
                <ScrollArea className="h-64 pr-4">
                  {checklistLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : checklistItems.length > 0 ? (
                    <div className="space-y-2">
                      {checklistItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <button
                            onClick={() => toggleChecklistItemStatus(item.id, !item.concluido)}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              item.concluido
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {item.concluido && <CheckCircle className="h-3 w-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${item.concluido ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                              {item.titulo}
                            </p>
                            {item.descricao && (
                              <p className={`text-xs ${item.concluido ? 'text-gray-400' : 'text-gray-500'}`}>
                                {item.descricao}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <CheckSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhum item no checklist</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Clique no botão "Checklist" abaixo para adicionar itens
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Observações */}
              {viewingCronograma.observacoes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Observações</h3>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm leading-relaxed">
                    {viewingCronograma.observacoes}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center pt-4 border-t flex-shrink-0">
                {currentUser?.organizacao === 'portes' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (viewingCronograma) {
                        setIsViewDialogOpen(false);
                        setIsChecklistOpen(true);
                      }
                    }}
                    className="mr-auto bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checklist
                  </Button>
                )}
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewingCronograma(null);
                      setIsViewDialogOpen(false);
                    }}
                  >
                    Fechar
                  </Button>
              {/* Excluir movido para topo do modal; somente Portes pode editar */}
              {currentUser?.organizacao === 'portes' && (
                <Button
                  onClick={() => {
                    setViewingCronograma(null);
                    setIsViewDialogOpen(false);
                    setEditingCronograma(viewingCronograma);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
                </div>
              </div>
            </div>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <Download className="h-6 w-6" />
              Configurar Overview PDF
            </DialogTitle>
            <DialogDescription className="text-base">
              Escolha a organização e o status das demandas para incluir no overview PDF.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="org-pdf-select" className="text-base font-medium">Organização</Label>
              <Select value={selectedOrganizationForPDF} onValueChange={setSelectedOrganizationForPDF}>
                <SelectTrigger className="h-12">
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
            
            <div className="space-y-3">
              <Label htmlFor="status-pdf-select" className="text-base font-medium">Status das Demandas</Label>
              <Select value={selectedStatusForPDF} onValueChange={setSelectedStatusForPDF}>
                <SelectTrigger className="h-12">
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
            
            {selectedOrganizationForPDF !== 'todos' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Building className="h-5 w-5 text-blue-600 mt-0.5" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-blue-800">
                      Overview específico para: {selectedOrganizationForPDF.toUpperCase()}
                    </p>
                    <p className="text-sm text-blue-600 mt-2">
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Building className="h-5 w-5 text-green-600 mt-0.5" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-green-800">
                      Overview completo de todas as organizações
                    </p>
                    <p className="text-sm text-green-600 mt-2">
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
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsOrganizationModalOpen(false)}
              className="px-6"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarDownloadPDF}
              className="bg-blue-600 hover:bg-blue-700 px-6"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Overview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </ErrorBoundary>
  );
};

export default Cronograma;