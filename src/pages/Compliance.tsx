import { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  ChevronDown
} from 'lucide-react';
import {
  uploadAnexo,
  listAnexos,
  downloadAnexo,
  removeAnexo,
  getTipoAnexoFromItemId,
  formatFileSize,
  validateFileType,
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
    'rede_frota': 'REDE FROTA'
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

// Função para verificar se uma etapa pode ser acessada (fluxo sequencial)
const canAccessStep = (itemId: string, complianceItems: ComplianceItem[]): boolean => {
  const stepOrder = ['1', '2', '3', '4', '6', '7', '8']; // Ordem das etapas
  
  // A primeira etapa sempre pode ser acessada
  if (itemId === '1') return true;
  
  const currentIndex = stepOrder.indexOf(itemId);
  if (currentIndex === -1) return true; // Se não está na lista, permite acesso
  
  // Verificar se a etapa anterior foi concluída
  const previousStepId = stepOrder[currentIndex - 1];
  const previousStep = complianceItems.find(item => item.id === previousStepId);
  
  if (!previousStep) return true;
  
  // Verificar se a etapa anterior tem dados preenchidos OU anexos
  const hasData = Boolean(
    (previousStep.data && previousStep.data.trim()) ||
    (previousStep.valor && previousStep.valor.trim()) ||
    (previousStep.observacoes && previousStep.observacoes.trim())
  );
  
  const hasAnexos = Boolean(
    previousStep.anexos && previousStep.anexos.length > 0
  );
  
  // A etapa anterior está completa se tem dados OU anexos
  return hasData || hasAnexos;
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
  onFieldChange: (id: string, field: 'valor' | 'data' | 'observacoes', value: string) => void;
  onFileUpload: (id: string, file: File) => void;
  onRemoveFile: (id: string, anexoId: number) => void;
  onSave: (id: string) => void;
  gerarParecer: (id: string) => void;
  getStatusBadge: (status: string) => JSX.Element;
  loading: boolean;
  currentCompetenciaId: string | null;
  onToggleExpanded: (id: string) => void;
  downloadParecerPDF: (parecerText: string) => void;
  complianceItems: ComplianceItem[]; // ← ADICIONAR ESTA PROP
}) => {
  const [uploading, setUploading] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>(item.anexos || []);

  // Verificar se esta etapa pode ser acessada
  const canAccess = canAccessStep(item.id, complianceItems);

  // Carregar anexos quando o componente monta
  useEffect(() => {
    const loadAnexos = async () => {
      if (currentCompetenciaId) {
        try {
          const tipoAnexo = getTipoAnexoFromItemId(item.id);
          const anexosData = await listAnexos(currentCompetenciaId);
          const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
          setAnexos(filteredAnexos);
        } catch (error) {
          console.error('Erro ao carregar anexos:', error);
        }
      }
    };
    loadAnexos();
  }, [currentCompetenciaId, item.id]);

  const handleFileUpload = async (file: File) => {
    if (!currentCompetenciaId) {
      alert('Nenhuma competência selecionada');
      return;
    }

    if (!validateFileType(file)) {
      alert('Arquivo inválido. Verifique se o arquivo não está corrompido.');
      return;
    }

    try {
      setUploading(true);
      const tipoAnexo = getTipoAnexoFromItemId(item.id);
      const novoAnexo = await uploadAnexo(currentCompetenciaId, tipoAnexo, file);

      // Recarregar anexos do servidor para garantir sincronização
      const anexosData = await listAnexos(currentCompetenciaId);
      const filteredAnexos = anexosData.filter(anexo => anexo.tipo_anexo === tipoAnexo);
      setAnexos(filteredAnexos);

      onFileUpload(item.id, file);
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
      <Card className={`mb-6 ${!canAccess ? 'opacity-50 bg-gray-50' : ''}`}>
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
      <Card className="mb-6">
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
                  <Button
                    onClick={() => gerarParecer(currentCompetenciaId || '')}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Gerando...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-5 w-5 mr-2" />
                        Gerar Parecer IA
                      </>
                    )}
                  </Button>
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
    <Card className={`mb-6 ${!canAccess ? 'opacity-50 bg-gray-50' : ''}`}>
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
            <div className={`grid grid-cols-1 gap-4 ${item.id === '4' ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {/* Campo Valor - apenas para Comprovação de Compensações (id: 4) */}
              {item.id === '4' && (
                <div>
                  <Label htmlFor={`valor-${item.id}`}>
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Valor
                  </Label>
                  <input
                    id={`valor-${item.id}`}
                    type="text"
                    value={item.valor || ''}
                    onChange={(e) => onFieldChange(item.id, 'valor', e.target.value)}
                    placeholder="Digite o valor"
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}

          {/* Campo Período - apenas para Competência Período (id: 1) */}
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
        </div>

        {/* Seção de Anexos */}
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
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
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

            {/* Adicionar indicador de quem editou por último */}
            {getEditIndicator(item)}
          </>
        )}
      </CardContent>
    </Card>
  );
});

// Função para salvar estado dos cards no localStorage
const saveCardsState = (items: ComplianceItem[]) => {
  try {
    const stateToSave = items.map(item => ({
      id: item.id,
      isExpanded: item.isExpanded,
      status: item.status,
      lastUpdated: item.lastUpdated,
      updatedBy: item.updatedBy
    }));
    localStorage.setItem('compliance-cards-state', JSON.stringify(stateToSave));
  } catch (error) {
    console.error('Erro ao salvar estado dos cards:', error);
  }
};

// Função para carregar estado dos cards do localStorage
const loadCardsState = (): Partial<ComplianceItem>[] => {
  try {
    const savedState = localStorage.getItem('compliance-cards-state');
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (error) {
    console.error('Erro ao carregar estado dos cards:', error);
  }
  return [];
};

// Função para inicializar complianceItems com estado salvo
const initializeComplianceItems = (): ComplianceItem[] => {
  const defaultItems: ComplianceItem[] = [
    { id: '1', title: 'Competência Período', description: 'Período da competência fiscal', status: 'pendente', isExpanded: false },
    { id: '2', title: 'Relatório Técnico', description: 'Relatório técnico entregue no início do trabalho, antes das compensações. Anexe: análise da situação fiscal atual, levantamento de pendências, cronograma de regularizações e parecer técnico sobre a viabilidade das compensações.', status: 'pendente', isExpanded: false },
    { id: '3', title: 'Relatório Faturamento', description: 'Relatório mensal entregue a partir do momento que houve as compensações para comprovar essas compensações. Anexe: demonstrativo de faturamento mensal, notas fiscais, comprovantes de pagamento de impostos e documentos que validem as compensações realizadas.', status: 'pendente', isExpanded: false },
    { id: '4', title: 'Comprovação de Compensações', description: 'Documentos que comprovam as compensações de impostos realizadas. Anexe: demonstrativos de compensação, declarações de débitos e créditos tributários (DCTF), comprovantes de compensação, extratos bancários das compensações e relatórios de conferência dos valores compensados.', status: 'pendente', isExpanded: false },
    { id: '6', title: 'Comprovação de Email', description: 'Emails enviados no período da competência para comprovar a comunicação durante o processo. Anexe: print screens dos emails enviados, comprovantes de envio, respostas recebidas, threads de conversa com órgãos competentes e qualquer correspondência eletrônica relacionada ao período da competência.', status: 'pendente', isExpanded: false },
    { id: '7', title: 'Notas Fiscais Enviadas', description: 'Notas fiscais emitidas e enviadas durante o período da competência. Anexe: notas fiscais de saída, notas fiscais de entrada, comprovantes de envio das notas fiscais, XMLs das notas fiscais, relatórios de emissão de notas fiscais e qualquer documentação fiscal relacionada ao período da competência.', status: 'pendente', isExpanded: false },
    { id: '8', title: 'Parecer Final', description: 'Parecer gerado pela IA', status: 'pendente', isExpanded: false }
  ];

  const savedState = loadCardsState();

  return defaultItems.map(item => {
    const savedItem = savedState.find(saved => saved.id === item.id);
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
              {alteracao.valor_anterior && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Valor anterior:</span> {alteracao.valor_anterior}
                </div>
              )}
              <div className="text-sm text-gray-600">
                <span className="font-medium">Novo valor:</span> {alteracao.valor_novo}
              </div>
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
    '1': { // Competência Período
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
      'valor': 'imposto_compensado_texto',
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
      console.log(' Carregando dados de compliance para competência:', competenciaId);

      const response = await fetch(`${API_BASE}/compliance/competencias/${competenciaId}`);
      const data = await response.json();

      if (data.success) {
        const competencia = data.data;
        console.log(' Dados da competência carregados:', competencia);
        console.log('🔍 Debug - ultima_alteracao_por_nome:', competencia.ultima_alteracao_por_nome);
        console.log('🔍 Debug - ultima_alteracao_em:', competencia.ultima_alteracao_em);

        // Mapear os dados do banco para os complianceItems
        const updatedItems = complianceItems.map(item => {
          const itemId = item.id;
          let updatedItem = { ...item };

          // Mapear campos específicos baseado no ID do item
          switch (itemId) {
            case '1': // Competência Período
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
                  ? competencia.competencia_referencia 
                  : new Date(competencia.competencia_referencia).toISOString().split('T')[0];
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
                updatedItem.valor = competencia.imposto_compensado_texto;
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

          // Verificar se o item tem dados preenchidos para marcar como concluído
          const hasData = (updatedItem.data && updatedItem.data.trim()) ||
                         (updatedItem.valor && updatedItem.valor.trim()) ||
                         (updatedItem.observacoes && updatedItem.observacoes.trim());
          
          if (hasData) {
            updatedItem.status = 'concluido';
            // Se o item está concluído, manter fechado (isExpanded = false)
            updatedItem.isExpanded = false;
          } else {
            // Se o item não tem dados, manter expandido para facilitar preenchimento
            updatedItem.isExpanded = true;
          }

          return updatedItem;
        });

        setComplianceItems(updatedItems);
        console.log(' Compliance items atualizados com dados do banco:', updatedItems);

        // Carregar histórico de alterações
        await loadHistorico(competenciaId);
      } else {
        console.error(' Erro ao carregar dados de compliance:', data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error(' Erro ao carregar dados de compliance:', err);
      setError('Erro ao carregar dados de compliance');
    }
  };

  // Função para criar nova competência
  const createCompetencia = async () => {
    try {
      setLoading(true);
      const competencia_referencia = new Date().toISOString().split('T')[0];
      
      // Obter ID do usuário logado do localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const created_by = currentUser.id;
      
      console.log('🔍 currentUser para criação:', currentUser);
      console.log('🔍 organizacao:', currentUser.organizacao);
      console.log('🔍 created_by:', created_by);
      console.log('🔍 typeof created_by:', typeof created_by);

      if (!created_by) {
        console.error('❌ Erro: created_by é undefined ou null');
        setError('Usuário não encontrado. Faça login novamente.');
        return;
      }

      if (!currentUser.organizacao) {
        console.error('❌ Erro: organizacao é undefined ou null');
        setError('Organização do usuário não encontrada. Faça login novamente.');
        return;
      }

      console.log('🔍 Criando nova competência:', { 
        competencia_referencia, 
        created_by, 
        organizacao_criacao: currentUser.organizacao 
      });

      const response = await fetch(`${API_BASE}/compliance/competencias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-organization': currentUser.organizacao || 'cassems'
        },
        body: JSON.stringify({ 
          competencia_referencia, 
          created_by,
          organizacao_criacao: currentUser.organizacao || 'cassems'
        }),
      });

      console.log('🔍 Status da resposta:', response.status);
      console.log('🔍 Headers da resposta:', response.headers);
      
      const data = await response.json();
      console.log('🔍 Dados da resposta:', data);

      if (data.success) {
        console.log('✅ Competência criada:', data.data);
        setCurrentCompetenciaId(data.data.id.toString());
        setCurrentView('create');
        setComplianceItems(prev => prev.map(item => ({
          ...item,
          valor: '',
          data: '',
          observacoes: '',
          anexos: [],
          status: 'pendente',
          lastUpdated: undefined,
          updatedBy: undefined,
          isExpanded: true
        })));
        // REMOVER esta linha: loadComplianceData(data.data.id.toString());
      } else {
        console.error('❌ Erro ao criar competência:', data.error);
        console.error('❌ Detalhes do erro:', data.details);
        setError(data.error || 'Erro ao criar competência');
      }
    } catch (err) {
      console.error('❌ Erro na requisição:', err);
      setError('Erro ao criar competência');
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
  const saveFieldToDatabaseDirect = async (dbField: string, value: string, userId: number) => {
    if (!currentCompetenciaId) {
      console.error('🔍 Nenhuma competência selecionada');
      return;
    }

    try {
      console.log('🔍 Salvando campo diretamente:', {
        competenciaId: currentCompetenciaId,
        field: dbField,
        value,
        user_id: userId
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

  // Salvar campo específico no banco
  const saveFieldToDatabase = async (itemId: string, field: 'valor' | 'data' | 'observacoes' | 'competencia_inicio' | 'competencia_fim', value: string, userId: number) => {
    if (!currentCompetenciaId) {
      console.error('🔍 Nenhuma competência selecionada');
      return;
    }

    try {
      // Mapear campos específicos para cada item
      let dbField: string;

      if (itemId === '1') { // Competência Período
        if (field === 'data') {
          // Para competência período, vamos salvar em campos separados
          // O valor vem no formato "data_inicio|data_fim" ou apenas "data_inicio"
          const [dataInicio, dataFim] = value.split('|');
          
          // Salvar data de início
          if (dataInicio) {
            await saveFieldToDatabaseDirect('competencia_inicio', dataInicio, userId);
          }
          
          // Salvar data de fim (se existir)
          if (dataFim) {
            await saveFieldToDatabaseDirect('competencia_fim', dataFim, userId);
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
          '5': 'valor_compensado',
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
  const handleFieldChange = useCallback((id: string, field: 'valor' | 'data' | 'observacoes', value: string) => {
    setComplianceItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, [field]: value }
        : item
    ));
  }, []);

  const handleFileUpload = useCallback((id: string, file: File) => {
    console.log(' Arquivo selecionado para item:', id, file.name);
    // O upload real é feito no componente ComplianceItemCard
  }, []);

  const handleRemoveFile = useCallback((id: string, anexoId: number) => {
    console.log(' Removendo anexo:', id, anexoId);
    // A remoção real é feita no componente ComplianceItemCard
  }, []);

  // Função para alternar expansão do card
  const handleToggleExpanded = useCallback((id: string) => {
    setComplianceItems(prev => {
      const newItems = prev.map(item =>
        item.id === id
          ? { ...item, isExpanded: !item.isExpanded }
          : item
      );
      // Salvar estado no localStorage
      saveCardsState(newItems);
      return newItems;
    });
  }, []);

  // Função para salvar item completo - APENAS quando clicar em Salvar
  const handleSave = useCallback(async (id: string) => {
    const item = complianceItems.find(item => item.id === id);
    if (!item) return;

    // Verificar se há uma competência selecionada
    if (!currentCompetenciaId) {
      setError('Nenhuma competência selecionada. Clique em "Nova Competência" primeiro.');
      return;
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

      if (item.valor && item.valor.trim()) {
        console.log('🔍 Salvando valor com user_id:', currentUser.id);
        promises.push(saveFieldToDatabase(id, 'valor', item.valor, currentUser.id));
      }
      if (item.data && item.data.trim()) {
        console.log('🔍 Salvando data com user_id:', currentUser.id);
        promises.push(saveFieldToDatabase(id, 'data', item.data, currentUser.id));
      }
      if (item.observacoes && item.observacoes.trim()) {
        console.log('🔍 Salvando observacoes com user_id:', currentUser.id);
        promises.push(saveFieldToDatabase(id, 'observacoes', item.observacoes, currentUser.id));
      }

      // Aguardar todas as operações de salvamento
      await Promise.all(promises);

      // Se for o item "Competência Período" e tiver data, atualizar a competencia_referencia
      if (id === '1' && item.data && item.data.trim()) {
        // Se for um período (contém '|'), salvar como está, senão converter para data única
        const dataParaSalvar = item.data.includes('|') ? item.data : item.data;
        await updateCompetenciaReferencia(currentCompetenciaId, dataParaSalvar);
        setCompetenciaData(dataParaSalvar);
      }

      // RECARREGAR dados do banco para pegar as informações atualizadas
      if (currentCompetenciaId) {
        console.log('🔍 Debug - Chamando loadComplianceData para:', currentCompetenciaId);
        await loadComplianceData(currentCompetenciaId);
        console.log('🔍 Debug - loadComplianceData concluído');
      }

      // Atualizar estado local APENAS após salvar com sucesso
      setComplianceItems(prev => {
        const newItems = prev.map(i =>
          i.id === id
            ? {
                ...i,
                valor: item.valor || '',
                data: item.data || '',
                observacoes: item.observacoes || '',
                status: 'concluido' as const, // Mudar para concluído
                isExpanded: false // Fechar o card
              }
            : i
        );
        saveCardsState(newItems);
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
        {Array.isArray(competencias) && competencias.length > 0 ? (
          competencias.map((competencia) => (
            <div
              key={competencia.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
                          return `Competência Período (${dataInicio} - ${dataFim})`;
                        } else if (dataInicio) {
                          return `Competência Período (${dataInicio})`;
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
                      
                      return `Competência Período ${competencia.competencia_formatada || 'N/A'}`;
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
              {loading ? 'Criando...' : 'Criar Primeira Competência'}
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
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>

          <Button onClick={() => setCurrentView('list')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
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
          />
        ))}
      </div>

      {/* Adicionar seção de histórico */}
      <HistoricoAlteracoes historico={historico} loading={loadingHistorico} />
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
