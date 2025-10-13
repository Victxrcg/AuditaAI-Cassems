import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
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
  ChevronRight
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
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [cronogramas, setCronogramas] = useState<CronogramaItem[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [editingCronograma, setEditingCronograma] = useState<CronogramaItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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

  useEffect(() => {
    if (currentUser) {
      fetchCronogramas();
      fetchEstatisticas();
      fetchUsuarios();
    }
  }, [currentUser]);

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
      pendente: { variant: 'secondary', text: 'PENDENTE' },
      em_andamento: { variant: 'default', text: 'EM ANDAMENTO' },
      concluido: { variant: 'default', text: 'CONCLUÍDO' },
      atrasado: { variant: 'destructive', text: 'ATRASADO' }
    } as const;

    return variants[status as keyof typeof variants] || { variant: 'secondary', text: 'PENDENTE' };
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const variants = {
      baixa: { variant: 'secondary', text: 'BAIXA' },
      media: { variant: 'default', text: 'MÉDIA' },
      alta: { variant: 'destructive', text: 'ALTA' },
      critica: { variant: 'destructive', text: 'CRÍTICA' }
    } as const;

    const badgeInfo = variants[prioridade as keyof typeof variants] || variants.baixa;

    return (
      <Badge variant={badgeInfo.variant as any} className="text-xs">
        {badgeInfo.text}
      </Badge>
    );
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

  // Função para renderizar a visualização em lista (estilo timeline horizontal)
  const renderListView = () => {
    // Agrupar cronogramas por mês/ano
    const cronogramasPorMes = cronogramasFiltrados.reduce((acc, cronograma) => {
      if (!cronograma.data_inicio) return acc;
      
      const dataInicio = new Date(cronograma.data_inicio);
      const mesAno = `${dataInicio.toLocaleDateString('pt-BR', { month: 'short' })}/${dataInicio.getFullYear()}`;
      
      if (!acc[mesAno]) {
        acc[mesAno] = [];
      }
      acc[mesAno].push(cronograma);
      return acc;
    }, {} as Record<string, CronogramaItem[]>);

    // Ordenar meses cronologicamente
    const mesesOrdenados = Object.keys(cronogramasPorMes).sort((a, b) => {
      const [mesA, anoA] = a.split('/');
      const [mesB, anoB] = b.split('/');
      const dataA = new Date(parseInt(anoA), ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].indexOf(mesA.toLowerCase()));
      const dataB = new Date(parseInt(anoB), ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].indexOf(mesB.toLowerCase()));
      return dataA.getTime() - dataB.getTime();
    });

    // Cores por status
    const coresStatus = {
      'pendente': { bg: 'bg-gray-100', dot: 'bg-gray-400', text: 'text-gray-700' },
      'em_andamento': { bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-700' },
      'concluido': { bg: 'bg-green-50', dot: 'bg-green-500', text: 'text-green-700' },
      'atrasado': { bg: 'bg-red-50', dot: 'bg-red-500', text: 'text-red-700' }
    };

    // Cores por prioridade
    const coresPrioridade = {
      'baixa': 'text-gray-600',
      'media': 'text-blue-600',
      'alta': 'text-orange-600',
      'critica': 'text-red-600'
    };

    return (
      <div className="space-y-6">
        {/* Cabeçalho */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Painel de Demandas
                </CardTitle>
                <CardDescription>
                  Linha do tempo com atividades organizadas por período
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Timeline por mês */}
        {mesesOrdenados.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhuma demanda encontrada</h3>
              <p className="text-gray-500">
                Não há demandas com datas de início cadastradas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {mesesOrdenados.map((mesAno) => {
              const cronogramasDoMes = cronogramasPorMes[mesAno];
              
              return (
                <Card key={mesAno} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      {mesAno.toUpperCase()} - {cronogramasDoMes.length} atividade{cronogramasDoMes.length !== 1 ? 's' : ''}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                      {cronogramasDoMes.map((cronograma, index) => {
                        const statusInfo = coresStatus[cronograma.status] || coresStatus.pendente;
                        const prioridadeInfo = coresPrioridade[cronograma.prioridade] || coresPrioridade.media;
                        
                        return (
                          <div key={cronograma.id} className={`p-6 hover:bg-gray-50 transition-colors ${statusInfo.bg}`}>
                            <div className="flex items-center gap-4">
                              {/* Indicador de status */}
                              <div className="flex-shrink-0">
                                <div className={`w-3 h-3 rounded-full ${statusInfo.dot}`}></div>
                              </div>
                              
                              {/* Seta para direita */}
                              <div className="flex-shrink-0">
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                              
                              {/* Conteúdo principal */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    {/* Status e Título */}
                                    <div className="flex items-center gap-3 mb-2">
                                      <Badge 
                                        variant={getStatusBadgeInfo(cronograma.status).variant as any}
                                        className="text-xs"
                                      >
                                        {getStatusBadgeInfo(cronograma.status).text}
                                      </Badge>
                                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                                        {cronograma.titulo}
                                      </h3>
                                    </div>
                                    
                                    {/* Descrição */}
                                    {cronograma.descricao && (
                                      <p className="text-gray-600 mb-3 text-sm">
                                        {cronograma.descricao}
                                      </p>
                                    )}
                                    
                                    {/* Informações da atividade */}
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                      {/* Prioridade */}
                                      <div className={`flex items-center gap-1 ${prioridadeInfo}`}>
                                        <AlertTriangle className="h-3 w-3" />
                                        <span className="text-xs font-medium">
                                          {cronograma.prioridade.toUpperCase()}
                                        </span>
                                      </div>
                                      
                                      {/* Responsável */}
                                      {cronograma.responsavel_nome && (
                                        <div className="flex items-center gap-1 text-gray-600">
                                          <User className="h-3 w-3" />
                                          <span className="text-xs">{cronograma.responsavel_nome}</span>
                                        </div>
                                      )}
                                      
                                      {/* Período */}
                                      {cronograma.data_inicio && cronograma.data_fim && (
                                        <div className="flex items-center gap-1 text-gray-600">
                                          <Calendar className="h-3 w-3" />
                                          <span className="text-xs">
                                            {new Date(cronograma.data_inicio).toLocaleDateString('pt-BR')} – {new Date(cronograma.data_fim).toLocaleDateString('pt-BR')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Motivo do atraso */}
                                    {cronograma.motivo_atraso && (
                                      <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
                                        <div className="flex items-start gap-2">
                                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                          <div>
                                            <p className="text-sm font-medium text-red-800">Aguardando ação</p>
                                            <p className="text-sm text-red-700">{cronograma.motivo_atraso}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Ações */}
                                  <div className="flex gap-2 flex-shrink-0">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingCronograma(cronograma);
                                        setIsEditDialogOpen(true);
                                      }}
                                      title="Editar demanda"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => openDeleteDialog(cronograma)}
                                      title="Excluir demanda"
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
                  </CardContent>
                </Card>
              );
            })}
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

    // Cores por status
    const coresStatus: Record<string, string> = {
      'pendente': 'bg-gray-400',
      'em_andamento': 'bg-blue-400',
      'concluido': 'bg-green-400',
      'atrasado': 'bg-red-400'
    };

    // Função para calcular posição da barra
    const calcularPosicaoBarra = (dataInicio: Date | null, dataFim: Date | null) => {
      if (!dataInicio || !dataFim) {
        return { inicio: 0, largura: 0, colunaInicio: 0, colunaFim: 1 };
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
                    : 'Visualização temporal das demandas por organização'
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
                {Object.entries(cronogramasPorOrganizacao).map(([organizacao, cronogramasOrg]) => (
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
                    {cronogramasOrg.map((cronograma) => {
                      const dataInicio = cronograma.data_inicio ? new Date(cronograma.data_inicio) : null;
                      const dataFim = cronograma.data_fim ? new Date(cronograma.data_fim) : null;
                      
                      const posicao = calcularPosicaoBarra(dataInicio, dataFim);

                      return (
                        <div key={cronograma.id} className="flex items-center h-16 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="w-80 px-4 py-3 text-sm text-gray-700 border-r">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <span 
                                  className="truncate cursor-pointer hover:text-blue-600 transition-colors flex-1"
                                  onClick={() => {
                                    setEditingCronograma(cronograma);
                                    setIsEditDialogOpen(true);
                                  }}
                                  title={`Clique para editar: ${cronograma.titulo}`}
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
                          
                          {/* Timeline bar interativa */}
                          <div className="relative flex-1 h-full">
                            {dataInicio && dataFim && (
                              <div
                                className={`absolute top-1/2 transform -translate-y-1/2 h-10 rounded-lg ${coresStatus[cronograma.status]} shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-white hover:scale-105 overflow-hidden`}
                                style={{
                                  left: posicao.inicio,
                                  width: posicao.largura,
                                  minWidth: '60px'
                                }}
                                onClick={() => {
                                  setEditingCronograma(cronograma);
                                  setIsEditDialogOpen(true);
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
                                left: `${((hoje.getTime() - inicioPeriodo.getTime()) / (fimPeriodo.getTime() - inicioPeriodo.getTime())) * 100}%`
                              }}
                              title={`Hoje: ${hoje.toLocaleDateString('pt-BR')}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
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
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className={`${viewMode === 'timeline' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'} relative`}
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
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
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
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
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
                <Select value={filtroOrganizacao} onValueChange={setFiltroOrganizacao}>
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
      ) : (
        viewMode === 'list' ? renderListView() : renderTimelineView()
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
                          currentUser?.organizacao === 'rede_frota' ? 'REDE FROTA' : 
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
                        <SelectItem value="rede_frota">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            REDE FROTA
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
    </div>
  );
};

export default Cronograma;