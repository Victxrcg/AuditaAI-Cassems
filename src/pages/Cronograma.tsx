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
  Building
} from 'lucide-react';

interface CronogramaItem {
  id: number;
  titulo: string;
  descricao?: string;
  organizacao: string;
  fase_atual: string;
  progresso_percentual: number;
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
  const [editingCronograma, setEditingCronograma] = useState<CronogramaItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    organizacao: 'cassems',
    fase_atual: 'inicio',
    progresso_percentual: 0,
    data_inicio: '',
    data_fim: '',
    status: 'pendente',
    prioridade: 'media',
    observacoes: '',
    motivo_atraso: ''
  });
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
    }
  }, [currentUser]);

  // Função para converter data para formato YYYY-MM-DD
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
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
        progresso_percentual: editingCronograma.progresso_percentual,
        data_inicio: formatDateForInput(editingCronograma.data_inicio || ''),
        data_fim: formatDateForInput(editingCronograma.data_fim || ''),
        status: editingCronograma.status,
        prioridade: editingCronograma.prioridade,
        observacoes: editingCronograma.observacoes || '',
        motivo_atraso: editingCronograma.motivo_atraso || ''
      });
    } else {
      setFormData({
        titulo: '',
        descricao: '',
        organizacao: currentUser?.organizacao || 'cassems',
        fase_atual: 'inicio',
        progresso_percentual: 0,
        data_inicio: '',
        data_fim: '',
        status: 'pendente',
        prioridade: 'media',
        observacoes: '',
        motivo_atraso: ''
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

  // Filtrar cronogramas
  const cronogramasFiltrados = cronogramas.filter(cronograma => {
    const statusMatch = filtroStatus === 'todos' || cronograma.status === filtroStatus;
    const prioridadeMatch = filtroPrioridade === 'todos' || cronograma.prioridade === filtroPrioridade;
    const organizacaoMatch = filtroOrganizacao === 'todos' || cronograma.organizacao === filtroOrganizacao;
    return statusMatch && prioridadeMatch && organizacaoMatch;
  });

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
      concluido: 'success',
      atrasado: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const variants = {
      baixa: 'secondary',
      media: 'default',
      alta: 'destructive',
      critica: 'destructive'
    } as const;

    return (
      <Badge variant={variants[prioridade as keyof typeof variants] || 'secondary'}>
        {prioridade.toUpperCase()}
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

    const faseConfig = fases[fase as keyof typeof fases] || { label: fase, color: 'bg-gray-100 text-gray-800' };

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
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': userOrg
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: editingCronograma ? "Cronograma atualizado com sucesso!" : "Cronograma criado com sucesso!",
        });
        setIsEditDialogOpen(false);
        setEditingCronograma(null);
        fetchCronogramas();
        fetchEstatisticas();
      } else {
        throw new Error('Erro ao salvar cronograma');
      }
    } catch (error) {
      console.error('Erro ao salvar cronograma:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar cronograma",
        variant: "destructive",
      });
    }
  };

  // Deletar cronograma
  const deleteCronograma = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este cronograma?')) {
      return;
    }

    try {
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const response = await fetch(`${API_BASE}/cronograma/${id}`, {
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
              👑 Você tem acesso completo a todos os cronogramas do sistema
            </p>
          ) : (
            <p className="text-sm text-blue-600 mt-1">
              ℹ️ Você está visualizando apenas as demandas da sua organização
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCronogramas} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
          <Button onClick={() => {
            setEditingCronograma(null);
            setIsEditDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Demanda
          </Button>
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
        </CardContent>
      </Card>

      {/* Lista de Cronogramas */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : cronogramasFiltrados.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhuma demanda encontrada</h3>
              <p className="text-gray-500">
                {filtroStatus !== 'todos' || filtroPrioridade !== 'todos' 
                  ? 'Tente ajustar os filtros para ver mais resultados.'
                  : 'Não há demandas cadastradas no momento.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          cronogramasFiltrados.map((cronograma) => {
            const diasAtraso = calcularDiasAtraso(cronograma.data_fim || '');
            
            return (
              <Card key={cronograma.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(cronograma.status)}
                      <div>
                        <CardTitle className="text-lg">{cronograma.titulo}</CardTitle>
                        {cronograma.descricao && (
                          <CardDescription className="mt-1">{cronograma.descricao}</CardDescription>
                        )}
                      </div>
                    </div>
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
                        onClick={() => deleteCronograma(cronograma.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progresso */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Progresso</span>
                      <span className="text-sm text-gray-600">{cronograma.progresso_percentual}%</span>
                    </div>
                    <Progress value={cronograma.progresso_percentual} className="h-2" />
                  </div>

                  {/* Informações */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-gray-500">Fase Atual</Label>
                      <div className="mt-1">{getFaseBadge(cronograma.fase_atual)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Responsável</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{cronograma.responsavel_nome || 'Não atribuído'}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Prazo</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(cronograma.data_fim || '')}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Organização</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        <span>{cronograma.responsavel_empresa || cronograma.organizacao}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status e Prioridade */}
                  <div className="flex gap-2 mt-4">
                    {getStatusBadge(cronograma.status)}
                    {getPrioridadeBadge(cronograma.prioridade)}
                    {diasAtraso > 0 && (
                      <Badge variant="destructive">
                        {diasAtraso} dia{diasAtraso > 1 ? 's' : ''} atrasado
                      </Badge>
                    )}
                  </div>

                  {/* Motivo do Atraso */}
                  {cronograma.motivo_atraso && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Motivo do atraso:</p>
                          <p className="text-sm text-red-700">{cronograma.motivo_atraso}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  {cronograma.observacoes && (
                    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-800 mb-1">Observações:</p>
                      <p className="text-sm text-gray-700">{cronograma.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

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

              {currentUser?.organizacao === 'portes' ? (
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
                      <SelectItem value="cassems">CASSEMS</SelectItem>
                      <SelectItem value="portes">PORTES</SelectItem>
                      <SelectItem value="rede_frota">REDE FROTA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label htmlFor="organizacao">Organização</Label>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 border rounded-md">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {currentUser?.nome_empresa || currentUser?.organizacao_nome || 'Sua organização'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Organização fixada para sua conta
                  </p>
                </div>
              )}

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
                <Label htmlFor="progresso">Progresso (%)</Label>
                <Input
                  id="progresso"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progresso_percentual}
                  onChange={(e) => setFormData({...formData, progresso_percentual: parseInt(e.target.value) || 0})}
                />
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
                    ⚠️ Este campo é obrigatório quando o status é "Atrasado"
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
    </div>
  );
};

export default Cronograma;