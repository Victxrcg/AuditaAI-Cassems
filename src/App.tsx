import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";
import Compliance from "./pages/Compliance";
import Register from "./pages/Register";
import Users from "./pages/Users";
import Cronograma from "./pages/Cronograma";
import Documentos from "./pages/Documentos";
import Ajuda from "./pages/Ajuda";
import Manutencao from "./pages/Manutencao";
import { useServerStatus } from "./hooks/useServerStatus";

const queryClient = new QueryClient();

const AppContent = () => {
  const { isOnline } = useServerStatus();

  // Se o servidor estiver offline, mostrar página de manutenção
  if (!isOnline) {
    return <Manutencao />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registrar" element={<Register />} />
        <Route path="/compliance" element={<Layout><Compliance /></Layout>} />
        <Route path="/cronograma" element={<Layout><Cronograma /></Layout>} />
        <Route path="/documentos" element={<Layout><Documentos /></Layout>} />
        <Route path="/usuarios" element={<Layout><Users /></Layout>} />
        <Route path="/ajuda" element={<Layout><Ajuda /></Layout>} />
        {/* Redireciona / e /dashboard para /cronograma */}
        <Route path="/" element={<Navigate to="/cronograma" />} />
        <Route path="/dashboard" element={<Navigate to="/cronograma" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
