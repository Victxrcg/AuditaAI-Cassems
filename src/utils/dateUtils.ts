// Utilitários para formatação de datas no padrão brasileiro
export const formatDateBR = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // Se já está no formato DD/MM/YYYY, retornar como está
    if (dateString.includes('/')) {
      return dateString;
    }
    
    // Se está no formato YYYY-MM-DD, converter sem usar new Date() para evitar problemas de fuso horário
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Para outros formatos, usar new Date() como fallback
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    return dateString;
  }
};

// Função para formatar data e hora no padrão brasileiro
export const formatDateTimeBR = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  } catch (error) {
    return dateString;
  }
};

// Função para converter data do formato brasileiro para ISO
export const parseDateBR = (dateBR: string): string => {
  if (!dateBR) return '';
  
  try {
    // Converte DD/MM/YYYY para YYYY-MM-DD
    const [day, month, year] = dateBR.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch (error) {
    return dateBR;
  }
};

// Função para converter data do formato ISO para brasileiro
export const parseDateISO = (dateISO: string): string => {
  if (!dateISO) return '';
  
  try {
    // Converte YYYY-MM-DD para DD/MM/YYYY
    const [year, month, day] = dateISO.split('-');
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateISO;
  }
};

// Função para formatar data no título da competência
export const formatCompetenciaTitle = (dateString: string): string => {
  if (!dateString) return 'Competência Período';
  
  try {
    // Se contém "|" significa que é um período (data_inicio|data_fim)
    if (dateString.includes('|')) {
      const [dataInicio, dataFim] = dateString.split('|');
      
      if (dataInicio && dataFim) {
        // Formatar data de início
        const dataInicioFormatted = formatDateBR(dataInicio);
        // Formatar data de fim
        const dataFimFormatted = formatDateBR(dataFim);
        
        return `Competência Período (${dataInicioFormatted} - ${dataFimFormatted})`;
      } else if (dataInicio) {
        // Apenas data de início
        const dataInicioFormatted = formatDateBR(dataInicio);
        return `Competência Período (${dataInicioFormatted})`;
      }
    }
    
    // Se a data já está no formato YYYY-MM-DD (do input type="date")
    if (dateString.includes('-')) {
      const dataFormatted = formatDateBR(dateString);
      return `Competência Período (${dataFormatted})`;
    }
    
    // Se a data está em outro formato, tentar converter
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return `Competência Período (${dateString})`;
    }
    
    const dataFormatted = formatDateBR(dateString);
    return `Competência Período (${dataFormatted})`;
  } catch (error) {
    return `Competência Período (${dateString})`;
  }
};
