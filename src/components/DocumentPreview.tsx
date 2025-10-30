import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Image, 
  File, 
  Calendar,
  Building,
  Folder,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentPreviewProps {
  document: {
    id: number;
    nome_arquivo: string;
    tamanho: number;
    mimetype: string;
    organizacao: string;
    created_at: string;
    pasta_id?: number;
  };
  position?: { x: number; y: number };
  onClose?: () => void;
  className?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  position = { x: 0, y: 0 },
  onClose,
  className
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Corrige nomes com acentos em mojibake
  const normalizeFileName = (name: string) => {
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

  // Função para formatar tamanho do arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Função para formatar data
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para obter ícone baseado no tipo de arquivo
  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) {
      return <Image className="h-8 w-8 text-green-500" />;
    } else if (mimetype === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    } else {
      return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  // Função para obter cor do badge baseado no tipo
  const getTypeColor = (mimetype: string) => {
    if (mimetype.startsWith('image/')) {
      return 'bg-green-100 text-green-800';
    } else if (mimetype === 'application/pdf') {
      return 'bg-red-100 text-red-800';
    } else if (mimetype.includes('word') || mimetype.includes('document')) {
      return 'bg-blue-100 text-blue-800';
    } else if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) {
      return 'bg-green-100 text-green-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para obter extensão do arquivo
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  // Função para carregar preview de imagem
  const loadImagePreview = async () => {
    if (!document.mimetype.startsWith('image/') || imagePreview) return;
    
    setIsLoading(true);
    try {
      // Aqui você pode implementar a lógica para carregar a imagem
      // Por enquanto, vamos simular com um placeholder
      setImagePreview('/placeholder.svg');
    } catch (error) {
      console.error('Erro ao carregar preview da imagem:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar preview quando o componente monta
  useEffect(() => {
    if (document.mimetype.startsWith('image/')) {
      loadImagePreview();
    }
  }, [document.mimetype]);

  // Posicionar o preview
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.style.left = `${position.x}px`;
      previewRef.current.style.top = `${position.y}px`;
    }
  }, [position]);

  return (
    <Card
      ref={previewRef}
      className={cn(
        "w-80 shadow-2xl border-2 bg-white animate-in fade-in-0 zoom-in-95 duration-200 pointer-events-auto",
        position.x === 0 && position.y === 0 ? "relative" : "fixed z-[9999]",
        className
      )}
      style={{
        ...(position.x !== 0 || position.y !== 0 ? {
          left: position.x,
          top: position.y,
        } : {}),
        maxWidth: '320px',
        minWidth: '280px'
      }}
    >
      <CardContent className="p-4">
        {/* Header com ícone e nome do arquivo */}
        <div className="flex items-start gap-3 mb-4">
          {getFileIcon(document.mimetype)}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" title={normalizeFileName(document.nome_arquivo)}>
              {normalizeFileName(document.nome_arquivo)}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("text-xs", getTypeColor(document.mimetype))}>
                {getFileExtension(document.nome_arquivo)}
              </Badge>
              <span className="text-xs text-gray-500">
                {formatFileSize(document.tamanho)}
              </span>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Preview de imagem se for uma imagem */}
        {document.mimetype.startsWith('image/') && (
          <div className="mb-4">
            <div className="relative bg-gray-50 rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                  onError={() => setImagePreview(null)}
                />
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-400">
                  <Image className="h-8 w-8" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Informações do documento */}
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>Enviado em {formatDate(document.created_at)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Building className="h-3 w-3" />
            <span>Organização: {document.organizacao}</span>
          </div>

          {document.pasta_id && (
            <div className="flex items-center gap-2">
              <Folder className="h-3 w-3" />
              <span>Pasta: {document.pasta_id}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3" />
            <span>Tipo: {document.mimetype}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default DocumentPreview;
