import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  X
} from 'lucide-react';

export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedPasta, setSelectedPasta] = useState<number | null>(null);
  const [showCreatePasta, setShowCreatePasta] = useState(false);
  const [editingPasta, setEditingPasta] = useState<Pasta | null>(null);
  const [movingDoc, setMovingDoc] = useState<Documento | null>(null);
  
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

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocumento(file, currentUser?.id, currentUser?.organizacao, selectedPasta || undefined);
      setFile(null);
      await load();
    } finally {
      setUploading(false);
    }
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
    if (!confirm('Tem certeza que deseja remover esta pasta? Documentos dentro dela serão movidos para "Sem pasta".')) return;
    try {
      await removerPasta(pastaId);
      await load();
    } catch (error) {
      console.error('Erro ao remover pasta:', error);
      alert('Erro ao remover pasta. Verifique se ela está vazia.');
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pasta "Sem pasta" */}
            <div 
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedPasta === null 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedPasta(null)}
            >
              <div className="flex items-center gap-3">
                <Folder className="w-6 h-6 text-gray-500" />
                <div>
                  <h3 className="font-medium">Sem pasta</h3>
                  <p className="text-sm text-gray-500">
                    {docs.filter(doc => !doc.pasta_id).length} documentos
                  </p>
                </div>
              </div>
            </div>

            {/* Pastas criadas */}
            {pastas.map((pasta) => (
              <div 
                key={pasta.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedPasta === pasta.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPasta(pasta.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderOpen className="w-6 h-6 text-blue-500" />
                    <div className="min-w-0">
                      <h3 className="font-medium truncate" title={pasta.titulo}>
                        {pasta.titulo}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {pasta.total_documentos} documentos
                      </p>
                      {pasta.descricao && (
                        <p className="text-xs text-gray-400 truncate" title={pasta.descricao}>
                          {pasta.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditPasta(pasta);
                      }}
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
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
            <div className="flex-1">
              <Label>Selecionar arquivo</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleUpload} disabled={!file || uploading}>
              <Upload className="w-4 h-4 mr-2" /> Enviar
            </Button>
          </div>
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
              <div key={d.id} className="flex items-center justify-between p-3 rounded border">
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
                  <Button variant="outline" size="sm" onClick={async () => { await removerDocumento(d.id); await load(); }}>
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
    </div>
  );
}


