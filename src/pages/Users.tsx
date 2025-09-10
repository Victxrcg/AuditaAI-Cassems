import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface UserRow {
  id: number;
  username: string;
  email: string;
  nome: string | null;
  status: 'ativo' | 'inativo';
  role: 'admin' | 'auditor' | 'compliance' | 'viewer';
  created_at?: string;
}

const Users = () => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

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
      console.log('📋 Tipo de data:', typeof data);
      console.log('📋 É array?', Array.isArray(data));
      console.log('📋 Quantidade de usuários:', data?.length || 0);

      // Garante que data seja sempre um array
      const usersArray = Array.isArray(data) ? data : [];
      console.log('📋 Array final de usuários:', usersArray);
      console.log('📋 Quantidade no array final:', usersArray.length);

      setUsers(usersArray);
    } catch (error) {
      console.error('Erro na requisição:', error);
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateUser = async (id: number, patch: Partial<UserRow>) => {
    await fetch(`${API_BASE}/api/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Usuários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div>Carregando...</div>}
          {!loading && users.length === 0 && <div>Nenhum usuário encontrado.</div>}
          {!loading && users.map(u => (
            <div key={u.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center border rounded-md p-3">
              <div className="md:col-span-2">
                <div className="text-sm font-medium">{u.nome || '-'} </div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div>
                <Select value={u.role} onValueChange={(val) => updateUser(u.id, { role: val as any })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Leitor</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={u.status} onValueChange={(val) => updateUser(u.id, { status: val as any })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Input defaultValue={u.nome || ''} placeholder="Nome" onBlur={(e) => e.target.value !== (u.nome || '') && updateUser(u.id, { nome: e.target.value })} />
                <Input defaultValue={u.email} placeholder="Email" onBlur={(e) => e.target.value !== u.email && updateUser(u.id, { email: e.target.value })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button variant="outline" onClick={fetchUsers}>Recarregar</Button>
      </div>
    </div>
  );
};

export default Users; 