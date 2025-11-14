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
import AcessoNegado from "./pages/AcessoNegado";
import { useServerStatus } from "./hooks/useServerStatus";
import ProtectedRoute from "./components/ProtectedRoute";

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
        <Route 
          path="/compliance" 
          element={
            <ProtectedRoute requiredPermission="compliance">
              <Layout><Compliance tipoCompliance="rat-fat" /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/compliance/rat-fat" 
          element={
            <ProtectedRoute requiredPermission="compliance">
              <Layout><Compliance tipoCompliance="rat-fat" /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/compliance/subvencao-fiscal" 
          element={
            <ProtectedRoute requiredPermission="compliance">
              <Layout><Compliance tipoCompliance="subvencao-fiscal" /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/compliance/terceiros" 
          element={
            <ProtectedRoute requiredPermission="compliance">
              <Layout><Compliance tipoCompliance="terceiros" /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/cronograma" 
          element={
            <ProtectedRoute requiredPermission="cronograma">
              <Layout><Cronograma /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documentos" 
          element={
            <ProtectedRoute requiredPermission="documentos">
              <Layout><Documentos /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/usuarios" 
          element={
            <ProtectedRoute requiredPermission="usuarios">
              <Layout><Users /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ajuda" 
          element={
            <ProtectedRoute requiredPermission="ajuda">
              <Layout><Ajuda /></Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/acesso-negado"
          element={
            <ProtectedRoute>
              <Layout><AcessoNegado /></Layout>
            </ProtectedRoute>
          }
        />
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
