import { Anexo } from '@/services/anexosService';

export interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  valor?: string;
  data?: string;
  observacoes?: string;
  anexos?: Anexo[];
  status: 'pendente' | 'concluido' | 'em_analise';
  lastUpdated?: string;
  updatedBy?: string;
  organizacao?: string;
  isExpanded?: boolean;
  emailRemetente?: string;
  emailDestinatario?: string;
  emailAssunto?: string;
  emailEnviado?: boolean;
}

export interface Competencia {
  id: string;
  mes: string;
  ano: string;
  status: 'em_andamento' | 'concluida';
  parecer_gerado: boolean;
  created_at: string;
  created_by_nome: string;
  created_by_organizacao?: string;
  created_by_cor?: string;
  competencia_formatada?: string;
  competencia_referencia?: string;
  competencia_inicio?: string;
  competencia_fim?: string;
  parecer_texto?: string;
  ultima_alteracao_por?: string;
  ultima_alteracao_por_nome?: string;
  ultima_alteracao_organizacao?: string;
  ultima_alteracao_em?: string;
  updated_at?: string;
  organizacao?: string;
}

export interface HistoricoAlteracao {
  id: number;
  campo_alterado: string;
  campo_alterado_titulo?: string;
  valor_anterior: string;
  valor_novo: string;
  alterado_por_nome: string;
  alterado_por_organizacao: string;
  alterado_por_cor: string;
  alterado_em: string;
}

export interface LeiVigente {
  titulo: string;
  descricao: string;
  link?: string;
}

export interface ComplianceProps {
  tipoCompliance?: string;
}

