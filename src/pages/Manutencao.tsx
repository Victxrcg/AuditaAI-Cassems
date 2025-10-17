import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wrench, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Server,
  Users,
  Shield
} from 'lucide-react';

export default function Manutencao() {
  const [retryCount, setRetryCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkServerStatus = async () => {
    setIsChecking(true);
    setRetryCount(prev => prev + 1);
    setLastCheck(new Date());
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        // Servidor está funcionando, redirecionar
        window.location.reload();
      }
    } catch (error) {
      console.log('Servidor ainda não está disponível:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRetry = () => {
    checkServerStatus();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  // Auto-retry a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      checkServerStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header com logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Compliance App</h1>
              <p className="text-sm text-gray-600">Cassems</p>
            </div>
          </div>
        </div>

        {/* Card principal */}
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Wrench className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-2xl text-gray-900 mb-2">
              Sistema em Manutenção
            </CardTitle>
            <p className="text-gray-600">
              Estamos atualizando o sistema para melhorar sua experiência
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Status atual */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">Sistema temporariamente indisponível</p>
                  <p className="text-sm text-orange-700">
                    Nossa equipe está trabalhando para restaurar o serviço o mais rápido possível
                  </p>
                </div>
              </div>
            </div>

            {/* Informações de status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Server className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Servidor</p>
                <p className="text-xs text-gray-600">Atualizando</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Usuários</p>
                <p className="text-xs text-gray-600">Temporariamente offline</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Shield className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Segurança</p>
                <p className="text-xs text-gray-600">Dados protegidos</p>
              </div>
            </div>

            {/* Estatísticas de verificação */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 text-blue-600 ${isChecking ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-medium text-blue-800">Verificação automática</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {retryCount} tentativas
                </Badge>
              </div>
              
              {lastCheck && (
                <p className="text-xs text-blue-700">
                  Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
                </p>
              )}
              
              <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                <Clock className="w-3 h-3" />
                <span>Verificando a cada 30 segundos automaticamente</span>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleRetry}
                disabled={isChecking}
                className="flex-1"
                size="lg"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Verificando...' : 'Verificar Agora'}
              </Button>
              
              <Button 
                onClick={handleRefresh}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar Página
              </Button>
            </div>

            {/* Informações adicionais */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">
                Se o problema persistir por mais de 15 minutos, entre em contato com o suporte
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>• Dados seguros</span>
                <span>• Backup automático</span>
                <span>• Retorno em breve</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            © 2024 Compliance App - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
