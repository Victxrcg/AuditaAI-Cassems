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

export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedPasta, setSelectedPasta] = useState<number | null>(null);
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
  };

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

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

      await uploadDocumento(file, currentUser?.id, currentUser?.organizacao, selectedPasta || undefined);
      
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

  // Função para visualizar documento
  const handleViewDocument = (documentId: number) => {
    // Abrir documento em nova aba
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/documentos/${documentId}/download`;
    window.open(url, '_blank');
  };

  // Funções para pastas
  const handleCreatePasta = async () => {
    if (!pastaTitulo.trim()) return;
    try {
      await criarPasta(pastaTitulo, pastaDescricao, currentUser?.id, currentUser?.organizacao);
      setPastaTitulo('');
      setPastaDescricao('');
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
  const filteredDocs = selectedPasta === null 
    ? docs.filter(doc => !doc.pasta_id)
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
            {/* Pasta "Sem pasta" */}
            <div 
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                selectedPasta === null 
                  ? 'bg-blue-50 border-2 border-blue-500' 
                  : 'hover:bg-gray-50 border-2 border-transparent'
              }`}
              onClick={() => setSelectedPasta(null)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Folder className="w-5 h-5 text-gray-500" />
                <div className="min-w-0">
                  <h3 className="font-medium">Sem pasta</h3>
                  <p className="text-sm text-gray-500">
                    {docs.filter(doc => !doc.pasta_id).length} documentos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {docs.filter(doc => !doc.pasta_id).length} docs
                </Badge>
              </div>
            </div>

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
            {selectedPasta === null 
              ? 'Arquivo será enviado para "Sem pasta"'
              : `Arquivo será enviado para "${pastas.find(p => p.id === selectedPasta)?.titulo || 'Pasta selecionada'}"`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadArea
            onFileSelect={handleFileSelect}
            onFileUpload={handleFileUpload}
            onFileRemove={handleFileRemove}
            accept="*/*"
            maxSize={50 * 1024 * 1024} // 50MB
            uploadState={uploadState}
            setUploadState={setUploadState}
          />
        </CardContent>
      </Card>

      {/* Lista de Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedPasta === null 
              ? 'Documentos sem pasta'
              : `Documentos em "${pastas.find(p => p.id === selectedPasta)?.titulo || 'Pasta selecionada'}"`
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredDocs.map((d) => (
              <div 
                key={d.id} 
                className="flex items-center justify-between p-3 rounded border hover:bg-gray-50 transition-colors cursor-pointer"
                onMouseEnter={(e) => showPreview(d, e)}
                onMouseLeave={hidePreview}
                onMouseMove={(e) => updatePosition(e)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div className="min-w-0">
                    <div className="font-medium truncate" title={d.nome_arquivo}>{d.nome_arquivo}</div>
                    <div className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <Badge className="ml-2">{Math.round((d.tamanho || 0) / 1024)} KB</Badge>
                  <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                    <Building className="w-3 h-3" />{(d.organizacao || '').toUpperCase()}
                  </Badge>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setMovingDoc(d)}
                    title="Mover para outra pasta"
                  >
                    <Move className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadDocumento(d.id)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteDocument(d)}>
                    <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Mover Documento</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setMovingDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  <strong>{movingDoc.nome_arquivo}</strong>
                </p>
                <div className="space-y-2">
                  <Button 
                    variant={movingDoc.pasta_id === null ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => handleMoveDocument(movingDoc.id, null)}
                  >
                    <Folder className="w-4 h-4 mr-2" />
                    Sem pasta
                  </Button>
                  {pastas.map((pasta) => (
                    <Button 
                      key={pasta.id}
                      variant={movingDoc.pasta_id === pasta.id ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => handleMoveDocument(movingDoc.id, pasta.id)}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      {pasta.titulo}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de confirmação de exclusão de pasta */}
      {deletingPasta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-800">Confirmar Exclusão</CardTitle>
                  <CardDescription>Esta ação não pode ser desfeita</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    Tem certeza que deseja remover a pasta <strong>"{deletingPasta.titulo}"</strong>?
                  </p>
                  <p className="text-sm text-red-700">
                    {deletingPasta.total_documentos > 0 
                      ? `Os ${deletingPasta.total_documentos} documento(s) dentro dela serão movidos para "Sem pasta".`
                      : 'A pasta está vazia e será removida permanentemente.'
                    }
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setDeletingPasta(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDeletePasta}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-800">Confirmar Exclusão</CardTitle>
                  <CardDescription>Esta ação não pode ser desfeita</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-2">
                    Tem certeza que deseja remover o documento <strong>"{deletingDoc.nome_arquivo}"</strong>?
                  </p>
                  <p className="text-sm text-red-700">
                    O arquivo será removido permanentemente do servidor.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setDeletingDoc(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={confirmDeleteDocument}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
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
            border: '2px solid red', // Debug: borda vermelha para ver onde está
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
            onDownload={downloadDocumento}
            onView={handleViewDocument}
          />
        </div>
      )}
    </div>
  );
}


