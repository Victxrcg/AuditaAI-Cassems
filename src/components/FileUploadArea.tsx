import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Loader2,
  Cloud,
  CloudCheck,
  CloudOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileUploadState {
  file: File | null;
  status: 'idle' | 'selected' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
  uploadId?: string;
}

interface FileUploadAreaProps {
  onFileSelect?: (file: File) => void;
  onFileUpload?: (file: File) => Promise<any>;
  onFileRemove?: () => void;
  accept?: string;
  maxSize?: number; // em bytes
  disabled?: boolean;
  className?: string;
  uploadState?: FileUploadState;
  setUploadState?: (state: FileUploadState) => void;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  onFileSelect,
  onFileUpload,
  onFileRemove,
  accept = "*/*",
  maxSize = 50 * 1024 * 1024, // 50MB padrão
  disabled = false,
  className,
  uploadState,
  setUploadState
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalState, setInternalState] = useState<FileUploadState>({
    file: null,
    status: 'idle',
    progress: 0
  });

  // Usar estado interno se não for fornecido externamente
  const currentState = uploadState || internalState;
  const setCurrentState = setUploadState || setInternalState;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${formatFileSize(maxSize)}`
      };
    }
    return { valid: true };
  };

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setCurrentState({
        file: null,
        status: 'error',
        progress: 0,
        error: validation.error
      });
      return;
    }

    setCurrentState({
      file,
      status: 'selected',
      progress: 0
    });

    onFileSelect?.(file);
  }, [maxSize, onFileSelect, setCurrentState]);

  const handleFileUpload = useCallback(async () => {
    if (!currentState.file || !onFileUpload) return;

    setCurrentState(prev => ({ ...prev, status: 'uploading', progress: 0 }));

    try {
      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setCurrentState(prev => {
          if (prev.progress < 90) {
            return { ...prev, progress: prev.progress + Math.random() * 10 };
          }
          return prev;
        });
      }, 200);

      const result = await onFileUpload(currentState.file);
      
      clearInterval(progressInterval);
      
      setCurrentState(prev => ({
        ...prev,
        status: 'processing',
        progress: 95
      }));

      // Simular processamento
      await new Promise(resolve => setTimeout(resolve, 1000));

      setCurrentState(prev => ({
        ...prev,
        status: 'success',
        progress: 100,
        uploadId: result?.id || result?.anexo_id
      }));

    } catch (error) {
      setCurrentState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Erro no upload'
      }));
    }
  }, [currentState.file, onFileUpload, setCurrentState]);

  const handleFileRemove = useCallback(() => {
    setCurrentState({
      file: null,
      status: 'idle',
      progress: 0
    });
    onFileRemove?.();
  }, [onFileRemove, setCurrentState]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const getStatusIcon = () => {
    switch (currentState.status) {
      case 'selected':
        return <FileText className="h-8 w-8 text-blue-500" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />;
      default:
        return <Upload className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (currentState.status) {
      case 'selected':
        return 'Arquivo selecionado - Pronto para enviar';
      case 'uploading':
        return 'Enviando arquivo...';
      case 'processing':
        return 'Processando arquivo...';
      case 'success':
        return 'Arquivo enviado com sucesso!';
      case 'error':
        return currentState.error || 'Erro no upload';
      default:
        return 'Clique para fazer upload ou arraste o arquivo aqui';
    }
  };

  const getStatusColor = () => {
    switch (currentState.status) {
      case 'selected':
        return 'border-blue-400 bg-blue-50';
      case 'uploading':
      case 'processing':
        return 'border-blue-400 bg-blue-50';
      case 'success':
        return 'border-green-400 bg-green-50';
      case 'error':
        return 'border-red-400 bg-red-50';
      default:
        return isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400';
    }
  };

  const isUploading = currentState.status === 'uploading' || currentState.status === 'processing';
  const canUpload = currentState.status === 'selected' && !disabled;
  const canRemove = currentState.status !== 'idle' && !isUploading;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Área de Upload */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer",
          getStatusColor(),
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "hover:shadow-md"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center space-y-3">
          {getStatusIcon()}
          
          <div className="space-y-2">
            <p className={cn(
              "text-sm font-medium",
              currentState.status === 'error' ? "text-red-600" : 
              currentState.status === 'success' ? "text-green-600" :
              "text-gray-600"
            )}>
              {getStatusText()}
            </p>
            
            {currentState.file && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{currentState.file.name}</span>
                <span>({formatFileSize(currentState.file.size)})</span>
              </div>
            )}
          </div>

          {/* Barra de Progresso */}
          {isUploading && (
            <div className="w-full max-w-xs">
              <Progress value={currentState.progress} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(currentState.progress)}% concluído
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2">
            {currentState.status === 'idle' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Arquivo
              </Button>
            )}

            {canUpload && (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileUpload();
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Cloud className="h-4 w-4 mr-2" />
                Enviar Arquivo
              </Button>
            )}

            {currentState.status === 'success' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileRemove();
                }}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                <CloudCheck className="h-4 w-4 mr-2" />
                Arquivo Enviado
              </Button>
            )}

            {currentState.status === 'error' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileRemove();
                }}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <CloudOff className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            )}

            {canRemove && currentState.status !== 'success' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileRemove();
                }}
                className="text-gray-600"
              >
                <X className="h-4 w-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Status Badge */}
      {currentState.status !== 'idle' && (
        <div className="flex justify-center">
          <Badge
            variant={
              currentState.status === 'success' ? 'default' :
              currentState.status === 'error' ? 'destructive' :
              'secondary'
            }
            className={cn(
              currentState.status === 'success' && "bg-green-100 text-green-800",
              currentState.status === 'error' && "bg-red-100 text-red-800",
              currentState.status === 'selected' && "bg-blue-100 text-blue-800",
              (currentState.status === 'uploading' || currentState.status === 'processing') && "bg-yellow-100 text-yellow-800"
            )}
          >
            {currentState.status === 'selected' && 'Pronto para Enviar'}
            {currentState.status === 'uploading' && 'Enviando...'}
            {currentState.status === 'processing' && 'Processando...'}
            {currentState.status === 'success' && 'Enviado com Sucesso'}
            {currentState.status === 'error' && 'Erro no Upload'}
          </Badge>
        </div>
      )}

      {/* Informações de Validação */}
      <div className="text-xs text-gray-500 text-center">
        <p>Tamanho máximo: {formatFileSize(maxSize)}</p>
        <p>Formatos aceitos: {accept === "*/*" ? "Todos" : accept}</p>
      </div>
    </div>
  );
};

export default FileUploadArea;
