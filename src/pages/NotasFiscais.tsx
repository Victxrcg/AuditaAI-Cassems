import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploadArea, { FileUploadState } from '@/components/FileUploadArea';
import {
  downloadDocumento,
  listarDocumentos,
  removerDocumento,
  uploadDocumento,
  listarPastas,
  criarPasta,
  listarOrganizacoesDocumentos,
  type Documento,
  type Pasta
} from '@/services/documentosService';
import {
  ReceiptText,
  Upload,
  Download,
  FileText,
  Building,
  Eye,
  Trash2,
  AlertTriangle,
  Calendar,
  Link2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';
const DOC_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

const PASTA_NOTAS_FISCAIS = 'Notas Fiscais';

const formatarNomeOrganizacao = (codigo: string) => {
  if (!codigo) return '';
  return codigo
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
};

interface CronogramaItem {
  id: number;
  titulo: string;
  status: string;
  fase_atual?: string;
  data_inicio?: string;
  data_fim?: string;
  responsavel_nome?: string;
  organizacao: string;
}

export default function NotasFiscais() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [organizacoesDisponiveis, setOrganizacoesDisponiveis] = useState<string[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [pastaNotasFiscais, setPastaNotasFiscais] = useState<Pasta | null>(null);
  const [cronogramaItens, setCronogramaItens] = useState<CronogramaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<Documento | null>(null);
  const [pdfDoc, setPdfDoc] = useState<Documento | null>(null);
  const [uploadState, setUploadState] = useState<FileUploadState>({
    file: null,
    status: 'idle',
    progress: 0
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
    const org = user?.organizacao || 'cassems';
    setSelectedOrg(org);
  }, []);

  // Carregar organizações (Portes vê todas)
  useEffect(() => {
    (async () => {
      try {
        if (currentUser?.organizacao === 'portes') {
          const orgs = await listarOrganizacoesDocumentos();
          setOrganizacoesDisponiveis(orgs || []);
        } else {
          setOrganizacoesDisponiveis(currentUser?.organizacao ? [currentUser.organizacao] : []);
        }
      } catch (e) {
        console.error('Erro ao listar organizações:', e);
      }
    })();
  }, [currentUser]);

  const orgParaBuscar = selectedOrg || currentUser?.organizacao || 'cassems';

  // Apenas Portes pode enviar/excluir arquivos; organizações só visualizam
  const podeEnviarArquivos = currentUser?.organizacao === 'portes';

  const loadData = async () => {
    if (!orgParaBuscar) return;
    setLoading(true);
    try {
      const [docsData, pastasData] = await Promise.all([
        listarDocumentos(orgParaBuscar),
        listarPastas(orgParaBuscar)
      ]);

      const pastasList = pastasData || [];
      setPastas(pastasList);

      // Encontrar ou criar pasta "Notas Fiscais"
      let pastaNF = pastasList.find((p: Pasta) =>
        p.titulo?.toLowerCase().includes('notas fiscais') || p.titulo === PASTA_NOTAS_FISCAIS
      );

      if (!pastaNF && podeEnviarArquivos) {
        try {
          const novaPasta = await criarPasta(
            PASTA_NOTAS_FISCAIS,
            'Notas fiscais das empresas para compliance e transparência com o cronograma',
            currentUser?.id,
            orgParaBuscar,
            null
          );
          pastaNF = novaPasta;
        } catch (err) {
          console.error('Erro ao criar pasta Notas Fiscais:', err);
        }
      }

      setPastaNotasFiscais(pastaNF || null);

      const docsList = docsData || [];
      const docsFiltrados = pastaNF
        ? docsList.filter((d: Documento) => d.pasta_id === pastaNF.id)
        : [];
      setDocumentos(docsFiltrados);

      // Carregar cronograma para transparência (o que está sendo cobrado vs cronograma)
      try {
        const res = await fetch(`${API_BASE}/cronograma?organizacao=${orgParaBuscar}`);
        if (res.ok) {
          const cronogramaData = await res.json();
          setCronogramaItens(Array.isArray(cronogramaData) ? cronogramaData : []);
        } else {
          setCronogramaItens([]);
        }
      } catch {
        setCronogramaItens([]);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgParaBuscar && currentUser) {
      loadData();
    }
  }, [orgParaBuscar, currentUser?.id]);

  const handleFileSelect = (file: File) => {
    setUploadState({ file, status: 'selected', progress: 0 });
  };

  const handleFileUpload = async (file: File) => {
    if (!pastaNotasFiscais) {
      alert('A pasta "Notas Fiscais" ainda não está disponível. Aguarde ou recarregue a página.');
      setUploadState(prev => ({ ...prev, status: 'idle', progress: 0 }));
      return;
    }

    try {
      setUploadState(prev => ({ ...prev, status: 'uploading', progress: 0 }));

      const progressInterval = setInterval(() => {
        setUploadState(prev => {
          if (prev.progress < 90) {
            return { ...prev, progress: prev.progress + Math.random() * 10 };
          }
          return prev;
        });
      }, 200);

      const orgDestino = pastaNotasFiscais.organizacao || orgParaBuscar;
      await uploadDocumento(file, currentUser?.id, orgDestino, pastaNotasFiscais.id);

      clearInterval(progressInterval);
      setUploadState(prev => ({ ...prev, status: 'processing', progress: 95 }));
      await new Promise(r => setTimeout(r, 500));
      setUploadState(prev => ({ ...prev, status: 'success', progress: 100 }));

      await loadData();

      setTimeout(() => {
        setUploadState({ file: null, status: 'idle', progress: 0 });
      }, 2000);
    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: 'Erro ao fazer upload do arquivo'
      }));
    }
  };

  const handleFileRemove = () => {
    setUploadState({ file: null, status: 'idle', progress: 0 });
  };

  const handleDeleteDocument = (doc: Documento) => setDeletingDoc(doc);

  const confirmDeleteDocument = async () => {
    if (!deletingDoc) return;
    try {
      await removerDocumento(deletingDoc.id);
      setDeletingDoc(null);
      await loadData();
    } catch (e) {
      console.error('Erro ao remover documento:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e seleção de organização */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-6 w-6" />
                Notas Fiscais
              </CardTitle>
              <CardDescription>
                Notas fiscais para compliance e transparência com o cronograma
              </CardDescription>
            </div>
            {currentUser?.organizacao === 'portes' && organizacoesDisponiveis.length > 0 && (
              <div className="w-full sm:w-64">
                <label className="text-sm font-medium mb-2 block">Organização</label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizacoesDisponiveis.map((org) => (
                      <SelectItem key={org} value={org}>
                        {formatarNomeOrganizacao(org)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Transparência: Cronograma vs Cobrança */}
      {cronogramaItens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              Demandas no cronograma ({formatarNomeOrganizacao(orgParaBuscar)})
            </CardTitle>
            <CardDescription>
              Visualize as demandas do cronograma para comparar com as notas fiscais anexadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {cronogramaItens.slice(0, 12).map((item) => (
                <Badge
                  key={item.id}
                  variant="secondary"
                  className="text-xs py-1.5 px-2.5 flex items-center gap-1.5"
                >
                  <Calendar className="h-3 w-3" />
                  <span className="truncate max-w-[180px]" title={item.titulo}>
                    {item.titulo}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="capitalize">{item.status}</span>
                </Badge>
              ))}
              {cronogramaItens.length > 12 && (
                <Badge variant="outline" className="text-xs">
                  +{cronogramaItens.length - 12} mais
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload - apenas Portes pode enviar */}
      {podeEnviarArquivos && (
        <Card>
          <CardHeader>
            <CardTitle>Enviar nota fiscal</CardTitle>
            <CardDescription>
              {pastaNotasFiscais
                ? `Os arquivos serão salvos em "${PASTA_NOTAS_FISCAIS}" para ${formatarNomeOrganizacao(orgParaBuscar)}`
                : 'Aguarde o carregamento da pasta ou recarregue a página.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pastaNotasFiscais ? (
              <FileUploadArea
                onFileSelect={handleFileSelect}
                onFileUpload={handleFileUpload}
                onFileRemove={handleFileRemove}
                accept=".pdf,application/pdf,image/*"
                maxSize={50 * 1024 * 1024}
                uploadState={uploadState}
                setUploadState={setUploadState}
              />
            ) : (
              <div className="p-6 rounded-lg border border-dashed bg-muted/30 text-center text-sm text-muted-foreground">
                {loading ? 'Carregando...' : 'Nenhuma pasta disponível. Recarregue a página.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de notas fiscais */}
      <Card>
        <CardHeader>
          <CardTitle>
            Notas fiscais anexadas
            {documentos.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {documentos.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Documentos em "{PASTA_NOTAS_FISCAIS}" para {formatarNomeOrganizacao(orgParaBuscar)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Carregando...</p>
          ) : documentos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ReceiptText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma nota fiscal anexada ainda.</p>
              <p className="text-xs mt-1">
                {podeEnviarArquivos
                  ? 'Use a área acima para enviar arquivos PDF ou imagens.'
                  : 'Os documentos serão disponibilizados pelo administrador.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documentos.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border hover:bg-muted/50 gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate" title={d.nome_arquivo}>
                        {d.nome_arquivo}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round((d.tamanho || 0) / 1024)} KB
                    </Badge>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {d.mimetype === 'application/pdf' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPdfDoc(d)}
                        className="text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadDocumento(d.id)}
                      className="text-xs"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Baixar
                    </Button>
                    {podeEnviarArquivos && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDocument(d)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal PDF */}
      {pdfDoc && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base truncate">{pdfDoc.nome_arquivo}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPdfDoc(null)}>
                Fechar
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden">
              <iframe
                title="PDF"
                className="w-full h-[70vh] rounded border"
                src={`${DOC_BASE}/documentos/${pdfDoc.id}/stream#toolbar=1`}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal exclusão */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-800 text-base">Excluir nota fiscal</CardTitle>
                  <CardDescription>Esta ação não pode ser desfeita.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 mb-4">
                Deseja remover <strong>{deletingDoc.nome_arquivo}</strong>?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingDoc(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={confirmDeleteDocument}>
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
