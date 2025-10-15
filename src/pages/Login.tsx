import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Shield, TrendingUp, Users, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Redireciona para o dashboard se já estiver autenticado
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (step === 'credentials') {
        // 1) validar credenciais no backend
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, senha: password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          // Usuário ativo: login direto
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('user', JSON.stringify(data.user));
          navigate('/dashboard');
          toast({ title: 'Login realizado com sucesso!' });
        } else if (data.error === 'Usuário inativo' || (data.error && data.error.toLowerCase().includes('inativo'))) {
          // Usuário precisa confirmar e-mail - não reenviar código, apenas pedir
          setStep('code');
          toast({ title: 'Confirme seu email', description: 'Digite o código que foi enviado para seu email no cadastro.' });
        } else {
          toast({ title: 'Erro no login', description: data.error || 'Credenciais inválidas.', variant: 'destructive' });
        }
      } else {
        // step === 'code' -> verificar código
        const verifyRes = await fetch(`${API_BASE}/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          // Tentar login novamente agora que o email foi confirmado
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha: password })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          navigate('/dashboard');
          toast({ title: 'Email confirmado!', description: 'Acesso autorizado.' });
        } else {
          toast({ title: 'Código inválido', description: verifyData.error || 'Verifique e tente novamente.', variant: 'destructive' });
        }
      }
    } catch (err) {
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível conectar ao servidor.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex justify-center items-center">

        {/* Right Side - Login Form */}
        <div className="flex flex-col justify-center">
          <Card className="bg-white/90 shadow-2xl border border-gray-200 rounded-2xl backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary rounded-xl">
                  <Shield className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl">Acesso ao Sistema</CardTitle>
              <CardDescription>
                Entre com suas credenciais para acessar o painel administrativo
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {step === 'credentials' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="text"
                        placeholder="Digite seu email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Digite sua senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-12 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="code">Código de verificação</Label>
                      <Input
                        id="code"
                        type="text"
                        placeholder="Digite o código de 6 dígitos"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                        required
                        className="h-12 tracking-widest text-center"
                      />
                    </div>
                    <div className="text-right text-sm">
                      <button type="button" className="text-primary hover:underline"
                        onClick={async ()=>{
                          setIsLoading(true);
                          try{
                            const r = await fetch(`${API_BASE}/auth/send-code`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
                            const d = await r.json();
                            if(r.ok && d.success){
                              toast({title:'Código reenviado', description:'Verifique seu email.'});
                            } else {
                              toast({title:'Erro ao reenviar', description:d.error||'Tente novamente.', variant:'destructive'});
                            }
                          }finally{ setIsLoading(false); }
                        }}
                      >Reenviar código</button>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      {step === 'credentials' ? 'Validando...' : 'Verificando...'}
                    </div>
                  ) : (
                    step === 'credentials' ? 'Continuar' : 'Confirmar código'
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Não tem conta? {" "}
                  <Link to="/registrar" className="text-primary hover:underline">Cadastre-se</Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;