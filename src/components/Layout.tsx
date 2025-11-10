import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, Menu, ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mostrarBotaoVoltar, setMostrarBotaoVoltar] = useState(false);

  // Função para voltar à seleção de empresas (apenas para Portes na página de cronograma)
  const handleVoltarSelecao = () => {
    localStorage.removeItem('cronograma-empresa-selecionada');
    // Recarregar a página para mostrar a tela de seleção
    window.location.reload();
  };

  // Verificar se deve mostrar o botão voltar
  useEffect(() => {
    const verificarBotaoVoltar = () => {
      if (location.pathname !== '/cronograma') {
        setMostrarBotaoVoltar(false);
        return;
      }
      
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const empresaSelecionada = localStorage.getItem('cronograma-empresa-selecionada');
        const deveMostrar = !!(user?.organizacao === 'portes' && empresaSelecionada);
        setMostrarBotaoVoltar(deveMostrar);
      } catch {
        setMostrarBotaoVoltar(false);
      }
    };

    verificarBotaoVoltar();
    
    // Verificar periodicamente (a cada 500ms) para detectar mudanças no localStorage
    const interval = setInterval(verificarBotaoVoltar, 500);
    
    return () => clearInterval(interval);
  }, [location.pathname]);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [navigate, location]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/cronograma':
        return 'Cronograma';
      case '/audios':
        return 'Áudios';
      case '/auditoria':
        return 'Auditoria';
      case '/auditoria':
        return 'Auditoria';
      case '/auditoria':
        return 'Auditoria';
      case '/acesso-negado':
        return 'Acesso Negado';
      default:
        return 'Compliance';
    }
  };

  return (
    <div className="h-screen bg-background flex">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile Sidebar */}
      {isMobile && (
        <Sidebar 
          isOpen={sidebarOpen} 
          onOpenChange={setSidebarOpen}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button is now part of the Sidebar component */}
            <h1 className={`text-xl font-semibold text-foreground truncate ${isMobile ? 'ml-14' : ''}`}>
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {mostrarBotaoVoltar && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleVoltarSelecao}
                className="text-xs md:text-sm botao-voltar-animado"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Voltar
              </Button>
            )}
          </div>
          <style>{`
            @keyframes slideInFromRight {
              from {
                opacity: 0;
                transform: translateX(20px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateX(0) scale(1);
              }
            }
            .botao-voltar-animado {
              animation: slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;