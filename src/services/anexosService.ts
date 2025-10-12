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

  const response = await fetch(`${API_BASE}/compliance/competencias/${complianceId}/anexos/${tipoAnexo}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Erro ao fazer upload do anexo');
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

// Validar tipo de arquivo
export const validateFileType = (file: File): boolean => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png'
  ];
  
  return allowedTypes.includes(file.type);
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
    case 'jpg':
    case 'jpeg':
    case 'png':
      return '';
    case 'txt':
      return '';
    default:
      return '';
  }
};
