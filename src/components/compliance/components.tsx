import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ComplianceItem } from './types';
import { formatDateTimeBR } from '@/utils/dateUtils';
import { lightenColor, darkenColor } from './utils';

// Obter badge de organização (retorna JSX)
export const getOrganizationBadge = (organizacao: string | undefined, cor?: string): React.ReactElement | null => {
  if (!organizacao) return null;

  const configPadrao: Record<string, { nome: string; cor: string; corClara: string; corTexto: string }> = {
    portes: {
      nome: 'PORTES',
      cor: '#10B981',
      corClara: '#D1FAE5',
      corTexto: '#065F46'
    },
    cassems: {
      nome: 'CASSEMS',
      cor: '#3B82F6',
      corClara: '#DBEAFE',
      corTexto: '#1E40AF'
    }
  };

  const orgConfig = configPadrao[organizacao.toLowerCase()];
  
  let org;
  if (orgConfig) {
    org = orgConfig;
  } else {
    const corBase = cor || '#8B5CF6';
    org = {
      nome: organizacao.toUpperCase().replace(/_/g, ' '),
      cor: corBase,
      corClara: lightenColor(corBase),
      corTexto: darkenColor(corBase)
    };
  }

  return (
    <Badge
      style={{
        backgroundColor: org.corClara,
        color: org.corTexto,
        border: `1px solid ${org.cor}`
      }}
      className="text-xs font-medium"
    >
      {org.nome}
    </Badge>
  );
};

// Obter indicador de edição (retorna JSX)
export const getEditIndicator = (item: ComplianceItem, cor?: string): React.ReactElement | null => {
  if (!item.updatedBy || !item.organizacao) return null;

  const configPadrao: Record<string, { nome: string; cor: string }> = {
    portes: {
      nome: 'Portes',
      cor: '#10B981'
    },
    cassems: {
      nome: 'Cassems',
      cor: '#3B82F6'
    }
  };

  const orgConfig = configPadrao[item.organizacao.toLowerCase()];
  
  let org;
  if (orgConfig) {
    org = orgConfig;
  } else {
    org = {
      nome: item.organizacao.charAt(0).toUpperCase() + item.organizacao.slice(1).replace(/_/g, ' '),
      cor: cor || '#8B5CF6'
    };
  }

  return (
    <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap break-words">
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: org.cor }}
      />
      <span className="break-words">
        Editado por {item.updatedBy} ({org.nome})
        {item.lastUpdated && ` em ${formatDateTimeBR(item.lastUpdated)}`}
      </span>
    </div>
  );
};

