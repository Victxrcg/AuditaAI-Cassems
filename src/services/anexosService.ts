// Serviço para gerenciar anexos de compliance
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Anexo {
  id: number;
  nome_arquivo: string;
  tipo_anexo: string;
  tamanho_arquivo: number;
  created_at: string;
}

// Upload de anexo
export const uploadAnexo = async (complianceId: string, tipoAnexo: string, file: File): Promise<Anexo> => {
  const formData = new FormData();
  formData.append('anexo', file);

  // Obter informações do usuário atual
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const response = await fetch(`${API_BASE}/compliance/competencias/${complianceId}/anexos/${tipoAnexo}`, {
    method: 'POST',
    headers: {
      'x-user-organization': currentUser.organizacao || 'cassems',
      'x-user-id': currentUser.id?.toString() || '1'
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Tratar erros específicos
    if (response.status === 413) {
      throw new Error('Arquivo muito grande. O limite máximo é 1GB.');
    }
    
    if (response.status === 400) {
      throw new Error(errorData.details || errorData.error || 'Arquivo inválido.');
    }
    
    throw new Error(errorData.error || 'Erro ao fazer upload do anexo');
  }

  const data = await response.json();
  return data.data;
};

// Listar anexos de uma competência
export const listAnexos = async (complianceId: string): Promise<Anexo[]> => {
  const response = await fetch(`${API_BASE}/compliance/competencias/${complianceId}/anexos`);
  
  if (!response.ok) {
    throw new Error('Erro ao listar anexos');
  }

  const data = await response.json();
  return data.data;
};

// Buscar anexos por tipo
export const getAnexosByTipo = async (complianceId: string, tipoAnexo: string): Promise<Anexo[]> => {
  const response = await fetch(`${API_BASE}/compliance/competencias/${complianceId}/anexos/${tipoAnexo}`);
  
  if (!response.ok) {
    throw new Error('Erro ao buscar anexos por tipo');
  }

  const data = await response.json();
  return data.data;
};

// Baixar anexo
export const downloadAnexo = async (anexoId: number, filename: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/compliance/anexos/${anexoId}`);
  
  if (!response.ok) {
    throw new Error('Erro ao baixar anexo');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Remover anexo
export const removeAnexo = async (anexoId: number): Promise<void> => {
  const response = await fetch(`${API_BASE}/compliance/anexos/${anexoId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Erro ao remover anexo');
  }
};

// Mapear tipos de anexo para IDs dos itens
export const getTipoAnexoFromItemId = (itemId: string): string => {
  const mapping: Record<string, string> = {
    '1': 'competencia_referencia',
    '2': 'relatorio_inicial',
    '3': 'relatorio_faturamento',
    '4': 'imposto_compensado',
    '5': 'valor_compensado',
    '6': 'emails',
    '7': 'estabelecimento',
    '8': 'parecer'
  };
  
  return mapping[itemId] || 'unknown';
};

// Formatar tamanho do arquivo
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validar tipo de arquivo - Permitir qualquer tipo de arquivo
export const validateFileType = (file: File): boolean => {
  // Permitir qualquer tipo de arquivo, apenas verificar se é um arquivo válido
  return file && file.name && file.size > 0;
};

// Validar tamanho do arquivo
export const validateFileSize = (file: File): { valid: boolean; message?: string } => {
  const maxSize = 1024 * 1024 * 1024; // 1GB
  const fileSize = file.size;
  
  if (fileSize > maxSize) {
    return {
      valid: false,
      message: `Arquivo muito grande. Tamanho máximo permitido: ${formatFileSize(maxSize)}. Tamanho do arquivo: ${formatFileSize(fileSize)}`
    };
  }
  
  return { valid: true };
};

// Obter ícone do arquivo baseado no tipo
export const getFileIcon = (filename: string | undefined): string => {
  // Verificar se filename existe e não é undefined
  if (!filename || typeof filename !== 'string') {
    return ''; // Ícone padrão para arquivo desconhecido
  }
  
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return '';
    case 'doc':
    case 'docx':
      return '';
    case 'xls':
    case 'xlsx':
      return '';
    case 'csv':
      return ''; // Ícone para CSV
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
      return '';
    case 'txt':
    case 'rtf':
      return '';
    case 'msg':
    case 'eml':
      return ''; // Ícone para emails (Outlook MSG e EML)
    case 'zip':
    case 'rar':
    case '7z':
      return ''; // Ícone para arquivos compactados
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
      return ''; // Ícone para vídeos
    case 'mp3':
    case 'wav':
    case 'flac':
      return ''; // Ícone para áudios
    default:
      return ''; // Ícone genérico para qualquer arquivo
  }
};
