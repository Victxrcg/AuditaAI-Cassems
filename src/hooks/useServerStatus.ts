import { useState, useEffect } from 'react';

interface ServerStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastCheck: Date | null;
  retryCount: number;
}

export const useServerStatus = () => {
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: true,
    isChecking: false,
    lastCheck: null,
    retryCount: 0
  });

  const checkServerStatus = async (): Promise<boolean> => {
    setStatus(prev => ({ ...prev, isChecking: true }));
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        signal: AbortSignal.timeout(10000) // 10 segundos de timeout
      });
      
      const isOnline = response.ok;
      
      setStatus(prev => ({
        ...prev,
        isOnline,
        isChecking: false,
        lastCheck: new Date(),
        retryCount: prev.retryCount + 1
      }));
      
      return isOnline;
    } catch (error) {
      console.log('Erro ao verificar status do servidor:', error);
      
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        lastCheck: new Date(),
        retryCount: prev.retryCount + 1
      }));
      
      return false;
    }
  };

  // Verificação inicial
  useEffect(() => {
    checkServerStatus();
  }, []);

  // Auto-retry a cada 30 segundos quando offline
  useEffect(() => {
    if (!status.isOnline && !status.isChecking) {
      const interval = setInterval(() => {
        checkServerStatus();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [status.isOnline, status.isChecking]);

  return {
    ...status,
    checkServerStatus
  };
};
