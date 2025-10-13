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
  User
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
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'dashboard'>('timeline');
  
  
  // Estado para controlar fases expandidas
  const [fasesExpandidas, setFasesExpandidas] = useState<Set<string>>(new Set());
  
  // Estado para busca
  const [busca, setBusca] = useState('');
  
  // Estado para controlar grupos de mês expandidos
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());

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
      
      const mesA = a.split('/')[0].toLowerCase();
      const anoA = parseInt(a.split('/')[1]);
      const mesB = b.split('/')[0].toLowerCase();
      const anoB = parseInt(b.split('/')[1]);
      
      // Primeiro compara o ano
      if (anoA !== anoB) {
        return anoA - anoB;
      }
      
      // Se o ano for igual, compara o mês
      return (meses[mesA as keyof typeof meses] || 0) - (meses[mesB as keyof typeof meses] || 0);
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

  // Função para renderizar a visualização em dashboard
  const renderDashboardView = () => {
    // Filtrar cronogramas com busca
    const cronogramasFiltradosComBusca = cronogramas.filter(cronograma => {
      const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
      const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
      const organizacaoMatch = filtroOrganizacao === 'todos' || cronograma.organizacao === filtroOrganizacao;
      const buscaMatch = !busca || cronograma.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                        (cronograma.responsavel_nome && cronograma.responsavel_nome.toLowerCase().includes(busca.toLowerCase()));
      return statusMatch && prioridadeMatch && organizacaoMatch && buscaMatch;
    });

    return (
      <div className="space-y-6">
        {/* Cabeçalho do Dashboard */}
        <div className="bg-white border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Status Atual do Projeto
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Visão geral do progresso das atividades
              </p>
            </div>
          </div>

          {/* Barra de busca e controles */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar atividade..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                size="sm" 
                className="bg-black text-white hover:bg-gray-800"
                onClick={() => {
                  setEditingCronograma(null);
                  setFormData(initialFormData());
                  setIsEditDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova atividade
              </Button>
            </div>
          </div>
        </div>

        {/* Grid de atividades */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cronogramasFiltradosComBusca.map((cronograma) => {
            const progresso = calcularProgresso(cronograma);
            const statusInfo = getStatusLabel(cronograma.status);
            
            return (
              <div 
                key={cronograma.id} 
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setEditingCronograma(cronograma);
                  setIsEditDialogOpen(true);
                }}
              >
                {/* Barra de progresso */}
                <div className="mb-4">
                  <div className="w-full bg-gray-300 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        cronograma.status === 'concluido' ? 'bg-blue-600' : 
                        cronograma.status === 'em_andamento' ? 'bg-blue-600' : 
                        cronograma.status === 'atrasado' ? 'bg-blue-600' : 'bg-gray-400'
                      }`}
                      style={{ width: `${progresso}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-gray-700">{progresso}%</span>
                    <span className={`text-sm font-medium ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </div>
                </div>

                {/* Título da atividade */}
                <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
                  {cronograma.titulo}
                </h3>

                {/* Informações adicionais */}
                <div className="space-y-2 text-sm text-gray-600">
                  {cronograma.responsavel_nome && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{cronograma.responsavel_nome}</span>
                    </div>
                  )}
                  
                  {cronograma.data_fim && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Prazo: {new Date(cronograma.data_fim).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span>{cronograma.organizacao.toUpperCase()}</span>
                  </div>
                </div>

                {/* Badge de prioridade */}
                {cronograma.prioridade !== 'media' && (
                  <div className="mt-4">
                    {getPrioridadeBadge(cronograma.prioridade)}
                  </div>
                )}

                {/* Motivo do atraso se aplicável */}
                {cronograma.motivo_atraso && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-800">Motivo do atraso:</p>
                        <p className="text-xs text-red-700 mt-1">{cronograma.motivo_atraso}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mensagem quando não há resultados */}
        {cronogramasFiltradosComBusca.length === 0 && (
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

        {/* Resumo estatístico */}
        {cronogramasFiltradosComBusca.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Progresso</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {cronogramasFiltradosComBusca.filter(c => c.status === 'concluido').length}
                </div>
                <div className="text-sm text-gray-600">Finalizadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {cronogramasFiltradosComBusca.filter(c => c.status === 'em_andamento').length}
                </div>
                <div className="text-sm text-gray-600">Em Andamento</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {cronogramasFiltradosComBusca.filter(c => c.status === 'atrasado').length}
                </div>
                <div className="text-sm text-gray-600">Em Risco</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {cronogramasFiltradosComBusca.filter(c => c.status === 'pendente').length}
                </div>
                <div className="text-sm text-gray-600">Pendentes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
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
        {/* Cabeçalho do Painel */}
        <div className="bg-white border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Painel de Implantação — Rede Frota x Portes
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Linha do tempo com títulos expansíveis • Admin (edição)
              </p>
            </div>
          </div>

          {/* Barra de busca e controles */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar etapa, atividade, respo"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                size="sm" 
                className="bg-black text-white hover:bg-gray-800"
                onClick={() => {
                  setEditingCronograma(null);
                  setFormData(initialFormData());
                  setIsEditDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova atividade
              </Button>
            </div>
          </div>

          {/* Botões de controle */}
          <div className="flex items-center gap-4 mt-4">
            <Button variant="outline" size="sm" onClick={expandirTodos}>
              Expandir tudo
            </Button>
            <Button variant="outline" size="sm" onClick={recolherTodos}>
              Recolher tudo
            </Button>
          </div>
        </div>

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
                        <div key={cronograma.id} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start gap-4">
                            {/* Indicador visual */}
                            <div className="flex-shrink-0 mt-1">
                              <div className={`w-3 h-3 rounded-full ${statusColor.icon}`}></div>
                            </div>

                            {/* Conteúdo da atividade */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                                    {cronograma.titulo}
                                  </h4>
                                  
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
                                    onClick={() => {
                                      setEditingCronograma(cronograma);
                                      setIsEditDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openDeleteDialog(cronograma)}
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
              variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('dashboard')}
              className={viewMode === 'dashboard' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
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
              <Select key={`status-${filtroStatus}`} value={filtroStatus} onValueChange={setFiltroStatus}>
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
              <Select key={`prioridade-${filtroPrioridade}`} value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
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
                <Select key={`org-${filtroOrganizacao}`} value={filtroOrganizacao} onValueChange={setFiltroOrganizacao}>
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
      ) : viewMode === 'dashboard' ? (
        renderDashboardView()
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