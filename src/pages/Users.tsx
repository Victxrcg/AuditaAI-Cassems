import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, User, Mail, Shield, CheckCircle, XCircle, Key, Calendar, Clock, Building } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface UserRow {
  id: number;
  email: string;
  nome: string | null;
  perfil: string;
  ativo: number;
  created_at?: string;
  updated_at?: string;
  organizacao?: 'cassems' | 'portes';
}

const Users = () => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Carregar usuário atual do localStorage
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/usuarios`);
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

  useEffect(() => { fetchUsers(); }, []);

  const resetPassword = async (userId: number, userName: string) => {
    if (!currentUser || currentUser.organizacao !== 'portes') {
      toast({
        title: "Acesso Negado",
        description: "Apenas usuários da PORTES podem resetar senhas.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
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

  const getRoleBadge = (perfil: string) => {
    const config = {
      admin: { label: 'Administrador', className: 'bg-red-100 text-red-800 border-red-200' },
      auditor: { label: 'Auditor', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      compliance: { label: 'Compliance', className: 'bg-green-100 text-green-800 border-green-200' },
      viewer: { label: 'Visualizador', className: 'bg-gray-100 text-gray-800 border-gray-200' }
    };
    const roleConfig = config[perfil as keyof typeof config] || config.viewer;
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

  const getOrganizationBadge = (organizacao: string) => {
    return organizacao === 'cassems' ? (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 border">
        <Building className="h-3 w-3 mr-1" />
        CASSEMS
      </Badge>
    ) : (
      <Badge className="bg-green-100 text-green-800 border-green-200 border">
        <Building className="h-3 w-3 mr-1" />
        PORTES
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Usuários do Sistema</h1>
          <p className="text-gray-600">Gerencie os usuários e suas permissões</p>
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

                    {/* Organização */}
                    <div className="lg:col-span-2">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-medium">Organização</div>
                        {getOrganizationBadge(user.organizacao || 'cassems')}
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resetPassword(user.id, user.nome || user.email)}
                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          >
                            <Key className="h-4 w-4 mr-1" />
                            Resetar Senha
                          </Button>
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
    </div>
  );
};

export default Users; 