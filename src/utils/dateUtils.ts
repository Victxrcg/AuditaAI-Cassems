// Utilitários para formatação de datas no padrão brasileiro
export const formatDateBR = (dateString: string | Date | any): string => {
  if (!dateString) return '';
  
  try {
    // Se for um objeto Date, converter para string ISO
    if (dateString instanceof Date) {
      dateString = dateString.toISOString();
    }
    
    // Se não for string, tentar converter
    if (typeof dateString !== 'string') {
      // Se for um objeto, tentar extrair propriedades comuns de data
      if (typeof dateString === 'object' && dateString !== null) {
        // Tentar propriedades comuns de objetos de data
        if (dateString.date) {
          dateString = dateString.date;
        } else if (dateString.created_at) {
          dateString = dateString.created_at;
        } else if (dateString.toString && typeof dateString.toString === 'function') {
          dateString = dateString.toString();
        } else {
          console.warn('Não foi possível converter objeto para string de data:', dateString);
          return '';
        }
      } else {
        dateString = String(dateString);
      }
    }
    
    // Se ainda não for string válida, retornar vazio
    if (typeof dateString !== 'string' || dateString.trim() === '') {
      return '';
    }
    
    // Se já está no formato DD/MM/YYYY, retornar como está
    if (dateString.includes('/') && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return dateString;
    }
    
    // Se está no formato ISO completo (YYYY-MM-DDTHH:MM:SS.000Z), extrair apenas a data
    if (dateString.includes('T')) {
      const datePart = dateString.split('T')[0]; // Pega apenas YYYY-MM-DD
      const [year, month, day] = datePart.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }
    
    // Se está no formato YYYY-MM-DD, converter sem usar new Date() para evitar problemas de fuso horário
    if (dateString.includes('-') && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const datePart = dateString.split(' ')[0]; // Pega apenas a parte da data se houver hora
      const [year, month, day] = datePart.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }
    
    // Para outros formatos, usar new Date() como fallback
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Data inválida em formatDateBR:', dateString);
      return ''; // Retornar vazio se não conseguir parsear
    }
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    console.warn('Erro ao formatar data em formatDateBR:', dateString, error);
    return '';
  }
};

// Função para formatar data e hora no padrão brasileiro
export const formatDateTimeBR = (dateString: string | Date | any): string => {
  if (!dateString) return '';
  
  try {
    // Se for um objeto Date, converter para string ISO
    if (dateString instanceof Date) {
      dateString = dateString.toISOString();
    }
    
    // Se não for string, tentar converter
    if (typeof dateString !== 'string') {
      // Se for um objeto, tentar extrair propriedades comuns de data
      if (typeof dateString === 'object' && dateString !== null) {
        // Tentar propriedades comuns de objetos de data
        if (dateString.date) {
          dateString = dateString.date;
        } else if (dateString.created_at) {
          dateString = dateString.created_at;
        } else if (dateString.toString && typeof dateString.toString === 'function') {
          dateString = dateString.toString();
        } else {
          console.warn('Não foi possível converter objeto para string de data:', dateString);
          return '';
        }
      } else {
        dateString = String(dateString);
      }
    }
    
    // Se ainda não for string válida, retornar vazio
    if (typeof dateString !== 'string' || dateString.trim() === '') {
      return '';
    }
    
    // Se já está no formato brasileiro, retornar como está
    if (dateString.includes('/') && dateString.includes(':')) {
      return dateString;
    }
    
    // Se está no formato ISO completo (YYYY-MM-DDTHH:MM:SS.000Z ou YYYY-MM-DD HH:MM:SS)
    let date: Date;
    
    if (dateString.includes('T')) {
      // Formato ISO com T (YYYY-MM-DDTHH:MM:SS.000Z)
      date = new Date(dateString);
    } else if (dateString.includes(' ') && dateString.includes(':')) {
      // Formato MySQL (YYYY-MM-DD HH:MM:SS)
      date = new Date(dateString.replace(' ', 'T'));
    } else if (dateString.includes('-')) {
      // Formato apenas data (YYYY-MM-DD)
      date = new Date(dateString + 'T00:00:00');
    } else {
      // Tentar parsear como está
      date = new Date(dateString);
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.warn('Data inválida:', dateString);
      return ''; // Retornar vazio se não conseguir parsear
    }
    
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.warn('Erro ao formatar data:', dateString, error);
    return '';
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
  if (!dateString) return 'Período';
  
  try {
    // Se contém "|" significa que é um período (data_inicio|data_fim)
    if (dateString.includes('|')) {
      const [dataInicio, dataFim] = dateString.split('|');
      
      if (dataInicio && dataFim) {
        // Formatar data de início
        const dataInicioFormatted = formatDateBR(dataInicio);
        // Formatar data de fim
        const dataFimFormatted = formatDateBR(dataFim);
        
        return `Período (${dataInicioFormatted}) - (${dataFimFormatted})`;
      } else if (dataInicio) {
        // Apenas data de início
        const dataInicioFormatted = formatDateBR(dataInicio);
        return `Período (${dataInicioFormatted})`;
      }
    }
    
    // Se a data já está no formato YYYY-MM-DD (do input type="date")
    if (dateString.includes('-')) {
      const dataFormatted = formatDateBR(dateString);
      return `Período (${dataFormatted})`;
    }
    
    // Se a data está em outro formato, tentar converter
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return `Período (${dateString})`;
    }
    
    const dataFormatted = formatDateBR(dateString);
    return `Período (${dataFormatted})`;
  } catch (error) {
    return `Período (${dateString})`;
  }
};
