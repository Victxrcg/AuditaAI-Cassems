import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, RefreshCw, User, Mail, Shield, CheckCircle, XCircle, Key, Calendar, Clock, Building, Edit, Save, X } from 'lucide-react';
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
}

const Users = () => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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

  const updateUser = async (userId: number, userData: Partial<UserRow>) => {
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
        toast({
          title: "Usuário Atualizado",
          description: `Usuário foi atualizado com sucesso.`,
        });
        
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
      compliance: 'Compliance'
    };
    return profiles[perfil as keyof typeof profiles] || perfil;
  };

  const getRoleBadge = (perfil: string) => {
    const config = {
      admin: { label: 'Administrador', className: 'bg-red-100 text-red-800 border-red-200' },
      compliance: { label: 'Compliance', className: 'bg-green-100 text-green-800 border-green-200' }
    };
    const roleConfig = config[perfil as keyof typeof config] || config.compliance;
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
    setEditingUser({...user});
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (editingUser) {
      updateUser(editingUser.id, {
        perfil: editingUser.perfil,
        organizacao: editingUser.organizacao,
        ativo: editingUser.ativo
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Usuários do Sistema</h1>
          <p className="text-gray-600">
            {currentUser?.organizacao === 'portes' 
              ? 'Gerencie todos os usuários do sistema' 
              : `Usuários da ${currentUser?.nome_empresa || currentUser?.organizacao_nome || 'sua organização'}`
            }
          </p>
          {currentUser?.organizacao !== 'portes' && (
            <p className="text-sm text-blue-600 mt-1">
              ℹ️ Você está visualizando apenas os usuários da sua organização
            </p>
          )}
        </div>
        <Button variant="outline" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Recarregar
        </Button>
      </div>

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
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Avatar e Info Básica */}
                    <div className="lg:col-span-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{user.nome || 'Sem nome'}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Empresa */}
                    <div className="lg:col-span-2">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Empresa</div>
                        {getOrganizationBadge(user)}
                      </div>
                    </div>

                    {/* Perfil */}
                    <div className="lg:col-span-2">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Perfil</div>
                        {getRoleBadge(user.perfil)}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="lg:col-span-2">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Status</div>
                        {getStatusBadge(user.ativo)}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="lg:col-span-2">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Ações</div>
                        {currentUser?.organizacao === 'portes' ? (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                              className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resetPassword(user.id, user.nome || user.email)}
                              className="text-orange-600 border-orange-300 hover:bg-orange-50"
                            >
                              <Key className="h-4 w-4 mr-1" />
                              Resetar
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
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">Criado em:</span>
                        <span>{formatDate(user.created_at || '')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Última atualização:</span>
                        <span>{formatDate(user.updated_at || '')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição Completo */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-6">
              {/* Informações do Usuário */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Usuário</label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-semibold">{editingUser.nome}</p>
                  <p className="text-sm text-gray-600">{editingUser.email}</p>
                </div>
              </div>
              
              {/* Organização */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Organização</label>
                <Select
                  value={editingUser.organizacao || 'cassems'}
                  onValueChange={(value) => setEditingUser({...editingUser, organizacao: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cassems">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        CASSEMS
                      </div>
                    </SelectItem>
                    <SelectItem value="portes">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        PORTES
                      </div>
                    </SelectItem>
                    <SelectItem value="rede_frota">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        REDE FROTA
                      </div>
                    </SelectItem>
                    {/* Adicionar outras organizações dinamicamente se necessário */}
                  </SelectContent>
                </Select>
              </div>

              {/* Perfil */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Perfil</label>
                <Select
                  value={editingUser.perfil}
                  onValueChange={(value) => setEditingUser({...editingUser, perfil: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Administrador - Acesso total ao sistema
                      </div>
                    </SelectItem>
                    <SelectItem value="compliance">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Compliance - Focado em compliance fiscal
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Ativo/Inativo */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {editingUser.ativo === 1 ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      {editingUser.ativo === 1 ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <Switch
                    checked={editingUser.ativo === 1}
                    onCheckedChange={(checked) => setEditingUser({...editingUser, ativo: checked ? 1 : 0})}
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    editingUser.perfil === users.find(u => u.id === editingUser.id)?.perfil &&
                    editingUser.organizacao === users.find(u => u.id === editingUser.id)?.organizacao &&
                    editingUser.ativo === users.find(u => u.id === editingUser.id)?.ativo
                  }
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users; 