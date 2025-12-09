import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Download,
  Trash2,
  Plus,
  ArrowLeft,
  Eye,
  Brain,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Landmark,
  Upload
} from 'lucide-react';
import { formatDateBR, formatDateTimeBR } from '@/utils/dateUtils';
import { useToast } from '@/components/ui/use-toast';
import jsPDF from 'jspdf';

const ICMSEqualizacaoSimplificado = () => {
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';
  const [uploading, setUploading] = useState(false);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'create'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para streaming
  const [isProcessingStream, setIsProcessingStream] = useState(false);
  const [processamentoStatus, setProcessamentoStatus] = useState('');
  const [processamentoTexto, setProcessamentoTexto] = useState('');
  const [extratoProcessado, setExtratoProcessado] = useState<any>(null);
  const [extratoProcessandoId, setExtratoProcessandoId] = useState<number | null>(null);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedExtrato, setSelectedExtrato] = useState<any | null>(null);
  const [isExtratoModalOpen, setIsExtratoModalOpen] = useState(false);
  
  // Estados para arquivos enviados na tela
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: number;
    nome: string;
    status: 'enviando' | 'enviado' | 'erro';
    extratoId?: number;
    mimetype?: string;
    error?: string;
  }>>([]);
  
  const { toast } = useToast();

  // Carregar anexos existentes
  useEffect(() => {
    const loadAnexos = async () => {
      try {
        setLoading(true);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const userOrg = currentUser.organizacao || 'cassems';
        
        const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
        const response = await fetch(`${baseUrl}/compliance/icms-equalizacao/anexos`, {
          headers: {
            'x-user-organization': userOrg,
            'x-user-id': currentUser.id?.toString() || ''
          }
        });

        if (response.ok) {
          const data = await response.json();
          setAnexos(data.data || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Erro ao carregar anexos:', response.status, errorData);
        }
      } catch (error) {
        console.error('Erro ao carregar anexos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnexos();
    
    // Recarregar a cada 10 segundos APENAS se houver extratos sendo processados
    const interval = setInterval(async () => {
      setAnexos(currentAnexos => {
        const temProcessando = currentAnexos.some((a: any) => a.status_processamento === 'processando');
        
        if (!temProcessando) {
          return currentAnexos;
        }

        (async () => {
          try {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const userOrg = currentUser.organizacao || 'cassems';
            const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
            const response = await fetch(`${baseUrl}/compliance/icms-equalizacao/anexos`, {
              headers: {
                'x-user-organization': userOrg,
                'x-user-id': currentUser.id?.toString() || ''
              }
            });
            if (response.ok) {
              const data = await response.json();
              setAnexos(data.data || []);
            }
          } catch (error) {
            // Ignorar erros no polling
          }
        })();

        return currentAnexos;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Função para iniciar processamento com streaming
  const iniciarProcessamentoStream = async (extratoId: number) => {
    try {
      setIsProcessingStream(true);
      setProcessamentoStatus('Preparando...');
      setProcessamentoTexto('');
      setExtratoProcessado(null);
      setExtratoProcessandoId(extratoId);
      
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userOrg = currentUser.organizacao || 'cassems';
      
      const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const url = `${baseUrl}/compliance/icms-equalizacao/anexos/${extratoId}/processar-stream`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': userOrg,
          'x-user-id': currentUser.id?.toString() || ''
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`Erro ao iniciar processamento: ${response.status} ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Não foi possível ler a resposta do servidor');
      }
      
      let buffer = '';
      let currentEvent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (buffer.trim()) {
            const remainingLines = buffer.split('\n');
            for (const line of remainingLines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (currentEvent === 'chunk' && data.text) {
                    setProcessamentoTexto(prev => prev + data.text);
                  }
                } catch (e) {
                  // Ignorar
                }
              }
            }
          }
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          
          if (line.trim() === '') {
            currentEvent = '';
            continue;
          }
          
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.substring(6);
              const data = JSON.parse(dataStr);
              
              if (currentEvent === 'status' || (!currentEvent && data.message && !data.text && !data.extrato)) {
                setProcessamentoStatus(data.message || 'Processando...');
              } else if (currentEvent === 'extrato_parcial' || (!currentEvent && data.extrato)) {
                setExtratoProcessado(data.extrato);
                setProcessamentoStatus(`Processando... ${data.extrato?.itens?.length || 0} item(ns) encontrado(s)`);
              } else if (currentEvent === 'chunk' || (!currentEvent && data.text)) {
                setProcessamentoTexto(prev => prev + (data.text || ''));
              } else if (currentEvent === 'complete' || (!currentEvent && data.success)) {
                setProcessamentoStatus('Concluído!');
                
                let extratoEncontrado = data.extrato || null;
                
                // Se o extrato veio no evento, usar ele
                if (extratoEncontrado) {
                  setExtratoProcessado(extratoEncontrado);
                }
                
                // Atualizar status do arquivo no modal
                if (extratoProcessandoId) {
                  setUploadedFiles(prev => prev.map(f => 
                    f.extratoId === extratoProcessandoId
                      ? { ...f, status: 'enviado' }
                      : f
                  ));
                }
                
                // Recarregar lista de anexos e buscar extrato do banco se necessário
                const baseUrlReload = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
                const reloadResponse = await fetch(`${baseUrlReload}/compliance/icms-equalizacao/anexos`, {
                  headers: {
                    'x-user-organization': userOrg,
                    'x-user-id': currentUser.id?.toString() || ''
                  }
                });
                if (reloadResponse.ok) {
                  const reloadData = await reloadResponse.json();
                  setAnexos(reloadData.data || []);
                  
                  // Se não temos o extrato ainda, buscar do anexo recarregado
                  if (!extratoEncontrado && extratoProcessandoId) {
                    const anexoRecarregado = reloadData.data?.find((a: any) => a.id === extratoProcessandoId);
                    if (anexoRecarregado?.extrato_simplificado) {
                      try {
                        const extratoParsed = typeof anexoRecarregado.extrato_simplificado === 'string'
                          ? JSON.parse(anexoRecarregado.extrato_simplificado)
                          : anexoRecarregado.extrato_simplificado;
                        setExtratoProcessado(extratoParsed);
                        extratoEncontrado = extratoParsed;
                      } catch (parseError) {
                        console.error('Erro ao parsear extrato simplificado:', parseError);
                      }
                    }
                  }
                }
                
                toast({
                  title: "Sucesso",
                  description: "Extrato processado com sucesso!",
                });
                // NÃO fechar o modal automaticamente - usuário deve fechar manualmente
              } else if (currentEvent === 'error' || (!currentEvent && data.error)) {
                setProcessamentoStatus('Erro');
                // Atualizar status do arquivo no modal para erro
                if (extratoProcessandoId) {
                  setUploadedFiles(prev => prev.map(f => 
                    f.extratoId === extratoProcessandoId
                      ? { ...f, status: 'erro', error: data.message || data.error || 'Erro ao processar' }
                      : f
                  ));
                }
                toast({
                  title: "Erro",
                  description: data.message || data.error || 'Erro ao processar extrato',
                  variant: "destructive",
                });
              }
            } catch (e) {
              console.error('Erro ao processar evento SSE:', e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Erro no streaming:', error);
      // Atualizar status do arquivo no modal para erro
      if (extratoProcessandoId) {
        setUploadedFiles(prev => prev.map(f => 
          f.extratoId === extratoProcessandoId
            ? { ...f, status: 'erro', error: error.message || 'Erro ao processar extrato' }
            : f
        ));
      }
      toast({
        title: "Erro",
        description: error.message || 'Erro ao processar extrato',
        variant: "destructive",
      });
      setProcessamentoStatus('Erro');
    } finally {
      // NÃO fechar o modal automaticamente - usuário deve fechar manualmente
      // O streaming continua visível mesmo após concluir ou erro
    }
  };

  // Função para validar um arquivo
  const validateFile = (file: File): string | null => {
    const allowedTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
    const allowedExtensions = ['.pdf', '.xls', '.xlsx', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return `Tipo de arquivo não permitido para "${file.name}". Use PDF, XLS, XLSX ou CSV.`;
    }

    if (file.size > 1024 * 1024 * 1024) {
      return `Arquivo "${file.name}" muito grande. O limite máximo é 1GB.`;
    }

    return null;
  };

  // Função para fazer upload de um único arquivo
  const uploadSingleFile = async (file: File): Promise<{ success: boolean; extratoId?: number; mimetype?: string; error?: string }> => {
    const validationError = validateFile(file);
    if (validationError) {
      return { success: false, error: validationError };
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userOrg = currentUser.organizacao || 'cassems';
      
      const formData = new FormData();
      formData.append('anexo', file);

      const baseUrlUpload = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const response = await fetch(`${baseUrlUpload}/compliance/icms-equalizacao/anexos`, {
        method: 'POST',
        headers: {
          'x-user-organization': userOrg,
          'x-user-id': currentUser.id?.toString() || ''
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao fazer upload do arquivo');
      }

      const data = await response.json();
      return {
        success: true,
        extratoId: data.data?.id,
        mimetype: data.data?.mimetype
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao fazer upload do arquivo'
      };
    }
  };

  // Função para processar múltiplos arquivos
  const handleMultipleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) return;

    // Inicializar lista de arquivos na tela
    setUploading(true);
    setUploadProgress({ current: 0, total: fileArray.length });
    
    // Inicializar lista de arquivos
    const initialFiles = fileArray.map((file, index) => ({
      id: index,
      nome: file.name,
      status: 'enviando' as const,
      mimetype: file.type
    }));
    setUploadedFiles(initialFiles);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userOrg = currentUser.organizacao || 'cassems';
    
    const results: Array<{ file: string; success: boolean; error?: string; extratoId?: number; mimetype?: string }> = [];

    // Upload sequencial com atualização do estado
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress({ current: i + 1, total: fileArray.length });

      const result = await uploadSingleFile(file);
      
      // Atualizar status do arquivo no modal
      setUploadedFiles(prev => prev.map(f => 
        f.id === i 
          ? { 
              ...f, 
              status: result.success ? 'enviado' : 'erro',
              extratoId: result.extratoId,
              mimetype: result.mimetype || f.mimetype || file.type, // Preservar mimetype original
              error: result.error
            }
          : f
      ));
      
      if (result.success) {
        results.push({ 
          file: file.name, 
          success: true, 
          extratoId: result.extratoId,
          mimetype: result.mimetype
        });
      } else {
        results.push({ 
          file: file.name, 
          success: false, 
          error: result.error 
        });
      }
    }

    // Recarregar lista completa de anexos e atualizar extratoId nos arquivos enviados
    const baseUrlReload = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
    const reloadResponse = await fetch(`${baseUrlReload}/compliance/icms-equalizacao/anexos`, {
      headers: {
        'x-user-organization': userOrg,
        'x-user-id': currentUser.id?.toString() || ''
      }
    });
    if (reloadResponse.ok) {
      const reloadData = await reloadResponse.json();
      const anexosRecarregados = reloadData.data || [];
      setAnexos(anexosRecarregados);
      
      // Atualizar extratoId nos arquivos enviados baseado na lista recarregada
      setUploadedFiles(prev => prev.map(f => {
        // Tentar encontrar o anexo correspondente pelo nome do arquivo
        const anexoEncontrado = anexosRecarregados.find((a: any) => {
          const nomeAnexo = typeof a.nome_arquivo === 'string' ? a.nome_arquivo : String(a.nome_arquivo || '');
          return nomeAnexo === f.nome || nomeAnexo.includes(f.nome.split('.')[0]);
        });
        
        if (anexoEncontrado && anexoEncontrado.id && !f.extratoId) {
          return {
            ...f,
            extratoId: Number(anexoEncontrado.id),
            mimetype: anexoEncontrado.mimetype || f.mimetype
          };
        }
        
        return f;
      }));
    }

    setUploading(false);
    setUploadProgress(null);
  };
  
  // Função para iniciar processamento de um arquivo específico no modal
  const handleSimplificarExtrato = async (extratoId: number) => {
    if (!extratoId) return;
    await iniciarProcessamentoStream(extratoId);
  };

  const handleFileUpload = async (file: File) => {
    await handleMultipleFileUpload([file]);
  };

  const handleRemoveAnexo = async (anexoId: number) => {
    if (!confirm('Tem certeza que deseja remover este extrato?')) {
      return;
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userOrg = currentUser.organizacao || 'cassems';

      const baseUrlDelete = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const response = await fetch(`${baseUrlDelete}/compliance/icms-equalizacao/anexos/${anexoId}`, {
        method: 'DELETE',
        headers: {
          'x-user-organization': userOrg,
          'x-user-id': currentUser.id?.toString() || ''
        }
      });

      if (response.ok) {
        setAnexos(prev => prev.filter(anexo => anexo.id !== anexoId));
        toast({
          title: "Sucesso",
          description: "Extrato removido com sucesso!",
        });
      } else {
        throw new Error('Erro ao remover extrato');
      }
    } catch (error) {
      console.error('Erro ao remover anexo:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover extrato",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (anexoId: number, filename: string) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userOrg = currentUser.organizacao || 'cassems';
      
      const baseUrl = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const response = await fetch(`${baseUrl}/compliance/icms-equalizacao/anexos/${anexoId}/download`, {
        headers: {
          'x-user-organization': userOrg,
          'x-user-id': currentUser.id?.toString() || ''
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  // Renderizar lista de extratos
  const renderLista = () => (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold">ICMS e Equalização</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Gerencie os extratos do ICMS enviados
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setIsProcessingStream(false);
              setExtratoProcessado(null);
              navigate('/compliance');
            }}
            className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">Voltar</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
          <Button
            onClick={() => setCurrentView('create')}
            className="bg-red-600 hover:bg-red-700 text-white text-xs lg:text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Gerar Extrato Simplificado
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : anexos.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Extratos Enviados ({anexos.length})
            </h2>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nome do Extrato
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Data de Envio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Enviado por
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {anexos.map((anexo) => {
                    if (!anexo || typeof anexo !== 'object') {
                      return null;
                    }
                    
                    const getEnviadoPor = () => {
                      const createdByName = (anexo as any).created_by_nome;
                      const enviadoPor = (anexo as any).enviado_por;
                      
                      if (createdByName && typeof createdByName === 'string' && createdByName.trim()) {
                        return createdByName;
                      }
                      
                      if (enviadoPor && typeof enviadoPor === 'string' && enviadoPor.trim()) {
                        return enviadoPor;
                      }
                      
                      try {
                        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                        if (currentUser.nome && typeof currentUser.nome === 'string') {
                          return currentUser.nome;
                        }
                        if (currentUser.email && typeof currentUser.email === 'string') {
                          return currentUser.email;
                        }
                      } catch (e) {
                        // Ignorar erro de parse
                      }
                      
                      return 'Usuário';
                    };
                    
                    const enviadoPor = getEnviadoPor();
                    
                    const nomeArquivo = typeof anexo.nome_arquivo === 'string' 
                      ? anexo.nome_arquivo 
                      : (anexo.nome_arquivo ? String(anexo.nome_arquivo) : `Extrato ${anexo.id || ''}`);
                    
                    const anexoId = typeof anexo.id === 'number' || typeof anexo.id === 'string' 
                      ? anexo.id 
                      : (anexo.id ? String(anexo.id) : '');
                    
                    return (
                      <tr 
                        key={String(anexoId || Math.random())} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          if (anexo.extrato_simplificado && anexo.status_processamento === 'concluido') {
                            setSelectedExtrato(anexo);
                            setIsExtratoModalOpen(true);
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {nomeArquivo}
                              </span>
                              {(() => {
                                // Verificar se created_at existe e é uma string válida
                                if (!anexo.created_at) return null;
                                if (typeof anexo.created_at !== 'string') {
                                  // Se for objeto, tentar extrair string
                                  if (typeof anexo.created_at === 'object' && anexo.created_at !== null) {
                                    // Objeto vazio ou inválido
                                    if (Object.keys(anexo.created_at).length === 0) return null;
                                  }
                                  return null;
                                }
                                const formattedDate = formatDateTimeBR(anexo.created_at);
                                return formattedDate && formattedDate.trim() !== '' && !formattedDate.includes('Invalid') ? (
                                  <span className="text-xs text-gray-500">
                                    Enviado em {formattedDate}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {(() => {
                            let dateValue: any = anexo.created_at;
                            
                            // Se não existe, retornar '-'
                            if (!dateValue) return '-';
                            
                            // Se for objeto Date, converter para ISO string
                            if (dateValue instanceof Date) {
                              dateValue = dateValue.toISOString();
                            }
                            // Se for objeto, tentar extrair a data
                            else if (typeof dateValue === 'object' && dateValue !== null) {
                              // Se for objeto vazio, retornar '-'
                              if (Object.keys(dateValue).length === 0) return '-';
                              // Tentar extrair propriedades comuns de objetos Date do MySQL/MariaDB
                              if (dateValue.date) {
                                dateValue = dateValue.date;
                              } else if (dateValue.created_at) {
                                dateValue = dateValue.created_at;
                              } else if (dateValue.toISOString && typeof dateValue.toISOString === 'function') {
                                dateValue = dateValue.toISOString();
                              } else if (dateValue.toString && typeof dateValue.toString === 'function') {
                                dateValue = dateValue.toString();
                              } else {
                                // Tentar converter para string
                                dateValue = String(dateValue);
                              }
                            }
                            
                            // Se ainda não for string, converter
                            if (typeof dateValue !== 'string') {
                              dateValue = String(dateValue);
                            }
                            
                            // Se string vazia ou apenas espaços, retornar '-'
                            if (!dateValue || dateValue.trim() === '' || dateValue === 'null' || dateValue === 'undefined') {
                              return '-';
                            }
                            
                            // Formatar a data usando a função utilitária
                            const formattedDate = formatDateBR(dateValue);
                            
                            // Retornar data formatada ou '-'
                            return formattedDate && formattedDate.trim() !== '' && !formattedDate.includes('Invalid') 
                              ? formattedDate 
                              : '-';
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {typeof enviadoPor === 'string' ? enviadoPor : String(enviadoPor || 'Usuário')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const status = typeof anexo.status_processamento === 'string' 
                              ? anexo.status_processamento 
                              : (anexo.status_processamento ? String(anexo.status_processamento) : '');
                            
                            if (status === 'processando') {
                              return (
                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Processando
                                </Badge>
                              );
                            }
                            if (status === 'pendente' && typeof anexo.mimetype === 'string' && anexo.mimetype === 'application/pdf') {
                              return (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Pendente
                                </Badge>
                              );
                            }
                            if (status === 'concluido' && anexo.extrato_simplificado) {
                              return (
                                <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Concluído
                                </Badge>
                              );
                            }
                            if (status === 'erro') {
                              return (
                                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {anexo.status_processamento === 'pendente' && anexo.mimetype === 'application/pdf' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => iniciarProcessamentoStream(Number(anexoId))}
                                disabled={isProcessingStream}
                                className="h-8 w-8 p-0"
                                title="Processar"
                              >
                                <Brain className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(Number(anexoId), nomeArquivo)}
                              className="h-8 w-8 p-0"
                              title="Baixar arquivo original"
                            >
                              <Download className="h-4 w-4 text-gray-600" />
                            </Button>
                            {anexo.extrato_simplificado && anexo.status_processamento === 'concluido' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedExtrato(anexo);
                                  setIsExtratoModalOpen(true);
                                }}
                                className="h-8 w-8 p-0"
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAnexo(Number(anexoId))}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="p-4 bg-red-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Landmark className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-gray-500 mb-4">Nenhum extrato enviado ainda</p>
          <Button
            onClick={() => setCurrentView('create')}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Gerar Extrato Simplificado
          </Button>
        </div>
      )}
    </div>
  );

  // Renderizar tela de criação/upload
  const renderCreate = () => (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold">Gerar Extrato Simplificado</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Faça o upload do extrato do ICMS
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setIsProcessingStream(false);
              setExtratoProcessado(null);
              setCurrentView('list');
            }}
            className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">Voltar</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Upload e lista de arquivos */}
        <div className="space-y-4">
          <Card 
            className={`border-2 border-dashed transition-colors ${
              isDragOver 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-300 hover:border-red-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
              
              const files = e.dataTransfer.files;
              if (files.length > 0) {
                handleMultipleFileUpload(files);
              }
            }}
          >
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-red-50 rounded-full">
                  <Landmark className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Enviar Extrato(s) do ICMS
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Formatos aceitos: PDF, XLS, XLSX ou CSV (máximo 1GB por arquivo)
                    <br />
                    <span className="text-xs text-gray-500">Você pode enviar múltiplos arquivos de uma vez</span>
                  </p>
                </div>
                
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xls,.xlsx,.csv"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleMultipleFileUpload(files);
                      }
                      if (e.target) {
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        {uploadProgress ? `Enviando ${uploadProgress.current}/${uploadProgress.total}...` : 'Enviando...'}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivo(s)
                      </>
                    )}
                  </Button>
                  {uploadProgress && (
                    <div className="w-full max-w-xs mt-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progresso</span>
                        <span>{uploadProgress.current} de {uploadProgress.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de arquivos enviados */}
          {uploadedFiles.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-4">Arquivos Enviados</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`p-3 rounded-lg border ${
                        file.status === 'enviado'
                          ? 'bg-green-50 border-green-200'
                          : file.status === 'erro'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-red-600 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {file.nome}
                            </span>
                          </div>
                          
                          {file.status === 'enviando' && (
                            <div className="flex items-center gap-2 text-xs text-blue-600">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Enviando...</span>
                            </div>
                          )}
                          
                          {file.status === 'enviado' && (
                            <div className="flex items-center gap-2 text-xs text-green-600 mb-2">
                              <CheckCircle className="h-3 w-3" />
                              <span>Enviado com sucesso</span>
                            </div>
                          )}
                          
                          {file.status === 'erro' && (
                            <div className="flex items-center gap-2 text-xs text-red-600 mb-2">
                              <AlertCircle className="h-3 w-3" />
                              <span>{file.error || 'Erro ao enviar'}</span>
                            </div>
                          )}
                          
                          {/* Botão removido - agora está no centro da tela */}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Streaming e resultado */}
        <div>
          {isProcessingStream && extratoProcessandoId ? (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    {processamentoStatus === 'Concluído!' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : processamentoStatus === 'Erro' ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                    )}
                    <h3 className="text-lg font-semibold">Processamento com IA</h3>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700">{processamentoStatus || 'Preparando...'}</p>
                  </div>
                  
                  {extratoProcessado ? (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-blue-900">Extrato Simplificado</p>
                          <p className="text-xs text-blue-700 mt-0.5">ICMS EQUALIZAÇÃO SIMPLES NACIONAL</p>
                        </div>
                        {processamentoStatus.includes('Concluído') && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      
                      {extratoProcessado.empresa?.razao_social && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-600">Empresa:</p>
                          <p className="text-sm font-medium text-gray-900">{extratoProcessado.empresa.razao_social}</p>
                        </div>
                      )}
                      
                      {extratoProcessado.itens && Array.isArray(extratoProcessado.itens) && extratoProcessado.itens.length > 0 ? (
                        <div className="space-y-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-blue-100">
                                  <th className="border border-blue-300 px-2 py-1 text-left">Referência</th>
                                  <th className="border border-blue-300 px-2 py-1 text-left">Pagamento</th>
                                  <th className="border border-blue-300 px-2 py-1 text-left">Número DAEMS</th>
                                  <th className="border border-blue-300 px-2 py-1 text-right">Valor Principal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {extratoProcessado.itens.map((item: any, idx: number) => {
                                  const valor = typeof item.valor_principal === 'number' 
                                    ? item.valor_principal.toFixed(2).replace('.', ',')
                                    : item.valor_principal;
                                  return (
                                    <tr key={idx} className={`hover:bg-blue-50 ${!processamentoStatus.includes('Concluído') ? 'animate-pulse' : ''}`}>
                                      <td className="border border-blue-200 px-2 py-1">{item.referencia || '-'}</td>
                                      <td className="border border-blue-200 px-2 py-1">{item.pagamento || '-'}</td>
                                      <td className="border border-blue-200 px-2 py-1">{item.numero_daems || '-'}</td>
                                      <td className="border border-blue-200 px-2 py-1 text-right font-medium">R$ {valor}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              {extratoProcessado.total !== undefined && (
                                <tfoot>
                                  <tr className="bg-blue-200 font-bold">
                                    <td colSpan={3} className="border border-blue-300 px-2 py-2 text-right">TOTAL:</td>
                                    <td className="border border-blue-300 px-2 py-2 text-right">
                                      R$ {typeof extratoProcessado.total === 'number' 
                                        ? extratoProcessado.total.toFixed(2).replace('.', ',')
                                        : extratoProcessado.total}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                          
                          {extratoProcessado.total !== undefined && (
                            <div className="bg-green-50 border border-green-200 rounded p-2">
                              <p className="text-xs text-green-800">
                                <strong>Total pago em ICMS EQUALIZAÇÃO SIMPLES NACIONAL:</strong> R$ {typeof extratoProcessado.total === 'number' 
                                  ? extratoProcessado.total.toFixed(2).replace('.', ',')
                                  : extratoProcessado.total}
                              </p>
                            </div>
                          )}

                          {processamentoStatus.includes('Concluído') && (
                            <div className="flex justify-end mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const doc = new jsPDF();
                                    const primaryColor: [number, number, number] = [59, 130, 246];
                                    const lightBlue: [number, number, number] = [239, 246, 255];
                                    const darkBlue: [number, number, number] = [30, 64, 175];
                                    
                                    let yPos = 20;
                                    
                                    doc.setFontSize(18);
                                    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
                                    doc.setFont('helvetica', 'bold');
                                    doc.text('EXTRATO SIMPLIFICADO', 105, yPos, { align: 'center' });
                                    
                                    yPos += 8;
                                    doc.setFontSize(12);
                                    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                                    doc.setFont('helvetica', 'normal');
                                    doc.text('ICMS EQUALIZAÇÃO SIMPLES NACIONAL', 105, yPos, { align: 'center' });
                                    
                                    yPos += 15;
                                    
                                    if (extratoProcessado.empresa?.razao_social || extratoProcessado.empresa?.inscricao_estadual) {
                                      doc.setFontSize(11);
                                      doc.setTextColor(0, 0, 0);
                                      doc.setFont('helvetica', 'bold');
                                      doc.text('DADOS DA EMPRESA', 20, yPos);
                                      yPos += 7;
                                      
                                      doc.setFont('helvetica', 'normal');
                                      if (extratoProcessado.empresa?.razao_social) {
                                        doc.text(`Razão Social: ${extratoProcessado.empresa.razao_social}`, 20, yPos);
                                        yPos += 6;
                                      }
                                      if (extratoProcessado.empresa?.inscricao_estadual) {
                                        doc.text(`Inscrição Estadual: ${extratoProcessado.empresa.inscricao_estadual}`, 20, yPos);
                                        yPos += 6;
                                      }
                                      yPos += 5;
                                    }
                                    
                                    if (extratoProcessado.itens && extratoProcessado.itens.length > 0) {
                                      const tableTop = yPos;
                                      const colHeaders = ['Referência', 'Pagamento', 'Número DAEMS', 'Valor Principal'];
                                      const colX = [20, 60, 100, 155];
                                      
                                      doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
                                      doc.rect(20, tableTop - 8, 170, 10, 'F');
                                      
                                      doc.setFontSize(10);
                                      doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
                                      doc.setFont('helvetica', 'bold');
                                      colHeaders.forEach((header, idx) => {
                                        doc.text(header, colX[idx], tableTop);
                                      });
                                      
                                      yPos = tableTop + 8;
                                      
                                      doc.setFontSize(9);
                                      doc.setTextColor(0, 0, 0);
                                      doc.setFont('helvetica', 'normal');
                                      
                                      extratoProcessado.itens.forEach((item: any, idx: number) => {
                                        if (idx % 2 === 0) {
                                          doc.setFillColor(249, 250, 251);
                                          doc.rect(20, yPos - 6, 170, 7, 'F');
                                        }
                                        
                                        const valor = typeof item.valor_principal === 'number' 
                                          ? item.valor_principal.toFixed(2).replace('.', ',')
                                          : item.valor_principal;
                                        
                                        doc.text(item.referencia || '-', colX[0], yPos);
                                        doc.text(item.pagamento || '-', colX[1], yPos);
                                        doc.text(item.numero_daems || '-', colX[2], yPos);
                                        doc.text(`R$ ${valor}`, colX[3], yPos, { align: 'right' });
                                        
                                        yPos += 7;
                                        
                                        if (yPos > 270) {
                                          doc.addPage();
                                          yPos = 20;
                                        }
                                      });
                                      
                                      yPos += 3;
                                      doc.setFillColor(219, 234, 254);
                                      doc.rect(20, yPos - 6, 170, 8, 'F');
                                      
                                      doc.setFontSize(10);
                                      doc.setFont('helvetica', 'bold');
                                      doc.text('TOTAL:', colX[2], yPos);
                                      
                                      const total = typeof extratoProcessado.total === 'number' 
                                        ? extratoProcessado.total.toFixed(2).replace('.', ',')
                                        : extratoProcessado.total;
                                      doc.text(`R$ ${total}`, colX[3], yPos, { align: 'right' });
                                      
                                      yPos += 12;
                                      
                                      doc.setFillColor(220, 252, 231);
                                      doc.rect(20, yPos, 170, 10, 'F');
                                      
                                      doc.setFontSize(10);
                                      doc.setTextColor(22, 101, 52);
                                      doc.setFont('helvetica', 'bold');
                                      const totalText = `Total pago em ICMS EQUALIZAÇÃO SIMPLES NACIONAL: R$ ${total}`;
                                      doc.text(totalText, 105, yPos + 7, { align: 'center' });
                                    }
                                    
                                    const pageCount = doc.getNumberOfPages();
                                    for (let i = 1; i <= pageCount; i++) {
                                      doc.setPage(i);
                                      doc.setFontSize(8);
                                      doc.setTextColor(150, 150, 150);
                                      doc.text(
                                        `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
                                        105,
                                        285,
                                        { align: 'center' }
                                      );
                                    }
                                    
                                    const fileName = `extrato-simplificado-icms-equalizacao.pdf`;
                                    doc.save(fileName);
                                    
                                    toast({
                                      title: "Sucesso",
                                      description: "PDF gerado com sucesso!",
                                    });
                                  } catch (error) {
                                    console.error('Erro ao gerar PDF:', error);
                                    toast({
                                      title: "Erro",
                                      description: "Erro ao gerar PDF",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Baixar PDF
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          {processamentoStatus.includes('Concluído') 
                            ? 'Nenhum item de ICMS EQUALIZAÇÃO SIMPLES NACIONAL encontrado neste extrato.'
                            : 'Processando... Aguarde enquanto a IA analisa o documento.'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 text-center">
                        {processamentoStatus.includes('Concluído') 
                          ? 'Aguardando dados do extrato...'
                          : 'Aguardando processamento...'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm mb-4">Envie um arquivo PDF e clique em "Simplificar Extrato" para ver o processamento</p>
                  
                  {/* Botão Simplificar Extrato no centro */}
                  {(() => {
                    // Encontrar o primeiro arquivo PDF enviado que pode ser simplificado
                    const arquivoParaSimplificar = uploadedFiles.find((file) => {
                      if (file.status !== 'enviado') return false;
                      const isPDF = file.mimetype === 'application/pdf' || file.nome.toLowerCase().endsWith('.pdf');
                      if (!isPDF) return false;
                      
                      // Se já tem extratoId, usar ele
                      if (file.extratoId) return true;
                      
                      // Caso contrário, tentar encontrar na lista de anexos
                      const anexoEncontrado = anexos.find((a: any) => 
                        a.nome_arquivo === file.nome || 
                        (typeof a.nome_arquivo === 'string' && a.nome_arquivo.includes(file.nome.split('.')[0]))
                      );
                      
                      return anexoEncontrado && anexoEncontrado.id;
                    });
                    
                    if (arquivoParaSimplificar) {
                      const extratoId = arquivoParaSimplificar.extratoId || 
                        (() => {
                          const anexoEncontrado = anexos.find((a: any) => 
                            a.nome_arquivo === arquivoParaSimplificar.nome || 
                            (typeof a.nome_arquivo === 'string' && a.nome_arquivo.includes(arquivoParaSimplificar.nome.split('.')[0]))
                          );
                          return anexoEncontrado ? Number(anexoEncontrado.id) : null;
                        })();
                      
                      if (extratoId) {
                        return (
                          <Button
                            size="lg"
                            onClick={() => handleSimplificarExtrato(extratoId)}
                            disabled={isProcessingStream && extratoProcessandoId === extratoId}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {isProcessingStream && extratoProcessandoId === extratoId ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                <Brain className="h-4 w-4 mr-2" />
                                Simplificar Extrato
                              </>
                            )}
                          </Button>
                        );
                      }
                    }
                    
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {currentView === 'list' ? renderLista() : renderCreate()}
      
      {/* Modal de detalhes do extrato simplificado */}
      <Dialog open={isExtratoModalOpen} onOpenChange={setIsExtratoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Extrato Simplificado</DialogTitle>
            <DialogDescription>
              ICMS EQUALIZAÇÃO SIMPLES NACIONAL
            </DialogDescription>
          </DialogHeader>
          
          {selectedExtrato && (() => {
            try {
              const extrato = typeof selectedExtrato.extrato_simplificado === 'string' 
                ? JSON.parse(selectedExtrato.extrato_simplificado) 
                : selectedExtrato.extrato_simplificado;
              
              if (extrato.itens && extrato.itens.length > 0) {
                return (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 font-medium">Arquivo:</p>
                          <p className="text-gray-900">{selectedExtrato.nome_arquivo || `Extrato ${selectedExtrato.id}`}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 font-medium">Data de Envio:</p>
                          <p className="text-gray-900">
                            {(() => {
                              if (!selectedExtrato.created_at) return '-';
                              // Se for objeto vazio, retornar '-'
                              if (typeof selectedExtrato.created_at === 'object' && selectedExtrato.created_at !== null) {
                                if (Object.keys(selectedExtrato.created_at).length === 0) return '-';
                              }
                              // Se não for string, tentar converter
                              if (typeof selectedExtrato.created_at !== 'string') return '-';
                              const formattedDate = formatDateTimeBR(selectedExtrato.created_at);
                              return formattedDate && formattedDate.trim() !== '' && !formattedDate.includes('Invalid') ? formattedDate : '-';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {extrato.empresa?.razao_social && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-xs text-gray-600 mb-1">Empresa:</p>
                        <p className="text-sm font-semibold text-gray-900">{extrato.empresa.razao_social}</p>
                        {extrato.empresa.inscricao_estadual && (
                          <p className="text-xs text-gray-600 mt-1">
                            Inscrição Estadual: {extrato.empresa.inscricao_estadual}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-blue-100">
                            <th className="border border-blue-300 px-3 py-2 text-left font-semibold">Referência</th>
                            <th className="border border-blue-300 px-3 py-2 text-left font-semibold">Pagamento</th>
                            <th className="border border-blue-300 px-3 py-2 text-left font-semibold">Número DAEMS</th>
                            <th className="border border-blue-300 px-3 py-2 text-right font-semibold">Valor Principal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extrato.itens.map((item: any, idx: number) => {
                            const valor = typeof item.valor_principal === 'number' 
                              ? item.valor_principal.toFixed(2).replace('.', ',')
                              : item.valor_principal;
                            return (
                              <tr key={idx} className="hover:bg-blue-50">
                                <td className="border border-blue-200 px-3 py-2">{item.referencia || '-'}</td>
                                <td className="border border-blue-200 px-3 py-2">{item.pagamento || '-'}</td>
                                <td className="border border-blue-200 px-3 py-2">{item.numero_daems || '-'}</td>
                                <td className="border border-blue-200 px-3 py-2 text-right font-medium">R$ {valor}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-blue-200 font-bold">
                            <td colSpan={3} className="border border-blue-300 px-3 py-3 text-right">TOTAL:</td>
                            <td className="border border-blue-300 px-3 py-3 text-right">
                              R$ {typeof extrato.total === 'number' 
                                ? extrato.total.toFixed(2).replace('.', ',')
                                : extrato.total}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 font-semibold">
                        Total pago em ICMS EQUALIZAÇÃO SIMPLES NACIONAL: R$ {typeof extrato.total === 'number' 
                          ? extrato.total.toFixed(2).replace('.', ',')
                          : extrato.total}
                      </p>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            const extrato = typeof selectedExtrato.extrato_simplificado === 'string' 
                              ? JSON.parse(selectedExtrato.extrato_simplificado) 
                              : selectedExtrato.extrato_simplificado;
                            
                            const doc = new jsPDF();
                            const primaryColor: [number, number, number] = [59, 130, 246];
                            const lightBlue: [number, number, number] = [239, 246, 255];
                            const darkBlue: [number, number, number] = [30, 64, 175];
                            
                            let yPos = 20;
                            
                            doc.setFontSize(18);
                            doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
                            doc.setFont('helvetica', 'bold');
                            doc.text('EXTRATO SIMPLIFICADO', 105, yPos, { align: 'center' });
                            
                            yPos += 8;
                            doc.setFontSize(12);
                            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                            doc.setFont('helvetica', 'normal');
                            doc.text('ICMS EQUALIZAÇÃO SIMPLES NACIONAL', 105, yPos, { align: 'center' });
                            
                            yPos += 15;
                            
                            if (extrato.empresa?.razao_social || extrato.empresa?.inscricao_estadual) {
                              doc.setFontSize(11);
                              doc.setTextColor(0, 0, 0);
                              doc.setFont('helvetica', 'bold');
                              doc.text('DADOS DA EMPRESA', 20, yPos);
                              yPos += 7;
                              
                              doc.setFont('helvetica', 'normal');
                              if (extrato.empresa?.razao_social) {
                                doc.text(`Razão Social: ${extrato.empresa.razao_social}`, 20, yPos);
                                yPos += 6;
                              }
                              if (extrato.empresa?.inscricao_estadual) {
                                doc.text(`Inscrição Estadual: ${extrato.empresa.inscricao_estadual}`, 20, yPos);
                                yPos += 6;
                              }
                              yPos += 5;
                            }
                            
                            if (extrato.itens && extrato.itens.length > 0) {
                              const tableTop = yPos;
                              const colHeaders = ['Referência', 'Pagamento', 'Número DAEMS', 'Valor Principal'];
                              const colX = [20, 60, 100, 155];
                              
                              doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
                              doc.rect(20, tableTop - 8, 170, 10, 'F');
                              
                              doc.setFontSize(10);
                              doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
                              doc.setFont('helvetica', 'bold');
                              colHeaders.forEach((header, idx) => {
                                doc.text(header, colX[idx], tableTop);
                              });
                              
                              yPos = tableTop + 8;
                              
                              doc.setFontSize(9);
                              doc.setTextColor(0, 0, 0);
                              doc.setFont('helvetica', 'normal');
                              
                              extrato.itens.forEach((item: any, idx: number) => {
                                if (idx % 2 === 0) {
                                  doc.setFillColor(249, 250, 251);
                                  doc.rect(20, yPos - 6, 170, 7, 'F');
                                }
                                
                                const valor = typeof item.valor_principal === 'number' 
                                  ? item.valor_principal.toFixed(2).replace('.', ',')
                                  : item.valor_principal;
                                
                                doc.text(item.referencia || '-', colX[0], yPos);
                                doc.text(item.pagamento || '-', colX[1], yPos);
                                doc.text(item.numero_daems || '-', colX[2], yPos);
                                doc.text(`R$ ${valor}`, colX[3], yPos, { align: 'right' });
                                
                                yPos += 7;
                                
                                if (yPos > 270) {
                                  doc.addPage();
                                  yPos = 20;
                                }
                              });
                              
                              yPos += 3;
                              doc.setFillColor(219, 234, 254);
                              doc.rect(20, yPos - 6, 170, 8, 'F');
                              
                              doc.setFontSize(10);
                              doc.setFont('helvetica', 'bold');
                              doc.text('TOTAL:', colX[2], yPos);
                              
                              const total = typeof extrato.total === 'number' 
                                ? extrato.total.toFixed(2).replace('.', ',')
                                : extrato.total;
                              doc.text(`R$ ${total}`, colX[3], yPos, { align: 'right' });
                              
                              yPos += 12;
                              
                              doc.setFillColor(220, 252, 231);
                              doc.rect(20, yPos, 170, 10, 'F');
                              
                              doc.setFontSize(10);
                              doc.setTextColor(22, 101, 52);
                              doc.setFont('helvetica', 'bold');
                              const totalText = `Total pago em ICMS EQUALIZAÇÃO SIMPLES NACIONAL: R$ ${total}`;
                              doc.text(totalText, 105, yPos + 7, { align: 'center' });
                            }
                            
                            const pageCount = doc.getNumberOfPages();
                            for (let i = 1; i <= pageCount; i++) {
                              doc.setPage(i);
                              doc.setFontSize(8);
                              doc.setTextColor(150, 150, 150);
                              doc.text(
                                `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
                                105,
                                285,
                                { align: 'center' }
                              );
                            }
                            
                            const fileName = `extrato-simplificado-${selectedExtrato.nome_arquivo?.replace('.pdf', '') || 'icms-equalizacao'}.pdf`;
                            doc.save(fileName);
                            
                            toast({
                              title: "Sucesso",
                              description: "PDF gerado com sucesso!",
                            });
                          } catch (error) {
                            console.error('Erro ao gerar PDF:', error);
                            toast({
                              title: "Erro",
                              description: "Erro ao gerar PDF",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Baixar Extrato Simplificado (PDF)
                      </Button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-600">
                      Nenhum item de ICMS EQUALIZAÇÃO SIMPLES NACIONAL encontrado neste extrato.
                    </p>
                  </div>
                );
              }
            } catch (error) {
              return (
                <div className="text-center py-8">
                  <p className="text-gray-600">Erro ao carregar extrato simplificado.</p>
                </div>
              );
            }
          })()}
        </DialogContent>
      </Dialog>
      
      {/* Dialog de processamento com streaming (mantido para compatibilidade) */}
      <Dialog open={isProcessingStream && currentView === 'list'} onOpenChange={(open) => {
        if (!open) {
          setIsProcessingStream(false);
          setExtratoProcessado(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Processando Extrato com IA</DialogTitle>
            <DialogDescription>
              Analisando o PDF e extraindo informações de ICMS EQUALIZAÇÃO SIMPLES NACIONAL...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {processamentoStatus === 'Concluído!' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : processamentoStatus === 'Erro' ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              )}
              <p className="text-sm font-medium">{processamentoStatus}</p>
            </div>
            
            {extratoProcessado && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Extrato Simplificado</p>
                    <p className="text-xs text-blue-700 mt-0.5">ICMS EQUALIZAÇÃO SIMPLES NACIONAL</p>
                  </div>
                  {processamentoStatus.includes('Concluído') && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
                
                {extratoProcessado.empresa?.razao_social && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-600">Empresa:</p>
                    <p className="text-sm font-medium text-gray-900">{extratoProcessado.empresa.razao_social}</p>
                  </div>
                )}
                
                {extratoProcessado.itens && extratoProcessado.itens.length > 0 ? (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-blue-100">
                            <th className="border border-blue-300 px-2 py-1 text-left">Referência</th>
                            <th className="border border-blue-300 px-2 py-1 text-left">Pagamento</th>
                            <th className="border border-blue-300 px-2 py-1 text-left">Número DAEMS</th>
                            <th className="border border-blue-300 px-2 py-1 text-right">Valor Principal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extratoProcessado.itens.map((item: any, idx: number) => {
                            const valor = typeof item.valor_principal === 'number' 
                              ? item.valor_principal.toFixed(2).replace('.', ',')
                              : item.valor_principal;
                            return (
                              <tr key={idx} className={`hover:bg-blue-50 ${!processamentoStatus.includes('Concluído') ? 'animate-pulse' : ''}`}>
                                <td className="border border-blue-200 px-2 py-1">{item.referencia || '-'}</td>
                                <td className="border border-blue-200 px-2 py-1">{item.pagamento || '-'}</td>
                                <td className="border border-blue-200 px-2 py-1">{item.numero_daems || '-'}</td>
                                <td className="border border-blue-200 px-2 py-1 text-right font-medium">R$ {valor}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {extratoProcessado.total !== undefined && (
                          <tfoot>
                            <tr className="bg-blue-200 font-bold">
                              <td colSpan={3} className="border border-blue-300 px-2 py-2 text-right">TOTAL:</td>
                              <td className="border border-blue-300 px-2 py-2 text-right">
                                R$ {typeof extratoProcessado.total === 'number' 
                                  ? extratoProcessado.total.toFixed(2).replace('.', ',')
                                  : extratoProcessado.total}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                    
                    {extratoProcessado.total !== undefined && (
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <p className="text-xs text-green-800">
                          <strong>Total pago em ICMS EQUALIZAÇÃO SIMPLES NACIONAL:</strong> R$ {typeof extratoProcessado.total === 'number' 
                            ? extratoProcessado.total.toFixed(2).replace('.', ',')
                            : extratoProcessado.total}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    Processando... Aguarde enquanto a IA analisa o documento.
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsProcessingStream(false);
                setCurrentView('list');
              }}
            >
              {extratoProcessado ? 'Ver Extratos' : 'Fechar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ICMSEqualizacaoSimplificado;

