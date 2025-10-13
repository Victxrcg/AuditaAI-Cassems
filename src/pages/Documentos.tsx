import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { downloadDocumento, listarDocumentos, removerDocumento, uploadDocumento } from '@/services/documentosService';
import { Trash2, Upload, Download, FileText, Building } from 'lucide-react';

interface Documento {
  id: number;
  nome_arquivo: string;
  caminho: string;
  tamanho: number;
  mimetype: string;
  organizacao: string;
  enviado_por?: number;
  created_at: string;
}

export default function Documentos() {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
  }, []);

  const load = async () => {
    const org = currentUser?.organizacao || 'cassems';
    const data = await listarDocumentos(org);
    setDocs(data);
  };

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocumento(file, currentUser?.id, currentUser?.organizacao);
      setFile(null);
      await load();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <CardDescription>Central de arquivos compartilhados entre Portes e empresas</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Arquivos enviados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded border">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <div className="min-w-0">
                    <div className="font-medium truncate" title={d.nome_arquivo}>{d.nome_arquivo}</div>
                    <div className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <Badge className="ml-2">{Math.round((d.tamanho || 0) / 1024)} KB</Badge>
                  <Badge variant="secondary" className="ml-2 flex items-center gap-1"><Building className="w-3 h-3" />{(d.organizacao || '').toUpperCase()}</Badge>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => downloadDocumento(d.id)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={async () => { await removerDocumento(d.id); await load(); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {docs.length === 0 && (
              <div className="text-sm text-gray-500">Nenhum documento enviado ainda.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


