import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";

const Register = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (senha !== confirmSenha) {
      toast({ title: 'Senhas não conferem', description: 'Digite a mesma senha nos dois campos.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    // Validação de senha
    if (senha.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/registrar`, { // Mudança: de /api/register para /api/auth/registrar
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ 
          title: 'Cadastro realizado!', 
          description: 'Agora você já pode fazer login.' 
        });
        setNome(""); 
        setEmail(""); 
        setSenha(""); 
        setConfirmSenha("");
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        toast({ 
          title: 'Erro no cadastro', 
          description: data.error || 'Tente novamente.', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      toast({ 
        title: 'Erro de conexão', 
        description: 'Não foi possível enviar seu cadastro.', 
        variant: 'destructive' 
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/90 shadow-2xl border border-gray-200 rounded-2xl backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>Cadastre-se para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              Já possui conta? {" "}
              <Link to="/login" className="text-primary hover:underline">Voltar ao login</Link>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input 
                placeholder="Digite seu nome completo" 
                value={nome} 
                onChange={e => setNome(e.target.value)} 
                required 
                minLength={2}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email" 
                placeholder="Digite seu email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <p className="text-xs text-gray-500 mt-1">
                Use um email válido para receber notificações
              </p>
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Crie uma senha"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  className="pr-10"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Mínimo de 6 caracteres
              </p>
            </div>
            <div>
              <Label>Confirmar senha</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmSenha}
                  onChange={e => setConfirmSenha(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {senha && confirmSenha && senha !== confirmSenha && (
                <p className="text-sm text-red-500 mt-1">As senhas não conferem.</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || (senha.length > 0 && confirmSenha.length > 0 && senha !== confirmSenha) || senha.length < 6}
            >
              {isLoading ? 'Enviando...' : 'Cadastrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register; 