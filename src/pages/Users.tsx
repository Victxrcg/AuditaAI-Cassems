import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw, User, Users as UsersIcon, Mail, Shield, CheckCircle, XCircle, Key, Calendar, Clock, Building, Edit, Save, X, Trash2, Filter, FileText, HelpCircle, LayoutDashboard, Lock, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface UserRow {
  id: number;
  email: string;
  nome: string | null;
  nome_empresa?: string;
  perfil: string;
  ativo: number;
  created_at?: string;
  updated_at?: string;
  organizacao?: string;
  organizacao_nome?: string;
  permissoes?: string[] | string; // Array de páginas permitidas ou string JSON
}

interface Organizacao {
  id: number;
  nome: string;
  codigo: string;
  cor_identificacao: string;
  logo_url?: string;
  ativa: number;
  total_usuarios?: number;
  created_at?: string;
  updated_at?: string;
}

const Users = () => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Estados para organizações
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organizacao | null>(null);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<{ [key: number]: boolean }>({});
  const [showDeleteOrgDialog, setShowDeleteOrgDialog] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<{ id: number; nome: string } | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);

  // Estados para filtros
  const [filtroOrganizacao, setFiltroOrganizacao] = useState<string>('todas');
  const [filtroPerfil, setFiltroPerfil] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Lista de páginas disponíveis no sistema com ícones
  const paginasDisponiveis = [
    { id: 'cronograma', nome: 'Cronograma', descricao: 'Acesso ao cronograma de demandas', icon: Calendar, cor: '#3B82F6' },
    { id: 'compliance', nome: 'Compliance', descricao: 'Acesso à página de compliance fiscal', icon: Shield, cor: '#10B981' },
    { id: 'documentos', nome: 'Documentos', descricao: 'Acesso à gestão de documentos', icon: FileText, cor: '#8B5CF6' },
    { id: 'usuarios', nome: 'Usuários', descricao: 'Acesso à gestão de usuários (apenas Portes)', icon: UsersIcon, cor: '#F59E0B' },
    { id: 'ajuda', nome: 'Ajuda', descricao: 'Acesso à página de ajuda', icon: HelpCircle, cor: '#6366F1' }
  ];

  // Carregar usuário atual do localStorage
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Obter organização do usuário logado
      const userOrg = currentUser?.organizacao || 'cassems';
      
      const res = await fetch(`${API_BASE}/usuarios?organizacao=${userOrg}`, {
        headers: {
          'x-user-organization': userOrg
        }
      });
      
      if (!res.ok) {
        console.error('Erro ao buscar usuários:', res.status, res.statusText);
        setUsers([]);
        return;
      }
      const data = await res.json();
      console.log('📋 Dados recebidos do backend:', data);

      // Processar dados do backend
      let usersArray = [];
      
      if (Array.isArray(data)) {
        usersArray = data;
      } else if (data && typeof data === 'object') {
        usersArray = [data];
      } else if (data && data.data && Array.isArray(data.data)) {
        usersArray = data.data;
      } else if (data && data.data && typeof data.data === 'object') {
        usersArray = [data.data];
      }

      setUsers(usersArray);
    } catch (error) {
      console.error('Erro na requisição:', error);
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => { 
    if (currentUser) {
      fetchUsers(); 
    }
  }, [currentUser]);

  const updateUser = async (userId: number, userData: Partial<UserRow> & { permissoes?: string }) => {
    // Apenas usuários da Portes podem editar qualquer usuário
    if (!currentUser || currentUser.organizacao !== 'portes') {
      toast({
        title: "Acesso Negado",
        description: "Apenas usuários da PORTES podem editar usuários.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/usuarios/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.success) {
        // Verificar se o usuário editado é o mesmo que está logado
        const loggedUserId = currentUser?.id;
        const updatedUserData = data.data || data.user;
        
        if (loggedUserId && parseInt(loggedUserId) === userId) {
          // Atualizar localStorage com os novos dados do usuário
          const updatedUser = {
            ...currentUser,
            ...updatedUserData,
            permissoes: updatedUserData?.permissoes || userData.permissoes
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setCurrentUser(updatedUser);
          
          // Disparar evento customizado para atualizar Sidebar
          window.dispatchEvent(new CustomEvent('userPermissionsUpdated'));
          
          toast({
            title: "Permissões Atualizadas",
            description: "Suas permissões foram atualizadas. O menu será atualizado automaticamente.",
          });
        } else {
          toast({
            title: "Usuário Atualizado",
            description: `Usuário foi atualizado com sucesso.`,
          });
        }
        
        // Atualizar a lista de usuários
        setUsers(users.map(user => 
          user.id === userId 
            ? { ...user, ...userData, updated_at: new Date().toISOString() }
            : user
        ));
        
        setIsEditDialogOpen(false);
        setEditingUser(null);
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao atualizar usuário",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar usuário",
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (userId: number, userName: string) => {
    // Apenas usuários da Portes podem resetar senhas
    if (!currentUser || currentUser.organizacao !== 'portes') {
      toast({
        title: "Acesso Negado",
        description: "Apenas usuários da PORTES podem resetar senhas.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Senha Resetada",
          description: `Senha do usuário ${userName} foi resetada com sucesso.`,
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao resetar senha",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      toast({
        title: "Erro",
        description: "Erro ao resetar senha",
        variant: "destructive",
      });
    }
  };

  const getProfileLabel = (perfil: string) => {
    const profiles = {
      admin: 'Administrador',
      usuario: 'Usuário'
    };
    return profiles[perfil as keyof typeof profiles] || perfil;
  };

  const getRoleBadge = (perfil: string) => {
    const config = {
      admin: { label: 'Administrador', className: 'bg-red-100 text-red-800 border-red-200' },
      usuario: { label: 'Usuário', className: 'bg-blue-100 text-blue-800 border-blue-200' }
    };
    const roleConfig = config[perfil as keyof typeof config] || { label: perfil, className: 'bg-gray-100 text-gray-800 border-gray-200' };
    return <Badge className={`${roleConfig.className} border`}>{roleConfig.label}</Badge>;
  };

  const getStatusBadge = (ativo: number) => {
    return ativo === 1 ? (
      <Badge className="bg-green-100 text-green-800 border-green-200 border">
        <CheckCircle className="h-3 w-3 mr-1" />
        Ativo
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 border-red-200 border">
        <XCircle className="h-3 w-3 mr-1" />
        Inativo
      </Badge>
    );
  };

  const getOrganizationBadge = (user: UserRow) => {
    const nomeEmpresa = user.nome_empresa || user.organizacao_nome || (user.organizacao === 'portes' ? 'Portes' : 'Cassems');
    
    // Determinar cor baseada na organização
    let badgeClass = 'bg-blue-100 text-blue-800 border-blue-200'; // Padrão azul
    
    if (user.organizacao === 'portes') {
      badgeClass = 'bg-green-100 text-green-800 border-green-200';
    } else if (user.organizacao === 'rede_frota') {
      badgeClass = 'bg-purple-100 text-purple-800 border-purple-200';
    } else if (user.organizacao && user.organizacao !== 'cassems' && user.organizacao !== 'portes') {
      // Organizações terceiras (dinâmicas)
      badgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
    
    return (
      <Badge className={`${badgeClass} border`}>
        <Building className="h-3 w-3 mr-1" />
        {nomeEmpresa.toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openEditDialog = (user: UserRow) => {
    // Parse permissoes se for string JSON
    let permissoesArray: string[] = [];
    if (user.permissoes) {
      if (typeof user.permissoes === 'string') {
        try {
          permissoesArray = JSON.parse(user.permissoes);
        } catch {
          permissoesArray = [];
        }
      } else if (Array.isArray(user.permissoes)) {
        permissoesArray = user.permissoes;
      }
    }
    
    setEditingUser({
      ...user,
      permissoes: permissoesArray
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (editingUser) {
      // Converter permissoes para JSON string se for array
      let permissoes = editingUser.permissoes;
      if (Array.isArray(permissoes)) {
        permissoes = JSON.stringify(permissoes);
      }
      
      updateUser(editingUser.id, {
        perfil: editingUser.perfil,
        organizacao: editingUser.organizacao,
        ativo: editingUser.ativo,
        permissoes: permissoes
      });
    }
  };

  // Funções para gerenciamento de organizações
  const fetchOrganizacoes = async () => {
    if (!currentUser || currentUser.organizacao !== 'portes') return;
    
    setLoadingOrgs(true);
    try {
      const res = await fetch(`${API_BASE}/organizacoes`, {
        headers: {
          'x-user-organization': 'portes'
        }
      });
      
      if (!res.ok) {
        console.error('Erro ao buscar organizações:', res.status, res.statusText);
        setOrganizacoes([]);
        return;
      }
      
      const data = await res.json();
      const organizacoesData = data.data || data || [];
      console.log('🔍 Organizações recebidas:', organizacoesData);
      console.log('🔍 Logo URLs:', organizacoesData.map((o: any) => ({ id: o.id, nome: o.nome, logo_url: o.logo_url })));
      setOrganizacoes(organizacoesData);
      // Limpar erros de logo ao recarregar
      setLogoError({});
    } catch (error) {
      console.error('Erro na requisição de organizações:', error);
      setOrganizacoes([]);
    }
    setLoadingOrgs(false);
  };

  useEffect(() => {
    if (currentUser && currentUser.organizacao === 'portes') {
      fetchOrganizacoes();
    }
  }, [currentUser]);

  const criarOrganizacao = async (orgData: Partial<Organizacao>) => {
    try {
      const response = await fetch(`${API_BASE}/organizacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': 'portes'
        },
        body: JSON.stringify(orgData)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Organização Criada",
          description: `Organização ${orgData.nome} foi criada com sucesso.`,
        });
        fetchOrganizacoes();
        setIsOrgDialogOpen(false);
        setEditingOrg(null);
        setIsCreatingOrg(false);
      } else {
        toast({
          title: "Erro",
          description: data.error || data.details || "Erro ao criar organização",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao criar organização:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar organização",
        variant: "destructive",
      });
    }
  };

  const atualizarOrganizacao = async (orgId: number, orgData: Partial<Organizacao>) => {
    try {
      const response = await fetch(`${API_BASE}/organizacoes/${orgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': 'portes'
        },
        body: JSON.stringify(orgData)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Organização Atualizada",
          description: `Organização foi atualizada com sucesso.`,
        });
        fetchOrganizacoes();
        setIsOrgDialogOpen(false);
        setEditingOrg(null);
      } else {
        toast({
          title: "Erro",
          description: data.error || data.details || "Erro ao atualizar organização",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar organização:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar organização",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrgClick = (orgId: number, orgNome: string) => {
    setOrgToDelete({ id: orgId, nome: orgNome });
    setShowDeleteOrgDialog(true);
  };

  const cancelDeleteOrg = () => {
    setShowDeleteOrgDialog(false);
    setOrgToDelete(null);
  };

  const confirmDeleteOrg = async () => {
    if (!orgToDelete) return;

    setDeletingOrg(true);
    try {
      const response = await fetch(`${API_BASE}/organizacoes/${orgToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-organization': 'portes'
        }
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Organização Excluída",
          description: `Organização ${orgToDelete.nome} foi excluída com sucesso.`,
        });
        fetchOrganizacoes();
        setShowDeleteOrgDialog(false);
        setOrgToDelete(null);
      } else {
        toast({
          title: "Erro",
          description: data.error || data.details || "Erro ao excluir organização",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao excluir organização:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir organização",
        variant: "destructive",
      });
    } finally {
      setDeletingOrg(false);
    }
  };

  const openCreateOrgDialog = () => {
    setEditingOrg({ id: 0, nome: '', codigo: '', cor_identificacao: '#6366F1', logo_url: '', ativa: 1 } as Organizacao);
    setLogoFile(null);
    setLogoPreview(null);
    setIsCreatingOrg(true);
    setIsOrgDialogOpen(true);
  };

  const openEditOrgDialog = (org: Organizacao) => {
    console.log('🔍 Abrindo diálogo para editar organização:', {
      id: org.id,
      nome: org.nome,
      logo_url: org.logo_url
    });
    setEditingOrg({ ...org });
    setLogoFile(null);
    setLogoPreview(org.logo_url || null);
    setIsCreatingOrg(false);
    setIsOrgDialogOpen(true);
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Erro",
        description: "Apenas arquivos de imagem são permitidos (jpeg, jpg, png, gif, webp, svg)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "Arquivo muito grande. Tamanho máximo: 15MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch(`${API_BASE}/organizacoes/upload-logo`, {
        method: 'POST',
        headers: {
          'x-user-organization': 'portes'
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao fazer upload da logo');
      }

      const data = await response.json();
      return data.logo_url || null;
    } catch (error: any) {
      console.error('Erro ao fazer upload da logo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao fazer upload da logo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!editingOrg) {
      console.error('❌ editingOrg é null!');
      return;
    }
    
    // Verificar se o ID ainda está presente antes de salvar
    if (editingOrg.id && editingOrg.id > 0) {
      console.log('✅ ID válido encontrado antes de salvar:', editingOrg.id);
    } else {
      console.log('⚠️ ID não encontrado ou inválido antes de salvar:', editingOrg.id);
    }

    // Se houver arquivo de logo selecionado, fazer upload primeiro
    let logoUrl = editingOrg.logo_url || null;
    if (logoFile) {
      const uploadedUrl = await handleUploadLogo();
      if (uploadedUrl) {
        logoUrl = uploadedUrl;
      } else {
        // Se o upload falhar, não continuar
        return;
      }
    }

    const orgData = {
      nome: editingOrg.nome,
      codigo: editingOrg.codigo,
      cor_identificacao: editingOrg.cor_identificacao,
      logo_url: logoUrl,
      ativa: editingOrg.ativa ? 1 : 0
    };

    // Verificar se é criação ou atualização baseado APENAS no ID
    // Se editingOrg.id existe e é maior que 0, SEMPRE é uma atualização
    const hasValidId = editingOrg.id && editingOrg.id > 0;
    
    console.log('🔍 Salvando organização:', {
      id: editingOrg.id,
      isCreatingOrg,
      hasValidId,
      nome: editingOrg.nome,
      logoUrl,
      editingOrgCompleto: editingOrg
    });

    if (hasValidId) {
      // SEMPRE atualizar se tiver ID válido, independente de isCreatingOrg
      console.log('✅ Atualizando organização existente (ID:', editingOrg.id, ')');
      atualizarOrganizacao(editingOrg.id, orgData);
    } else {
      // Criar nova organização apenas se não tiver ID válido
      console.log('✅ Criando nova organização');
      criarOrganizacao(orgData);
    }

    // Limpar estados após salvar
    setLogoFile(null);
    setLogoPreview(null);
  };

  const isPortes = currentUser?.organizacao === 'portes';

  return (
    <>
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">Gerenciamento</h1>
          <p className="text-sm sm:text-base text-gray-600 truncate">
            {isPortes
              ? 'Gerencie usuários e organizações do sistema' 
              : `Usuários da ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'sua organização'}`
            }
          </p>
        </div>
        <Button variant="outline" onClick={isPortes ? () => { fetchUsers(); fetchOrganizacoes(); } : fetchUsers} disabled={loading || loadingOrgs} className="flex-shrink-0">
          <RefreshCw className={`h-4 w-4 mr-2 ${(loading || loadingOrgs) ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Recarregar</span>
          <span className="sm:hidden">↻</span>
        </Button>
      </div>

      {isPortes ? (
        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="organizacoes">Organizações</TabsTrigger>
          </TabsList>
          
          <TabsContent value="usuarios" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Filtro por Organização */}
                  <div className="space-y-2">
                    <Label htmlFor="filtro-org">Organização</Label>
                    <Select value={filtroOrganizacao} onValueChange={setFiltroOrganizacao}>
                      <SelectTrigger id="filtro-org">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as organizações</SelectItem>
                        {organizacoes.map((org) => (
                          <SelectItem key={org.id} value={org.codigo}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: org.cor_identificacao }}
                              />
                              {org.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Perfil */}
                  <div className="space-y-2">
                    <Label htmlFor="filtro-perfil">Perfil</Label>
                    <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
                      <SelectTrigger id="filtro-perfil">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os perfis</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="usuario">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro por Status */}
                  <div className="space-y-2">
                    <Label htmlFor="filtro-status">Status</Label>
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger id="filtro-status">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Botão Limpar Filtros */}
                {(filtroOrganizacao !== 'todas' || filtroPerfil !== 'todos' || filtroStatus !== 'todos') && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFiltroOrganizacao('todas');
                        setFiltroPerfil('todos');
                        setFiltroStatus('todos');
                      }}
                      className="w-full sm:w-auto"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Limpar Filtros
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Lista de Usuários ({(() => {
              // Aplicar filtros
              let filtered = users;
              if (filtroOrganizacao !== 'todas') {
                filtered = filtered.filter(u => u.organizacao === filtroOrganizacao);
              }
              if (filtroPerfil !== 'todos') {
                filtered = filtered.filter(u => u.perfil === filtroPerfil);
              }
              if (filtroStatus !== 'todos') {
                filtered = filtered.filter(u => 
                  filtroStatus === 'ativo' ? u.ativo === 1 : u.ativo === 0
                );
              }
              return filtered.length;
            })()} de {users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (() => {
            // Aplicar filtros
            let filtered = users;
            if (filtroOrganizacao !== 'todas') {
              filtered = filtered.filter(u => u.organizacao === filtroOrganizacao);
            }
            if (filtroPerfil !== 'todos') {
              filtered = filtered.filter(u => u.perfil === filtroPerfil);
            }
            if (filtroStatus !== 'todos') {
              filtered = filtered.filter(u => 
                filtroStatus === 'ativo' ? u.ativo === 1 : u.ativo === 0
              );
            }

            return filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
                Nenhum usuário encontrado com os filtros selecionados
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
                {filtered.map(user => (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  {/* Layout principal responsivo */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                    {/* Avatar e Info Básica */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-base sm:text-lg truncate">{user.nome || 'Sem nome'}</div>
                        <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badges e Ações em linha para telas grandes */}
                    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-2 xl:gap-4 lg:items-start xl:items-center">
                      {/* Empresa */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Empresa</div>
                        <div className="truncate">{getOrganizationBadge(user)}</div>
                      </div>

                      {/* Perfil */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Perfil</div>
                        <div className="truncate">{getRoleBadge(user.perfil)}</div>
                      </div>

                      {/* Status */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Status</div>
                        <div className="truncate">{getStatusBadge(user.ativo)}</div>
                      </div>

                      {/* Ações */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Ações</div>
                        {currentUser?.organizacao === 'portes' ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs sm:text-sm"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resetPassword(user.id, user.nome || user.email)}
                              className="text-orange-600 border-orange-300 hover:bg-orange-50 text-xs sm:text-sm"
                            >
                              <Key className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Resetar senha
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            Nenhuma ação disponível
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações Adicionais */}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="font-medium">Criado em:</span>
                        <span className="truncate">{formatDate(user.created_at || '')}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="font-medium">Última atualização:</span>
                        <span className="truncate">{formatDate(user.updated_at || '')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
          </TabsContent>
          
          <TabsContent value="organizacoes" className="space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl break-words">
                    <Building className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    Organizações ({organizacoes.length})
                  </CardTitle>
                  <Button 
                    onClick={openCreateOrgDialog} 
                    size="sm"
                    className="text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200 w-full sm:w-auto whitespace-nowrap"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    Nova Organização
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingOrgs ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : organizacoes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhuma organização encontrada.
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {organizacoes.map((org) => (
                      <div key={org.id} className="border border-gray-200 rounded-lg p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div 
                              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                              style={{ 
                                backgroundColor: (org.logo_url && !logoError[org.id]) ? 'transparent' : (org.cor_identificacao + '20')
                              }}
                            >
                              {org.logo_url && !logoError[org.id] ? (
                                <img
                                  src={(() => {
                                    // Se já é URL completa, usar diretamente
                                    if (org.logo_url.startsWith('http')) {
                                      return org.logo_url;
                                    }
                                    // Se logo_url começa com /api, remover /api para evitar duplicação
                                    // porque API_BASE já contém /api
                                    const logoPath = org.logo_url.startsWith('/api') 
                                      ? org.logo_url.substring(4) // Remove '/api' do início
                                      : org.logo_url;
                                    return `${API_BASE}${logoPath}`;
                                  })()}
                                  alt={`Logo ${org.nome}`}
                                  className="w-full h-full object-cover"
                                  style={{ borderRadius: '50%' }}
                                  onLoad={() => {
                                    console.log('✅ Logo carregada com sucesso:', org.nome, org.logo_url);
                                  }}
                                  onError={(e) => {
                                    const logoUrl = (() => {
                                      if (org.logo_url.startsWith('http')) {
                                        return org.logo_url;
                                      }
                                      const logoPath = org.logo_url.startsWith('/api') 
                                        ? org.logo_url.substring(4)
                                        : org.logo_url;
                                      return `${API_BASE}${logoPath}`;
                                    })();
                                    console.error('❌ Erro ao carregar logo:', org.nome);
                                    console.error('❌ URL original:', org.logo_url);
                                    console.error('❌ URL tentada:', logoUrl);
                                    // Se a imagem falhar, marcar como erro para mostrar o ícone
                                    setLogoError(prev => ({ ...prev, [org.id]: true }));
                                  }}
                                />
                              ) : (
                                <Building 
                                  className="h-6 w-6" 
                                  style={{ color: org.cor_identificacao }}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-base sm:text-lg truncate">{org.nome}</div>
                              <div className="text-xs sm:text-sm text-gray-600 truncate">
                                Código: {org.codigo}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-2 xl:gap-4 lg:items-start xl:items-center">
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 font-medium">Status</div>
                              <div className="truncate">
                                {org.ativa === 1 ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 border">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Ativa
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 border">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Inativa
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 font-medium">Usuários</div>
                              <div className="truncate">
                                <Badge variant="outline">{org.total_usuarios || 0} usuário(s)</Badge>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 font-medium">Ações</div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditOrgDialog(org)}
                                  className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs sm:text-sm"
                                >
                                  <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteOrgClick(org.id, org.nome)}
                                  disabled={(org.total_usuarios || 0) > 0}
                                  className="text-red-600 border-red-300 hover:bg-red-50 text-xs sm:text-sm disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {(org.total_usuarios || 0) > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-xs text-orange-600 space-y-1">
                              <p className="text-orange-700">
                                Para excluir esta organização, você precisa primeiro transferir todos os usuários para outra organização. Vá na aba "Usuários", edite cada usuário e altere a organização deles.
                              </p>
                            </div>
                          </div>
                        )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Lista de Usuários ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum usuário encontrado.
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {users.map(user => (
                    <div key={user.id} className="border border-gray-200 rounded-lg p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                      {/* Layout principal responsivo */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                        {/* Avatar e Info Básica */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-base sm:text-lg truncate">{user.nome || 'Sem nome'}</div>
                            <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Badges e Ações em linha para telas grandes */}
                        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 sm:gap-4 lg:gap-2 xl:gap-4 lg:items-start xl:items-center">
                          {/* Empresa */}
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 font-medium">Empresa</div>
                            <div className="truncate">{getOrganizationBadge(user)}</div>
                          </div>

                          {/* Perfil */}
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 font-medium">Perfil</div>
                            <div className="truncate">{getRoleBadge(user.perfil)}</div>
                          </div>

                          {/* Status */}
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 font-medium">Status</div>
                            <div className="truncate">{getStatusBadge(user.ativo)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Informações Adicionais */}
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="font-medium">Criado em:</span>
                            <span className="truncate">{formatDate(user.created_at || '')}</span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="font-medium">Última atualização:</span>
                            <span className="truncate">{formatDate(user.updated_at || '')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>

      {/* Dialog de Edição de Usuário - Fora do container principal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} modal={true}>
        <DialogContent className="max-w-xl w-[95vw] max-h-[90vh] flex flex-col z-[60]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl flex items-center gap-2 break-words">
              <Edit className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              Gerencie as informações e permissões de acesso do usuário
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 sm:space-y-6 overflow-y-auto flex-1 min-h-0 pr-1 sm:pr-2 -mr-1 sm:mr-0">
              {/* Seção: Informações Básicas */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <User className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-sm text-gray-700">Informações Básicas</h3>
                </div>
                
                {/* Informações do Usuário - Read Only */}
              <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Usuário</Label>
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {editingUser.nome?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-gray-900 truncate">{editingUser.nome || 'Sem nome'}</p>
                        <p className="text-sm text-gray-600 truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {editingUser.email}
                        </p>
                      </div>
                    </div>
                </div>
              </div>
              
                {/* Grid de Configurações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Organização */}
              <div className="space-y-2">
                    <Label htmlFor="edit-org" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Building className="h-3.5 w-3.5" />
                      Organização
                    </Label>
                <Select
                  value={editingUser.organizacao || 'cassems'}
                  onValueChange={(value) => {
                    // Atualizar organização e definir perfil automaticamente
                    const novoPerfil = value === 'portes' ? 'admin' : 'usuario';
                    setEditingUser({...editingUser, organizacao: value, perfil: novoPerfil});
                  }}
                >
                      <SelectTrigger id="edit-org" className="h-10">
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                        {organizacoes.length > 0 ? (
                          organizacoes.map((org) => (
                            <SelectItem key={org.id} value={org.codigo}>
                      <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: org.cor_identificacao }}
                                />
                                <span>{org.nome}</span>
                      </div>
                    </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="cassems">CASSEMS</SelectItem>
                            <SelectItem value="portes">PORTES</SelectItem>
                            <SelectItem value="rede_frota">MARAJÓ / REDE FROTA</SelectItem>
                          </>
                        )}
                  </SelectContent>
                </Select>
              </div>

              {/* Perfil */}
              <div className="space-y-2">
                    <Label htmlFor="edit-perfil" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      Perfil
                    </Label>
                <Select
                  value={editingUser.perfil}
                  onValueChange={(value) => setEditingUser({...editingUser, perfil: value})}
                >
                      <SelectTrigger id="edit-perfil" className="h-10">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-600" />
                            <div>
                              <div className="font-medium">Administrador</div>
                            </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="usuario">
                      <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">Usuário</div>
                            </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                  </div>
              </div>

                {/* Status */}
              <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Status da Conta</Label>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      {editingUser.ativo === 1 ? (
                        <div className="p-2 bg-green-100 rounded-full">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-red-100 rounded-full">
                          <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm text-gray-900">
                          {editingUser.ativo === 1 ? 'Usuário Ativo' : 'Usuário Inativo'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {editingUser.ativo === 1 ? 'Pode acessar o sistema normalmente' : 'Não pode acessar o sistema'}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={editingUser.ativo === 1}
                      onCheckedChange={(checked) => setEditingUser({...editingUser, ativo: checked ? 1 : 0})}
                      className="data-[state=checked]:bg-green-600"
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Permissões de Acesso */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-purple-600" />
                    <h3 className="font-semibold text-sm text-gray-700">Permissões de Acesso</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(() => {
                      const permissoesArray = Array.isArray(editingUser.permissoes) ? editingUser.permissoes : [];
                      return permissoesArray.length === 0 ? 'Acesso Total' : `${permissoesArray.length} página(s)`;
                    })()}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Selecione quais páginas este usuário pode acessar. <strong>Se nenhuma for selecionada, terá acesso a todas as páginas.</strong>
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                    {paginasDisponiveis.map((pagina) => {
                      const permissoesArray = Array.isArray(editingUser.permissoes) 
                        ? editingUser.permissoes 
                        : [];
                      const temAcesso = permissoesArray.includes(pagina.id);
                      
                      // Renderizar apenas o conteúdo simples do card, sem nenhuma referência ao componente principal
                      return (
                        <div 
                          key={`permissao-page-${pagina.id}`} 
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${temAcesso ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const currentPerms = Array.isArray(editingUser.permissoes) 
                              ? [...editingUser.permissoes] 
                              : [];
                            const newPerms = temAcesso
                              ? currentPerms.filter(p => p !== pagina.id)
                              : [...currentPerms, pagina.id];
                            setEditingUser({...editingUser, permissoes: newPerms});
                          }}
                        >
                          <div className={`p-2 rounded-lg flex-shrink-0 ${temAcesso ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                            {(() => {
                              const IconComponent = pagina.icon;
                              if (!IconComponent || typeof IconComponent !== 'function') return null;
                              // Renderizar apenas o ícone usando JSX diretamente
                              const Icon = IconComponent as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
                              return (
                                <Icon 
                                  className={`h-5 w-5 ${temAcesso ? 'text-blue-600' : 'text-gray-400'}`}
                                  style={temAcesso && pagina.cor ? { color: pagina.cor } : undefined}
                                />
                              );
                            })()}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm truncate ${temAcesso ? 'text-gray-900' : 'text-gray-600'}`}>
                                {String(pagina.nome || '')}
                              </span>
                              {temAcesso && (
                                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{String(pagina.descricao || '')}</p>
                          </div>
                          <Switch
                            checked={temAcesso}
                            onCheckedChange={(checked) => {
                              const currentPerms = Array.isArray(editingUser.permissoes) 
                                ? [...editingUser.permissoes] 
                                : [];
                              const newPerms = checked
                                ? [...currentPerms, pagina.id]
                                : currentPerms.filter(p => p !== pagina.id);
                              setEditingUser({...editingUser, permissoes: newPerms});
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            className="flex-shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  {(() => {
                    const permissoesArray = Array.isArray(editingUser.permissoes) ? editingUser.permissoes : [];
                    if (permissoesArray.length === 0) {
                      return (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                          <LayoutDashboard className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-800">
                            <strong>Acesso Total:</strong> Este usuário terá acesso a todas as páginas do sistema, pois nenhuma restrição foi definida.
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-amber-800">
                            <strong>Acesso Restrito:</strong> Este usuário poderá acessar apenas as {permissoesArray.length} página(s) selecionada(s). Páginas não selecionadas estarão ocultas no menu.
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

            </div>
          )}
          
          {/* Botões de Ação - Fixos na parte inferior */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t flex-shrink-0 mt-auto">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={editingUser ? (() => {
                const originalUser = users.find(u => u.id === editingUser.id);
                if (!originalUser) return true;
                
                // Parse permissoes originais
                let originalPerms: string[] = [];
                if (originalUser.permissoes) {
                  if (typeof originalUser.permissoes === 'string') {
                    try {
                      originalPerms = JSON.parse(originalUser.permissoes);
                    } catch {
                      originalPerms = [];
                    }
                  } else if (Array.isArray(originalUser.permissoes)) {
                    originalPerms = originalUser.permissoes;
                  }
                }
                
                const currentPerms = Array.isArray(editingUser.permissoes) 
                  ? editingUser.permissoes 
                  : [];
                
                // Comparar arrays de permissões
                const permsChanged = JSON.stringify(originalPerms.sort()) !== JSON.stringify(currentPerms.sort());
                
                return (
                  editingUser.perfil === originalUser.perfil &&
                  editingUser.organizacao === originalUser.organizacao &&
                  editingUser.ativo === originalUser.ativo &&
                  !permsChanged
                );
              })() : true}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição/Criação de Organização - Fora do container principal */}
      <Dialog open={isOrgDialogOpen} onOpenChange={(open) => {
        setIsOrgDialogOpen(open);
        if (!open) {
          // Limpar estados ao fechar
          console.log('🔍 Fechando diálogo de organização');
          setLogoFile(null);
          setLogoPreview(null);
          setEditingOrg(null);
          setIsCreatingOrg(false);
        }
      }}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl break-words">
              {isCreatingOrg ? 'Criar Organização' : 'Editar Organização'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {isCreatingOrg 
                ? 'Preencha os dados para criar uma nova organização no sistema.'
                : 'Edite os dados da organização abaixo.'}
            </DialogDescription>
          </DialogHeader>
          {editingOrg && (
            <div className="space-y-4 sm:space-y-6 overflow-y-auto flex-1 min-h-0 pr-1 sm:pr-2 -mr-1 sm:mr-0">
              <div className="space-y-2 w-full">
                <Label htmlFor="org-nome" className="text-sm sm:text-base">Nome *</Label>
                <Input
                  id="org-nome"
                  value={editingOrg.nome}
                  onChange={(e) => {
                    if (!editingOrg) return;
                    setEditingOrg({ ...editingOrg, nome: e.target.value });
                  }}
                  placeholder="Ex: SENAC"
                  required
                  className="w-full text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2 w-full">
                <Label htmlFor="org-codigo" className="text-sm sm:text-base">Código *</Label>
                <Input
                  id="org-codigo"
                  value={editingOrg.codigo}
                  onChange={(e) => {
                    if (!editingOrg) return;
                    // Se estiver editando (tem ID), manter o código original sem normalizar
                    // Se estiver criando (não tem ID ou ID é 0), normalizar o código
                    const newCodigo = isCreatingOrg 
                      ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                      : e.target.value; // Manter código original ao editar
                    setEditingOrg({ 
                      ...editingOrg, 
                      codigo: newCodigo
                    });
                  }}
                  placeholder="Ex: senac"
                  required
                  disabled={!isCreatingOrg} // Desabilitar edição do código quando estiver editando
                  className="w-full text-xs sm:text-sm"
                />
                <p className="text-xs text-gray-500 break-words">
                  {isCreatingOrg 
                    ? 'Usado como identificador único (apenas letras, números e _)' 
                    : 'O código não pode ser alterado após a criação da organização'}
                </p>
              </div>

              <div className="space-y-2 w-full">
                <Label htmlFor="org-cor" className="text-sm sm:text-base">Cor de Identificação</Label>
                <div className="flex flex-col sm:flex-row gap-2 items-center w-full">
                  <Input
                    id="org-cor"
                    type="color"
                    value={editingOrg.cor_identificacao}
                    onChange={(e) => setEditingOrg({ ...editingOrg, cor_identificacao: e.target.value })}
                    className="w-20 h-10 flex-shrink-0"
                  />
                  <Input
                    value={editingOrg.cor_identificacao}
                    onChange={(e) => setEditingOrg({ ...editingOrg, cor_identificacao: e.target.value })}
                    placeholder="#6366F1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    className="flex-1 w-full text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 w-full">
                <Label htmlFor="org-logo" className="text-sm sm:text-base">Logo da Organização</Label>
                <div className="space-y-3 w-full">
                  <div className="flex items-center gap-3 w-full">
                    <label
                      htmlFor="logo-upload"
                      className="flex-1 cursor-pointer w-full"
                    >
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors w-full">
                        <div className="flex flex-col items-center justify-center gap-2">
                          {uploadingLogo ? (
                            <>
                              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
                              <p className="text-xs sm:text-sm text-gray-600 break-words">Enviando...</p>
                            </>
                          ) : logoPreview ? (
                            <>
                              <img
                                src={logoPreview.startsWith('data:') || logoPreview.startsWith('http') ? logoPreview : `${API_BASE}${logoPreview}`}
                                alt="Preview logo"
                                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <p className="text-xs text-gray-600 break-words">Clique para alterar</p>
                            </>
                          ) : (
                            <>
                              <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                              <p className="text-xs sm:text-sm text-gray-600 break-words">Clique para fazer upload</p>
                              <p className="text-xs text-gray-400 break-words">PNG, JPG, GIF até 15MB</p>
                            </>
                          )}
                        </div>
                      </div>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                        onChange={handleLogoFileSelect}
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                    </label>
                  </div>
                  {logoFile && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 bg-blue-50 rounded-lg w-full">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ImageIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs sm:text-sm text-gray-700 break-words truncate">{logoFile.name}</span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          ({(logoFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(editingOrg.logo_url || null);
                          const input = document.getElementById('logo-upload') as HTMLInputElement;
                          if (input) input.value = '';
                        }}
                        className="h-6 px-2 text-xs flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {!logoPreview && !logoFile && (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0">
                      <Building className="h-6 w-6 sm:h-8 sm:h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 break-words">Faça upload da logo da organização (máximo 15MB)</p>
              </div>

              <div className="space-y-2 w-full">
                <Label className="text-sm sm:text-base">Status</Label>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {editingOrg.ativa === 1 ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm sm:text-base break-words">
                      {editingOrg.ativa === 1 ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <Switch
                    checked={editingOrg.ativa === 1}
                    onCheckedChange={(checked) => {
                      if (!editingOrg) return;
                      setEditingOrg({ ...editingOrg, ativa: checked ? 1 : 0 });
                    }}
                    className="flex-shrink-0"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Botões de Ação - Fixos na parte inferior */}
          {editingOrg && (
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t flex-shrink-0 mt-auto">
              <Button
                variant="outline"
                onClick={() => {
                  console.log('🔍 Cancelando edição/criação de organização');
                  setIsOrgDialogOpen(false);
                  setEditingOrg(null);
                  setIsCreatingOrg(false);
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
                className="w-full sm:w-auto text-xs sm:text-sm"
                disabled={uploadingLogo}
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSaveOrg}
                disabled={!editingOrg.nome || !editingOrg.codigo || uploadingLogo}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm"
              >
                {uploadingLogo ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white sm:mr-2"></div>
                    <span className="hidden sm:inline">Enviando...</span>
                    <span className="sm:hidden">Enviando</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                    {isCreatingOrg ? 'Criar' : 'Salvar Alterações'}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão de organização */}
      <AlertDialog open={showDeleteOrgDialog} onOpenChange={setShowDeleteOrgDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base lg:text-lg break-words">
              <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 text-red-600 flex-shrink-0" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm lg:text-base break-words">
              Tem certeza que deseja excluir a organização "{orgToDelete?.nome}"? Esta ação não pode ser desfeita.
              <br /><br />
              <strong className="text-red-600">⚠️ ATENÇÃO:</strong> Todos os dados relacionados serão excluídos permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs sm:text-sm break-words">
                <li>Dados da organização</li>
                <li>Configurações e permissões</li>
                <li>Logo e identificação visual</li>
                <li>Histórico de alterações</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={cancelDeleteOrg} className="text-xs lg:text-sm w-full sm:w-auto order-2 sm:order-1">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteOrg}
              className="bg-red-600 hover:bg-red-700 text-xs lg:text-sm w-full sm:w-auto order-1 sm:order-2"
              disabled={deletingOrg}
            >
              {deletingOrg ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Users; 