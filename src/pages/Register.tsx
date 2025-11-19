import { useState, useEffect } from "react";
import { Eye, EyeOff, Building, Mail, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const Register = () => {
  const [searchParams] = useSearchParams();
  const orgCodigo = searchParams.get('org'); // Pega o parâmetro 'org' da URL
  
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [orgInfo, setOrgInfo] = useState<{ nome: string; codigo: string } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';

  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<{ value: string; label: string }[]>([
    { value: 'cassems', label: 'CASSEMS' },
    { value: 'portes', label: 'PORTES ADVOGADOS' },
    { value: 'rede_frota', label: 'MARAJÓ / REDE FROTA' }
  ]);

  // Buscar organizações do backend
  useEffect(() => {
    const fetchOrganizacoes = async () => {
      try {
        const res = await fetch(`${API_BASE}/organizacoes`, {
          headers: {
            'x-user-organization': 'portes'
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          const orgs = data.data || data || [];
          
          // Mapear organizações para formato de select
          const orgsFormatadas = orgs
            .filter((org: any) => org.ativa === 1) // Apenas organizações ativas
            .map((org: any) => ({
              value: org.codigo,
              label: org.nome
            }));
          
          if (orgsFormatadas.length > 0) {
            setEmpresasDisponiveis(orgsFormatadas);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar organizações:', error);
        // Manter lista padrão em caso de erro
      }
    };

    fetchOrganizacoes();
  }, []);

  // Se tiver código de organização na URL, buscar informações da organização
  useEffect(() => {
    if (orgCodigo) {
      const fetchOrgInfo = async () => {
        try {
          const res = await fetch(`${API_BASE}/organizacoes`, {
            headers: {
              'x-user-organization': 'portes'
            }
          });
          
          if (res.ok) {
            const data = await res.json();
            const orgs = data.data || data || [];
            const org = orgs.find((o: any) => o.codigo === orgCodigo);
            
            if (org) {
              setOrgInfo({ nome: org.nome, codigo: org.codigo });
              setNomeEmpresa(org.codigo); // Pré-selecionar a organização
            } else {
              // Organização não encontrada, mas ainda podemos usar o código
              setOrgInfo({ nome: orgCodigo.split('_').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' '), codigo: orgCodigo });
              setNomeEmpresa(orgCodigo);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar informações da organização:', error);
          // Mesmo com erro, usar o código fornecido
          setOrgInfo({ nome: orgCodigo.split('_').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' '), codigo: orgCodigo });
          setNomeEmpresa(orgCodigo);
        }
      };

      fetchOrgInfo();
    }
  }, [orgCodigo, API_BASE]);

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

    // Validação do nome da empresa (não obrigatório se tiver código de organização na URL)
    if (!orgCodigo && !nomeEmpresa.trim()) {
      toast({ title: 'Empresa obrigatória', description: 'Selecione uma empresa da lista.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    try {
      const body: any = { nome, email, senha };
      
      // Se tiver código de organização na URL, enviar ele
      if (orgCodigo) {
        body.organizacaoCodigo = orgCodigo;
        // Se tiver nome da empresa, também enviar
        if (nomeEmpresa) {
          body.nomeEmpresa = nomeEmpresa;
        }
      } else {
        // Comportamento normal: enviar nomeEmpresa
        body.nomeEmpresa = nomeEmpresa;
      }

      const res = await fetch(`${API_BASE}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ 
          title: 'Cadastro realizado!', 
          description: 'Enviamos um código de verificação para seu email. Verifique sua caixa de entrada.' 
        });
        // Mudar para a etapa de verificação
        setStep('verify');
        // Limpar campos sensíveis, mas manter email
        setSenha(""); 
        setConfirmSenha("");
      } else {
        // Se o erro for de email não verificado, mostrar tela de verificação
        if (data.needsVerification) {
          toast({ 
            title: 'Email já cadastrado', 
            description: data.message || 'Reenviamos um código de verificação para seu email.' 
          });
          setStep('verify');
          setSenha("");
          setConfirmSenha("");
        } else {
          toast({ 
            title: 'Erro no cadastro', 
            description: data.error || 'Tente novamente.', 
            variant: 'destructive' 
          });
        }
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const res = await fetch(`${API_BASE}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast({ 
          title: 'Email verificado!', 
          description: 'Sua conta foi ativada. Você já pode fazer login.' 
        });
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        toast({ 
          title: 'Código inválido', 
          description: data.error || 'Verifique o código e tente novamente.', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      toast({ 
        title: 'Erro de conexão', 
        description: 'Não foi possível verificar o código.', 
        variant: 'destructive' 
      });
    }
    
    setIsVerifying(false);
  };

  const handleResendCode = async () => {
    setIsResending(true);
    
    try {
      const res = await fetch(`${API_BASE}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast({ 
          title: 'Código reenviado!', 
          description: 'Um novo código foi enviado para seu email.' 
        });
      } else {
        toast({ 
          title: 'Erro ao reenviar', 
          description: data.error || 'Tente novamente mais tarde.', 
          variant: 'destructive' 
        });
      }
    } catch (err) {
      toast({ 
        title: 'Erro de conexão', 
        description: 'Não foi possível reenviar o código.', 
        variant: 'destructive' 
      });
    }
    
    setIsResending(false);
  };

  // Se estiver na etapa de verificação, mostrar tela de código
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/90 shadow-2xl border border-gray-200 rounded-2xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary rounded-xl">
                <Mail className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Verificar Email</CardTitle>
            <CardDescription>
              Digite o código de 6 dígitos que enviamos para {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <Label>Código de verificação</Label>
                <Input 
                  type="text" 
                  placeholder="000000" 
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite o código de 6 dígitos enviado para seu email
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isVerifying || verificationCode.length !== 6}
              >
                {isVerifying ? 'Verificando...' : 'Verificar código'}
              </Button>
              
              <div className="text-center space-y-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendCode}
                  disabled={isResending}
                  className="w-full text-sm"
                >
                  {isResending ? 'Reenviando...' : 'Não recebeu o código? Reenviar'}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('register')}
                  className="w-full text-sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao cadastro
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/90 shadow-2xl border border-gray-200 rounded-2xl backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Criar conta</CardTitle>
          <CardDescription>Cadastre-se para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-base text-muted-foreground">
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
            {orgCodigo && orgInfo ? (
              <div>
                <Label>Organização</Label>
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md border border-primary/20">
                  <Building className="h-4 w-4 text-primary" />
                  <span className="font-medium">{orgInfo.nome}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Você está se cadastrando para a organização {orgInfo.nome}
                </p>
              </div>
            ) : (
              <div>
                <Label>Empresa</Label>
                <Select value={nomeEmpresa} onValueChange={setNomeEmpresa} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresasDisponiveis.map((empresa) => (
                      <SelectItem key={empresa.value} value={empresa.value}>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <span>{empresa.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione a empresa onde você trabalha
                </p>
              </div>
            )}
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