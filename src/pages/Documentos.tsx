import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import FileUploadArea, { FileUploadState } from '@/components/FileUploadArea';
import DocumentPreview from '@/components/DocumentPreview';
import PreviewWrapper from '@/components/PreviewWrapper';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  downloadDocumento, 
  listarDocumentos, 
  removerDocumento, 
  uploadDocumento,
  listarPastas,
  criarPasta,
  atualizarPasta,
  removerPasta,
  moverDocumento,
  listarOrganizacoesDocumentos,
  type Documento,
  type Pasta
} from '@/services/documentosService';
import { 
  Trash2, 
  Upload, 
  Download, 
  FileText, 
  Building, 
  Folder, 
  FolderOpen, 
  Plus, 
  Edit, 
  Move,
  X,
  AlertTriangle
} from 'lucide-react';
import { Play } from 'lucide-react';
import { Eye } from 'lucide-react';

export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [playingDoc, setPlayingDoc] = useState<Documento | null>(null);
  const [pdfDoc, setPdfDoc] = useState<Documento | null>(null);
  const [docxDoc, setDocxDoc] = useState<Documento | null>(null);
  // undefined = nenhuma pasta selecionada ainda; null = filtro "Sem pasta"
  const [selectedPasta, setSelectedPasta] = useState<number | null | undefined>(undefined);
  const [showCreatePasta, setShowCreatePasta] = useState(false);
  const [editingPasta, setEditingPasta] = useState<Pasta | null>(null);
  const [movingDoc, setMovingDoc] = useState<Documento | null>(null);
  const [deletingPasta, setDeletingPasta] = useState<Pasta | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Documento | null>(null);
  const [uploadState, setUploadState] = useState<FileUploadState>({
    file: null,
    status: 'idle',
    progress: 0
  });

  // Hook para preview de documentos
  const {
    previewState,
    showPreview,
    hidePreview,
    hidePreviewImmediately,
    updatePosition
  } = useDocumentPreview();

  // Ref para timeout do preview
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estados para formulário de pasta
  const [pastaTitulo, setPastaTitulo] = useState('');
  const [pastaDescricao, setPastaDescricao] = useState('');
  const [pastaOrganizacao, setPastaOrganizacao] = useState<string>('');
  const [organizacoesDisponiveis, setOrganizacoesDisponiveis] = useState<string[]>([]);

  // Corrige nomes com acentos que vieram em mojibake (ex.: "Ã§" -> "ç")
  const normalizeFileName = (name: string) => {
    try {
      // Heurística: se contiver padrões típicos de mojibake, tenta reparar
      if (/Ã|Â|â|œ|�/.test(name)) {
        // decodeURIComponent(escape(...)) converte de latin1 -> utf8 em navegadores
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return decodeURIComponent(escape(name));
      }
      return name;
    } catch (_e) {
      return name;
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  const load = async () => {
    const org = currentUser?.organizacao || 'cassems';
    const [docsData, pastasData] = await Promise.all([
      listarDocumentos(org),
      listarPastas(org)
    ]);
    setDocs(docsData);
    setPastas(pastasData);
    // Se não houver nenhuma pasta, abrir formulário de criação
    if ((pastasData || []).length === 0) {
      setShowCreatePasta(true);
    } else if (pastasData && pastasData.length > 0) {
      // Se houver pastas e nenhuma estiver selecionada, selecionar a primeira
      setSelectedPasta(prev => prev === undefined ? pastasData[0].id : prev);
    }
  };

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  // Carregar organizações para Portes
  useEffect(() => {
    (async () => {
      try {
        if (currentUser?.organizacao === 'portes') {
          const orgs = await listarOrganizacoesDocumentos();
          setOrganizacoesDisponiveis(orgs || []);
        }
      } catch (e) {
        console.error('Erro ao listar organizações:', e);
      }
    })();
  }, [currentUser]);

  const handleFileSelect = (file: File) => {
    setUploadState({
      file,
      status: 'selected',
      progress: 0
    });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadState(prev => ({ ...prev, status: 'uploading', progress: 0 }));
      
      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadState(prev => {
          if (prev.progress < 90) {
            return { ...prev, progress: prev.progress + Math.random() * 10 };
          }
          return prev;
        });
      }, 200);

      // Bloquear upload sem pasta selecionada
      if (selectedPasta === null || selectedPasta === undefined) {
        alert('Selecione uma pasta antes de enviar arquivos.');
        setUploadState(prev => ({ ...prev, status: 'idle', progress: 0 }));
        return;
      }

      const pastaDestino = pastas.find(p => p.id === selectedPasta);
      const orgDestino = pastaDestino?.organizacao || currentUser?.organizacao;
      await uploadDocumento(file, currentUser?.id, orgDestino, selectedPasta);
      
      clearInterval(progressInterval);
      
      setUploadState(prev => ({ ...prev, status: 'processing', progress: 95 }));
      
      // Simular processamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUploadState(prev => ({ ...prev, status: 'success', progress: 100 }));
      
      await load();
      
      // Reset após sucesso
      setTimeout(() => {
        setUploadState({
          file: null,
          status: 'idle',
          progress: 0
        });
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
    setUploadState({
      file: null,
      status: 'idle',
      progress: 0
    });
  };


  // Funções para pastas
  const handleCreatePasta = async () => {
    if (!pastaTitulo.trim()) return;
    try {
      const orgDestino = currentUser?.organizacao === 'portes' ? (pastaOrganizacao || currentUser?.organizacao) : currentUser?.organizacao;
      await criarPasta(pastaTitulo, pastaDescricao, currentUser?.id, orgDestino);
      setPastaTitulo('');
      setPastaDescricao('');
      setPastaOrganizacao('');
      setShowCreatePasta(false);
      await load();
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
    }
  };

  const handleEditPasta = async () => {
    if (!editingPasta || !pastaTitulo.trim()) return;
    try {
      await atualizarPasta(editingPasta.id, pastaTitulo, pastaDescricao);
      setPastaTitulo('');
      setPastaDescricao('');
      setEditingPasta(null);
      await load();
    } catch (error) {
      console.error('Erro ao atualizar pasta:', error);
    }
  };

  const handleDeletePasta = async (pastaId: number) => {
    const pasta = pastas.find(p => p.id === pastaId);
    if (pasta) {
      setDeletingPasta(pasta);
    }
  };

  const confirmDeletePasta = async () => {
    if (!deletingPasta) return;
    try {
      await removerPasta(deletingPasta.id);
      setDeletingPasta(null);
      await load();
    } catch (error) {
      console.error('Erro ao remover pasta:', error);
      alert('Erro ao remover pasta. Verifique se ela está vazia.');
    }
  };

  const handleDeleteDocument = async (doc: Documento) => {
    setDeletingDoc(doc);
  };

  const confirmDeleteDocument = async () => {
    if (!deletingDoc) return;
    try {
      await removerDocumento(deletingDoc.id);
      setDeletingDoc(null);
      await load();
    } catch (error) {
      console.error('Erro ao remover documento:', error);
    }
  };

  const handleMoveDocument = async (docId: number, pastaId: number | null) => {
    try {
      await moverDocumento(docId, pastaId);
      setMovingDoc(null);
      await load();
    } catch (error) {
      console.error('Erro ao mover documento:', error);
    }
  };

  // Filtrar documentos por pasta selecionada
  const filteredDocs = selectedPasta === undefined
    ? []
    : docs.filter(doc => doc.pasta_id === selectedPasta);

  const startEditPasta = (pasta: Pasta) => {
    setEditingPasta(pasta);
    setPastaTitulo(pasta.titulo);
    setPastaDescricao(pasta.descricao || '');
  };

  const cancelEdit = () => {
    setEditingPasta(null);
    setPastaTitulo('');
    setPastaDescricao('');
    setPastaOrganizacao('');
    setShowCreatePasta(false);
  };

  return (
    <div className="space-y-6">
      {/* Seção de Pastas */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pastas</CardTitle>
              <CardDescription>Organize seus documentos em pastas temáticas</CardDescription>
            </div>
            <Button onClick={() => setShowCreatePasta(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Pasta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Sem pasta removido */}

            {/* Pastas criadas */}
            {pastas.map((pasta) => (
              <div 
                key={pasta.id}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedPasta === pasta.id 
                    ? 'bg-blue-50 border-2 border-blue-500' 
                    : 'hover:bg-gray-50 border-2 border-transparent'
                }`}
                onClick={() => setSelectedPasta(pasta.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FolderOpen className="w-5 h-5 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate" title={pasta.titulo}>
                      {pasta.titulo}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {pasta.descricao || 'Sem descrição'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {pasta.total_documentos} docs
                  </Badge>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditPasta(pasta);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePasta(pasta.id);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Criação/Edição de Pasta */}
      {(showCreatePasta || editingPasta) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingPasta ? 'Editar Pasta' : 'Nova Pasta'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="titulo">Título da pasta *</Label>
                <Input
                  id="titulo"
                  value={pastaTitulo}
                  onChange={(e) => setPastaTitulo(e.target.value)}
                  placeholder="Ex: Negativação"
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={pastaDescricao}
                  onChange={(e) => setPastaDescricao(e.target.value)}
                  placeholder="Arquivos relacionados à negativação..."
                  rows={3}
                />
              </div>
              {currentUser?.organizacao === 'portes' && !editingPasta && (
                <div>
                  <Label>Organização destino (apenas Portes)</Label>
                  <Select value={pastaOrganizacao} onValueChange={setPastaOrganizacao}>
                    <SelectTrigger>
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
                  <p className="text-xs text-gray-500 mt-1">A pasta será criada na organização selecionada.</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  onClick={editingPasta ? handleEditPasta : handleCreatePasta}
                  disabled={!pastaTitulo.trim()}
                >
                  {editingPasta ? 'Atualizar' : 'Criar'} Pasta
                </Button>
                <Button variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção de Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Enviar Documento</CardTitle>
          <CardDescription>
            {pastas.length === 0
              ? 'Nenhuma pasta cadastrada. Crie uma pasta para habilitar o envio.'
              : selectedPasta === undefined
                ? 'Selecione uma pasta para habilitar o envio.'
                : `Arquivo será enviado para "${pastas.find(p => p.id === selectedPasta)?.titulo || 'Pasta selecionada'}"`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pastas.length === 0 || selectedPasta === undefined ? (
            <div className="p-4 rounded border border-dashed text-sm text-gray-600 bg-gray-50">
              {pastas.length === 0 ? (
                <div className="flex items-center justify-between">
                  <span>Crie uma pasta para habilitar o envio de documentos.</span>
                  <Button className="ml-3" onClick={() => setShowCreatePasta(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Criar pasta
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span>Selecione uma pasta na lista ao lado para habilitar o envio.</span>
                </div>
              )}
            </div>
          ) : (
            <FileUploadArea
              onFileSelect={handleFileSelect}
              onFileUpload={handleFileUpload}
              onFileRemove={handleFileRemove}
              accept="*/*"
              maxSize={100 * 1024 * 1024} // 100MB
              uploadState={uploadState}
              setUploadState={setUploadState}
            />
          )}
        </CardContent>
      </Card>

      {/* Lista de Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>
              {selectedPasta === undefined
              ? 'Selecione uma pasta para visualizar documentos'
              : `Documentos em "${pastas.find(p => p.id === selectedPasta)?.titulo || 'Pasta selecionada'}"`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredDocs.map((d) => (
              <div 
                key={d.id} 
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded border hover:bg-gray-50 transition-colors cursor-pointer gap-2 sm:gap-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div 
                      className="font-medium text-sm sm:text-base truncate"
                      title={normalizeFileName(d.nome_arquivo)}
                    >
                      <span 
                        className="hover:underline"
                        onMouseEnter={(e) => showPreview(d, e)}
                        onMouseLeave={hidePreview}
                        onMouseMove={(e) => updatePosition(e)}
                      >
                        {normalizeFileName(d.nome_arquivo)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <Badge className="text-xs">{Math.round((d.tamanho || 0) / 1024)} KB</Badge>
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Building className="w-3 h-3" />{(d.organizacao || '').toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 sm:gap-2 flex-shrink-0 flex-wrap">
                  {d.mimetype === 'application/pdf' && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setPdfDoc(d); }}
                      title="Visualizar PDF"
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" /> 
                      <span className="hidden sm:inline">Visualizar</span>
                    </Button>
                  )}
                  {(d.mimetype?.includes('word') || d.mimetype?.includes('officedocument.wordprocessingml.document') || /\.docx$/i.test(d.nome_arquivo)) && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setDocxDoc(d); }}
                      title="Visualizar DOCX"
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" /> 
                      <span className="hidden sm:inline">Visualizar</span>
                    </Button>
                  )}
                  {d.mimetype && d.mimetype.startsWith('video/') && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setPlayingDoc(d); }}
                      title="Assistir vídeo"
                      className="text-xs"
                    >
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" /> 
                      <span className="hidden sm:inline">Assistir</span>
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMovingDoc(d)}
                    title="Mover para outra pasta"
                    className="h-8 w-8 sm:h-auto sm:w-auto p-0 sm:px-3"
                  >
                    <Move className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadDocumento(d.id)} className="h-8 w-8 sm:h-auto sm:w-auto p-0 sm:px-3">
                    <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteDocument(d)} className="h-8 w-8 sm:h-auto sm:w-auto p-0 sm:px-3">
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredDocs.length === 0 && (
              <div className="text-sm text-gray-500">
                {selectedPasta === null 
                  ? 'Nenhum documento sem pasta.'
                  : 'Nenhum documento nesta pasta.'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal para mover documento */}
      {movingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base sm:text-lg">Mover Documento</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setMovingDoc(null)} className="h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-gray-600 break-words">
                  <strong>{movingDoc.nome_arquivo}</strong>
                </p>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {/* Removido: opção Sem pasta */}
                  {pastas.map((pasta) => (
                    <Button 
                      key={pasta.id}
                      variant={movingDoc.pasta_id === pasta.id ? "default" : "outline"}
                      className="w-full justify-start text-xs sm:text-sm"
                      onClick={() => handleMoveDocument(movingDoc.id, pasta.id)}
                    >
                      <FolderOpen className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      <span className="truncate">{pasta.titulo}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal do Player de Vídeo */}
      {playingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-5xl max-h-[95vh] flex flex-col">
            <CardHeader className="p-3 sm:p-6 flex-shrink-0">
              <div className="flex justify-between items-center gap-2">
                <CardTitle className="text-sm sm:text-lg truncate">Reproduzir vídeo</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setPlayingDoc(null)} className="h-8 w-8 p-0 flex-shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="truncate text-xs sm:text-sm" title={normalizeFileName(playingDoc.nome_arquivo)}>
                {normalizeFileName(playingDoc.nome_arquivo)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 flex-1 min-h-0">
              <div className="w-full aspect-video bg-black rounded overflow-hidden">
                {/* Usar endpoint de stream com suporte a Range */}
                <video
                  controls
                  autoPlay
                  className="w-full h-full"
                  src={`${(import.meta as any).env.VITE_API_URL || 'http://localhost:3001'}/documentos/${playingDoc.id}/stream`}
                >
                  Seu navegador não suporta a reprodução de vídeo.
                </video>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal do Visualizador de PDF */}
      {pdfDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full h-full sm:h-[90vh] sm:max-w-7xl flex flex-col">
            <CardHeader className="p-3 sm:p-6 flex-shrink-0">
              <div className="flex justify-between items-center gap-2">
                <CardTitle className="text-sm sm:text-lg truncate">Visualizar PDF</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setPdfDoc(null)} className="h-8 w-8 p-0 flex-shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="truncate text-xs sm:text-sm" title={normalizeFileName(pdfDoc.nome_arquivo)}>
                {normalizeFileName(pdfDoc.nome_arquivo)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 flex-1 min-h-0 h-[calc(100%-120px)] sm:h-[calc(90vh-120px)]">
              <div className="w-full h-full bg-white rounded overflow-hidden border">
                <iframe
                  title="PDF"
                  className="w-full h-full"
                  src={`${(import.meta as any).env.VITE_API_URL || 'http://localhost:3001'}/documentos/${pdfDoc.id}/stream#toolbar=1&navpanes=0`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal do Visualizador de DOCX */}
      {docxDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full h-full sm:h-[90vh] sm:max-w-7xl flex flex-col">
            <CardHeader className="p-3 sm:p-6 flex-shrink-0">
              <div className="flex justify-between items-center gap-2">
                <CardTitle className="text-sm sm:text-lg truncate">Visualizar DOCX</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setDocxDoc(null)} className="h-8 w-8 p-0 flex-shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="truncate text-xs sm:text-sm" title={normalizeFileName(docxDoc.nome_arquivo)}>
                {normalizeFileName(docxDoc.nome_arquivo)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 flex-1 min-h-0 h-[calc(100%-120px)] sm:h-[calc(90vh-120px)]">
              <div className="w-full h-full bg-white rounded overflow-hidden border">
                {/* Visualizador online da Microsoft exige URL pública acessível. Em ambiente local pode não abrir. */}
                <iframe
                  title="DOCX"
                  className="w-full h-full"
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(((import.meta as any).env.VITE_API_URL || 'http://localhost:3001') + '/documentos/' + docxDoc.id + '/stream')}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de confirmação de exclusão de pasta */}
      {deletingPasta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-red-100 rounded-full flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-red-800 text-sm sm:text-base">Confirmar Exclusão</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Esta ação não pode ser desfeita</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-800 font-medium mb-2 break-words">
                    Tem certeza que deseja remover a pasta <strong>"{deletingPasta.titulo}"</strong>?
                  </p>
                  <p className="text-xs sm:text-sm text-red-700">
                    {deletingPasta.total_documentos > 0 
                      ? `Os ${deletingPasta.total_documentos} documento(s) dentro dela serão movidos para "Sem pasta".`
                      : 'A pasta está vazia e será removida permanentemente.'
                    }
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setDeletingPasta(null)}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDeletePasta}
                    className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
                    size="sm"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Excluir Pasta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de confirmação de exclusão de documento */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-red-100 rounded-full flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-red-800 text-sm sm:text-base">Confirmar Exclusão</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Esta ação não pode ser desfeita</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-800 font-medium mb-2 break-words">
                    Tem certeza que deseja remover o documento <strong>"{deletingDoc.nome_arquivo}"</strong>?
                  </p>
                  <p className="text-xs sm:text-sm text-red-700">
                    O arquivo será removido permanentemente do servidor.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setDeletingDoc(null)}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDeleteDocument}
                    className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
                    size="sm"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Excluir Documento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview de Documento */}
      {previewState.isVisible && previewState.document && (
        <div
          className="fixed z-[9999] pointer-events-auto"
          style={{
            left: `${previewState.position.x}px`,
            top: `${previewState.position.y}px`,
          }}
          onMouseEnter={() => {
            // Cancelar timeout quando mouse entra no preview
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
          }}
          onMouseLeave={hidePreview}
        >
          <DocumentPreview
            document={previewState.document}
            position={{ x: 0, y: 0 }} // O wrapper gerencia o posicionamento
            onClose={hidePreviewImmediately}
          />
        </div>
      )}
    </div>
  );
}


