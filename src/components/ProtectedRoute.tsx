import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string; // ID da página (ex: 'compliance', 'cronograma')
}

const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  // Escutar evento de atualização de permissões
  useEffect(() => {
    const handlePermissionsUpdate = () => {
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('userPermissionsUpdated', handlePermissionsUpdate);
    
    return () => {
      window.removeEventListener('userPermissionsUpdated', handlePermissionsUpdate);
    };
  }, []);
  
  // Verificar autenticação
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se não especificar permissão, permitir acesso (páginas públicas autenticadas)
  if (!requiredPermission) {
    return <>{children}</>;
  }

  // Verificar permissão
  try {
    const raw = localStorage.getItem('user');
    if (!raw) {
      return <Navigate to="/login" replace />;
    }
    
    const user = JSON.parse(raw);
    
    // Usuários Portes sempre têm acesso a tudo
    if (user?.organizacao?.toLowerCase() === 'portes') {
      return <>{children}</>;
    }
    
    // Se não tiver campo permissoes ou for null/empty, tem acesso a tudo
    if (!user?.permissoes) {
      return <>{children}</>;
    }
    
    // Parse permissoes se for string JSON
    let permissoesArray: string[] = [];
    if (typeof user.permissoes === 'string') {
      try {
        permissoesArray = JSON.parse(user.permissoes);
      } catch {
        // Se não conseguir parsear, permitir acesso
        return <>{children}</>;
      }
    } else if (Array.isArray(user.permissoes)) {
      permissoesArray = user.permissoes;
    }
    
    // Se array vazio, tem acesso a tudo
    if (permissoesArray.length === 0) {
      return <>{children}</>;
    }
    
    // Verificar se a página está na lista de permissões
    if (permissoesArray.includes(requiredPermission)) {
      return <>{children}</>;
    }
    
    // Sem permissão - redirecionar para página inicial (cronograma)
    return <Navigate to="/cronograma" replace />;
  } catch {
    // Em caso de erro, permitir acesso por segurança
    return <>{children}</>;
  }
};

export default ProtectedRoute;

