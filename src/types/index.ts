export interface Customer {
  id: number;
  credor: string;
  cpfCnpj: string;
  titulo: string;
  matricula: string;
  nome: string;
  dataVencimento: string;
  atraso: number;
  valorRecebido: number;
  plano?: string;
  dataPromessaPg?: string;
  dataPagamento?: string;
  comissao: number;
  acao: string;
  smsEnviado: boolean;
  uraEnviado: boolean;
  envioNegociacao?: string;
  audioUrl?: string;
  audioName?: string;
  audioUploadDate?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  uploadDate: string;
  description?: string;
  fileType: string;
}

export interface DashboardMetrics {
  totalClientes: number;
  totalReceitas: number;
  clientesAtrasados: number;
  totalComissao: number;
  mediaAtraso: number;
  taxaRecuperacao: number;
  clientesComAudio: number;
}

export interface AudioFile {
  id: string;
  customerId: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  duration?: number;
  size?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'manager';
  avatar?: string;
}