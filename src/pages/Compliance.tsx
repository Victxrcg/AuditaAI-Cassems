import { useState, useCallback, useMemo, useEffect, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  MessageSquare,
  Plus,
  ArrowLeft,
  Eye,
  Pencil,
  Brain,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Lock,
  Mail,
  FileBarChart,
  Landmark,
  Briefcase,
  ArrowRight,
  Users,
  Receipt,
  Wallet,
  Search,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  uploadAnexo,
  listAnexos,
  downloadAnexo,
  removeAnexo,
  getTipoAnexoFromItemId,
  formatFileSize,
  validateFileType,
  validateFileSize,
  getFileIcon,
  type Anexo,
  listAnexosByCategory,
  getCategoryName
} from '@/services/anexosService';
import { formatDateBR, formatDateTimeBR, formatCompetenciaTitle } from '@/utils/dateUtils';
import { useToast } from '@/components/ui/use-toast';
import jsPDF from 'jspdf';
import { ComplianceItem, Competencia, HistoricoAlteracao, ComplianceProps } from '@/components/compliance/types';
import ComplianceSelection from '@/components/compliance/ComplianceSelection';
import ICMSEqualizacaoSimplificado from '@/components/compliance/ICMSEqualizacaoSimplificado';
import HistoricoAlteracoes from '@/components/compliance/HistoricoAlteracoes';
import ComplianceItemSkeleton from '@/components/compliance/ComplianceItemSkeleton';
import FirstAccessForm from '@/components/compliance/FirstAccessForm';
import { 
  initializeComplianceItems, 
  canGenerateAIParecer, 
  canAccessStep,
  getTipoComplianceName,
  getLeisVigentes,
  getStatusLeisVigentes,
  loadCardsState,
  formatOrganizationName,
  lightenColor,
  darkenColor
} from '@/components/compliance/utils';
import { getOrganizationBadge, getEditIndicator } from '@/components/compliance/components';

// Funções utilitárias movidas para @/components/compliance/utils.ts
// Importar quando necessário: import { formatOrganizationName, lightenColor, darkenColor, canGenerateAIParecer, canAccessStep } from '@/components/compliance/utils';

// Funções getOrganizationBadge e getEditIndicator movidas para utils.ts

// Componente separado para ComplianceItemCard
const ComplianceItemCard = memo(({
  item,
  onFieldChange,
  onFileUpload,
  onRemoveFile,
  onSave,
  gerarParecer,
  getStatusBadge,
  loading,
  currentCompetenciaId,
  onToggleExpanded,
  downloadParecerPDF,
  complianceItems,
  apiBase,
  currentUserEmail,
  competenciaPeriodo
}: {
  item: ComplianceItem;
  onFieldChange: (id: string, field: 'valor' | 'data' | 'observacoes' | 'emailRemetente' | 'emailDestinatario' | 'emailAssunto' | 'emailEnviado', value: string | boolean) => void;
  onFileUpload: (id: string, file: File) => Promise<any>;
  onRemoveFile: (id: string, anexoId: number) => void;
  onSave: (id: string) => void;
  gerarParecer: (id: string) => void;
  getStatusBadge: (status: string) => JSX.Element;
  loading: boolean;
  currentCompetenciaId: string | null;
  onToggleExpanded: (id: string) => void;
  downloadParecerPDF: (parecerText: string) => void;
  complianceItems: ComplianceItem[];
  apiBase: string;
  currentUserEmail?: string;
  competenciaPeriodo?: string;
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>(item.anexos || []);
  const [canAccess, setCanAccess] = useState(true);
  const [canGenerateAI, setCanGenerateAI] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false); // Estado para controlar drag over
  const [anexoParaRemover, setAnexoParaRemover] = useState<Anexo | null>(null);
  const [removendoAnexo, setRemovendoAnexo] = useState(false);

  // Verificar se esta etapa pode ser acessada
  useEffect(() => {
    const checkAccess = async () => {
      const access = await canAccessStep(item.id, complianceItems, currentCompetenciaId);
      setCanAccess(access);
    };
    checkAccess();
  }, [item.id, complianceItems, currentCompetenciaId]);

  // Verificar se pode gerar parecer IA (apenas para item '8')
  useEffect(() => {
    const checkAIGeneration = async () => {
      if (item.id === '8') {
        const canGenerate = await canGenerateAIParecer(complianceItems, currentCompetenciaId);
        setCanGenerateAI(canGenerate);
      }
    };
    checkAIGeneration();
  }, [item.id, complianceItems, currentCompetenciaId]);

  // Carregar anexos quando o componente monta e verificar acesso
  useEffect(() => {
    const loadAnexosAndCheckAccess = async () => {
      if (currentCompetenciaId) {
        try {
          const tipoAnexo = getTipoAnexoFromItemId(item.id);
          const anexosData = await listAnexos(currentCompetenciaId);
          const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
          console.log(`🔍 Carregando anexos para item ${item.id}: ${filteredAnexos.length} anexos encontrados`);
          setAnexos(filteredAnexos);
          
          // Verificar acesso novamente após carregar anexos
          const access = await canAccessStep(item.id, complianceItems, currentCompetenciaId);
          setCanAccess(access);
        } catch (error) {
          console.error('Erro ao carregar anexos:', error);
        }
      } else {
        // Se não há competência, limpar anexos
        setAnexos([]);
      }
    };
    loadAnexosAndCheckAccess();
  }, [currentCompetenciaId, item.id, complianceItems, item.status]);

  const handleFileUpload = async (file: File) => {
    // Verificar se precisa criar competência primeiro
    if (!currentCompetenciaId) {
      // Chamar função do pai para criar competência
      const novaCompetencia = await onFileUpload(item.id, file);
      
      // Se a competência foi criada, fazer upload
      if (novaCompetencia && novaCompetencia.id) {
        await processarUpload(file, novaCompetencia.id.toString());
      }
    } else {
      // Se já existe competência, fazer upload diretamente
      await processarUpload(file, currentCompetenciaId);
    }
  };

    const processarUpload = async (file: File, competenciaId: string) => {
      console.log('🔍 processarUpload called with:', file.name, 'competenciaId:', competenciaId);
      
      if (!validateFileType(file)) {
        console.log('❌ File validation failed');
        alert('Arquivo inválido. Verifique se o arquivo não está corrompido.');
        return;
      }

      // Validar tamanho do arquivo
      const sizeValidation = validateFileSize(file);
      if (!sizeValidation.valid) {
        console.log('❌ File size validation failed:', sizeValidation.message);
        alert(sizeValidation.message || 'Arquivo muito grande.');
        return;
      }

      // Avisar sobre arquivos grandes
      if (file.size > 50 * 1024 * 1024) { // > 50MB
        const confirmUpload = confirm(`Arquivo grande detectado (${formatFileSize(file.size)}). O upload pode demorar alguns minutos. Continuar?`);
        if (!confirmUpload) {
          return;
        }
      }

    try {
      console.log('🔍 Starting upload process...');
      setUploading(true);
      const tipoAnexo = getTipoAnexoFromItemId(item.id);
      console.log('🔍 tipoAnexo:', tipoAnexo);
      console.log('🔍 Calling uploadAnexo...');
      const novoAnexo = await uploadAnexo(competenciaId, tipoAnexo, file);
      console.log('🔍 Upload completed:', novoAnexo);

      // Recarregar anexos do servidor para garantir sincronização
      const anexosData = await listAnexos(competenciaId);
      const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
      setAnexos(filteredAnexos);

      // Verificar acesso novamente após upload (para liberar próximas etapas)
      const access = await canAccessStep(item.id, complianceItems, competenciaId);
      setCanAccess(access);

      // Recarregar dados de compliance para atualizar status baseado em anexos
      console.log('🔍 Recarregando dados após upload para atualizar status...');
      // Chamar função do componente pai para recarregar dados
      if (typeof onFileUpload === 'function') {
        await onFileUpload(item.id, file);
      }
      console.log('Arquivo carregado com sucesso:', file.name);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmRemoveAnexo = async () => {
    if (!anexoParaRemover) return;

    try {
      setRemovendoAnexo(true);
      await removeAnexo(anexoParaRemover.id);
      setAnexos(prev => prev.filter(anexo => anexo.id !== anexoParaRemover.id));
      onRemoveFile(item.id, anexoParaRemover.id);
    } catch (error) {
      console.error('Erro ao remover anexo:', error);
      alert('Erro ao remover anexo');
    } finally {
      setRemovendoAnexo(false);
      setAnexoParaRemover(null);
    }
  };

  const normalizeFileName = (name: string | undefined | null) => {
    if (!name) return '';
    try {
      if (/Ã|Â|â|œ|�/.test(name)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return decodeURIComponent(escape(name));
      }
      return name;
    } catch (_e) {
      return name;
    }
  };

  const handleDownloadAnexo = async (anexo: Anexo) => {
    try {
      await downloadAnexo(anexo.id, anexo.nome_arquivo);
    } catch (error) {
      console.error('Erro ao baixar anexo:', error);
      alert('Erro ao baixar anexo');
    }
  };

  const removerAnexoModal = (
    <AlertDialog
      open={!!anexoParaRemover}
      onOpenChange={(open) => {
        if (!open && !removendoAnexo) {
          setAnexoParaRemover(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Trash2 className="h-4 w-4 text-red-600" />
            Remover anexo
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm sm:text-base break-words">
            Tem certeza de que deseja remover o anexo{' '}
            <strong>{anexoParaRemover?.nome_arquivo || 'selecionado'}</strong>?<br />
            Essa ação não pode ser desfeita e o arquivo será excluído do compliance e da pasta de documentos correspondente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel
            disabled={removendoAnexo}
            onClick={() => setAnexoParaRemover(null)}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={removendoAnexo}
            onClick={handleConfirmRemoveAnexo}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 order-1 sm:order-2"
          >
            {removendoAnexo ? 'Removendo...' : 'Remover'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Se o card não está expandido, mostrar apenas o resumo
  if (!item.isExpanded) {
    return (
      <>
      <Card className={`mb-6 bg-white transition-shadow ${!canAccess ? 'opacity-50' : 'shadow-sm hover:shadow-lg'} overflow-hidden`}>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <CardTitle className={`text-base sm:text-lg break-words ${!canAccess ? 'text-gray-400' : ''}`}>
                  {item.id === '1' && item.data
                    ? formatCompetenciaTitle(item.data)
                    : item.title
                  }
                </CardTitle>
                {getStatusBadge(item.status)}
                {/* Mostrar contador de documentos para categorias (exceto Período) */}
                {item.id !== '1' && item.id !== '8' && anexos.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {anexos.length} {anexos.length === 1 ? 'documento' : 'documentos'}
                  </Badge>
                )}
              </div>
              <CardDescription className={`text-sm sm:text-base mt-1 break-words ${!canAccess ? 'text-gray-400' : ''}`}>
                {item.description}
              </CardDescription>
              {!canAccess && (
                <div className="text-xs text-orange-600 mt-1 font-medium break-words">
                  🔒 Complete a etapa anterior para desbloquear
                </div>
              )}
              {item.lastUpdated && canAccess && (
                <div className="text-xs text-gray-500 mt-1 break-words">
                  Última atualização: {formatDateTimeBR(item.lastUpdated)} por {item.updatedBy}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <Button
                onClick={() => onToggleExpanded(item.id)}
                size="sm"
                variant="outline"
                disabled={!canAccess}
                className={`text-xs sm:text-sm whitespace-nowrap ${!canAccess ? 'cursor-not-allowed' : ''}`}
              >
                <Pencil className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">{canAccess ? 'Editar' : 'Bloqueado'}</span>
                <span className="sm:hidden">{canAccess ? 'Editar' : 'Bloq.'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      {removerAnexoModal}
      </>
    );
  }

  // Se for o Parecer Final, renderizar interface especial de IA
  // APENAS o item com id '8' (Parecer Final) deve mostrar esta seção
  // Verificação dupla: ID e título para garantir que é realmente o Parecer Final
  if (String(item.id) === '8' && item.title === 'Parecer Final') {
    return (
      <Card className="mb-6 bg-white transition-shadow shadow-sm hover:shadow-lg overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 break-words">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                {item.title}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm break-words">
                {item.description} - Gerado automaticamente por IA
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-lg border border-blue-200 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2 break-words">
                   Gerar Parecer com Inteligência Artificial
                </h3>
                <p className="text-blue-700 text-xs sm:text-sm break-words">
                  A IA analisará todos os campos preenchidos e gerará um parecer completo.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!item.observacoes ? (
                  // Se não há parecer gerado, mostrar botão para gerar
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => gerarParecer(currentCompetenciaId || '')}
                      size="lg"
                      className={`w-full sm:w-auto text-sm sm:text-base ${
                        canGenerateAI && !loading
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white cursor-not-allowed opacity-60'
                      }`}
                      disabled={!canGenerateAI || loading}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                          <span className="hidden sm:inline">Gerando...</span>
                          <span className="sm:hidden">Gerando</span>
                        </>
                      ) : canGenerateAI ? (
                        <>
                          <Brain className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          <span className="hidden sm:inline">Gerar Parecer IA</span>
                          <span className="sm:hidden">Gerar IA</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          <span className="hidden sm:inline">Gerar Parecer IA</span>
                          <span className="sm:hidden">Gerar IA</span>
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  // Se já há parecer gerado, mostrar apenas botão para baixar
                  <Button
                    onClick={() => downloadParecerPDF(item.observacoes)}
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-50 w-full sm:w-auto text-sm sm:text-base"
                    size="lg"
                  >
                    <Download className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="hidden sm:inline">Baixar PDF</span>
                    <span className="sm:hidden">Baixar</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Mostrar loading enquanto gera o parecer */}
          {loading && !item.observacoes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 w-full">
              <div className="flex items-start sm:items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600 flex-shrink-0 mt-0.5 sm:mt-0"></div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-blue-900 text-sm sm:text-base break-words">Gerando Parecer com IA...</h4>
                  <p className="text-xs sm:text-sm text-blue-700 break-words mt-1">Aguarde enquanto a inteligência artificial analisa os dados e gera o parecer.</p>
                </div>
              </div>
            </div>
          )}

          {/* Mostrar parecer gerado se existir */}
          {item.observacoes && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 w-full">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base break-words">Parecer Gerado:</span>
              </div>
              <div className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border break-words overflow-x-auto max-w-full">
                {item.observacoes}
              </div>
            </div>
          )}

          {/* Lista de anexos do parecer */}
          {anexos.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 w-full">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base break-words">Pareceres gerados:</span>
              </div>
              <div className="space-y-2">
                {anexos.map((anexo) => (
                  <div key={anexo.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white p-3 rounded border w-full">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs sm:text-sm font-medium break-words block">{normalizeFileName(anexo.nome_arquivo || 'Arquivo sem nome')}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(anexo.tamanho_arquivo || 0)})
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAnexo(anexo)}
                        className="text-green-700 border-green-300 text-xs sm:text-sm"
                      >
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Baixar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAnexoParaRemover(anexo)}
                        className="text-red-700 border-red-300"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.lastUpdated && (
            <div className="text-xs text-gray-500 border-t pt-2 break-words">
              Última atualização: {formatDateTimeBR(item.lastUpdated)} por {item.updatedBy}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Renderização normal para outros itens
  return (
    <>
    <Card className={`mb-6 bg-white transition-shadow ${!canAccess ? 'opacity-50' : 'shadow-sm hover:shadow-lg'} overflow-hidden`}>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className={`text-base sm:text-lg break-words ${!canAccess ? 'text-gray-400' : ''}`}>
              {item.id === '1' && item.data
                ? formatCompetenciaTitle(item.data)
                : item.title
              }
            </CardTitle>
            <CardDescription className={`text-sm sm:text-base mt-1 break-words ${!canAccess ? 'text-gray-400' : ''}`}>
              {item.description}
            </CardDescription>
            {!canAccess && (
              <div className="text-xs text-orange-600 mt-1 font-medium">
                🔒 Complete a etapa anterior para desbloquear
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:flex-shrink-0">
            {/* Badge de organização */}
            {getOrganizationBadge(item.organizacao)}
            {getStatusBadge(item.status)}
            <Button
              onClick={() => onSave(item.id)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm whitespace-nowrap"
              disabled={loading || !canAccess}
            >
              {loading ? (
                <span className="hidden sm:inline">Salvando...</span>
              ) : (
                <>
                  <Save className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{canAccess ? 'Salvar' : 'Bloqueado'}</span>
                  <span className="sm:hidden">{canAccess ? 'Salvar' : 'Bloq.'}</span>
                </>
              )}
            </Button>
            <Button
              onClick={() => onToggleExpanded(item.id)}
              size="sm"
              variant="outline"
              className="text-xs sm:text-sm whitespace-nowrap"
            >
              Fechar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className={`p-4 sm:p-6 space-y-4 ${!canAccess ? 'pointer-events-none' : ''} overflow-hidden`}>
        {!canAccess ? (
          <div className="text-center py-6 sm:py-8 text-gray-500 px-2">
            <div className="text-3xl sm:text-4xl mb-2">🔒</div>
            <p className="text-base sm:text-lg font-medium break-words">Etapa Bloqueada</p>
            <p className="text-xs sm:text-sm break-words mt-1">Complete a etapa anterior para desbloquear esta seção.</p>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-1 w-full`}>

          {/* Campo Período - apenas para Período (id: 1) */}
          {item.id === '1' && (
            <div className="w-full">
              <Label htmlFor={`data-${item.id}`} className="text-sm sm:text-base">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                Período da Competência
              </Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1 w-full">
                <div className="flex-1 w-full min-w-0">
                  <Label htmlFor={`data-inicio-${item.id}`} className="text-xs text-gray-500">
                    Data Início
                  </Label>
                  <input
                    id={`data-inicio-${item.id}`}
                    type="date"
                    value={item.data ? item.data.split('|')[0] || '' : ''}
                    onChange={(e) => {
                      const dataInicio = e.target.value;
                      const dataFim = item.data ? item.data.split('|')[1] || '' : '';
                      const novoValor = dataInicio ? (dataFim ? `${dataInicio}|${dataFim}` : dataInicio) : dataFim;
                      onFieldChange(item.id, 'data', novoValor);
                    }}
                    className="flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-2 sm:px-3 py-2 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Data início"
                  />
                </div>
                <div className="flex-1 w-full min-w-0">
                  <Label htmlFor={`data-fim-${item.id}`} className="text-xs text-gray-500">
                    Data Fim
                  </Label>
                  <input
                    id={`data-fim-${item.id}`}
                    type="date"
                    value={item.data ? item.data.split('|')[1] || '' : ''}
                    onChange={(e) => {
                      const dataFim = e.target.value;
                      const dataInicio = item.data ? item.data.split('|')[0] || '' : '';
                      const novoValor = dataInicio ? (dataFim ? `${dataInicio}|${dataFim}` : dataInicio) : dataFim;
                      onFieldChange(item.id, 'data', novoValor);
                    }}
                    className="flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-2 sm:px-3 py-2 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Data fim"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 break-words">
                Defina livremente o período fiscal desta competência. Consulte a página de Cronograma para acompanhar as demandas programadas.
              </p>
            </div>
          )}

          <div className="w-full">
            <Label htmlFor={`observacoes-${item.id}`} className="text-sm sm:text-base">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
              Observações
            </Label>
            <Textarea
              id={`observacoes-${item.id}`}
              value={item.observacoes || ''}
              onChange={(e) => onFieldChange(item.id, 'observacoes', e.target.value)}
              placeholder="Digite suas observações aqui..."
              className="mt-1 w-full min-h-[80px] resize-none max-w-full text-xs sm:text-sm"
              rows={3}
            />
          </div>

          {/* Campos de Email - para Notas Fiscais (ID '7') e Relatório Faturamento (ID '3') */}
          {(item.id === '7' || item.id === '3') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 w-full">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                <h3 className="text-base sm:text-lg font-semibold text-blue-900 break-words">Envio por Email</h3>
              </div>
              <p className="text-xs sm:text-sm text-blue-700 mb-4 break-words">
                {item.id === '3' 
                  ? 'Envie o relatório de faturamento anexado diretamente por email'
                  : 'Envie as notas fiscais anexadas diretamente por email'
                }
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full">
                <div className="w-full min-w-0">
                  <Label htmlFor={`email-remetente-${item.id}`} className="text-xs sm:text-sm">
                    <Mail className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                    Seu Email (Remetente)
                  </Label>
                  <Input
                    id={`email-remetente-${item.id}`}
                    type="email"
                    value={item.emailRemetente || currentUserEmail || ''}
                    onChange={(e) => onFieldChange(item.id, 'emailRemetente', e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="mt-1 w-full text-xs sm:text-sm"
                    disabled
                  />
                </div>
                
                <div className="w-full min-w-0">
                  <Label htmlFor={`email-destinatario-${item.id}`} className="text-xs sm:text-sm">
                    <Mail className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
                    Email Destinatário
                  </Label>
                  <Input
                    id={`email-destinatario-${item.id}`}
                    type="email"
                    value={item.emailDestinatario || ''}
                    onChange={(e) => onFieldChange(item.id, 'emailDestinatario', e.target.value)}
                    placeholder="destinatario@exemplo.com"
                    className="mt-1 w-full text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Assunto opcional */}
              <div className="mt-4 w-full">
                <Label htmlFor={`email-assunto-${item.id}`} className="text-xs sm:text-sm">Assunto (opcional)</Label>
                <Input
                  id={`email-assunto-${item.id}`}
                  type="text"
                  value={(item as any).emailAssunto || ''}
                  onChange={(e) => onFieldChange(item.id, 'emailAssunto' as any, e.target.value)}
                    placeholder={item.id === '3' 
                      ? competenciaPeriodo 
                        ? `Relatório Faturamento - Competência Período (${competenciaPeriodo}) (padrão)`
                        : `Relatório Faturamento - Competência ${currentCompetenciaId || ''} (padrão)`
                      : competenciaPeriodo
                        ? `Notas Fiscais - Competência Período (${competenciaPeriodo}) (padrão)`
                        : `Notas Fiscais - Competência ${currentCompetenciaId || ''} (padrão)`
                    }
                  className="mt-1 w-full text-xs sm:text-sm"
                />
              </div>
              
              {/* Status de envio */}
              {item.emailEnviado && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-green-800 font-medium break-words">Email enviado com sucesso!</span>
                  </div>
                  <p className="text-xs sm:text-sm text-green-700 mt-1 break-words">
                    De: {item.emailRemetente} → Para: {item.emailDestinatario}
                  </p>
                </div>
              )}

              {/* Botão de envio de email */}
              <div className="mt-4 flex justify-end w-full">
                <Button
                  onClick={async () => {
                    const emailRemetenteToUse = item.emailRemetente || currentUserEmail || '';
                    if (!emailRemetenteToUse || !item.emailDestinatario) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha ambos os campos de email antes de enviar.",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (anexos.length === 0) {
                      toast({
                        title: "Nenhum arquivo",
                        description: item.id === '3' 
                          ? "Anexe pelo menos um relatório de faturamento antes de enviar por email."
                          : "Anexe pelo menos uma nota fiscal antes de enviar por email.",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (!currentCompetenciaId) {
                      toast({
                        title: "Competência não encontrada",
                        description: "Salve a competência antes de enviar por email.",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      // Usar o estado de loading do componente pai
                      // setLoading(true);
                      
                      // Construir URL corretamente, evitando duplicação de /api
                      const baseUrl = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;
                      const finalUrl = `${baseUrl}/email/enviar-notas-fiscais`;
                      console.log('🔍 URL construída:', finalUrl);
                      console.log('🔍 apiBase original:', apiBase);
                      console.log('🔍 baseUrl:', baseUrl);
                      
                      // Toast de carregamento
                      toast({
                        title: 'Enviando email... ',
                        description: 'Aguarde, estamos enviando os anexos por email.',
                        variant: 'default',
                      });
                      
                      const response = await fetch(finalUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          emailRemetente: emailRemetenteToUse,
                          emailDestinatario: item.emailDestinatario,
                          competenciaId: currentCompetenciaId,
                          assunto: (item as any).emailAssunto && (item as any).emailAssunto.trim() ? (item as any).emailAssunto.trim() : undefined,
                          tipoAnexo: item.id === '3' ? 'relatorio_faturamento' : 'estabelecimento',
                          competenciaPeriodo: competenciaPeriodo || undefined
                        })
                      });

                      const data = await response.json();

                      if (data.success) {
                        // Marcar email como enviado
                        onFieldChange(item.id, 'emailEnviado', true);
                        
                        toast({
                          title: "Email enviado!",
                          description: item.id === '3'
                            ? `Relatório de faturamento enviado para ${item.emailDestinatario}`
                            : `Notas fiscais enviadas para ${item.emailDestinatario}`,
                          variant: "default",
                        });
                      } else {
                        toast({
                          title: "Erro ao enviar email",
                          description: data.error || "Erro desconhecido",
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      console.error('Erro ao enviar email:', error);
                      toast({
                        title: "Erro de conexão",
                        description: "Erro ao conectar com o servidor",
                        variant: "destructive",
                      });
                    }
                  }}
                  className={`${item.emailEnviado ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"} text-xs sm:text-sm whitespace-nowrap`}
                  disabled={!(item.emailRemetente || currentUserEmail) || !item.emailDestinatario || anexos.length === 0 || loading || item.emailEnviado}
                >
                  <Mail className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{loading ? 'Enviando...' : item.emailEnviado ? 'Email Enviado ✓' : 'Enviar por Email'}</span>
                  <span className="sm:hidden">{loading ? 'Enviando...' : item.emailEnviado ? 'Enviado ✓' : 'Enviar'}</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Seção de Anexos - apenas para itens que não sejam Período */}
        {item.id !== '1' && (
          <div className="w-full">
            <Label htmlFor={`anexo-${item.id}`} className="text-sm sm:text-base font-semibold">Anexar Arquivo</Label>
            <div className="mt-1 w-full">
              {/* Lista de anexos existentes */}
              {anexos.length > 0 && (
                <div className="mb-4 space-y-2 w-full">
                  {anexos.map((anexo) => (
                    <div key={anexo.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg bg-gray-50 w-full">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-lg flex-shrink-0">{getFileIcon(anexo.nome_arquivo || 'arquivo')}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs sm:text-sm font-medium break-words block">{normalizeFileName(anexo.nome_arquivo || 'Arquivo sem nome')}</span>
                          <span className="text-xs text-gray-500">
                            ({formatFileSize(anexo.tamanho_arquivo || 0)})
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadAnexo(anexo)}
                          className="text-xs sm:text-sm"
                        >
                          <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Baixar</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAnexoParaRemover(anexo)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload de novo arquivo */}
              <div 
                className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors cursor-pointer w-full ${
                  isDragOver 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
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
                    const file = files[0];
                    handleFileUpload(file);
                  }
                }}
                onClick={() => {
                  const input = document.getElementById(`anexo-${item.id}`) as HTMLInputElement;
                  if (input) input.click();
                }}
              >
                <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-xs sm:text-sm text-gray-600 mb-2 break-words px-2">
                  {uploading ? 'Fazendo upload...' : 'Clique para fazer upload ou arraste o arquivo aqui'}
                </p>
                <Input
                  id={`anexo-${item.id}`}
                  type="file"
                  accept="*/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById(`anexo-${item.id}`)?.click();
                  }}
                  disabled={uploading}
                  className="text-xs sm:text-sm"
                >
                  {uploading ? 'Uploading...' : 'Selecionar Arquivo'}
                </Button>
              </div>
            </div>
          </div>
        )}

            {/* Adicionar indicador de quem editou por último */}
            {getEditIndicator(item)}
          </>
        )}
      </CardContent>
    </Card>
    {removerAnexoModal}
    </>
  );
});

// Função para salvar estado dos cards no localStorage
const saveCardsState = (items: ComplianceItem[], competenciaId?: string) => {
  try {
    const stateToSave = items.map(item => ({
      id: item.id,
      isExpanded: item.isExpanded,
      status: item.status,
      lastUpdated: item.lastUpdated,
      updatedBy: item.updatedBy,
      competenciaId: competenciaId
    }));
    localStorage.setItem('compliance-cards-state', JSON.stringify(stateToSave));
    console.log('💾 Estado dos cards salvo:', stateToSave);
  } catch (error) {
    console.error('Erro ao salvar estado dos cards:', error);
  }
};

// Função para carregar estado dos cards do localStorage
// Funções loadCardsState e initializeComplianceItems movidas para @/components/compliance/utils.ts
// Importar quando necessário: import { loadCardsState, initializeComplianceItems } from '@/components/compliance/utils';

// Componente de Skeleton Loading movido para @/components/compliance/ComplianceItemSkeleton.tsx

// Componente simplificado para ICMS e Equalização movido para @/components/compliance/ICMSEqualizacaoSimplificado.tsx
// Componente HistoricoAlteracoes movido para @/components/compliance/HistoricoAlteracoes.tsx
// Componente ComplianceItemSkeleton movido para @/components/compliance/ComplianceItemSkeleton.tsx

// Componente de seleção de tipo de Compliance

export default function Compliance({ tipoCompliance }: ComplianceProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Se não houver tipoCompliance, mostrar tela de seleção
  if (!tipoCompliance) {
    return <ComplianceSelection />;
  }

  // Versão simplificada para ICMS e Equalização (apenas upload de documento)
  if (tipoCompliance === 'icms-equalizacao') {
    return <ICMSEqualizacaoSimplificado />;
  }
  
  // Sempre inicializar com a lista ao montar o componente
  // O localStorage é usado apenas para manter estado durante refresh de página
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'view'>('list');
  const [selectedCompetencia, setSelectedCompetencia] = useState<Competencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCompetencia, setLoadingCompetencia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para dados reais
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  // Inicializar complianceItems com estado salvo
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>(() => initializeComplianceItems());
  const [currentCompetenciaId, setCurrentCompetenciaId] = useState<string | null>(null);

  // NOVO: Estado para data da competência no header
  const [competenciaData, setCompetenciaData] = useState<string>('');
  
  // Estado para período formatado da competência
  const [competenciaPeriodo, setCompetenciaPeriodo] = useState<string>('');

  // Estado para histórico de alterações
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Estado para usuário atual
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    nome: string;
    email: string;
    organizacao: string;
    perfil: string;
    cor_identificacao: string;
  } | null>(null);

  // Estado para dialog de confirmação
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [competenciaToDelete, setCompetenciaToDelete] = useState<string | null>(null);

  // Estado para controlar o modal de Leis Vigentes
  const [leisVigentesModalOpen, setLeisVigentesModalOpen] = useState(false);

  // Estado para organização selecionada (para Portes criar compliance para outra organização)
  const [selectedOrganizacao, setSelectedOrganizacao] = useState<string>('');
  const [organizacoesDisponiveis, setOrganizacoesDisponiveis] = useState<string[]>([]);

  // Estado para primeiro acesso
  const [showFirstAccessForm, setShowFirstAccessForm] = useState(false);
  const [checkingFirstAccess, setCheckingFirstAccess] = useState(true);

  // API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';

  // Mapear IDs dos itens para campos do banco
  const itemFieldMapping: Record<string, Record<string, string>> = {
    '1': { // Período
      'data': 'competencia_referencia',
      'observacoes': 'competencia_referencia_texto'
    },
    '2': { // Relatório Técnico
      'data': 'relatorio_inicial_data',
      'observacoes': 'relatorio_inicial_texto'
    },
    '3': { // Relatório Faturamento
      'data': 'relatorio_faturamento_data',
      'observacoes': 'relatorio_faturamento_texto'
    },
    '4': { // Comprovação de Compensações
      'data': 'imposto_compensado_data',
      'observacoes': 'imposto_compensado_observacoes'
    },
    '6': { // Comprovação de Email
      'data': 'emails_data',
      'observacoes': 'emails_texto'
    },
    '7': { // Notas Fiscais Enviadas
      'data': 'estabelecimento_data',
      'observacoes': 'estabelecimento_texto'
    },
    '8': { // Parecer Final
      'observacoes': 'parecer_texto'
    }
  };

  // Função de teste para verificar conexão
  const testConnection = async () => {
    try {
      console.log(' Testando conexão com o backend...');

      // Primeiro testar a rota de health
      const healthResponse = await fetch(`${API_BASE}/health`);
      const healthData = await healthResponse.json();
      console.log(' Health check:', healthData);

      // Depois testar a rota de competências (rota correta)
      let userOrg = currentUser?.organizacao;
      if (!userOrg) {
        const userFromStorage = localStorage.getItem('user');
        if (userFromStorage) {
          const parsedUser = JSON.parse(userFromStorage);
          userOrg = parsedUser.organizacao;
        }
      }
      userOrg = userOrg || 'cassems';
      const response = await fetch(`${API_BASE}/compliance/competencias?organizacao=${userOrg}`, {
        headers: {
          'x-user-organization': userOrg
        }
      });
      const data = await response.json();
      console.log(' Resposta do backend:', data);
      setError(null);
    } catch (err) {
      console.error(' Erro na conexão:', err);
      setError('Erro de conexão com o backend');
    }
  };

  // Carregar competências do banco
  const loadCompetencias = async () => {
    try {
      setLoading(true);
      
      // Obter organização do usuário atual (com fallback para localStorage)
      let userOrg = currentUser?.organizacao;
      if (!userOrg) {
        const userFromStorage = localStorage.getItem('user');
        if (userFromStorage) {
          const parsedUser = JSON.parse(userFromStorage);
          userOrg = parsedUser.organizacao;
        }
      }
      userOrg = userOrg || 'cassems';
      
      console.log('🔍 Organização detectada:', userOrg);
      console.log('🔍 Tipo Compliance:', tipoCompliance);
      console.log('🔍 currentUser:', currentUser);
      console.log('🔍 localStorage user:', localStorage.getItem('user'));
      
      // Validar que tipoCompliance está definido
      if (!tipoCompliance) {
        console.error('❌ Erro: tipoCompliance não está definido');
        setError('Tipo de compliance não definido. Por favor, selecione um tipo de compliance.');
        setLoading(false);
        return;
      }
      
      // Fazer requisição com filtro de organização e tipo_compliance
      const urlParams = new URLSearchParams({
        organizacao: userOrg,
        tipo_compliance: tipoCompliance // Sempre enviar tipo_compliance
      });
      
      console.log('🔍 URL Params:', urlParams.toString());
      console.log('🔍 Tipo Compliance sendo enviado:', tipoCompliance);
      
      const response = await fetch(`${API_BASE}/compliance/competencias?${urlParams.toString()}`, {
        headers: {
          'x-user-organization': userOrg,
          'x-tipo-compliance': tipoCompliance // Sempre enviar no header
        }
      });
      const data = await response.json();

      console.log('🔍 Debug - Resposta da API:', data);
      console.log('🔍 Total de competências recebidas:', data.data?.length || 0);
      if (data.data && data.data.length > 0) {
        console.log('🔍 Organizações nas competências recebidas:', [...new Set(data.data.map(c => c.organizacao_criacao))]);
      }

      if (data.success) {
        // Se data.data é um objeto, converter para array
        let competenciasData = [];
        if (Array.isArray(data.data)) {
          competenciasData = data.data;
        } else if (data.data && typeof data.data === 'object') {
          // Se é um objeto único, colocar em um array
          competenciasData = [data.data];
        }

        // Ordenar por data de criação (mais recente primeiro)
        competenciasData.sort((a, b) => {
          const dateA = new Date(a.created_at);
          const dateB = new Date(b.created_at);
          return dateB.getTime() - dateA.getTime(); // Ordem decrescente (mais recente primeiro)
        });

        setCompetencias(competenciasData);
        console.log(' Competências carregadas e ordenadas:', competenciasData);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Erro ao carregar competências');
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar histórico de alterações
  const loadHistorico = async (competenciaId: string) => {
    try {
      setLoadingHistorico(true);
      const response = await fetch(`${API_BASE}/compliance/competencias/${competenciaId}/historico`);
      const data = await response.json();

      if (data.success) {
        setHistorico(data.data);
        console.log('Histórico carregado:', data.data);
      } else {
        console.error('Erro ao carregar histórico:', data.error);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Função para carregar dados de compliance de uma competência específica
  const loadComplianceData = async (competenciaId: string) => {
    try {
      setLoadingCompetencia(true);
      console.log(' Carregando dados de compliance para competência:', competenciaId);
      
      // Limpar estado salvo anterior se for uma competência diferente
      const currentSavedState = loadCardsState();
      const hasDifferentCompetencia = Object.keys(currentSavedState).length > 0 && 
        !Object.values(currentSavedState).some(item => item.competenciaId === competenciaId);
      
      if (hasDifferentCompetencia) {
        console.log('🔍 Limpando estado salvo para nova competência');
        localStorage.removeItem('compliance-cards-state');
      }

      const response = await fetch(`${API_BASE}/compliance/competencias/${competenciaId}`);
      const data = await response.json();

      if (data.success) {
        const competencia = data.data;
        console.log(' Dados da competência carregados:', competencia);
        console.log('🔍 Debug - ultima_alteracao_por_nome:', competencia.ultima_alteracao_por_nome);
        console.log('🔍 Debug - ultima_alteracao_em:', competencia.ultima_alteracao_em);

        // Mapear os dados do banco para os complianceItems
        const itemsWithBasicData = complianceItems.map(item => {
          const itemId = item.id;
          let updatedItem = { ...item };

          // Mapear campos específicos baseado no ID do item
          switch (itemId) {
            case '1': // Período
              // Usar os novos campos separados
              if (competencia.competencia_inicio || competencia.competencia_fim) {
                // Extrair apenas a parte da data (YYYY-MM-DD) do formato ISO completo
                const dataInicio = competencia.competencia_inicio 
                  ? competencia.competencia_inicio.split('T')[0] 
                  : '';
                const dataFim = competencia.competencia_fim 
                  ? competencia.competencia_fim.split('T')[0] 
                  : '';
                
                if (dataInicio && dataFim) {
                  // Período completo
                  updatedItem.data = `${dataInicio}|${dataFim}`;
                  setCompetenciaData(`${dataInicio}|${dataFim}`);
                  // Definir período formatado para exibição (ex: 12/05/2024 a 12/02/2025)
                  const periodoFormatado = `${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`;
                  setCompetenciaPeriodo(periodoFormatado);
                } else if (dataInicio) {
                  // Apenas data de início
                  updatedItem.data = dataInicio;
                  setCompetenciaData(dataInicio);
                  setCompetenciaPeriodo(formatDateBR(dataInicio));
                }
              }
              // Fallback para competencia_referencia (compatibilidade)
              else if (competencia.competencia_referencia) {
                // Se competencia_referencia já está no formato YYYY-MM-DD, usar diretamente
                const dataFormatada = competencia.competencia_referencia.includes('-') 
                  ? competencia.competencia_referencia.split('T')[0] // Garantir que pega apenas a parte da data
                  : competencia.competencia_referencia; // Usar como está se não for ISO
                updatedItem.data = dataFormatada;
                setCompetenciaData(dataFormatada);
              }
              if (competencia.competencia_referencia_texto) {
                updatedItem.observacoes = competencia.competencia_referencia_texto;
              }
              break;
            case '2': // Relatório Técnico
              if (competencia.relatorio_inicial_texto) {
                updatedItem.observacoes = competencia.relatorio_inicial_texto;
              }
              break;
            case '3': // Relatório Faturamento
              if (competencia.relatorio_faturamento_texto) {
                updatedItem.observacoes = competencia.relatorio_faturamento_texto;
              }
              break;
            case '4': // Comprovação de Compensações
              if (competencia.imposto_compensado_texto) {
                updatedItem.observacoes = competencia.imposto_compensado_texto;
              }
              break;
            case '6': // Comprovação de Email
              if (competencia.emails_texto) {
                updatedItem.observacoes = competencia.emails_texto;
              }
              break;
            case '7': // Notas Fiscais Enviadas
              if (competencia.estabelecimento_texto) {
                updatedItem.observacoes = competencia.estabelecimento_texto;
              }
              break;
            case '8': // Parecer Final
              if (competencia.parecer_texto) {
                updatedItem.observacoes = competencia.parecer_texto;
              }
              break;
          }

          // Adicionar informações de organização - MANTER a organização original do item
          // Não sobrescrever a organização, apenas atualizar as informações de última alteração
          updatedItem.updatedBy = competencia.ultima_alteracao_por_nome || competencia.created_by_nome;
          updatedItem.lastUpdated = competencia.ultima_alteracao_em || competencia.updated_at;
          
          console.log('🔍 Debug - updatedItem.updatedBy:', updatedItem.updatedBy);
          console.log('🔍 Debug - updatedItem.lastUpdated:', updatedItem.lastUpdated);

          return updatedItem;
        });

        // Depois, verificar anexos e determinar status para cada item
        const updatedItems = await Promise.all(itemsWithBasicData.map(async (updatedItem) => {
          // PRIMEIRO: Determinar status baseado nos dados reais do banco E anexos
          const hasData = (updatedItem.data && updatedItem.data.trim()) ||
                         (updatedItem.observacoes && updatedItem.observacoes.trim());
          
          // Verificar se há anexos para este item (exceto para Período)
          let hasAnexos = false;
          if (competenciaId && updatedItem.id !== '1') {
            try {
              const tipoAnexo = getTipoAnexoFromItemId(updatedItem.id);
              const anexosData = await listAnexos(competenciaId);
              const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
              hasAnexos = filteredAnexos.length > 0;
              console.log(`🔍 Item ${updatedItem.id} - hasData: ${hasData}, hasAnexos: ${hasAnexos} (${filteredAnexos.length} anexos)`);
            } catch (error) {
              console.error('Erro ao verificar anexos para status:', error);
            }
          }
          
          // Item está concluído se tem dados OU anexos (para Período, apenas dados)
          const isCompleted = updatedItem.id === '1' ? hasData : (hasData || hasAnexos);
          
          if (isCompleted) {
            updatedItem.status = 'concluido';
            // Card Parecer Final sempre fica aberto, outros cards com dados ficam fechados
            updatedItem.isExpanded = updatedItem.id === '8' ? true : false;
          } else {
            updatedItem.status = 'pendente';
            updatedItem.isExpanded = true; // Cards sem dados ficam abertos para preenchimento
          }
          
          // SEGUNDO: Preservar estado de expansão do localStorage (apenas isExpanded)
          const savedState = loadCardsState();
          const savedItemState = savedState[updatedItem.id];
          
          if (savedItemState) {
            // Card Parecer Final sempre fica aberto, outros usam estado salvo
            updatedItem.isExpanded = updatedItem.id === '8' ? true : savedItemState.isExpanded;
            console.log(`🔍 Item ${updatedItem.id} - Status: ${updatedItem.status} (baseado em dados), isExpanded: ${updatedItem.isExpanded} (do localStorage)`);
          } else {
            // Verificar se o item atual já estava fechado (exceto Parecer Final)
            if (updatedItem.id !== '8') {
              const currentItem = complianceItems.find(current => current.id === updatedItem.id);
              if (currentItem && currentItem.isExpanded === false) {
                updatedItem.isExpanded = false;
              }
            }
          }

          return updatedItem;
        }));

        setComplianceItems(updatedItems);
        console.log(' Compliance items atualizados com dados do banco:', updatedItems);
        
        // Carregar campos de email do localStorage e aplicar nos itens
        try {
          const emailFieldsKey = `compliance-email-${competenciaId}`;
          const savedEmailFields = JSON.parse(localStorage.getItem(emailFieldsKey) || '{}');
          
          if (Object.keys(savedEmailFields).length > 0) {
            const itemsWithEmail = updatedItems.map(item => {
              const savedFields = savedEmailFields[item.id];
              if (savedFields) {
                return { ...item, ...savedFields };
              }
              return item;
            });
            
            setComplianceItems(itemsWithEmail);
            console.log('📧 Campos de email carregados do localStorage:', savedEmailFields);
          }
        } catch (error) {
          console.error('Erro ao carregar campos de email:', error);
        }
        
        // Salvar estado atual dos cards no localStorage
        saveCardsState(updatedItems, competenciaId);

        // Carregar histórico de alterações
        await loadHistorico(competenciaId);
      } else {
        console.error(' Erro ao carregar dados de compliance:', data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error(' Erro ao carregar dados de compliance:', err);
      setError('Erro ao carregar dados de compliance');
    } finally {
      setLoadingCompetencia(false);
    }
  };

  // Função para criar nova competência
  // Função para iniciar criação de nova competência (modo rascunho)
  const createCompetencia = () => {
    // Reinicializar cards com status pendente
    resetComplianceItemsToPending();
    
    // Limpar competência atual
    setSelectedCompetencia(null);
    setCurrentCompetenciaId(null);
    
    // Limpar organização selecionada
    setSelectedOrganizacao('');
    
    // Carregar organizações se for Portes
    if (currentUser?.organizacao === 'portes') {
      loadOrganizacoes();
    }
    
    // Mudar para modo de criação
    setCurrentView('create');
    
    // Mostrar notificação informativa
    toast({
      title: "Modo de Criação",
      description: "Preencha pelo menos um campo e salve para criar a competência.",
      variant: "default",
    });
  };

  // Função auxiliar para reinicializar cards com status pendente
  const resetComplianceItemsToPending = () => {
    // Limpar estado salvo do localStorage
    localStorage.removeItem('compliance_cards_state');
    
    // Reinicializar cards com status pendente
    setComplianceItems([
      { id: '1', title: 'Período', description: 'Informe o período fiscal referente à competência.', status: 'pendente', isExpanded: false },
      { id: '2', title: 'Relatório Técnico', description: 'Análise fiscal inicial com pendências, cronograma e parecer sobre as compensações.', status: 'pendente', isExpanded: false },
      { id: '3', title: 'Relatório Faturamento', description: 'Comprovação mensal das compensações: faturamento, notas e impostos pagos.', status: 'pendente', isExpanded: false },
      { id: '4', title: 'Comprovação de Compensações', description: 'Documentos que comprovam compensações realizadas e seus valores.', status: 'pendente', isExpanded: false },
      { id: '6', title: 'Comprovação de Email', description: 'Evidências de comunicação por e-mail durante o período fiscal.', status: 'pendente', isExpanded: false },
      { id: '7', title: 'Notas Fiscais Enviadas', description: 'Notas fiscais e comprovantes emitidos no período da competência.', status: 'pendente', isExpanded: false },
      { id: '8', title: 'Parecer Final', description: 'Parecer gerado pela IA.', status: 'pendente', isExpanded: true }
    ]);
  };

  // Função para criar competência quando há dados para salvar
  const createCompetenciaWithData = async (competenciaData) => {
    try {
      setLoading(true);
      
      // Obter ID do usuário logado do localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const created_by = currentUser.id;
      
      if (!created_by) {
        console.error('❌ Erro: created_by é undefined ou null');
        setError('Usuário não encontrado. Faça login novamente.');
        return null;
      }

      if (!currentUser.organizacao) {
        console.error('❌ Erro: organizacao é undefined ou null');
        setError('Organização do usuário não encontrada. Faça login novamente.');
        return null;
      }

      // Determinar organização a ser usada:
      // - Se for Portes e tiver selecionado uma organização, usar a selecionada
      // - Caso contrário, usar a organização do usuário
      const organizacaoParaCriar = (currentUser.organizacao === 'portes' && selectedOrganizacao) 
        ? selectedOrganizacao 
        : currentUser.organizacao;

      // Validação: Se for Portes, deve ter selecionado uma organização
      if (currentUser.organizacao === 'portes' && !selectedOrganizacao) {
        setError('Por favor, selecione uma organização antes de criar o compliance.');
        toast({
          title: "Organização Obrigatória",
          description: "Selecione uma organização antes de criar o compliance.",
          variant: "destructive",
        });
        return null;
      }

      // Validar que tipoCompliance está definido
      if (!tipoCompliance) {
        toast({
          title: "Erro",
          description: "Tipo de compliance não definido. Por favor, selecione um tipo de compliance.",
          variant: "destructive",
        });
        setLoading(false);
        return null;
      }

      console.log('🔍 Criando competência com dados:', competenciaData);
      console.log('🔍 Organização para criar:', organizacaoParaCriar);
      console.log('🔍 Tipo Compliance:', tipoCompliance);

      const response = await fetch(`${API_BASE}/compliance/competencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser.organizacao || 'cassems',
          'x-tipo-compliance': tipoCompliance
        },
        body: JSON.stringify({ 
          ...competenciaData,
          created_by,
          organizacao_criacao: organizacaoParaCriar || 'cassems',
          tipo_compliance: tipoCompliance // tipo_compliance é obrigatório
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Competência criada com sucesso:', data.data);
        return data.data;
      } else {
        console.error('❌ Erro ao criar competência:', data.error);
        setError(data.error || 'Erro ao criar competência');
        return null;
      }
    } catch (err) {
      console.error('❌ Erro na requisição:', err);
      setError('Erro ao criar competência');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Função para excluir competência
  const deleteCompetencia = async (competenciaId: string) => {
    try {
      // Verificar se o usuário está carregado, se não, tentar carregar
      if (!currentUser) {
        console.log(' Usuário não carregado, tentando carregar...');
        await loadCurrentUser();

        // Se ainda não estiver carregado, usar dados do localStorage
        if (!currentUser) {
          const userFromStorage = JSON.parse(localStorage.getItem('user') || '{}');
          if (!userFromStorage.id) {
            toast({
              title: "Erro",
              description: "Usuário não encontrado. Faça login novamente.",
              variant: "destructive",
            });
            return;
          }

          // Usar dados do localStorage temporariamente
          const tempUser = {
            id: userFromStorage.id,
            nome: userFromStorage.nome || 'Usuário',
            organizacao: userFromStorage.organizacao || 'cassems'
          };

          const response = await fetch(`${API_BASE}/compliance/competencias/${competenciaId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: tempUser.id,
              organizacao: tempUser.organizacao
            }),
          });

          const data = await response.json();

          if (data.success) {
            // Recarregar lista de competências
            await loadCompetencias();

            // SEMPRE voltar para a lista após exclusão
            setCurrentView('list');
            setCurrentCompetenciaId(null);
            setSelectedCompetencia(null);

            toast({
              title: "Competência Excluída",
              description: "A competência foi excluída com sucesso.",
              variant: "default",
            });
          } else {
            toast({
              title: "Erro",
              description: data.error || "Erro ao excluir competência",
              variant: "destructive",
            });
          }
          return;
        }
      }

      const response = await fetch(`${API_BASE}/compliance/competencias/${competenciaId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          organizacao: currentUser.organizacao
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Recarregar lista de competências
        await loadCompetencias();

        // SEMPRE voltar para a lista após exclusão
        setCurrentView('list');
        setCurrentCompetenciaId(null);
        setSelectedCompetencia(null);

        toast({
          title: "Competência Excluída",
          description: "A competência foi excluída com sucesso.",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao excluir competência",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao excluir competência:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir competência",
        variant: "destructive",
      });
    }
  };

  // Função auxiliar para salvar campo no banco (sem recursão)
  const saveFieldToDatabaseDirect = async (dbField: string, value: string, userId: number, competenciaId?: string) => {
    const competenciaIdToUse = competenciaId || currentCompetenciaId;
    if (!competenciaIdToUse) {
      console.error('🔍 Nenhuma competência selecionada');
      return;
    }

    try {
      console.log('🔍 Salvando campo diretamente:', {
        competenciaId: competenciaIdToUse,
        field: dbField,
        value,
        user_id: userId
      });

      const response = await fetch(`${API_BASE}/compliance/compliance/${competenciaIdToUse}/field`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field: dbField, value, user_id: userId }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Campo salvo com sucesso:', dbField, value);
      } else {
        console.error('❌ Erro ao salvar campo:', data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error('❌ Erro na requisição:', err);
      setError('Erro ao salvar campo');
    }
  };

  // Salvar campo específico no banco
  const saveFieldToDatabase = async (itemId: string, field: 'data' | 'observacoes' | 'competencia_inicio' | 'competencia_fim', value: string, userId: number, competenciaId?: string) => {
    const competenciaIdToUse = competenciaId || currentCompetenciaId;
    if (!competenciaIdToUse) {
      console.error('🔍 Nenhuma competência selecionada');
      return;
    }

    try {
      // Mapear campos específicos para cada item
      let dbField: string;

      if (itemId === '1') { // Período
        if (field === 'data') {
          // Para competência período, vamos salvar em campos separados
          // O valor vem no formato "data_inicio|data_fim" ou apenas "data_inicio"
          const [dataInicio, dataFim] = value.split('|');
          
          // Salvar data de início
          if (dataInicio) {
            await saveFieldToDatabaseDirect('competencia_inicio', dataInicio, userId, competenciaIdToUse);
          }
          
          // Salvar data de fim (se existir)
          if (dataFim) {
            await saveFieldToDatabaseDirect('competencia_fim', dataFim, userId, competenciaIdToUse);
          }
          
          return; // Retornar aqui pois já salvamos os campos separados
        } else if (field === 'observacoes') {
          dbField = 'competencia_referencia_texto';
        } else {
          console.error('🔍 Campo não suportado para item 1:', field);
          return;
        }
      } else {
        // Para outros itens, usar o mapeamento específico por campo
        const itemFieldMapping = {
          '2': { 'observacoes': 'relatorio_inicial' },
          '3': { 'observacoes': 'relatorio_faturamento' },
          '4': { 'observacoes': 'imposto_compensado', 'valor': 'valor_compensado' },
          '6': { 'observacoes': 'emails' },
          '7': { 'observacoes': 'estabelecimento' },
          '8': { 'observacoes': 'parecer' }
        };

        const itemMapping = itemFieldMapping[itemId];
        if (!itemMapping) {
          console.error('🔍 Item não mapeado:', itemId);
          return;
        }

        dbField = itemMapping[field];
        if (!dbField) {
          console.error('🔍 Campo não mapeado para item:', itemId, field);
          return;
        }
        
        // Se for um campo de data para itens que não são o item 1, não salvar no banco
        if (field === 'data' && itemId !== '1') {
          console.log('🔍 Campo de data para item', itemId, '- não salvo no banco (não suportado)');
          return;
        }
        
        // Se for um campo de email, não salvar no banco (não suportado pelo backend)
        const unsupportedFields = ['emailRemetente', 'emailDestinatario', 'emailEnviado'];
        if (unsupportedFields.includes(field as string)) {
          console.log('🔍 Campo de email para item', itemId, '- não salvo no banco (não suportado)');
          return;
        }
      }

      console.log('🔍 Salvando no banco:', {
        competenciaId: currentCompetenciaId,
        field: dbField,
        value,
        user_id: userId,
        itemId: itemId,
        originalField: field
      });
      
      console.log('🔍 DEBUG - Campo que será enviado para o backend:', dbField);
      console.log('🔍 DEBUG - Valor que será enviado:', value);
      console.log('🔍 DEBUG - Tipo do valor:', typeof value);

      const response = await fetch(`${API_BASE}/compliance/compliance/${currentCompetenciaId}/field`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field: dbField, value, user_id: userId }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Campo salvo com sucesso:', dbField, value);
      } else {
        console.error('❌ Erro ao salvar campo:', data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error('❌ Erro na requisição:', err);
      setError('Erro ao salvar campo');
    }
  };

  // Função para atualizar competencia_periodo
  const updateCompetenciaReferencia = async (competenciaId: string, novaData: string) => {
    try {
      // Se for um período (contém '|'), não salvar no campo competencia_referencia
      // pois esse campo é DATE e não aceita períodos
      if (novaData.includes('|')) {
        console.log('🔍 Período detectado, não atualizando competencia_referencia (campo DATE não suporta períodos)');
        return;
      }

      // Obter usuário atual do localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (!currentUser.id) {
        console.error('❌ Usuário não encontrado para updateCompetenciaReferencia');
        return;
      }

      const response = await fetch(`${API_BASE}/compliance/compliance/${competenciaId}/field`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ field: 'competencia_referencia', value: novaData, user_id: currentUser.id }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(' Competência de referência atualizada:', novaData);
        // Recarregar a lista de competências para mostrar a data atualizada
        await loadCompetencias();
      } else {
        console.error(' Erro ao atualizar competência de referência:', data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error(' Erro na requisição:', err);
      setError('Erro ao atualizar competência de referência');
    }
  };

  // Função para carregar dados do usuário atual
  const loadCurrentUser = async () => {
    try {
      // Primeiro tentar carregar do localStorage
      const userFromStorage = localStorage.getItem('user');
      if (userFromStorage) {
        const parsedUser = JSON.parse(userFromStorage);
        console.log('🔍 Usuário carregado do localStorage:', parsedUser);
        setCurrentUser(parsedUser);
        return;
      }

      // Se não estiver no localStorage, tentar carregar via API
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      const response = await fetch(`${API_BASE}/auth/user/${userId}`);
      const data = await response.json();

      if (data.success) {
        console.log('🔍 Usuário carregado via API:', data.data);
        setCurrentUser(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    }
  };

  // Carregar organizações disponíveis (para Portes)
  const loadOrganizacoes = async () => {
    try {
      if (currentUser?.organizacao === 'portes') {
        const response = await fetch(`${API_BASE}/documentos/organizacoes`);
        if (response.ok) {
          const orgs = await response.json();
          setOrganizacoesDisponiveis(orgs || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar organizações:', error);
    }
  };

  // Handlers estáveis com useCallback
  const handleFieldChange = useCallback((id: string, field: 'valor' | 'data' | 'observacoes' | 'emailRemetente' | 'emailDestinatario' | 'emailAssunto' | 'emailEnviado', value: string | boolean) => {
    const updatedItems = prev => prev.map(item =>
      item.id === id
        ? { ...item, [field]: value }
        : item
    );
    
    setComplianceItems(updatedItems);
    
    // Salvar campos de email no localStorage se houver competência
    if (currentCompetenciaId && ['emailRemetente', 'emailDestinatario', 'emailAssunto', 'emailEnviado'].includes(field)) {
      try {
        const emailFieldsKey = `compliance-email-${currentCompetenciaId}`;
        const savedFields = JSON.parse(localStorage.getItem(emailFieldsKey) || '{}');
        savedFields[id] = {
          ...savedFields[id],
          [field]: value
        };
        localStorage.setItem(emailFieldsKey, JSON.stringify(savedFields));
        console.log('💾 Campos de email salvos no localStorage:', savedFields);
      } catch (error) {
        console.error('Erro ao salvar campos de email:', error);
      }
    }
  }, [currentCompetenciaId]);

  const handleFileUpload = useCallback(async (id: string, file: File) => {
    console.log(' Arquivo selecionado para item:', id, file.name);
    
    // Se não há competência selecionada, criar uma nova
    if (!currentCompetenciaId) {
      console.log('🔍 Nenhuma competência selecionada, criando nova via upload...');
      
      // Criar competência com data atual como referência e tipo_compliance
      const competenciaData = {
        competencia_referencia: new Date().toISOString().split('T')[0],
        tipo_compliance: tipoCompliance
      };
      
      const novaCompetencia = await createCompetenciaWithData(competenciaData);
      
      if (!novaCompetencia) {
        console.error('Erro ao criar nova competência para upload.');
        return null;
      }
      
      // Definir a nova competência como atual
      setCurrentCompetenciaId(novaCompetencia.id.toString());
      setSelectedCompetencia(novaCompetencia);
      
      // Reinicializar cards com status pendente
      resetComplianceItemsToPending();
      
      // Mudar para modo de visualização
      setCurrentView('view');
      
      console.log('✅ Nova competência criada via upload:', novaCompetencia.id);
      return novaCompetencia;
    }
    
    // Se já há competência, recarregar dados para atualizar status baseado em anexos
    if (currentCompetenciaId) {
      console.log('🔍 Recarregando dados após upload para atualizar status...');
      await loadComplianceData(currentCompetenciaId);
    }
    
    return null;
  }, [currentCompetenciaId, createCompetenciaWithData, loadComplianceData]);

  const handleRemoveFile = useCallback((id: string, anexoId: number) => {
    console.log(' Removendo anexo:', id, anexoId);
    // A remoção real é feita no componente ComplianceItemCard
  }, []);

  // Função para alternar expansão do card
  const handleToggleExpanded = useCallback((id: string) => {
    // Card Parecer Final não pode ser fechado
    if (id === '8') {
      return;
    }
    
    setComplianceItems(prev => {
      const newItems = prev.map(item =>
        item.id === id
          ? { ...item, isExpanded: !item.isExpanded }
          : item
      );
      // Salvar estado no localStorage
      saveCardsState(newItems, currentCompetenciaId || undefined);
      return newItems;
    });
  }, []);

  // Função para salvar item completo - APENAS quando clicar em Salvar
  const handleSave = useCallback(async (id: string) => {
    const item = complianceItems.find(item => item.id === id);
    if (!item) return;

    // Se não há competência selecionada, criar uma nova
    let competenciaIdToUse = currentCompetenciaId;
    
    if (!competenciaIdToUse) {
      console.log('🔍 Nenhuma competência selecionada, criando nova...');
      
      // Criar competência com data atual como referência e tipo_compliance
      const competenciaData = {
        competencia_referencia: new Date().toISOString().split('T')[0],
        tipo_compliance: tipoCompliance
      };
      
      const novaCompetencia = await createCompetenciaWithData(competenciaData);
      
      if (!novaCompetencia) {
        setError('Erro ao criar nova competência.');
        return;
      }
      
      // Usar o ID da competência criada diretamente
      competenciaIdToUse = novaCompetencia.id.toString();
      
      // Definir a nova competência como atual
      setCurrentCompetenciaId(competenciaIdToUse);
      setSelectedCompetencia(novaCompetencia);
      
      // Reinicializar cards com status pendente
      resetComplianceItemsToPending();
      
      // Mudar para modo de visualização
      setCurrentView('view');
      
      console.log('✅ Nova competência criada:', novaCompetencia.id);
    }

    // Obter usuário atual do localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('🔍 Debug - currentUser do localStorage:', currentUser);
    console.log('🔍 Debug - currentUser.id:', currentUser.id);
    console.log('🔍 Debug - typeof currentUser.id:', typeof currentUser.id);
    
    if (!currentUser.id) {
      console.error('❌ Usuário não encontrado no localStorage');
      setError('Usuário não encontrado. Faça login novamente.');
      return;
    }

    try {
      setLoading(true);
      console.log(' Iniciando salvamento do item:', id, item);
      console.log('🔍 Debug - currentUser.id para salvar:', currentUser.id);

      // Salvar cada campo no banco se tiver valor
      const promises = [];
      
      if (item.data && item.data.trim()) {
        console.log('🔍 Salvando data:', item.data, 'para item:', id, 'com user_id:', currentUser.id, 'competenciaId:', competenciaIdToUse);
        promises.push(saveFieldToDatabase(id, 'data', item.data, currentUser.id, competenciaIdToUse));
      }
      if (item.observacoes && item.observacoes.trim()) {
        console.log('🔍 Salvando observacoes:', item.observacoes, 'para item:', id, 'com user_id:', currentUser.id, 'competenciaId:', competenciaIdToUse);
        promises.push(saveFieldToDatabase(id, 'observacoes', item.observacoes, currentUser.id, competenciaIdToUse));
      }
      
      console.log('🔍 Total de promises para salvar:', promises.length);

      // Aguardar todas as operações de salvamento
      await Promise.all(promises);

      // Se for o item "Período" e tiver data, atualizar a competencia_referencia
      if (id === '1' && item.data && item.data.trim()) {
        // Para período, usar a data de início como referência
        const dataInicio = item.data.includes('|') ? item.data.split('|')[0] : item.data;
        await updateCompetenciaReferencia(currentCompetenciaId, dataInicio);
        setCompetenciaData(dataInicio);
        console.log('🔍 Competência de referência atualizada para:', dataInicio);
      }

      // RECARREGAR dados do banco para pegar as informações atualizadas
      if (currentCompetenciaId) {
        console.log('🔍 Debug - Chamando loadComplianceData para:', currentCompetenciaId);
        await loadComplianceData(currentCompetenciaId);
        console.log('🔍 Debug - loadComplianceData concluído');
        
        // Atualizar a lista de competências para mostrar a nova competência
        console.log('🔍 Atualizando lista de competências...');
        await loadCompetencias();
        console.log('🔍 Lista de competências atualizada');
      }

      // Atualizar estado local APENAS após salvar com sucesso
      setComplianceItems(prev => {
        const newItems = prev.map(i =>
          i.id === id
            ? {
                ...i,
                data: item.data || '',
                observacoes: item.observacoes || '',
                status: 'concluido' as const, // Mudar para concluído
                isExpanded: false // Fechar o card
              }
            : i
        );
        saveCardsState(newItems, currentCompetenciaId || undefined);
        return newItems;
      });

      // Mostrar notificação de sucesso
      toast({
        title: "Salvo com sucesso!",
        description: `Campo "${item.title}" foi salvo com sucesso.`,
        variant: "default",
      });

    } catch (err) {
      console.error(' Erro ao salvar item:', err);
      setError('Erro ao salvar item');
    } finally {
      setLoading(false);
    }
  }, [complianceItems, currentCompetenciaId]);

  // Atualizar função gerarParecer
  const gerarParecer = useCallback(async (competenciaId: string) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/compliance/competencias/${competenciaId}/gerar-parecer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          organizacao: currentUser?.organizacao
        })
      });

      const data = await response.json();

      if (data.success) {
        // Recarregar dados da competência para mostrar o parecer
        await loadComplianceData(competenciaId);

        // Mostrar notificação de sucesso
        toast({
          title: "Parecer Gerado!",
          description: "O parecer foi gerado com sucesso usando IA.",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao gerar parecer",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao gerar parecer:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar parecer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser, loadComplianceData]);

  // Função para obter badge de status - ESTÁVEL
  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'concluido':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'em_analise':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Em Análise</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  }, []);

  // Função para gerar e baixar PDF do parecer
  const downloadParecerPDF = (parecerText: string) => {
    try {
      // Criar um novo documento
      const doc = new jsPDF();
      
      // Configurar fonte e tamanho
      doc.setFont('helvetica');
      doc.setFontSize(12);
      
      // Título
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Parecer de Compliance Fiscal', 20, 30);
      
      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Informações da competência
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Competência: ${competenciaData || 'N/A'}`, 20, 45);
      doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 50);
      doc.text(`Gerado por: ${currentUser?.nome || 'Sistema'}`, 20, 55);
      
      // Espaçamento
      doc.text('', 20, 65);
      
      // Conteúdo do parecer
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      // Dividir o texto em linhas que cabem na página
      const pageWidth = 170; // Largura útil da página
      const lineHeight = 6;
      const maxLinesPerPage = 40;
      let yPosition = 75;
      let currentPage = 1;
      
      const lines = doc.splitTextToSize(parecerText, pageWidth);
      
      lines.forEach((line: string, index: number) => {
        // Verificar se precisa de nova página
        if (yPosition > 280) {
          doc.addPage();
          currentPage++;
          yPosition = 20;
        }
        
        doc.text(line, 20, yPosition);
        yPosition += lineHeight;
      });
      
      // Rodapé
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${totalPages}`, 20, 290);
        doc.text('Sistema de Compliance Fiscal - AuditaAI', 150, 290);
      }
      
      // Baixar o arquivo
      const fileName = `parecer_compliance_${competenciaData || 'competencia'}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "PDF Gerado",
        description: "Parecer baixado com sucesso!",
      });
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar PDF do parecer",
        variant: "destructive",
      });
    }
  };

  // Resetar estado quando tipoCompliance mudar
  useEffect(() => {
    console.log('🔄 Tipo Compliance mudou para:', tipoCompliance);
    // Resetar para a visualização de lista
    setCurrentView('list');
    setSelectedCompetencia(null);
    setCurrentCompetenciaId(null);
    setCompetenciaData('');
    setCompetenciaPeriodo('');
    setComplianceItems(initializeComplianceItems());
    setError(null);
  }, [tipoCompliance]);

  // Carregar dados na inicialização e quando tipoCompliance mudar
  useEffect(() => {
    console.log(' Carregando competências...');
    if (currentUser) {
      loadCompetencias();
    }
  }, [currentUser, tipoCompliance]);

  // Carregar dados do usuário na inicialização
  useEffect(() => {
    const loadUser = async () => {
      await loadCurrentUser();
    };
    loadUser();
  }, []);

  // Verificar primeiro acesso quando usuário e tipoCompliance estiverem disponíveis
  useEffect(() => {
    const checkFirstAccess = async () => {
      console.log('🔍 [FRONTEND] Verificando primeiro acesso...');
      console.log('🔍 [FRONTEND] currentUser:', currentUser);
      console.log('🔍 [FRONTEND] tipoCompliance:', tipoCompliance);
      
      // Se não tem usuário, tentar carregar do localStorage
      let userId = currentUser?.id;
      if (!userId) {
        try {
          const userFromStorage = localStorage.getItem('user');
          if (userFromStorage) {
            const parsedUser = JSON.parse(userFromStorage);
            userId = parsedUser.id;
            console.log('🔍 [FRONTEND] userId do localStorage:', userId);
          }
        } catch (error) {
          console.error('❌ [FRONTEND] Erro ao ler localStorage:', error);
        }
      }
      
      if (!userId || !tipoCompliance) {
        console.log('⏳ [FRONTEND] Aguardando userId ou tipoCompliance...', { userId, tipoCompliance });
        setCheckingFirstAccess(true);
        return;
      }

      // Não verificar primeiro acesso para ICMS e Equalização
      if (tipoCompliance === 'icms-equalizacao') {
        console.log('ℹ️ [FRONTEND] ICMS e Equalização - pulando verificação de primeiro acesso');
        setCheckingFirstAccess(false);
        setShowFirstAccessForm(false);
        return;
      }

      try {
        setCheckingFirstAccess(true);
        // Construir URL corretamente - verificar se API_BASE já contém /api
        let baseUrl = API_BASE;
        if (baseUrl.endsWith('/api')) {
          baseUrl = baseUrl.slice(0, -4); // Remove /api do final
        }
        const url = `${baseUrl}/api/compliance/first-access/${tipoCompliance}/check`;
        const body = { userId: userId };
        
        console.log('🔍 [FRONTEND] Fazendo requisição para:', url);
        console.log('🔍 [FRONTEND] API_BASE original:', API_BASE);
        console.log('🔍 [FRONTEND] baseUrl ajustado:', baseUrl);
        console.log('🔍 [FRONTEND] Body:', body);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        console.log('🔍 [FRONTEND] Response status:', response.status);
        console.log('🔍 [FRONTEND] Response ok:', response.ok);

        const data = await response.json();
        console.log('🔍 [FRONTEND] Response data:', data);
        
        if (data.success) {
          // Mostrar formulário se:
          // 1. É primeiro acesso (não tem registro), OU
          // 2. Tem dados mas não está assinado (formulário incompleto)
          const shouldShowForm = data.isFirstAccess || (data.hasData && !data.isFormCompleted);
          console.log('🔍 [FRONTEND] isFirstAccess:', data.isFirstAccess);
          console.log('🔍 [FRONTEND] hasData:', data.hasData);
          console.log('🔍 [FRONTEND] isSigned:', data.isSigned);
          console.log('🔍 [FRONTEND] isFormCompleted:', data.isFormCompleted);
          console.log('🔍 [FRONTEND] data.data:', data.data);
          console.log('🔍 [FRONTEND] shouldShowForm:', shouldShowForm);
          setShowFirstAccessForm(shouldShowForm);
        } else {
          console.error('❌ [FRONTEND] Erro ao verificar primeiro acesso:', data.error);
          // Em caso de erro, não bloquear o acesso
          setShowFirstAccessForm(false);
        }
      } catch (error) {
        console.error('❌ [FRONTEND] Erro ao verificar primeiro acesso:', error);
        console.error('❌ [FRONTEND] Stack:', error.stack);
        // Em caso de erro, não bloquear o acesso
        setShowFirstAccessForm(false);
      } finally {
        setCheckingFirstAccess(false);
        console.log('✅ [FRONTEND] Verificação de primeiro acesso concluída');
      }
    };

    checkFirstAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, tipoCompliance]);

  // Carregar organizações quando usuário for Portes
  useEffect(() => {
    if (currentUser?.organizacao === 'portes') {
      loadOrganizacoes();
    }
  }, [currentUser]);

  // Carregar dados da competência ao recarregar a página (se houver uma selecionada)
  useEffect(() => {
    const loadSavedCompetencia = async () => {
      if (currentCompetenciaId && currentView === 'view' && currentUser) {
        console.log('🔄 Recarregando competência salva:', currentCompetenciaId);
        await loadComplianceData(currentCompetenciaId);
      }
    };
    loadSavedCompetencia();
  }, [currentUser]); // Executa apenas uma vez quando o usuário é carregado

  // Função para abrir modal de confirmação
  const handleDeleteClick = (competenciaId: string) => {
    setCompetenciaToDelete(competenciaId);
    setShowDeleteDialog(true);
  };

  // Função para confirmar exclusão
  const confirmDelete = async () => {
    if (competenciaToDelete) {
      await deleteCompetencia(competenciaToDelete);
      setShowDeleteDialog(false);
      setCompetenciaToDelete(null);
    }
  };

  // Função para cancelar exclusão
  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setCompetenciaToDelete(null);
  };

  // Renderizar tela de lista
  const renderListCompetencias = () => (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold">
            Compliance Fiscal - {getTipoComplianceName(tipoCompliance)}
          </h1>
          {currentUser?.organizacao === 'portes' ? (
            <p className="text-xs lg:text-sm text-green-600 mt-1">
              Acesso completo a todas as competências do sistema.
            </p>
          ) : (
            <p className="text-xs lg:text-sm text-blue-600 mt-1">
              Visualizando as competências da sua organização ({currentUser?.organizacao || 'carregando...'}).
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/compliance')}
            className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">Voltar</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
          <Button 
            onClick={createCompetencia} 
            className="bg-blue-600 hover:bg-blue-700 text-xs lg:text-sm font-medium" 
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Criando...' : 'Nova Competência'}
          </Button>
        </div>
      </div>

      {/* Legenda de Leis Vigentes */}
      {tipoCompliance && (() => {
        const leis = getLeisVigentes(tipoCompliance as any);
        
        if (leis.length === 0) return null;
        
        return (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setLeisVigentesModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm lg:text-base text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
            >
              <AlertCircle className="h-4 w-4 lg:h-5 lg:w-5" />
              <span className="font-medium">Leis Vigentes ({leis.length})</span>
              <span className="text-xs text-blue-500">Clique para ver todas</span>
            </button>
          </div>
        );
      })()}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800"> {error}</p>
        </div>
      )}


      {/* Lista de competências em formato vertical */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 lg:p-4 border border-gray-200 rounded-lg bg-white gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 lg:h-6 w-48 lg:w-64" />
                  <Skeleton className="h-3 lg:h-4 w-24 lg:w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 lg:h-10 w-16 lg:w-20" />
                  <Skeleton className="h-8 lg:h-10 w-12 lg:w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : Array.isArray(competencias) && competencias.length > 0 ? (
          competencias.map((competencia) => (
            <div
              key={competencia.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 lg:p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 break-words">
                    {(() => {
                      // Priorizar os novos campos separados
                      if (competencia.competencia_inicio || competencia.competencia_fim) {
                        const dataInicio = competencia.competencia_inicio ? 
                          formatDateBR(competencia.competencia_inicio) : '';
                        const dataFim = competencia.competencia_fim ? 
                          formatDateBR(competencia.competencia_fim) : '';
                        
                        if (dataInicio && dataFim) {
                          return `Período (${dataInicio}) - (${dataFim})`;
                        } else if (dataInicio) {
                          return `Período (${dataInicio})`;
                        }
                      }
                      
                      // Fallback para competencia_referencia (compatibilidade)
                      if (competencia.competencia_referencia) {
                        // Extrair apenas a parte da data do formato ISO completo
                        const dataFormatada = competencia.competencia_referencia.includes('T') 
                          ? competencia.competencia_referencia.split('T')[0]
                          : competencia.competencia_referencia;
                        const formatted = formatCompetenciaTitle(dataFormatada);
                        return formatted;
                      }
                      
                      return `Período ${competencia.competencia_formatada || 'N/A'}`;
                    })()}
                  </h3>

                  {/* Badge de organização */}
                  {getOrganizationBadge(competencia.created_by_organizacao, competencia.created_by_cor)}

                  <Badge 
                    className={competencia.parecer_texto 
                      ? "bg-green-100 text-green-800 border-green-200" 
                      : "bg-yellow-100 text-yellow-800 border-yellow-200"
                    }
                  >
                    {competencia.parecer_texto ? 'Concluído' : 'Em Andamento'}
                  </Badge>
                </div>

                {/* Na seção de informações da competência, adicionar indicador de parecer */}
                <div className="mt-1 text-xs sm:text-sm text-gray-600 space-y-1">
                  <p className="break-words">
                    {competencia.ultima_alteracao_por 
                      ? `Última alteração por ${competencia.ultima_alteracao_por_nome || competencia.ultima_alteracao_por} (${formatOrganizationName(competencia.ultima_alteracao_organizacao)})${competencia.ultima_alteracao_em ? ` em ${formatDateTimeBR(competencia.ultima_alteracao_em)}` : ''}`
                      : `Criado por ${competencia.created_by_nome || 'Usuário'} (${formatOrganizationName(competencia.created_by_organizacao)})`
                    }
                  </p>
                  <p className="break-words">Criado em: {formatDateBR(competencia.created_at)}</p>
                  
                  {/* Indicador de parecer disponível */}
                  {competencia.parecer_texto && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm break-words">Parecer disponível para download</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {/* Botão de download do parecer se existir */}
                {competencia.parecer_texto && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadParecerPDF(competencia.parecer_texto)}
                    className="border-green-600 text-green-600 hover:bg-green-50 text-xs lg:text-sm font-medium w-full sm:w-auto whitespace-nowrap"
                  >
                    <Download className="h-3 w-3 lg:h-4 lg:w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Baixar Parecer</span>
                    <span className="sm:hidden">Baixar</span>
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCompetencia(competencia);
                    setCurrentCompetenciaId(competencia.id.toString());
                    setCurrentView('view');
                    
                    // Salvar estado atual no localStorage
                    localStorage.setItem('compliance-current-id', competencia.id.toString());
                    localStorage.setItem('compliance-current-view', 'view');
                    
                    // Carregar dados de compliance da competência selecionada
                    loadComplianceData(competencia.id.toString());
                  }}
                  className="text-xs lg:text-sm font-medium w-full sm:w-auto whitespace-nowrap"
                >
                  <Eye className="h-3 w-3 lg:h-4 lg:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Visualizar</span>
                  <span className="sm:hidden">Ver</span>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhuma competência encontrada</p>
            <Button
              onClick={createCompetencia}
              className="mt-4 bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Criando...' : 'Criar Competência'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Renderizar tela de criação
  const renderCreateCompetencia = () => (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold">Nova Competência</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Preencha os campos abaixo para criar uma nova competência
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Button 
            variant="outline" 
            onClick={() => setCurrentView('list')}
            className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">Voltar</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
        </div>
      </div>

      {/* Seletor de Organização (apenas para Portes) */}
      {currentUser?.organizacao === 'portes' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Selecionar Organização</CardTitle>
            <CardDescription className="text-sm">
              Selecione a organização para a qual será criado o compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="organizacao-select">Organização *</Label>
              <Select value={selectedOrganizacao} onValueChange={setSelectedOrganizacao}>
                <SelectTrigger id="organizacao-select" className={!selectedOrganizacao ? 'border-red-300' : ''}>
                  <SelectValue placeholder="Selecione a organização" />
                </SelectTrigger>
                <SelectContent>
                  {organizacoesDisponiveis.map((org) => (
                    <SelectItem key={org} value={org}>
                      {org.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedOrganizacao && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ É obrigatório selecionar uma organização antes de criar o compliance.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                A pasta de documentos será criada para esta organização e ficará visível para Portes e para a organização selecionada.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {complianceItems.map((item, index) => (
          <ComplianceItemCard
            key={`${item.id}-${index}`}
            item={item}
            onFieldChange={handleFieldChange}
            onFileUpload={handleFileUpload}
            onRemoveFile={handleRemoveFile}
            onSave={handleSave}
            gerarParecer={gerarParecer}
            getStatusBadge={getStatusBadge}
            loading={loading}
            currentCompetenciaId={currentCompetenciaId}
            onToggleExpanded={handleToggleExpanded}
            downloadParecerPDF={downloadParecerPDF}
            complianceItems={complianceItems}
            apiBase={API_BASE}
            currentUserEmail={currentUser?.email}
            competenciaPeriodo={competenciaPeriodo}
          />
        ))}
      </div>
    </div>
  );

  // Renderizar tela de visualização
  const renderViewCompetencia = () => (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold">Competência</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            Preencha os campos abaixo para gerar o parecer de compliance
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Button 
            onClick={() => handleDeleteClick(selectedCompetencia?.id || '')}
            variant="destructive"
            disabled={loading || loadingCompetencia}
            className="text-xs lg:text-sm font-medium"
          >
            <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">Excluir</span>
            <span className="sm:hidden">Excluir</span>
          </Button>
          <Button 
            onClick={() => {
              setCurrentView('list');
              setCurrentCompetenciaId(null);
              localStorage.removeItem('compliance-current-id');
              localStorage.removeItem('compliance-current-view');
            }} 
            variant="outline" 
            disabled={loadingCompetencia}
            className="text-xs lg:text-sm font-medium border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
            <span className="hidden sm:inline">Voltar</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
        </div>
      </div>

      {loadingCompetencia ? (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">Carregando Competência</p>
                <p className="text-sm text-gray-600">Aguarde enquanto carregamos os dados...</p>
              </div>
            </div>
          </div>
          
          {/* Skeleton Loading para os cards */}
          <div className="space-y-6">
            <ComplianceItemSkeleton />
            <ComplianceItemSkeleton />
            <ComplianceItemSkeleton />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {complianceItems.map((item, index) => (
          <ComplianceItemCard
            key={`${item.id}-${index}`}
            item={item}
            onFieldChange={handleFieldChange}
            onFileUpload={handleFileUpload}
            onRemoveFile={handleRemoveFile}
            onSave={handleSave}
            gerarParecer={gerarParecer}
            getStatusBadge={getStatusBadge}
            loading={loading}
            currentCompetenciaId={currentCompetenciaId}
            onToggleExpanded={handleToggleExpanded}
            downloadParecerPDF={downloadParecerPDF}
          complianceItems={complianceItems}
          apiBase={API_BASE}
          currentUserEmail={currentUser?.email}
          competenciaPeriodo={competenciaPeriodo}
        />
      ))}
        </div>
      )}

      {/* Adicionar seção de histórico */}
      {!loadingCompetencia && (
        <HistoricoAlteracoes historico={historico} loading={loadingHistorico} />
      )}
    </div>
  );

  // Verificar se o usuário é da rede_frota e redirecionar
  useEffect(() => {
    const checkRedeFrota = () => {
      const userFromStorage = localStorage.getItem('user');
      if (userFromStorage) {
        try {
          const parsedUser = JSON.parse(userFromStorage);
          const org = parsedUser.organizacao?.toLowerCase() || '';
          if (org === 'rede_frota' || org === 'marajó / rede frota') {
            navigate('/cronograma');
            return;
          }
        } catch {
          // Ignorar erros
        }
      }
      if (currentUser) {
        const org = currentUser.organizacao?.toLowerCase() || '';
        if (org === 'rede_frota' || org === 'marajó / rede frota') {
          navigate('/cronograma');
        }
      }
    };
    checkRedeFrota();
  }, [currentUser, navigate]);

  // Renderizar conteúdo baseado na view atual
  return (
    <>
      {/* Formulário de primeiro acesso */}
      {showFirstAccessForm && tipoCompliance && (() => {
        // Obter userId do currentUser ou do localStorage
        let userId = currentUser?.id;
        if (!userId) {
          try {
            const userFromStorage = localStorage.getItem('user');
            if (userFromStorage) {
              const parsedUser = JSON.parse(userFromStorage);
              userId = parsedUser.id;
            }
          } catch (error) {
            console.error('Erro ao obter userId do localStorage:', error);
          }
        }
        
        if (!userId) return null;
        
        return (
          <FirstAccessForm
            tipoCompliance={tipoCompliance}
            userId={userId}
          onComplete={async () => {
            setShowFirstAccessForm(false);
            setCheckingFirstAccess(false);
            // Recarregar competências após completar o cadastro
            if (currentUser) {
              loadCompetencias();
            }
            // Recarregar verificação de primeiro acesso para garantir que não mostra mais o formulário
            // Isso é importante quando o usuário salva sem assinar
            if (currentUser?.id && tipoCompliance) {
              try {
                let baseUrl = API_BASE;
                if (baseUrl.endsWith('/api')) {
                  baseUrl = baseUrl.slice(0, -4);
                }
                const response = await fetch(`${baseUrl}/api/compliance/first-access/${tipoCompliance}/check`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: currentUser.id }),
                });
                const data = await response.json();
                if (data.success) {
                  setShowFirstAccessForm(data.isFirstAccess);
                }
              } catch (error) {
                console.error('Erro ao recarregar verificação de primeiro acesso:', error);
              }
            }
          }}
          onCancel={() => {
            // Se cancelar, redirecionar para a tela de seleção
            navigate('/compliance');
          }}
        />
        );
      })()}

      {/* Mostrar loading enquanto verifica primeiro acesso */}
      {checkingFirstAccess && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Verificando acesso...</p>
          </div>
        </div>
      )}

      {/* Conteúdo principal - só mostrar se não estiver verificando ou mostrando formulário */}
      {!checkingFirstAccess && !showFirstAccessForm && (
        <>
          {currentView === 'list' && renderListCompetencias()}
          {currentView === 'create' && renderCreateCompetencia()}
          {currentView === 'view' && renderViewCompetencia()}
        </>
      )}
      
      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base lg:text-lg break-words">
              <Trash2 className="h-4 w-4 lg:h-5 lg:w-5 text-red-600 flex-shrink-0" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm lg:text-base break-words">
              Tem certeza que deseja excluir esta competência? Esta ação não pode ser desfeita.
              <br /><br />
              <strong className="text-red-600">⚠️ ATENÇÃO:</strong> Todos os dados relacionados serão excluídos permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs sm:text-sm break-words">
                <li>Dados da competência</li>
                <li>Histórico de alterações</li>
                <li>Arquivos anexados</li>
                <li>Pareceres gerados</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={cancelDelete} className="text-xs lg:text-sm w-full sm:w-auto order-2 sm:order-1">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-xs lg:text-sm w-full sm:w-auto order-1 sm:order-2"
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Leis Vigentes */}
      {tipoCompliance && (() => {
        const leis = getLeisVigentes(tipoCompliance as any);
        const status = getStatusLeisVigentes(tipoCompliance as any);
        
        if (leis.length === 0) return null;
        
        return (
          <Dialog open={leisVigentesModalOpen} onOpenChange={setLeisVigentesModalOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg lg:text-xl">
                  <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
                  Leis Vigentes - {getTipoComplianceName(tipoCompliance)}
                </DialogTitle>
                <DialogDescription className="text-sm lg:text-base">
                  Todas as legislações vigentes relacionadas a este tipo de compliance
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {leis.map((lei, index) => (
                    <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <h3 className="font-semibold text-blue-900 mb-2 text-sm lg:text-base">
                        {lei.titulo}
                      </h3>
                      <p className="text-xs lg:text-sm text-blue-700 mb-3">
                        {lei.descricao}
                      </p>
                      {lei.link && (
                        <a 
                          href={lei.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-xs lg:text-sm font-medium underline"
                        >
                          Ver {lei.titulo.includes('Lei') ? 'Lei' : lei.titulo.includes('Decreto') ? 'Decreto' : 'Consulta'} Completa →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                
                {status && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="bg-blue-100 rounded-lg p-3 lg:p-4">
                      <p className="text-xs lg:text-sm text-blue-800">
                        <strong className="font-semibold">Status:</strong> {status}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </>
  );
}
