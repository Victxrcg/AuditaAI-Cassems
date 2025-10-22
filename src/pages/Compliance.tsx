import { useState, useCallback, useMemo, useEffect, memo } from 'react';
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
  Lock,
  Mail
} from 'lucide-react';
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
  type Anexo
} from '@/services/anexosService';
import { formatDateBR, formatDateTimeBR, formatCompetenciaTitle } from '@/utils/dateUtils';
import { toast } from '@/components/ui/use-toast';
import jsPDF from 'jspdf';

// Atualizar interfaces para incluir organização
interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  valor?: string;
  data?: string;
  observacoes?: string;
  anexos?: Anexo[];
  status: 'pendente' | 'concluido' | 'em_analise';
  lastUpdated?: string;
  updatedBy?: string;
  organizacao?: string; // Aceitar qualquer organização
  isExpanded?: boolean;
  // Campos específicos para envio de email (Notas Fiscais)
  emailRemetente?: string;
  emailDestinatario?: string;
}

interface Competencia {
  id: string;
  mes: string;
  ano: string;
  status: 'em_andamento' | 'concluida';
  parecer_gerado: boolean;
  created_at: string;
  created_by_nome: string;
  created_by_organizacao?: string; // Aceitar qualquer organização
  created_by_cor?: string;
  competencia_formatada?: string;
  competencia_referencia?: string;
  competencia_inicio?: string; // Novo campo para data de início
  competencia_fim?: string; // Novo campo para data de fim
  parecer_texto?: string;
  // Adicionar propriedades para última alteração
  ultima_alteracao_por?: string;
  ultima_alteracao_por_nome?: string;
  ultima_alteracao_organizacao?: string; // Aceitar qualquer organização
  ultima_alteracao_em?: string;
}

// Adicionar interface para histórico
interface HistoricoAlteracao {
  id: number;
  campo_alterado: string;
  valor_anterior: string;
  valor_novo: string;
  alterado_por_nome: string;
  alterado_por_organizacao: string; // Aceitar qualquer organização
  alterado_por_cor: string;
  alterado_em: string;
}

// Função auxiliar para formatar nome da organização
const formatOrganizationName = (org: string | undefined) => {
  if (!org) return 'Organização';
  
  const nomes: Record<string, string> = {
    'portes': 'PORTES',
    'cassems': 'CASSEMS',
    'rede_frota': 'MARAJÓ / REDE FROTA'
  };
  
  return nomes[org.toLowerCase()] || org.toUpperCase().replace(/_/g, ' ');
};

// Função auxiliar para clarear uma cor hex
const lightenColor = (hex: string) => {
  // Converter hex para RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Retornar com opacidade baixa para clarear
  return `rgba(${r}, ${g}, ${b}, 0.15)`;
};

// Função auxiliar para escurecer uma cor hex
const darkenColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Reduzir valores para escurecer
  const darken = (val: number) => Math.max(0, Math.floor(val * 0.6));
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
};

// Função para verificar se todas as etapas anteriores ao Parecer Final estão completas
const canGenerateAIParecer = async (complianceItems: ComplianceItem[], competenciaId: string | null): Promise<boolean> => {
  const requiredSteps = ['1', '2', '3', '4', '6', '7']; // Etapas obrigatórias antes do Parecer Final
  
  for (const stepId of requiredSteps) {
    const step = complianceItems.find(item => item.id === stepId);
    if (!step) return false;
    
    // Verificar se a etapa tem dados OU anexos
    const hasData = !!(step.valor || step.data || step.observacoes);
    let hasAnexos = false;
    
    if (competenciaId) {
      try {
        const tipoAnexo = getTipoAnexoFromItemId(stepId);
        const anexosData = await listAnexos(competenciaId);
        const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
        hasAnexos = filteredAnexos.length > 0;
      } catch (error) {
        console.error('Erro ao verificar anexos:', error);
      }
    }
    
    // Se a etapa não está completa (sem dados E sem anexos), não pode gerar parecer
    if (!hasData && !hasAnexos) {
      console.log(`🔍 Etapa ${stepId} não está completa: hasData=${hasData}, hasAnexos=${hasAnexos}`);
      return false;
    }
  }
  
  console.log('🔍 Todas as etapas estão completas, pode gerar parecer IA');
  return true;
};

// Função para verificar se uma etapa pode ser acessada (fluxo sequencial)
const canAccessStep = async (itemId: string, complianceItems: ComplianceItem[], competenciaId: string | null): Promise<boolean> => {
  const stepOrder = ['1', '2', '3', '4', '6', '7', '8']; // Ordem das etapas
  
  // A primeira etapa sempre pode ser acessada
  if (itemId === '1') return true;
  
  const currentIndex = stepOrder.indexOf(itemId);
  if (currentIndex === -1) return true; // Se não está na lista, permite acesso
  
  // Verificar se a etapa anterior foi concluída
  const previousStepId = stepOrder[currentIndex - 1];
  const previousStep = complianceItems.find(item => item.id === previousStepId);
  
  if (!previousStep) return true;
  
  // Verificar se a etapa anterior tem dados preenchidos
  const hasData = Boolean(
    (previousStep.data && previousStep.data.trim()) ||
    (previousStep.valor && previousStep.valor.trim()) ||
    (previousStep.observacoes && previousStep.observacoes.trim())
  );
  
  // Verificar se há anexos no banco de dados para a etapa anterior
  let hasAnexos = false;
  if (competenciaId) {
    try {
      const tipoAnexo = getTipoAnexoFromItemId(previousStepId);
      const anexosData = await listAnexos(competenciaId);
      const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
      hasAnexos = filteredAnexos.length > 0;
      console.log(`🔍 Verificando anexos para ${previousStepId}: ${filteredAnexos.length} anexos encontrados`);
    } catch (error) {
      console.error('Erro ao verificar anexos:', error);
    }
  }
  
  // A etapa anterior está completa se tem dados OU anexos
  const canAccess = hasData || hasAnexos;
  console.log(`🔍 canAccessStep ${itemId}: hasData=${hasData}, hasAnexos=${hasAnexos}, canAccess=${canAccess}`);
  return canAccess;
};

// Mover as funções para FORA do componente principal
const getOrganizationBadge = (organizacao: string | undefined, cor?: string) => {
  if (!organizacao) return null;

  // Configuração padrão para organizações conhecidas
  const configPadrao: Record<string, { nome: string; cor: string; corClara: string; corTexto: string }> = {
    portes: {
      nome: 'PORTES',
      cor: '#10B981',
      corClara: '#D1FAE5',
      corTexto: '#065F46'
    },
    cassems: {
      nome: 'CASSEMS',
      cor: '#3B82F6',
      corClara: '#DBEAFE',
      corTexto: '#1E40AF'
    }
  };

  // Verificar se existe configuração padrão
  const orgConfig = configPadrao[organizacao.toLowerCase()];
  
  let org;
  if (orgConfig) {
    // Usar configuração padrão
    org = orgConfig;
  } else {
    // Criar configuração dinâmica baseada na cor fornecida
    const corBase = cor || '#8B5CF6'; // Roxo como padrão
    org = {
      nome: organizacao.toUpperCase().replace(/_/g, ' '),
      cor: corBase,
      corClara: lightenColor(corBase),
      corTexto: darkenColor(corBase)
    };
  }

  return (
    <Badge
      style={{
        backgroundColor: org.corClara,
        color: org.corTexto,
        border: `1px solid ${org.cor}`
      }}
      className="text-xs font-medium"
    >
      {org.nome}
    </Badge>
  );
};

const getEditIndicator = (item: ComplianceItem, cor?: string) => {
  if (!item.updatedBy || !item.organizacao) return null;

  // Configuração padrão para organizações conhecidas
  const configPadrao: Record<string, { nome: string; cor: string }> = {
    portes: {
      nome: 'Portes',
      cor: '#10B981'
    },
    cassems: {
      nome: 'Cassems',
      cor: '#3B82F6'
    }
  };

  // Verificar se existe configuração padrão
  const orgConfig = configPadrao[item.organizacao.toLowerCase()];
  
  let org;
  if (orgConfig) {
    org = orgConfig;
  } else {
    // Criar configuração dinâmica
    org = {
      nome: item.organizacao.charAt(0).toUpperCase() + item.organizacao.slice(1).replace(/_/g, ' '),
      cor: cor || '#8B5CF6'
    };
  }

  return (
    <div className="text-xs text-gray-500 flex items-center gap-1">
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: org.cor }}
      />
      Editado por {item.updatedBy} ({org.nome})
      {item.lastUpdated && ` em ${formatDateTimeBR(item.lastUpdated)}`}
    </div>
  );
};

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
  complianceItems // ← ADICIONAR ESTA PROP para verificar fluxo sequencial
}: {
  item: ComplianceItem;
  onFieldChange: (id: string, field: 'valor' | 'data' | 'observacoes' | 'emailRemetente' | 'emailDestinatario', value: string) => void;
  onFileUpload: (id: string, file: File) => Promise<any>;
  onRemoveFile: (id: string, anexoId: number) => void;
  onSave: (id: string) => void;
  gerarParecer: (id: string) => void;
  getStatusBadge: (status: string) => JSX.Element;
  loading: boolean;
  currentCompetenciaId: string | null;
  onToggleExpanded: (id: string) => void;
  downloadParecerPDF: (parecerText: string) => void;
  complianceItems: ComplianceItem[]; // ← ADICIONAR ESTA PROP
  apiBase: string; // ← ADICIONAR API_BASE
}) => {
  const [uploading, setUploading] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>(item.anexos || []);
  const [canAccess, setCanAccess] = useState(true);
  const [canGenerateAI, setCanGenerateAI] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false); // Estado para controlar drag over

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
          setAnexos(filteredAnexos);
          
          // Verificar acesso novamente após carregar anexos
          const access = await canAccessStep(item.id, complianceItems, currentCompetenciaId);
          setCanAccess(access);
        } catch (error) {
          console.error('Erro ao carregar anexos:', error);
        }
      }
    };
    loadAnexosAndCheckAccess();
  }, [currentCompetenciaId, item.id, complianceItems]);

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

  const handleRemoveAnexo = async (anexoId: number) => {
    try {
      await removeAnexo(anexoId);
      setAnexos(prev => prev.filter(anexo => anexo.id !== anexoId));
      onRemoveFile(item.id, anexoId);
    } catch (error) {
      console.error('Erro ao remover anexo:', error);
      alert('Erro ao remover anexo');
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

  // Se o card não está expandido, mostrar apenas o resumo
  if (!item.isExpanded) {
    return (
      <Card className={`mb-6 bg-white transition-shadow ${!canAccess ? 'opacity-50' : 'shadow-sm hover:shadow-lg'}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className={`text-lg ${!canAccess ? 'text-gray-400' : ''}`}>
                {item.id === '1' && item.data
                  ? formatCompetenciaTitle(item.data)
                  : item.title
                }
              </CardTitle>
              <CardDescription className={!canAccess ? 'text-gray-400' : ''}>
                {item.description}
              </CardDescription>
              {!canAccess && (
                <div className="text-xs text-orange-600 mt-1 font-medium">
                  🔒 Complete a etapa anterior para desbloquear
                </div>
              )}
              {item.lastUpdated && canAccess && (
                <div className="text-xs text-gray-500 mt-1">
                  Última atualização: {formatDateTimeBR(item.lastUpdated)} por {item.updatedBy}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(item.status)}
              <Button
                onClick={() => onToggleExpanded(item.id)}
                size="sm"
                variant="outline"
                disabled={!canAccess}
                className={!canAccess ? 'cursor-not-allowed' : ''}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {canAccess ? 'Editar' : 'Bloqueado'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Se for o Parecer Final, renderizar interface especial de IA
  if (item.id === '8') {
    return (
      <Card className="mb-6 bg-white transition-shadow shadow-sm hover:shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                {item.title}
              </CardTitle>
              <CardDescription>
                {item.description} - Gerado automaticamente por IA
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                   Gerar Parecer com Inteligência Artificial
                </h3>
                <p className="text-blue-700 text-sm">
                  A IA analisará todos os campos preenchidos e gerará um parecer completo.
                </p>
              </div>
              <div className="flex gap-2">
                {!item.observacoes ? (
                  // Se não há parecer gerado, mostrar botão para gerar
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => gerarParecer(currentCompetenciaId || '')}
                      size="lg"
                      className={`${
                        canGenerateAI 
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                          : "bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white cursor-not-allowed opacity-60"
                      }`}
                      disabled={loading || !canGenerateAI}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Gerando...
                        </>
                      ) : (
                        <>
                          {canGenerateAI ? (
                            <MessageSquare className="h-5 w-5 mr-2" />
                          ) : (
                            <Lock className="h-5 w-5 mr-2" />
                          )}
                          Gerar Parecer IA
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  // Se já há parecer gerado, mostrar apenas botão para baixar
                  <Button
                    onClick={() => downloadParecerPDF(item.observacoes)}
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-50"
                    size="lg"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Baixar PDF
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Mostrar loading enquanto gera o parecer */}
          {loading && !item.observacoes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <div>
                  <h4 className="font-medium text-blue-900">Gerando Parecer com IA...</h4>
                  <p className="text-sm text-blue-700">Aguarde enquanto a inteligência artificial analisa os dados e gera o parecer.</p>
                </div>
              </div>
            </div>
          )}

          {/* Mostrar parecer gerado se existir */}
          {item.observacoes && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Parecer Gerado:</span>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border">
                {item.observacoes}
              </div>
            </div>
          )}

          {/* Lista de anexos do parecer */}
          {anexos.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Pareceres gerados:</span>
              </div>
              <div className="space-y-2">
                {anexos.map((anexo) => (
                  <div key={anexo.id} className="flex items-center justify-between bg-white p-3 rounded border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">{anexo.nome_arquivo || 'Arquivo sem nome'}</span>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(anexo.tamanho_arquivo || 0)})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAnexo(anexo)}
                        className="text-green-700 border-green-300"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Baixar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAnexo(anexo.id)}
                        className="text-red-700 border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.lastUpdated && (
            <div className="text-xs text-gray-500 border-t pt-2">
              Última atualização: {formatDateTimeBR(item.lastUpdated)} por {item.updatedBy}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Renderização normal para outros itens
  return (
    <Card className={`mb-6 bg-white transition-shadow ${!canAccess ? 'opacity-50' : 'shadow-sm hover:shadow-lg'}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className={`text-lg ${!canAccess ? 'text-gray-400' : ''}`}>
              {item.id === '1' && item.data
                ? formatCompetenciaTitle(item.data)
                : item.title
              }
            </CardTitle>
            <CardDescription className={!canAccess ? 'text-gray-400' : ''}>
              {item.description}
            </CardDescription>
            {!canAccess && (
              <div className="text-xs text-orange-600 mt-1 font-medium">
                🔒 Complete a etapa anterior para desbloquear
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Badge de organização */}
            {getOrganizationBadge(item.organizacao)}
            {getStatusBadge(item.status)}
            <Button
              onClick={() => onSave(item.id)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading || !canAccess}
            >
              {loading ? 'Salvando...' : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  {canAccess ? 'Salvar' : 'Bloqueado'}
                </>
              )}
            </Button>
            <Button
              onClick={() => onToggleExpanded(item.id)}
              size="sm"
              variant="outline"
            >
              Fechar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className={`space-y-4 ${!canAccess ? 'pointer-events-none' : ''}`}>
        {!canAccess ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-lg font-medium">Etapa Bloqueada</p>
            <p className="text-sm">Complete a etapa anterior para desbloquear esta seção.</p>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-1`}>

          {/* Campo Período - apenas para Período (id: 1) */}
          {item.id === '1' && (
            <div>
              <Label htmlFor={`data-${item.id}`}>
                <Calendar className="h-4 w-4 inline mr-1" />
                Período da Competência
              </Label>
              <div className="flex gap-2 mt-1">
                <div className="flex-1">
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
                    min="1900-01-01"
                    max="2099-12-31"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Data início"
                  />
                </div>
                <div className="flex-1">
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
                    min="1900-01-01"
                    max="2099-12-31"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Data fim"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Selecione o período da competência fiscal (ano entre 1900 e 2099)
              </p>
            </div>
          )}

          <div>
            <Label htmlFor={`observacoes-${item.id}`}>
              <MessageSquare className="h-4 w-4 inline mr-1" />
              Observações
            </Label>
            <Textarea
              id={`observacoes-${item.id}`}
              value={item.observacoes || ''}
              onChange={(e) => onFieldChange(item.id, 'observacoes', e.target.value)}
              placeholder="Digite suas observações aqui..."
              className="mt-1 w-full min-h-[80px] resize-none"
              rows={3}
            />
          </div>

          {/* Campos de Email - apenas para Notas Fiscais (ID '7') */}
          {item.id === '7' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Envio por Email</h3>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                Envie as notas fiscais anexadas diretamente por email
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`email-remetente-${item.id}`}>
                    <Mail className="h-4 w-4 inline mr-1" />
                    Seu Email (Remetente)
                  </Label>
                  <Input
                    id={`email-remetente-${item.id}`}
                    type="email"
                    value={item.emailRemetente || ''}
                    onChange={(e) => onFieldChange(item.id, 'emailRemetente', e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor={`email-destinatario-${item.id}`}>
                    <Mail className="h-4 w-4 inline mr-1" />
                    Email Destinatário
                  </Label>
                  <Input
                    id={`email-destinatario-${item.id}`}
                    type="email"
                    value={item.emailDestinatario || ''}
                    onChange={(e) => onFieldChange(item.id, 'emailDestinatario', e.target.value)}
                    placeholder="destinatario@exemplo.com"
                    className="mt-1"
                  />
                </div>
              </div>
              
              {/* Botão de envio de email */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={async () => {
                    if (!item.emailRemetente || !item.emailDestinatario) {
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
                        description: "Anexe pelo menos uma nota fiscal antes de enviar por email.",
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
                      
                      const response = await fetch(`${apiBase}/api/email/enviar-notas-fiscais`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          emailRemetente: item.emailRemetente,
                          emailDestinatario: item.emailDestinatario,
                          competenciaId: currentCompetenciaId
                        })
                      });

                      const data = await response.json();

                      if (data.success) {
                        toast({
                          title: "Email enviado!",
                          description: `Notas fiscais enviadas de ${item.emailRemetente} para ${item.emailDestinatario}`,
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
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!item.emailRemetente || !item.emailDestinatario || anexos.length === 0 || loading}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {loading ? 'Enviando...' : 'Enviar por Email'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Seção de Anexos - apenas para itens que não sejam Período */}
        {item.id !== '1' && (
          <div>
            <Label htmlFor={`anexo-${item.id}`}>Anexar Arquivo</Label>
            <div className="mt-1">
              {/* Lista de anexos existentes */}
              {anexos.length > 0 && (
                <div className="mb-4 space-y-2">
                  {anexos.map((anexo) => (
                    <div key={anexo.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getFileIcon(anexo.nome_arquivo || 'arquivo')}</span>
                        <div>
                          <span className="text-sm font-medium">{anexo.nome_arquivo || 'Arquivo sem nome'}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({formatFileSize(anexo.tamanho_arquivo || 0)})
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadAnexo(anexo)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveAnexo(anexo.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload de novo arquivo */}
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
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
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-2">
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
                  onClick={() => document.getElementById(`anexo-${item.id}`)?.click()}
                  disabled={uploading}
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
const loadCardsState = (): Record<string, any> => {
  try {
    const savedState = localStorage.getItem('compliance-cards-state');
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      const stateMap: Record<string, any> = {};
      parsedState.forEach((item: any) => {
        stateMap[item.id] = item;
      });
      return stateMap;
    }
  } catch (error) {
    console.error('Erro ao carregar estado dos cards:', error);
  }
  return {};
};

// Função para inicializar complianceItems com estado salvo
const initializeComplianceItems = (): ComplianceItem[] => {
  const defaultItems: ComplianceItem[] = [
    { id: '1', title: 'Período', description: 'Informe o período fiscal referente à competência.', status: 'pendente', isExpanded: false },
    { id: '2', title: 'Relatório Técnico', description: 'Análise fiscal inicial com pendências, cronograma e parecer sobre as compensações.', status: 'pendente', isExpanded: false },
    { id: '3', title: 'Relatório Faturamento', description: 'Comprovação mensal das compensações: faturamento, notas e impostos pagos.', status: 'pendente', isExpanded: false },
    { id: '4', title: 'Comprovação de Compensações', description: 'Documentos que comprovam compensações realizadas e seus valores.', status: 'pendente', isExpanded: false },
    { id: '6', title: 'Comprovação de Email', description: 'Evidências de comunicação por e-mail durante o período fiscal.', status: 'pendente', isExpanded: false },
    { id: '7', title: 'Notas Fiscais', description: 'Notas fiscais e comprovantes emitidos no período da competência.', status: 'pendente', isExpanded: false },
    { id: '8', title: 'Parecer Final', description: 'Parecer gerado pela IA.', status: 'pendente', isExpanded: true }
    
  ];

  const savedState = loadCardsState();

  return defaultItems.map(item => {
    const savedItem = savedState[item.id];
    if (savedItem) {
      return {
        ...item,
        isExpanded: savedItem.isExpanded ?? item.isExpanded,
        status: savedItem.status ?? item.status,
        lastUpdated: savedItem.lastUpdated ?? item.lastUpdated
        // Removido: updatedBy: savedItem.updatedBy ?? item.updatedBy
        // O updatedBy deve vir do banco de dados, não do localStorage
      };
    }
    return item;
  });
};

// Componente de Skeleton Loading para Compliance Items
const ComplianceItemSkeleton = () => (
  <Card className="w-full bg-white">
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Componente para exibir histórico de alterações
const HistoricoAlteracoes = ({ historico, loading }: { historico: HistoricoAlteracao[], loading: boolean }) => {
  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Carregando histórico...</span>
        </div>
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">Nenhuma alteração registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Pencil className="h-5 w-5" />
        Histórico de Alterações
      </h3>
      <div className="space-y-3">
        {historico.map((alteracao) => (
          <div key={alteracao.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: alteracao.alterado_por_cor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {alteracao.alterado_por_nome}
                </span>
                {getOrganizationBadge(alteracao.alterado_por_organizacao, alteracao.alterado_por_cor)}
                <span className="text-xs text-gray-500">
                  {formatDateTimeBR(alteracao.alterado_em)}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">Campo:</span> {alteracao.campo_alterado}
              </div>
              
              {/* Exibir informações específicas para parecer_texto */}
              {alteracao.campo_alterado === 'parecer_texto' ? (
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                  <span className="font-medium">Ação:</span> {alteracao.valor_novo}
                  {alteracao.valor_anterior && alteracao.valor_anterior !== '[Nenhum parecer anterior]' && (
                    <div className="mt-1 text-xs text-gray-600">
                      Substituiu parecer anterior
                    </div>
                  )}
                </div>
              ) : alteracao.campo_alterado.startsWith('anexo_') ? (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded border-l-4 border-green-400">
                  <span className="font-medium">Ação:</span> {alteracao.valor_novo}
                  {alteracao.valor_anterior && alteracao.valor_anterior !== '[Nenhum arquivo anterior]' && (
                    <div className="mt-1 text-xs text-gray-600">
                      {alteracao.valor_anterior}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    Tipo: {alteracao.campo_alterado.replace('anexo_', '').replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              ) : (
                <>
                  {alteracao.valor_anterior && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Valor anterior:</span> {alteracao.valor_anterior}
                    </div>
                  )}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Novo valor:</span> {alteracao.valor_novo}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mover as funções para dentro do componente principal Compliance
export default function Compliance() {
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

  // Estado para colapso da seção de Leis Vigentes
  const [leisVigentesExpanded, setLeisVigentesExpanded] = useState(true);

  // API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
      console.log('🔍 currentUser:', currentUser);
      console.log('🔍 localStorage user:', localStorage.getItem('user'));
      
      // Fazer requisição com filtro de organização
      const response = await fetch(`${API_BASE}/compliance/competencias?organizacao=${userOrg}`, {
        headers: {
          'x-user-organization': userOrg
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
                } else if (dataInicio) {
                  // Apenas data de início
                  updatedItem.data = dataInicio;
                  setCompetenciaData(dataInicio);
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
              if (competencia.imposto_compensado_observacoes) {
                updatedItem.observacoes = competencia.imposto_compensado_observacoes;
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

      console.log('🔍 Criando competência com dados:', competenciaData);

      const response = await fetch(`${API_BASE}/compliance/competencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser.organizacao || 'cassems'
        },
        body: JSON.stringify({ 
          ...competenciaData,
          created_by,
          organizacao_criacao: currentUser.organizacao || 'cassems'
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
        // Para outros itens, usar o mapeamento antigo
        const itemFieldMapping: Record<string, string> = {
          '2': 'relatorio_inicial',
          '3': 'relatorio_faturamento',
          '4': 'imposto_compensado',
          '6': 'emails',
          '7': 'estabelecimento',
          '8': 'parecer'
        };

        dbField = itemFieldMapping[itemId];
        if (!dbField) {
          console.error('🔍 Campo não mapeado:', itemId);
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

  // Handlers estáveis com useCallback
  const handleFieldChange = useCallback((id: string, field: 'valor' | 'data' | 'observacoes' | 'emailRemetente' | 'emailDestinatario', value: string) => {
    setComplianceItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, [field]: value }
        : item
    ));
  }, []);

  const handleFileUpload = useCallback(async (id: string, file: File) => {
    console.log(' Arquivo selecionado para item:', id, file.name);
    
    // Se não há competência selecionada, criar uma nova
    if (!currentCompetenciaId) {
      console.log('🔍 Nenhuma competência selecionada, criando nova via upload...');
      
      // Criar competência com data atual como referência
      const competenciaData = {
        competencia_referencia: new Date().toISOString().split('T')[0]
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
      
      // Criar competência com data atual como referência
      const competenciaData = {
        competencia_referencia: new Date().toISOString().split('T')[0]
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

  // Carregar dados na inicialização
  useEffect(() => {
    console.log(' Carregando competências...');
    if (currentUser) {
      loadCompetencias();
    }
  }, [currentUser]);

  // Carregar dados do usuário na inicialização
  useEffect(() => {
    loadCurrentUser();
  }, []);

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">
            Compliance Fiscal
          </h1>
          {currentUser?.organizacao === 'portes' ? (
            <p className="text-sm text-green-600 mt-1">
              Acesso completo a todas as competências do sistema.
            </p>
          ) : (
            <p className="text-sm text-blue-600 mt-1">
              Visualizando as competências da sua organização ({currentUser?.organizacao || 'carregando...'}).
            </p>
          )}
        <div className="flex gap-2">
          <Button onClick={testConnection} variant="outline">
            Testar Conexão
          </Button>
          <Button onClick={createCompetencia} className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Criando...' : 'Nova Competência'}
          </Button>
        </div>
      </div>

      {/* Seção de Leis Vigentes - Colapsável */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-blue-100 rounded-lg p-2 -m-2 transition-colors"
          onClick={() => setLeisVigentesExpanded(!leisVigentesExpanded)}
        >
          <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Leis Vigentes
          </h2>
          <ChevronDown 
            className={`h-5 w-5 text-blue-600 transition-transform duration-200 ${
              leisVigentesExpanded ? 'rotate-180' : ''
            }`} 
          />
        </div>
        
        {leisVigentesExpanded && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-2">Decreto 3.048/1999</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Regulamenta a Previdência Social e estabelece normas para o regime geral de previdência social.
                </p>
                <a 
                  href="https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
                >
                  Ver Decreto Completo →
                </a>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-2">Solução de Consulta COSIT 79/2023</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Orientações sobre consulta de CNPJ e procedimentos fiscais vigentes.
                </p>
                <a 
                  href="http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?facetsExistentes=&orgaosSelecionados=&tiposAtosSelecionados=&lblTiposAtosSelecionados=&ordemColuna=&ordemDirecao=&tipoConsulta=formulario&tipoAtoFacet=&siglaOrgaoFacet=&anoAtoFacet=&termoBusca=consulta+cnpj&numero_ato=79&tipoData=1&dt_inicio=&dt_fim=&ano_ato=&p=1&optOrdem=relevancia&p=1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
                >
                  Ver Consulta Completa →
                </a>
              </div>
            </div>
            <div className="text-xs text-blue-600">
              <strong>Status:</strong> Ambas as legislações estão vigentes e devem ser observadas nos procedimentos de compliance fiscal.
            </div>
          </div>
        )}
      </div>

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
              <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : Array.isArray(competencias) && competencias.length > 0 ? (
          competencias.map((competencia) => (
            <div
              key={competencia.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
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
                <div className="mt-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <p>
                      {competencia.ultima_alteracao_por 
                        ? `Última alteração por ${competencia.ultima_alteracao_por_nome || competencia.ultima_alteracao_por} (${formatOrganizationName(competencia.ultima_alteracao_organizacao)})`
                        : `Criado por ${competencia.created_by_nome || 'Usuário'} (${formatOrganizationName(competencia.created_by_organizacao)})`
                      }
                    </p>
                    {/* Indicador visual da organização */}
                    {competencia.created_by_organizacao && (
                      <div className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: competencia.created_by_cor || '#6B7280'
                          }}
                        />
                        <span className="text-xs font-medium">
                          {formatOrganizationName(competencia.created_by_organizacao)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p>Criado em: {formatDateBR(competencia.created_at)}</p>
                  
                  {/* Indicador de parecer disponível */}
                  {competencia.parecer_texto && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle className="h-4 w-4" />
                      <span>Parecer disponível para download</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {/* Botão de download do parecer se existir */}
                {competencia.parecer_texto && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadParecerPDF(competencia.parecer_texto)}
                    className="border-green-600 text-green-600 hover:bg-green-50"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Baixar Parecer
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCompetencia(competencia);
                    setCurrentCompetenciaId(competencia.id.toString());
                    setCurrentView('view');
                    // Carregar dados de compliance da competência selecionada
                    loadComplianceData(competencia.id.toString());
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Visualizar
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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => setCurrentView('list')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Nova Competência</h1>
      </div>

      <div className="space-y-6">
        {complianceItems.map((item) => (
          <ComplianceItemCard
            key={item.id}
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
          />
        ))}
      </div>
    </div>
  );

  // Renderizar tela de visualização
  const renderViewCompetencia = () => (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Competência
          </h2>
          <p className="text-gray-600">
            Preencha os campos abaixo para gerar o parecer de compliance
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => handleDeleteClick(selectedCompetencia?.id || '')}
            variant="destructive"
            disabled={loading || loadingCompetencia}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>

          <Button onClick={() => setCurrentView('list')} variant="outline" disabled={loadingCompetencia}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
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
          {complianceItems.map((item) => (
          <ComplianceItemCard
            key={item.id}
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

  // Renderizar conteúdo baseado na view atual
  return (
    <>
      {/* Conteúdo principal */}
      {currentView === 'list' && renderListCompetencias()}
      {currentView === 'create' && renderCreateCompetencia()}
      {currentView === 'view' && renderViewCompetencia()}

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Tem certeza que deseja excluir esta competência? Esta ação não pode ser desfeita.
              <br /><br />
              <strong className="text-red-600">⚠️ ATENÇÃO:</strong> Todos os dados relacionados serão excluídos permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Dados da competência</li>
                <li>Histórico de alterações</li>
                <li>Arquivos anexados</li>
                <li>Pareceres gerados</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              {loading ? 'Excluindo...' : 'Sim, Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
