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
  Download,
  ChevronDown
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
  const [isDelayExpanded, setIsDelayExpanded] = useState(false);
  const [isOrganizationModalOpen, setIsOrganizationModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedOrganizationForPDF, setSelectedOrganizationForPDF] = useState<string>('todos');
  const [selectedStatusForPDF, setSelectedStatusForPDF] = useState<string>('todos');
  const [selectedStatusForNonPortesPDF, setSelectedStatusForNonPortesPDF] = useState<string>('todos');
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
          yPosition += fontSize * 0.5 + 3; // Aumentar espaçamento entre linhas
          
          // Verificar se precisa de nova página
          if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            yPosition = margin;
          }
        });
        
        yPosition += 5; // Aumentar espaço adicional após o texto
      };
      
      // Função para adicionar uma linha de tabela simples com larguras dinâmicas
      const addTableRow = (items: string[], fontSize: number = 10) => {
        pdf.setFontSize(fontSize);
        
        // Calcular larguras dinâmicas baseadas no conteúdo
        const textWidths = items.map(item => {
          const cleanItem = item
            .replace(/[^\x00-\x7F\u00C0-\u017F\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\u2190-\u21FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return pdf.getTextWidth(cleanItem);
        });
        
        // Calcular larguras proporcionais
        const totalTextWidth = textWidths.reduce((sum, width) => sum + width, 0);
        const availableWidth = contentWidth - (items.length - 1) * 10; // 10mm de espaçamento entre colunas
        
        const colWidths = textWidths.map(width => (width / totalTextWidth) * availableWidth);
        
        // Adicionar cada item com sua largura calculada
        let currentX = margin;
        items.forEach((item, index) => {
          const cleanItem = item
            .replace(/[^\x00-\x7F\u00C0-\u017F\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\u2190-\u21FF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Verificar se o texto cabe na coluna, se não, truncar
          const maxWidth = colWidths[index];
          const textWidth = pdf.getTextWidth(cleanItem);
          
          let displayText = cleanItem;
          if (textWidth > maxWidth) {
            // Truncar texto para caber na coluna
            let truncatedText = cleanItem;
            while (pdf.getTextWidth(truncatedText + '...') > maxWidth && truncatedText.length > 0) {
              truncatedText = truncatedText.slice(0, -1);
            }
            displayText = truncatedText + '...';
          }
          
          pdf.text(displayText, currentX, yPosition);
          currentX += colWidths[index] + 10; // 10mm de espaçamento entre colunas
        });
        
        yPosition += fontSize * 0.6 + 8; // Aumentar espaçamento vertical
        
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
      ], 14); // Aumentar tamanho da fonte
      
      addText('', 5); // Espaço adicional após estatísticas
      
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
        ], 12); // Aumentar tamanho da fonte
        
        addText('', 3); // Espaço adicional após estatísticas
        
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
      // Usuário Portes: abrir modal de seleção de organização e status
      setIsOrganizationModalOpen(true);
    } else {
      // Usuários não-Portes: abrir modal apenas para seleção de status
      setIsStatusModalOpen(true);
    }
  };

  // Função para confirmar e baixar PDF após seleção no modal
  const confirmarDownloadPDF = () => {
    setIsOrganizationModalOpen(false);
    gerarOverviewPDF(selectedOrganizationForPDF, selectedStatusForPDF);
  };

  // Função para confirmar e baixar PDF para usuários não-Portes (apenas status)
  const confirmarDownloadPDFNonPortes = () => {
    setIsStatusModalOpen(false);
    gerarOverviewPDF(undefined, selectedStatusForNonPortesPDF);
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
  
  // Função para normalizar organização (igual ao backend)
  const normalizeOrganization = (org: string) => {
    if (!org) return '';
    const s = String(org).toLowerCase().trim();
    if (s.includes('maraj') || s.includes('rede frota') || s.includes('rede_frota')) return 'rede_frota';
    if (s.includes('cassems')) return 'cassems';
    if (s.includes('porte')) return 'portes';
    // fallback: trocar espaços por underscore
    return s.replace(/\s+/g, '_');
  };

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
        <div 
          className="px-4 py-3 text-sm text-gray-700 border-r overflow-hidden"
          style={{ width: `${colunaLargura}px` }}
        >
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
        <div 
          className="px-4 py-3 text-sm text-gray-700 border-r"
          style={{ width: `${colunaLargura}px` }}
        >
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
                                  </div>

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
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                  <BarChart3 className="h-5 w-5" />
                  Timeline de Demandas
                </CardTitle>
                <CardDescription className="text-sm lg:text-base mt-1">
                  {filtroStatus === 'apenas_concluidas' 
                    ? `Visualização temporal das tarefas concluídas (${cronogramasConcluidos.length} tarefas)`
                    : `Visualização temporal das demandas por organização${podeReordenar ? ' - Arraste para reordenar' : ''}`
                  }
                </CardDescription>
              </div>
              
              {/* Controles da timeline */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">
                  {Object.keys(cronogramasOrdenadosPorOrganizacao).length} organizações
                </div>
                <div className="text-xs text-gray-500">
                  {cronogramasParaTimeline.length} demandas
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetColumnWidth}
                  className="text-xs h-6 px-2"
                  title="Resetar largura da coluna para o padrão"
                >
                  Resetar Coluna
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
        {/* Timeline Header */}
        <div className="w-full timeline-container">
          <div className="w-full">
                {/* Header dos meses */}
                <div className="flex border-b-2 border-gray-200 overflow-x-auto">
                  <div 
                    className="px-3 lg:px-4 py-3 lg:py-4 font-semibold text-gray-700 bg-gray-100 border-r flex-shrink-0 relative"
                    style={{ width: `${colunaLargura}px` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm lg:text-base">Organização / Demanda</span>
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
                    <div key={index} className="px-1 lg:px-2 py-3 lg:py-4 text-center font-semibold text-gray-700 bg-gray-50 border-r flex-1 min-w-[60px] lg:min-w-[80px]">
                      <span className="text-xs lg:text-sm">
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
                    <div className="flex items-center h-12 lg:h-16 bg-gray-100 hover:bg-gray-50 transition-colors">
                      <div 
                        className="px-3 lg:px-4 py-3 lg:py-4 font-semibold text-gray-900 border-r flex-shrink-0"
                        style={{ width: `${colunaLargura}px` }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 lg:w-3 lg:h-3 rounded-full ${coresOrganizacao[organizacao] || 'bg-gray-400'}`}></div>
                          <span className="truncate text-sm lg:text-base font-medium">
                            {organizacao.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {timeUnits.map((_, index) => (
                        <div key={index} className="border-r flex-1 min-w-[60px] lg:min-w-[80px]"></div>
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
                      <div className="flex items-center h-12 lg:h-16 bg-gray-100 hover:bg-gray-50 transition-colors">
                        <div 
                          className="px-3 lg:px-4 py-3 lg:py-4 font-semibold text-gray-900 border-r flex-shrink-0"
                          style={{ width: `${colunaLargura}px` }}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 lg:w-3 lg:h-3 rounded-full ${coresOrganizacao[organizacao] || 'bg-gray-400'}`}></div>
                            <span className="truncate text-sm lg:text-base font-medium">
                              {organizacao.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        {timeUnits.map((_, index) => (
                          <div key={index} className="border-r flex-1 min-w-[60px] lg:min-w-[80px]"></div>
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
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold">Cronograma de Demandas</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            {currentUser?.organizacao === 'portes' 
              ? 'Gerencie todas as demandas de todas as organizações' 
              : `Demandas da ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'sua organização'}`
            }
          </p>
          {currentUser?.organizacao === 'portes' ? (
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
              onClick={handleOverviewPDFClick} 
              disabled={loading} 
              className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <Download className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline">
                {filtroOrganizacao === 'todos' ? 'Baixar Overview' : `Baixar Overview`}
              </span>
              <span className="sm:hidden">PDF</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="status-filter" className="text-sm font-medium">Status</Label>
              <Select key={`status-${viewMode}-${filtroStatus}`} value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="mt-1">
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
            <div>
              <Label htmlFor="prioridade-filter" className="text-sm font-medium">Prioridade</Label>
              <Select key={`prioridade-${viewMode}-${filtroPrioridade}`} value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger className="mt-1">
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
              <div>
                <Label htmlFor="organizacao-filter" className="text-sm font-medium">Organização</Label>
                <Select key={`org-${viewMode}-${filtroOrganizacao}`} value={filtroOrganizacao} onValueChange={setFiltroOrganizacao}>
                  <SelectTrigger className="mt-1">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-lg lg:text-xl">
              {editingCronograma ? 'Editar Demanda' : 'Nova Demanda'}
            </DialogTitle>
            <DialogDescription className="text-sm lg:text-base">
              {editingCronograma ? 'Modifique os dados da demanda abaixo.' : 'Preencha os dados para criar uma nova demanda.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 lg:space-y-6">
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2">
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

              {/* Informações do Período e Responsável */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Data de Início</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {formatDateForDisplay(viewingCronograma.data_inicio)}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Data de Fim</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {formatDateForDisplay(viewingCronograma.data_fim)}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Responsável</h3>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">
                      {viewingCronograma.responsavel_nome || 'Não definido'}
                    </span>
                  </div>
                </div>
              </div>


              {/* Motivo do Atraso */}
              {viewingCronograma.motivo_atraso && (
                <div>
                  <button
                    onClick={() => setIsDelayExpanded(!isDelayExpanded)}
                    className="flex items-center justify-between w-full text-left mb-2 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  >
                    <h3 className="text-g font-medium text-red-600">Motivo do Atraso</h3>
                    <ChevronDown 
                      className={`h-5 w-5 text-red-500 transition-transform ${
                        isDelayExpanded ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>
                  
                  {isDelayExpanded && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">Atraso Identificado</span>
                      </div>
                      <p className="text-red-700 text-sm leading-relaxed">
                        {viewingCronograma.motivo_atraso}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Barra de Progresso */}
                {checklistItems.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">
                        Progresso: {checklistItems.filter(item => item.concluido).length}/{checklistItems.length} itens concluídos
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        {Math.round((checklistItems.filter(item => item.concluido).length / checklistItems.length) * 100)}%
                      </span>
                    </div>
                    <Progress 
                      value={(checklistItems.filter(item => item.concluido).length / checklistItems.length) * 100} 
                      className="h-2 [&>div]:bg-green-500"
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-600">Checklist da Demanda</h3>
                  {(viewingCronograma?.data_inicio || viewingCronograma?.data_fim) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>
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
                            {(item.data_inicio || item.data_fim) && (
                              <div className={`flex items-center gap-3 mt-2 text-xs ${item.concluido ? 'text-gray-400' : 'text-gray-500'}`}>
                                <Clock className="h-3 w-3" />
                                {item.data_inicio && (
                                  <span>Início: {formatDateForDisplay(item.data_inicio)}</span>
                                )}
                                {item.data_fim && (
                                  <span>Fim: {formatDateForDisplay(item.data_fim)}</span>
                                )}
                              </div>
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
        <DialogContent className="sm:max-w-lg mx-4 sm:mx-0">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 lg:gap-3 text-base lg:text-lg">
              <Download className="h-5 w-5 lg:h-6 lg:w-6" />
              Configurar Overview PDF
            </DialogTitle>
            <DialogDescription className="text-sm lg:text-base">
              Escolha a organização e o status das demandas para incluir no overview PDF.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 lg:space-y-6">
            <div className="space-y-2 lg:space-y-3">
              <Label htmlFor="org-pdf-select" className="text-sm lg:text-base font-medium">Organização</Label>
              <Select value={selectedOrganizationForPDF} onValueChange={setSelectedOrganizationForPDF}>
                <SelectTrigger className="h-10 lg:h-12">
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

      {/* Modal de Seleção de Status para PDF (Usuários não-Portes) */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="sm:max-w-lg mx-4 sm:mx-0">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 lg:gap-3 text-base lg:text-lg">
              <Download className="h-5 w-5 lg:h-6 lg:w-6" />
              Configurar Overview PDF
            </DialogTitle>
            <DialogDescription className="text-sm lg:text-base">
              Escolha o status das demandas para incluir no overview PDF da sua organização.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 lg:space-y-6">
            <div className="space-y-2 lg:space-y-3">
              <Label htmlFor="status-non-portes-pdf-select" className="text-sm lg:text-base font-medium">Status das Demandas</Label>
              <Select value={selectedStatusForNonPortesPDF} onValueChange={setSelectedStatusForNonPortesPDF}>
                <SelectTrigger className="h-10 lg:h-12">
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
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Building className="h-5 w-5 text-blue-600 mt-0.5" />
                </div>
                <div>
                  <p className="text-base font-medium text-blue-800">
                    Overview da sua organização: {(currentUser?.nome_empresa || currentUser?.organizacao_nome || currentUser?.organizacao || 'Sistema').toUpperCase()}
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
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
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsStatusModalOpen(false)}
              className="px-6"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarDownloadPDFNonPortes}
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