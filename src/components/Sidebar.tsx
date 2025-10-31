import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Calendar, 
  Users, 
  FileText, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  BarChart3,
  Volume2,
  Bell,
  HelpCircle,
  XCircle,
  AlertCircleIcon,
  ClipboardList,
  Menu
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Sidebar = ({ isOpen, onOpenChange }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [permissionsKey, setPermissionsKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const getCurrentUserName = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return 'Usuário';
      const u = JSON.parse(raw);
      return u?.nome || u?.username || 'Usuário';
    } catch {
      return 'Usuário';
    }
  };

  const getCurrentUserInitials = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return 'U';
      const u = JSON.parse(raw);
      const name = u?.nome || u?.username || '';
      if (name.length >= 2) {
        return name.substring(0, 2).toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    } catch {
      return 'U';
    }
  };

  const getCurrentCompanyName = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return 'Cassems';
      const u = JSON.parse(raw);
      return u?.nome_empresa || u?.organizacao_nome || 'Cassems';
    } catch {
      return 'Cassems';
    }
  };

  const isRedeFrota = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const u = JSON.parse(raw);
      const org = u?.organizacao?.toLowerCase() || '';
      return org === 'rede_frota' || org === 'marajó / rede frota';
    } catch {
      return false;
    }
  };

  // Verificar se usuário tem permissão para acessar uma página
  const temPermissao = (paginaId: string) => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return true; // Se não tiver usuário, permitir acesso (página de login)
      const u = JSON.parse(raw);
      
      // Usuários Portes sempre têm acesso a tudo
      if (u?.organizacao?.toLowerCase() === 'portes') {
        return true;
      }
      
      // Se não tiver campo permissoes ou for null/empty, tem acesso a tudo
      if (!u?.permissoes) {
        return true;
      }
      
      // Parse permissoes se for string JSON
      let permissoesArray: string[] = [];
      if (typeof u.permissoes === 'string') {
        try {
          permissoesArray = JSON.parse(u.permissoes);
        } catch {
          return true; // Se não conseguir parsear, permitir acesso
        }
      } else if (Array.isArray(u.permissoes)) {
        permissoesArray = u.permissoes;
      }
      
      // Se array vazio, tem acesso a tudo
      if (permissoesArray.length === 0) {
        return true;
      }
      
      // Verificar se a página está na lista de permissões
      return permissoesArray.includes(paginaId);
    } catch {
      return true; // Em caso de erro, permitir acesso
    }
  };

  const allMenuItems = [
    { 
      name: "Cronograma", 
      icon: Calendar, 
      path: "/cronograma",
      id: "cronograma",
      badge: null
    },
    { 
      name: "Compliance", 
      icon: Shield, 
      path: "/compliance",
      id: "compliance",
      badge: null
    },
    {
      name: "Documentos",
      icon: FileText,
      path: "/documentos",
      id: "documentos",
      badge: null
    },
    {
      name: "Usuários",
      icon: Users,
      path: "/usuarios",
      id: "usuarios",
      badge: null
    },
    {
      name: "Ajuda",
      icon: HelpCircle,
      path: "/ajuda",
      id: "ajuda",
      badge: null
    }
  ];

  // Filtrar itens do menu baseado nas permissões do usuário
  // Usar permissionsKey para forçar re-render quando permissões mudarem
  const menuItems = React.useMemo(() => {
    return allMenuItems.filter(item => {
      // Usuários Portes sempre veem tudo
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u?.organizacao?.toLowerCase() === 'portes') {
            return true;
          }
        }
      } catch {
        // Continuar
      }
      
      // Verificar se tem permissão para esta página
      return temPermissao(item.id);
    });
  }, [permissionsKey]); // Re-executar quando permissionsKey mudar

  const bottomMenuItems = [
    // Removido o item Configurações
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    navigate('/login');
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Sync with parent component
  useEffect(() => {
    if (onOpenChange && isMobile) {
      onOpenChange(mobileOpen);
    }
  }, [mobileOpen, onOpenChange, isMobile]);

  useEffect(() => {
    if (isOpen !== undefined && isMobile) {
      setMobileOpen(isOpen);
    }
  }, [isOpen, isMobile]);

  // Escutar evento de atualização de permissões
  useEffect(() => {
    const handlePermissionsUpdate = () => {
      // Forçar re-render do componente quando permissões forem atualizadas
      setPermissionsKey(prev => prev + 1);
    };

    window.addEventListener('userPermissionsUpdated', handlePermissionsUpdate);
    
    return () => {
      window.removeEventListener('userPermissionsUpdated', handlePermissionsUpdate);
    };
  }, []);

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {(!collapsed || isMobile) && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">Compliance App</h1>
                <p className="text-sm text-sidebar-foreground">{getCurrentCompanyName()}</p>      
              </div>
            </div>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0 hover:bg-sidebar-accent"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-sidebar-foreground" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-sidebar-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={`flex items-center py-2 rounded-lg transition-colors sidebar-item
              ${(collapsed && !isMobile) ? 'justify-center px-0 gap-0' : 'gap-3 px-3'}
              ${isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
            `}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isMobile) && (
              <>
                <span className="text-sm font-medium">{item.name}</span>
                {item.badge && (
                  <Badge 
                    variant="secondary" 
                    className="ml-auto text-xs h-5 bg-primary/10 text-primary"
                  >
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        ))}
        
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {/* User Info */}
        <div className="flex items-center gap-3 px-3 py-2">
          {!collapsed && (
            <>
            <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-bold">
                {getCurrentUserInitials()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {getCurrentUserName()}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                Usuário
              </div>
            </div>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={`h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 ${
              collapsed ? 'mx-auto' : ''
            }`}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        
        {bottomMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors sidebar-item ${
              isActive(item.path) 
                ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="text-sm font-medium">{item.name}</span>}
          </NavLink>
        ))}
      </div>
    </>
  );

  // Mobile version with Sheet
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 h-10 w-10 bg-background/80 backdrop-blur-sm border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-68 p-0 bg-sidebar border-sidebar-border">
          <div className="h-full flex flex-col">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop version
  return (
    <div className={`${collapsed ? 'w-16' : 'w-68'} h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300`}>
      <SidebarContent />
    </div>
  );
};

export default Sidebar;