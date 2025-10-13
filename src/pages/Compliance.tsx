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
  organizacao?: 'portes' | 'cassems'; // ← NOVO
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
  created_by_organizacao?: 'portes' | 'cassems';
  created_by_cor?: string;
  competencia_formatada?: string;
  competencia_referencia?: string;
  parecer_texto?: string;
  // Adicionar propriedades para última alteração
  ultima_alteracao_por?: string;
  ultima_alteracao_por_nome?: string;
  ultima_alteracao_organizacao?: 'portes' | 'cassems';
  ultima_alteracao_em?: string;
}

// Adicionar interface para histórico
interface HistoricoAlteracao {
  id: number;
  campo_alterado: string;
  valor_anterior: string;
  valor_novo: string;
  alterado_por_nome: string;
  alterado_por_organizacao: 'portes' | 'cassems';
  alterado_por_cor: string;
  alterado_em: string;
}

// Mover as funções para FORA do componente principal
const getOrganizationBadge = (organizacao: 'portes' | 'cassems' | undefined) => {
  if (!organizacao) return null;

  const config = {
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

  const org = config[organizacao];

  // Verificar se org existe antes de acessar suas propriedades
  if (!org) {
    console.warn('Organização não reconhecida:', organizacao);
    return null;
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

const getEditIndicator = (item: ComplianceItem) => {
  if (!item.updatedBy || !item.organizacao) return null;

  const config = {
    portes: {
      nome: 'Portes',
      cor: '#10B981'
    },
    cassems: {
      nome: 'Cassems',
      cor: '#3B82F6'
    }
  };

  const org = config[item.organizacao];

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
  downloadParecerPDF // ← ADICIONAR ESTA PROP
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
  downloadParecerPDF: (parecerText: string) => void; // ← ADICIONAR ESTA PROP
}) => {
  const [uploading, setUploading] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>(item.anexos || []);

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
      alert('Tipo de arquivo não permitido. Use PDF, DOC, DOCX, XLS, XLSX, TXT, JPG ou PNG.');
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
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">
                {item.id === '1' && item.data
                  ? (() => {
                      console.log('🔍 Debug - item.data:', item.data);
                      const formatted = formatCompetenciaTitle(item.data);
                      console.log('🔍 Debug - formatCompetenciaTitle result:', formatted);
                      return formatted;
                    })()
                  : item.title
                }
              </CardTitle>
              <CardDescription>{item.description}</CardDescription>
              {item.lastUpdated && (
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
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
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
    <Card className="mb-6">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              {item.id === '1' && item.data
                ? formatCompetenciaTitle(item.data)
                : item.title
              }
            </CardTitle>
            <CardDescription>{item.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge de organização */}
            {getOrganizationBadge(item.organizacao)}
            {getStatusBadge(item.status)}
            <Button
              onClick={() => onSave(item.id)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Salvando...' : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
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

      <CardContent className="space-y-4">
        <div className={`grid grid-cols-1 gap-4 ${(item.id === '4' || item.id === '5') ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {/* Campo Valor - apenas para Imposto Compensado (id: 4) e Valor Compensado (id: 5) */}
          {(item.id === '4' || item.id === '5') && (
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

          {/* Campo Data - apenas para Competência Referencia (id: 1) */}
          {item.id === '1' && (
            <div>
              <Label htmlFor={`data-${item.id}`}>
                <Calendar className="h-4 w-4 inline mr-1" />
                Data da Competência
              </Label>
              <input
                id={`data-${item.id}`}
                type="date"
                value={item.data || ''}
                onChange={(e) => onFieldChange(item.id, 'data', e.target.value)}
                min="1900-01-01"
                max="2099-12-31"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Selecione uma data válida (ano entre 1900 e 2099)
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
                accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.jpg,.jpeg,.png"
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
    { id: '1', title: 'Competência Referencia', description: 'Data da competência fiscal', status: 'pendente', isExpanded: true },
    { id: '2', title: 'Relatório Inicial', description: 'Relatório inicial da empresa', status: 'pendente', isExpanded: true },
    { id: '3', title: 'Relatório Faturamento', description: 'Relatório de faturamento mensal', status: 'pendente', isExpanded: true },
    { id: '4', title: 'Imposto Compensado', description: 'Valor do imposto compensado', status: 'pendente', isExpanded: true },
    { id: '5', title: 'Valor Compensado', description: 'Valor total compensado', status: 'pendente', isExpanded: true },
    { id: '6', title: 'Emails', description: 'Endereços de e-mail para comunicação', status: 'pendente', isExpanded: true },
    { id: '7', title: 'Estabelecimento', description: 'Informações do estabelecimento', status: 'pendente', isExpanded: true },
    { id: '8', title: 'Parecer Final', description: 'Parecer gerado pela IA', status: 'pendente', isExpanded: true }
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
                <Badge
                  style={{
                    backgroundColor: alteracao.alterado_por_organizacao === 'portes' ? '#D1FAE5' : '#DBEAFE',
                    color: alteracao.alterado_por_organizacao === 'portes' ? '#065F46' : '#1E40AF'
                  }}
                  className="text-xs"
                >
                  {alteracao.alterado_por_organizacao === 'portes' ? 'PORTES' : 'CASSEMS'}
                </Badge>
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
    '1': { // Competência Referencia
      'data': 'competencia_referencia',
      'observacoes': 'competencia_referencia_texto'
    },
    '2': { // Relatório Inicial
      'data': 'relatorio_inicial_data',
      'observacoes': 'relatorio_inicial_texto'
    },
    '3': { // Relatório Faturamento
      'data': 'relatorio_faturamento_data',
      'observacoes': 'relatorio_faturamento_texto'
    },
    '4': { // Imposto Compensado
      'valor': 'imposto_compensado_texto',
      'data': 'imposto_compensado_data',
      'observacoes': 'imposto_compensado_observacoes'
    },
    '5': { // Valor Compensado
      'valor': 'valor_compensado_texto',
      'data': 'valor_compensado_data',
      'observacoes': 'valor_compensado_observacoes'
    },
    '6': { // Emails
      'data': 'emails_data',
      'observacoes': 'emails_texto'
    },
    '7': { // Estabelecimento
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
            case '1': // Competência Referencia
              if (competencia.competencia_referencia) {
                const dataISO = new Date(competencia.competencia_referencia);
                const dataFormatada = dataISO.toISOString().split('T')[0];
                updatedItem.data = dataFormatada;
                setCompetenciaData(dataFormatada);
              }
              if (competencia.competencia_referencia_texto) {
                updatedItem.observacoes = competencia.competencia_referencia_texto;
              }
              break;
            case '2': // Relatório Inicial
              if (competencia.relatorio_inicial_texto) {
                updatedItem.observacoes = competencia.relatorio_inicial_texto;
              }
              break;
            case '3': // Relatório Faturamento
              if (competencia.relatorio_faturamento_texto) {
                updatedItem.observacoes = competencia.relatorio_faturamento_texto;
              }
              break;
            case '4': // Imposto Compensado
              if (competencia.imposto_compensado_texto) {
                updatedItem.valor = competencia.imposto_compensado_texto;
              }
              break;
            case '5': // Valor Compensado
              if (competencia.valor_compensado_texto) {
                updatedItem.valor = competencia.valor_compensado_texto;
              }
              break;
            case '6': // Emails
              if (competencia.emails_texto) {
                updatedItem.observacoes = competencia.emails_texto;
              }
              break;
            case '7': // Estabelecimento
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
          if ((updatedItem.data && updatedItem.data.trim()) ||
              (updatedItem.valor && updatedItem.valor.trim()) ||
              (updatedItem.observacoes && updatedItem.observacoes.trim())) {
            updatedItem.status = 'concluido';
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

  // Salvar campo específico no banco
  const saveFieldToDatabase = async (itemId: string, field: 'valor' | 'data' | 'observacoes', value: string, userId: number) => {
    if (!currentCompetenciaId) {
      console.error('🔍 Nenhuma competência selecionada');
      return;
    }

    try {
      // Mapear campos específicos para cada item
      let dbField: string;

      if (itemId === '1') { // Competência Referencia
        if (field === 'data') {
          dbField = 'competencia_referencia';
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

  // Função para atualizar competencia_referencia
  const updateCompetenciaReferencia = async (competenciaId: string, novaData: string) => {
    try {
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

      // Se for o item "Competência Referencia" e tiver data, atualizar a competencia_referencia
      if (id === '1' && item.data && item.data.trim()) {
        await updateCompetenciaReferencia(currentCompetenciaId, item.data);
        setCompetenciaData(item.data);
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
                    {competencia.competencia_referencia
                      ? (() => {
                          const dataISO = new Date(competencia.competencia_referencia);
                          const dataFormatada = dataISO.toISOString().split('T')[0];
                          const formatted = formatCompetenciaTitle(dataFormatada);
                          return `Competência ${formatted.replace('Competência Referencia ', '')}`;
                        })()
                      : `Competência ${competencia.competencia_formatada || 'N/A'}`
                    }
                  </h3>

                  {/* Badge de organização */}
                  {getOrganizationBadge(competencia.created_by_organizacao)}

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
                        ? `Última alteração por ${competencia.ultima_alteracao_por_nome || competencia.ultima_alteracao_por} (${competencia.ultima_alteracao_organizacao === 'portes' ? 'PORTES' : 'CASSEMS'})`
                        : `Criado por ${competencia.created_by_nome || 'Usuário'} (${competencia.created_by_organizacao === 'portes' ? 'PORTES' : 'CASSEMS'})`
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
                          {competencia.created_by_organizacao === 'portes' ? 'Portes' : 'Cassems'}
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
            Competência {competenciaData}
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
