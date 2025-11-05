import jsPDF from 'jspdf';

// Cores do layout baseado no documento Word PORTES ADVOGADOS
export const LAYOUT_COLORS = {
  navy: [23, 37, 84] as [number, number, number], // Azul escuro navy (#172554)
  gold: [212, 175, 55] as [number, number, number], // Dourado (#D4AF37)
  yellow: [255, 193, 7] as [number, number, number], // Amarelo para ícones (#FFC107)
  white: [255, 255, 255] as [number, number, number], // Branco
  primary: [0, 51, 102] as [number, number, number], // Azul escuro (#003366)
  secondary: [0, 102, 204] as [number, number, number], // Azul médio (#0066CC)
  accent: [15, 157, 88] as [number, number, number], // Verde (#0F9D58)
  warning: [217, 48, 37] as [number, number, number], // Vermelho (#D93025)
  text: [51, 51, 51] as [number, number, number], // Cinza escuro (#333333)
  lightGray: [128, 128, 128] as [number, number, number], // Cinza médio
  border: [220, 225, 235] as [number, number, number], // Cinza claro para bordas
};

// Configurações de layout
export const LAYOUT_CONFIG = {
  margin: 20,
  headerHeight: 45, // Altura do cabeçalho com logo
  footerHeight: 20, // Altura do rodapé
  logoWidth: 50,
  logoHeight: 35,
  lineSpacing: 0.1, // Espaçamento entre linhas (muito reduzido)
  sectionSpacing: 3, // Espaçamento entre seções (reduzido)
  titleSpacing: 2, // Espaçamento após títulos (reduzido)
  paragraphSpacing: 1.5, // Espaçamento entre parágrafos
  leftBorderWidth: 3, // Largura da linha vertical esquerda
  goldBandHeight: 10, // Altura da faixa dourada
};

/**
 * Adiciona imagem de background do layout em todas as páginas do PDF
 * IMPORTANTE: No jsPDF, para o background ficar atrás do conteúdo, precisamos
 * inserir as imagens no início de cada página. Esta função reorganiza as páginas.
 * @param pdf - Instância do jsPDF
 * @param backgroundImagePath - Caminho para a imagem do layout (ex: '/layout-background.png')
 */
export const addLayoutBackgroundToAllPages = (pdf: jsPDF, backgroundImagePath: string = '/layout-background.png'): void => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  const totalPages = pdf.internal.pages.length - 1;
  
  // Adicionar background em todas as páginas
  // Como o jsPDF não suporta z-index facilmente, vamos adicionar a imagem
  // no início de cada página (ela ficará atrás se adicionarmos antes do conteúdo)
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    try {
      // Salvar o estado atual da página
      const pageContent = pdf.internal.pages[i];
      
      // Adicionar imagem de background (tentará carregar)
      // Nota: Se a imagem não existir, continuará sem ela
      pdf.addImage(backgroundImagePath, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    } catch (error) {
      console.warn(`Erro ao carregar imagem de background na página ${i}, continuando sem background:`, error);
      // Se não conseguir carregar a imagem, continuar sem ela
    }
  }
};

/**
 * Adiciona background na página atual (para ser chamado quando criar nova página)
 * @param pdf - Instância do jsPDF
 * @param backgroundImagePath - Caminho para a imagem do layout
 */
export const addLayoutBackgroundToCurrentPage = (pdf: jsPDF, backgroundImagePath: string = '/layout-background.png'): void => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  try {
    // Adicionar imagem de background na página atual
    pdf.addImage(backgroundImagePath, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  } catch (error) {
    console.warn('Erro ao carregar imagem de background, continuando sem background:', error);
  }
};

/**
 * Adiciona cabeçalho completo PORTES ADVOGADOS ao PDF seguindo o layout do documento Word
 * Nota: O background já deve ter sido adicionado antes de chamar esta função
 */
export const addHeader = (pdf: jsPDF, logoPath?: string, backgroundImagePath?: string) => {
  // Retornar posição Y inicial para o conteúdo (abaixo do cabeçalho)
  // O background já foi adicionado antes de chamar esta função
  return LAYOUT_CONFIG.margin + LAYOUT_CONFIG.headerHeight + LAYOUT_CONFIG.titleSpacing;
};

/**
 * Adiciona rodapé PORTES ADVOGADOS ao PDF seguindo o layout do documento Word
 * (Se estiver usando background, apenas adiciona numeração de páginas)
 */
export const addFooter = (pdf: jsPDF, pageNumber: number, totalPages: number, infoTexto?: string) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = LAYOUT_CONFIG.margin;
  
  // Se estiver usando background, o rodapé já está na imagem
  // Adicionar numeração de páginas e informações de geração (se fornecidas)
  pdf.setFontSize(9);
  pdf.setTextColor(...LAYOUT_COLORS.lightGray);
  pdf.setFont('helvetica', 'normal');
  
  const footerY = pageHeight - LAYOUT_CONFIG.margin;
  
  // Adicionar informações de geração no lado esquerdo (apenas na primeira página ou todas as páginas)
  if (infoTexto && pageNumber === 1) {
    pdf.text(
      infoTexto,
      margin + 10,
      footerY - 5
    );
  }
  
  // Numeração de páginas no lado direito
  pdf.text(
    `Página ${pageNumber} de ${totalPages}`,
    pageWidth - margin - 30,
    footerY - 5
  );
  
  return footerY - LAYOUT_CONFIG.footerHeight;
};

/**
 * Adiciona texto formatado seguindo o layout do documento Word
 */
export const addFormattedText = (
  pdf: jsPDF,
  text: string,
  options: {
    fontSize?: number;
    isBold?: boolean;
    color?: [number, number, number];
    align?: 'left' | 'center' | 'right';
    marginLeft?: number;
    marginRight?: number;
  } = {}
) => {
  const {
    fontSize = 12,
    isBold = false,
    color = LAYOUT_COLORS.text,
    align = 'left',
    marginLeft = LAYOUT_CONFIG.margin,
    marginRight = LAYOUT_CONFIG.margin
  } = options;
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  // Normalizar texto
  const cleanText = text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
  
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...color);
  pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
  
  // Quebrar texto em linhas
  const lines = pdf.splitTextToSize(cleanText, contentWidth);
  
  return lines;
};

/**
 * Adiciona título de seção seguindo o layout do documento Word
 */
export const addSectionTitle = (
  pdf: jsPDF,
  title: string,
  yPosition: number,
  level: 1 | 2 | 3 = 2
): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.leftBorderWidth; // Margem considerando a linha vertical
  const contentWidth = pageWidth - margin - LAYOUT_CONFIG.margin;
  
  let fontSize: number;
  let color: [number, number, number];
  
  switch (level) {
    case 1:
      fontSize = 16; // Reduzido de 20 para 16 para caber em 1 linha
      color = LAYOUT_COLORS.primary;
      break;
    case 2:
      fontSize = 14; // Reduzido de 16 para 14
      color = LAYOUT_COLORS.secondary;
      break;
    case 3:
      fontSize = 12; // Reduzido de 14 para 12
      color = LAYOUT_COLORS.secondary;
      break;
  }
  
  // Para títulos level 1, garantir que caiba em uma linha
  if (level === 1) {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', 'bold');
    // Testar se cabe em uma linha
    let testWidth = pdf.getTextWidth(title);
    let testFontSize = fontSize;
    
    // Se não cabe, reduzir o tamanho da fonte até caber (mínimo 12)
    while (testWidth > contentWidth && testFontSize > 12) {
      testFontSize -= 0.5;
      pdf.setFontSize(testFontSize);
      testWidth = pdf.getTextWidth(title);
    }
    
    // Se ainda não couber, usar fonte menor (mínimo 12)
    if (testWidth > contentWidth && testFontSize <= 12) {
      testFontSize = 12;
      pdf.setFontSize(testFontSize);
    }
    
    fontSize = testFontSize;
  }
  
  const lines = addFormattedText(pdf, title, {
    fontSize,
    isBold: true,
    color,
  });
  
  let currentY = yPosition;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottomMargin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.footerHeight;
  
  lines.forEach((line: string) => {
      if (currentY > pageHeight - bottomMargin) {
        pdf.addPage();
        // IMPORTANTE: Adicionar background PRIMEIRO na nova página
        try {
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.addImage('/layout-background.png', 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        } catch (error) {
          console.warn('Erro ao carregar background na nova página:', error);
        }
        currentY = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.headerHeight + LAYOUT_CONFIG.titleSpacing;
      }
      
      pdf.text(line, margin, currentY);
      currentY += fontSize * (1 + LAYOUT_CONFIG.lineSpacing); // Espaçamento reduzido entre linhas
    });
    
    // Espaçamento mínimo após título
    currentY += LAYOUT_CONFIG.titleSpacing;
    return currentY;
};

/**
 * Adiciona texto de corpo seguindo o layout do documento Word
 */
export const addBodyText = (
  pdf: jsPDF,
  text: string,
  yPosition: number,
  options: {
    fontSize?: number;
    isBold?: boolean;
    color?: [number, number, number];
    indent?: number;
  } = {}
): number => {
  const {
    fontSize = 12,
    isBold = false,
    color = LAYOUT_COLORS.text,
    indent = 0
  } = options;
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.leftBorderWidth + indent;
  const contentWidth = pageWidth - margin - LAYOUT_CONFIG.margin;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottomMargin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.footerHeight;
  
  const lines = addFormattedText(pdf, text, {
    fontSize,
    isBold,
    color,
    marginLeft: margin,
    marginRight: LAYOUT_CONFIG.margin
  });
  
  let currentY = yPosition;
  
  lines.forEach((line: string) => {
      if (currentY > pageHeight - bottomMargin) {
        pdf.addPage();
        // IMPORTANTE: Adicionar background PRIMEIRO na nova página
        try {
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.addImage('/layout-background.png', 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        } catch (error) {
          console.warn('Erro ao carregar background na nova página:', error);
        }
        currentY = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.headerHeight + LAYOUT_CONFIG.titleSpacing;
      }
      
      pdf.text(line, margin, currentY);
      currentY += fontSize * (1 + LAYOUT_CONFIG.lineSpacing); // Espaçamento reduzido
    });
    
    return currentY;
};

/**
 * Adiciona lista de itens seguindo o layout do documento Word
 */
export const addListItem = (
  pdf: jsPDF,
  items: string[],
  yPosition: number,
  options: {
    fontSize?: number;
    bulletColor?: [number, number, number];
    indent?: number;
  } = {}
): number => {
  const {
    fontSize = 11,
    bulletColor = LAYOUT_COLORS.text,
    indent = 10
  } = options;
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.leftBorderWidth + indent;
  const contentWidth = pageWidth - margin - LAYOUT_CONFIG.margin;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottomMargin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.footerHeight;
  
  let currentY = yPosition;
  
  items.forEach((item) => {
    // Texto do item (sem bullet adicional, já que o item pode vir formatado)
    const itemText = item.replace(/^[-•]\s*/, '').trim();
    
    // Para formato compacto, usar apenas o texto sem bullet se indent for 0
    const useBullet = indent > 0;
    const textMargin = useBullet ? margin + 5 : margin;
    
    const lines = addFormattedText(pdf, itemText, {
      fontSize,
      marginLeft: textMargin,
      marginRight: LAYOUT_CONFIG.margin
    });
    
    lines.forEach((line: string, index: number) => {
      if (currentY > pageHeight - bottomMargin) {
        pdf.addPage();
        // IMPORTANTE: Adicionar background PRIMEIRO na nova página (antes de qualquer conteúdo)
        try {
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.addImage('/layout-background.png', 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        } catch (error) {
          console.warn('Erro ao carregar background na nova página:', error);
        }
        currentY = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.headerHeight + LAYOUT_CONFIG.titleSpacing;
      }
      
      // Adicionar bullet apenas na primeira linha e se indent > 0
      if (index === 0 && useBullet) {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...bulletColor);
        pdf.setFont('helvetica', 'normal');
        pdf.text('•', margin, currentY);
      }
      
      pdf.text(line, textMargin, currentY);
      currentY += fontSize * (1 + LAYOUT_CONFIG.lineSpacing); // Espaçamento reduzido
    });
    
    currentY += 1.5; // Espaçamento mínimo entre itens
  });
  
  return currentY;
};

/**
 * Adiciona linha divisória seguindo o layout do documento Word
 */
export const addDivider = (pdf: jsPDF, yPosition: number): number => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.leftBorderWidth;
  
  pdf.setDrawColor(...LAYOUT_COLORS.border);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPosition, pageWidth - LAYOUT_CONFIG.margin, yPosition);
  
  return yPosition + LAYOUT_CONFIG.paragraphSpacing; // Espaçamento reduzido após divisor
};

/**
 * Adiciona tabela simples seguindo o layout do documento Word
 */
export const addTable = (
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  yPosition: number,
  options: {
    fontSize?: number;
    headerColor?: [number, number, number];
    headerBgColor?: [number, number, number];
    cellPadding?: number;
  } = {}
): number => {
  const {
    fontSize = 10,
    headerColor = [255, 255, 255],
    headerBgColor = LAYOUT_COLORS.primary,
    cellPadding = 3 // Padding reduzido
  } = options;
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.leftBorderWidth; // Margem considerando a linha vertical
  const contentWidth = pageWidth - margin - LAYOUT_CONFIG.margin;
  const colWidth = contentWidth / headers.length;
  
  let currentY = yPosition; // Sem espaço extra antes da tabela
  const rowHeight = fontSize * 1.1 + (cellPadding * 2); // Altura reduzida das linhas
  
  // Cabeçalho da tabela
  pdf.setFillColor(...headerBgColor);
  pdf.setDrawColor(...LAYOUT_COLORS.border);
  pdf.setLineWidth(0.5);
  pdf.rect(margin, currentY, contentWidth, rowHeight, 'FD');
  
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...headerColor);
  pdf.setFont('helvetica', 'bold');
  
  headers.forEach((header, index) => {
    const xPos = margin + (colWidth * index) + cellPadding;
    pdf.text(header, xPos, currentY + rowHeight / 2 + fontSize / 3);
  });
  
  currentY += rowHeight;
  
  // Linhas da tabela
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...LAYOUT_COLORS.text);
  
  rows.forEach((row, rowIndex) => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const bottomMargin = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.footerHeight;
    
    if (currentY + rowHeight > pageHeight - bottomMargin) {
      pdf.addPage();
      // Adicionar cabeçalho na nova página
      addHeader(pdf);
      currentY = LAYOUT_CONFIG.margin + LAYOUT_CONFIG.headerHeight + LAYOUT_CONFIG.titleSpacing;
    }
    
    // Borda da linha
    pdf.setDrawColor(...LAYOUT_COLORS.border);
    pdf.rect(margin, currentY, contentWidth, rowHeight, 'D');
    
    row.forEach((cell, cellIndex) => {
      const xPos = margin + (colWidth * cellIndex) + cellPadding;
      const lines = pdf.splitTextToSize(cell, colWidth - cellPadding * 2);
      pdf.text(lines[0] || '', xPos, currentY + rowHeight / 2 + fontSize / 3);
    });
    
    currentY += rowHeight;
  });
  
  return currentY + 2; // Espaçamento mínimo após tabela
};

