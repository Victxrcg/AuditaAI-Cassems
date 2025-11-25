import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';

interface CronogramaAlerta {
  id: number;
  tipo: 'cronograma' | 'checklist';
  cronograma_id: number;
  checklist_id?: number | null;
  organizacao: string;
  titulo: string;
  descricao?: string | null;
  created_at: string;
  created_by?: number | null;
  created_by_nome?: string | null;
  acknowledged: boolean;
  acknowledged_at?: string | null;
}

const NotificationBell = () => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';
  const [notificacoes, setNotificacoes] = useState<CronogramaAlerta[]>([]);
  const [loading, setLoading] = useState(false);
  const [ackLoadingId, setAckLoadingId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const ultimaOrganizacaoRef = useRef<string | null>(null);

  const getCurrentUser = () => {
    try {
      const user = localStorage.getItem('user');
      if (!user) return null;
      return JSON.parse(user);
    } catch {
      return null;
    }
  };

  const fetchNotificacoes = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      const userOrg = currentUser.organizacao || 'cassems';
      const params: string[] = [];

      // Para usuários Portes, verificar se há organização selecionada no cronograma
      // Para outros usuários, sempre filtrar pela organização do usuário
      if (userOrg === 'portes') {
        // Verificar se há organização selecionada no localStorage
        const organizacaoSelecionada = localStorage.getItem('cronograma-empresa-selecionada');
        if (organizacaoSelecionada && organizacaoSelecionada !== 'todos') {
          // Filtrar apenas pela organização selecionada
          params.push(`organizacao=${encodeURIComponent(organizacaoSelecionada)}`);
        } else {
          // Se não houver organização selecionada, não carregar notificações
          // para evitar misturar notificações de diferentes empresas
          setNotificacoes([]);
          setLoading(false);
          return;
        }
      } else {
        // Para usuários não-Portes, sempre filtrar pela organização do usuário
        params.push(`organizacao=${encodeURIComponent(userOrg)}`);
      }

      const query = params.length ? `?${params.join('&')}` : '';

      const response = await fetch(`${API_BASE}/cronograma/alertas${query}`, {
        headers: {
          'x-user-organization': userOrg,
          'x-user-id': currentUser.id?.toString() || ''
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar notificações');
      }

      const data = await response.json();
      const lista = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      // Filtrar apenas notificações não reconhecidas
      const pendentes = (lista as CronogramaAlerta[]).filter(alerta => !alerta.acknowledged);
      
      setNotificacoes(pendentes);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const acknowledgeNotificacao = useCallback(async (alertaId: number) => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;

    try {
      setAckLoadingId(alertaId);
      const response = await fetch(`${API_BASE}/cronograma/alertas/${alertaId}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser.organizacao || 'cassems',
          'x-user-id': currentUser.id?.toString() || ''
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao marcar notificação como lida');
      }

      // Remover notificação da lista
      setNotificacoes(prev => prev.filter(notif => notif.id !== alertaId));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    } finally {
      setAckLoadingId(null);
    }
  }, [API_BASE]);

  const marcarTodasComoLidas = useCallback(async () => {
    if (notificacoes.length === 0) return;
    
    try {
      // Marcar todas as notificações como lidas em paralelo
      await Promise.all(notificacoes.map(notif => acknowledgeNotificacao(notif.id)));
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
    }
  }, [notificacoes, acknowledgeNotificacao]);

  // Verificar se houve um novo login e carregar notificações apenas nesse caso
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;

    // Verificar se há um timestamp de login recente
    const ultimoLoginTimestamp = localStorage.getItem('ultimo_login_timestamp');
    const ultimaBuscaNotificacoes = localStorage.getItem('ultima_busca_notificacoes');
    
    // Se não há timestamp de última busca OU se o login é mais recente que a última busca
    // significa que é um novo login, então buscar notificações
    if (!ultimaBuscaNotificacoes || (ultimoLoginTimestamp && parseInt(ultimoLoginTimestamp) > parseInt(ultimaBuscaNotificacoes))) {
      fetchNotificacoes().then(() => {
        // Salvar timestamp da busca atual
        if (ultimoLoginTimestamp) {
          localStorage.setItem('ultima_busca_notificacoes', ultimoLoginTimestamp);
        }
      }).catch(() => {
        // Ignorar erros silenciosamente
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez ao montar

  // Recarregar quando o popover abrir (apenas uma vez ao abrir)
  useEffect(() => {
    if (isOpen) {
      // Atualizar a referência da organização ao abrir
      const currentUser = getCurrentUser();
      if (currentUser) {
        if (currentUser.organizacao === 'portes') {
          ultimaOrganizacaoRef.current = localStorage.getItem('cronograma-empresa-selecionada');
        } else {
          ultimaOrganizacaoRef.current = currentUser.organizacao || 'cassems';
        }
      }
      // Usar setTimeout para evitar fechar o popover imediatamente
      const timeoutId = setTimeout(() => {
        fetchNotificacoes();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Remover fetchNotificacoes das dependências para evitar loop

  const contadorNotificacoes = notificacoes.length;

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
        >
          <Bell className="h-5 w-5" />
          {contadorNotificacoes > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {contadorNotificacoes > 99 ? '99+' : contadorNotificacoes}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0 max-h-[500px] flex flex-col" align="end">
        <div className="flex flex-col h-full max-h-[500px]">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-base">Notificações</h3>
              {contadorNotificacoes > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {contadorNotificacoes} {contadorNotificacoes === 1 ? 'nova' : 'novas'}
                </Badge>
              )}
            </div>
            {(() => {
              const currentUser = getCurrentUser();
              const organizacaoSelecionada = currentUser?.organizacao === 'portes' 
                ? localStorage.getItem('cronograma-empresa-selecionada')
                : null;
              const organizacaoAtual = organizacaoSelecionada 
                ? organizacaoSelecionada
                : (currentUser?.organizacao || 'cassems');
              
              if (currentUser?.organizacao === 'portes' && organizacaoSelecionada) {
                const nomeOrg = organizacaoAtual
                  .replace(/_/g, ' ')
                  .split(' ')
                  .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
                return (
                  <p className="text-xs text-muted-foreground">
                    Mostrando notificações de: <span className="font-medium">{nomeOrg}</span>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          {/* Lista de Notificações */}
          {loading ? (
            <div className="flex-shrink-0 p-4 text-center text-sm text-muted-foreground">
              Carregando notificações...
            </div>
          ) : (() => {
            const currentUser = getCurrentUser();
            const isPortesSemOrganizacao = currentUser?.organizacao === 'portes' && 
              !localStorage.getItem('cronograma-empresa-selecionada');
            
            if (isPortesSemOrganizacao) {
              return (
                <div className="flex-shrink-0 p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Selecione uma empresa no Cronograma para ver as notificações
                  </p>
                </div>
              );
            }
            
            if (contadorNotificacoes === 0) {
              return (
                <div className="flex-shrink-0 p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma notificação nova
                  </p>
                </div>
              );
            }
            
            return (
            <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: '350px' }}>
              <div className="p-2">
                {notificacoes.map((notif) => (
                    <Card
                      key={notif.id}
                      className="mb-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-blue-900 break-words">
                              {notif.titulo}
                            </p>
                            <p className="text-xs text-blue-700 mt-1 break-words">
                              {new Date(notif.created_at).toLocaleString('pt-BR')}
                              {notif.created_by_nome && ` por ${notif.created_by_nome}`}
                            </p>
                            {notif.descricao && (
                              <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap break-words">
                                {notif.descricao}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => acknowledgeNotificacao(notif.id)}
                            disabled={ackLoadingId === notif.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-2 flex-shrink-0"
                          >
                            {ackLoadingId === notif.id ? '...' : 'Ciente'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </ScrollArea>
            );
          })()}

          {/* Footer */}
          {(() => {
            const currentUser = getCurrentUser();
            const isPortesSemOrganizacao = currentUser?.organizacao === 'portes' && 
              !localStorage.getItem('cronograma-empresa-selecionada');
            
            if (contadorNotificacoes > 0 && !isPortesSemOrganizacao) {
              return (
                <div className="flex-shrink-0 p-3 border-t bg-muted/50">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={marcarTodasComoLidas}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={loading || ackLoadingId !== null}
                  >
                    Marcar todas como lidas
                  </Button>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;

