// Serviço para gerar PDFs de documentos de compliance
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Cores do layout PORTES (adaptado de pdfLayoutUtils.ts)
const LAYOUT_COLORS = {
  primary: [0, 51, 102],      // Azul escuro (#003366)
  secondary: [0, 102, 204],  // Azul médio (#0066CC)
  text: [51, 51, 51],        // Cinza escuro (#333333)
  lightGray: [128, 128, 128], // Cinza médio
  border: [220, 225, 235],   // Cinza claro para bordas
};

/**
 * Gera PDF do termo de confidencialidade assinado no padrão ABNT com estilo PORTES
 * @param {Object} dados - Dados do termo e assinatura
 * @param {string} dados.termoConteudo - Conteúdo HTML/texto do termo
 * @param {Object} dados.dadosCadastro - Dados da empresa
 * @param {Object} dados.assinaturaInfo - Informações da assinatura
 * @param {string} dados.tipoCompliance - Tipo de compliance (rat-fat, etc)
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function gerarPDFTermoAssinado(dados) {
  return new Promise((resolve, reject) => {
    try {
      // Configurações ABNT: 3cm superior/esquerda, 2cm inferior/direita
      // 1cm = 28.35 pontos
      const margemSuperior = 3 * 28.35; // 85.05pt
      const margemInferior = 2 * 28.35; // 56.7pt
      const margemEsquerda = 3 * 28.35; // 85.05pt
      const margemDireita = 2 * 28.35; // 56.7pt
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { 
          top: margemSuperior, 
          bottom: margemInferior, 
          left: margemEsquerda, 
          right: margemDireita 
        }
      });

      const buffers = [];
      let currentPageNumber = 1;
      
      // Função para adicionar numeração no rodapé (ABNT: centralizado, 2cm da borda inferior)
      const addPageNumber = (pageNum) => {
        doc.save();
        const currentY = doc.y;
        const currentX = doc.x;
        
        doc.fontSize(10)
           .font('Times-Roman')
           .fillColor('black')
           .text(
             `${pageNum}`,
             margemEsquerda,
             doc.page.height - margemInferior + 10,
             {
               width: doc.page.width - margemEsquerda - margemDireita,
               align: 'center'
             }
           );
        
        doc.y = currentY;
        doc.x = currentX;
        doc.restore();
      };
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Função para verificar se precisa de nova página
      const checkNewPage = (espacoNecessario = 50) => {
        if (doc.y + espacoNecessario > doc.page.height - margemInferior) {
          doc.addPage();
          currentPageNumber++;
        }
      };

      // Configurações ABNT padrão com estilo PORTES
      const fonteNormal = 'Times-Roman';
      const fonteNegrito = 'Times-Bold';
      const tamanhoFonteNormal = 12;
      const tamanhoFonteTitulo = 14;
      const tamanhoFonteSubtitulo = 12;
      const espacamentoLinhas = 1.5; // Espaçamento 1,5 (ABNT)
      const espacamentoEntreParagrafos = 6; // 6pt entre parágrafos

      // TÍTULO PRINCIPAL (Centralizado, Negrito, 14pt, cor PORTES)
      doc.fontSize(tamanhoFonteTitulo)
         .font(fonteNegrito)
         .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
         .text('TERMO DE CONFIDENCIALIDADE', {
           align: 'center',
           lineGap: 6
         });
      
      checkNewPage(20);
      doc.moveDown(0.5);
      
      // Subtítulo (Centralizado, Normal, 12pt, cor texto)
      doc.fontSize(tamanhoFonteNormal)
         .font(fonteNormal)
         .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
         .text('(NDA – NON DISCLOSURE AGREEMENT)', {
           align: 'center',
           lineGap: 6
         });

      checkNewPage(30);
      doc.moveDown(1);

      // Conteúdo completo do termo
      const termoTexto = dados.termoConteudo
        .replace(/<[^>]*>/g, '') // Remove tags HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      // Dividir o texto em linhas para processar
      const linhas = termoTexto.split('\n');
      
      // Processar cada linha
      for (let i = 0; i < linhas.length; i++) {
        let linha = linhas[i].trim();
        
        // Pular linhas vazias (mas manter espaçamento mínimo)
        if (!linha) {
          checkNewPage(15);
          doc.moveDown(0.3);
          continue;
        }
        
        // Verificar espaço necessário antes de adicionar conteúdo
        checkNewPage(30);
        
        // TÍTULO PRINCIPAL DO TERMO (cor PORTES)
        if (linha === 'TERMO DE CONFIDENCIALIDADE') {
          doc.moveDown(0.5);
          doc.fontSize(tamanhoFonteTitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'center',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // Subtítulo NDA
        else if (linha.match(/^\(NDA[^)]+\)$/)) {
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNormal)
             .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
             .text(linha, {
               align: 'center',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // QUADRO RESUMO (Título de Seção, cor PORTES)
        else if (linha === 'QUADRO RESUMO') {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteTitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'left',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // CONSIDERANDOS (Título de Seção, cor PORTES)
        else if (linha === 'CONSIDERANDOS') {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteTitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'left',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // CLÁUSULA (Título de Seção, cor PORTES)
        else if (linha.match(/^CLÁUSULA\s+(PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA|QUINTA|SEXTA)[^:]*:/)) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteTitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'left',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // Seções numeradas (I –, II –, etc) - Subtítulo (cor secundária PORTES)
        else if (linha.match(/^(I{1,3}|IV|V|VI|VII|VIII|IX|X)\s*[–-]\s*(.+)$/)) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteSubtitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.secondary[0], LAYOUT_COLORS.secondary[1], LAYOUT_COLORS.secondary[2])
             .text(linha, {
               align: 'left',
               lineGap: 6
             });
          doc.moveDown(0.3);
        }
        // CONSIDERANDO (texto especial com recuo)
        else if (linha.startsWith('CONSIDERANDO')) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNormal)
             .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
             .text(linha, {
               align: 'justify',
               indent: 20, // Recuo de primeira linha
               lineGap: 6 * espacamentoLinhas
             });
          doc.moveDown(espacamentoEntreParagrafos / 6);
        }
        // RESOLVEM
        else if (linha.startsWith('RESOLVEM')) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'justify',
               lineGap: 6 * espacamentoLinhas
             });
          doc.moveDown(espacamentoEntreParagrafos / 6);
        }
        // Itens numerados (III.1., IV.2., etc) - Negrito (cor secundária PORTES)
        else if (linha.match(/^[IVX]+\.\d+\./)) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.secondary[0], LAYOUT_COLORS.secondary[1], LAYOUT_COLORS.secondary[2])
             .text(linha, {
               align: 'justify',
               lineGap: 6 * espacamentoLinhas
             });
          doc.moveDown(espacamentoEntreParagrafos / 6);
        }
        // Listas com bullet (•)
        else if (linha.startsWith('•') || linha.startsWith('-')) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNormal)
             .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
             .text(linha, {
               align: 'justify',
               indent: 20, // Recuo para lista
               lineGap: 6 * espacamentoLinhas
             });
          doc.moveDown(espacamentoEntreParagrafos / 6);
        }
        // Itens com letra (a), b), etc) - Recuo
        else if (linha.match(/^[a-z]\)\s+/)) {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNormal)
             .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
             .text(linha, {
               align: 'justify',
               indent: 20, // Recuo para subitens
               lineGap: 6 * espacamentoLinhas
             });
          doc.moveDown(espacamentoEntreParagrafos / 6);
        }
        // ASSINADO POR (Centralizado, cor PORTES)
        else if (linha === 'ASSINADO POR:' || linha.startsWith('ASSINADO POR:')) {
          doc.moveDown(1.5);
          checkNewPage(50);
          doc.fontSize(tamanhoFonteSubtitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'center',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // Data/Hora (Centralizado)
        else if (linha.startsWith('Data:') || linha.startsWith('Hora:')) {
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNormal)
             .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
             .text(linha, {
               align: 'center',
               lineGap: 6
             });
          doc.moveDown(0.3);
        }
        // Nome do assinante (linha após ASSINADO POR) - Centralizado e Negrito (cor PORTES)
        else if (i > 0 && linhas[i-1].trim().startsWith('ASSINADO POR:')) {
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'center',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // ASSINATURAS ELETRÔNICAS (Título, cor PORTES)
        else if (linha === 'ASSINATURAS ELETRÔNICAS') {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteTitulo)
             .font(fonteNegrito)
             .fillColor(LAYOUT_COLORS.primary[0], LAYOUT_COLORS.primary[1], LAYOUT_COLORS.primary[2])
             .text(linha, {
               align: 'center',
               lineGap: 6
             });
          doc.moveDown(0.5);
        }
        // Separador (cor borda PORTES)
        else if (linha.match(/^[–-]{4,}$/)) {
          doc.moveDown(1);
          checkNewPage(30);
          // Linha separadora
          const currentY = doc.y;
          doc.strokeColor(`rgb(${LAYOUT_COLORS.border.join(',')})`)
             .lineWidth(0.5)
             .moveTo(margemEsquerda, currentY)
             .lineTo(doc.page.width - margemDireita, currentY)
             .stroke();
          doc.moveDown(1);
        }
        // Parágrafo normal (Justificado, 12pt, espaçamento 1,5, cor texto)
        else {
          doc.moveDown(espacamentoEntreParagrafos / 6);
          doc.fontSize(tamanhoFonteNormal)
             .font(fonteNormal)
             .fillColor(LAYOUT_COLORS.text[0], LAYOUT_COLORS.text[1], LAYOUT_COLORS.text[2])
             .text(linha, {
               align: 'justify',
               lineGap: 6 * espacamentoLinhas
             });
          doc.moveDown(espacamentoEntreParagrafos / 6);
        }
      }

      // Adicionar numeração em todas as páginas antes de finalizar
      // Usar o bufferedPageRange para adicionar numeração em todas as páginas
      const addPageNumbersToAllPages = () => {
        try {
          const range = doc.bufferedPageRange();
          if (range && range.count > 0) {
            for (let i = range.start; i < range.start + range.count; i++) {
              doc.switchToPage(i);
              const pageNum = i - range.start + 1;
              doc.save();
              const currentY = doc.y;
              const currentX = doc.x;
              
              doc.fontSize(10)
                 .font('Times-Roman')
                 .fillColor(LAYOUT_COLORS.lightGray[0], LAYOUT_COLORS.lightGray[1], LAYOUT_COLORS.lightGray[2])
                 .text(
                   `${pageNum}`,
                   margemEsquerda,
                   doc.page.height - margemInferior + 10,
                   {
                     width: doc.page.width - margemEsquerda - margemDireita,
                     align: 'center'
                   }
                 );
              
              doc.y = currentY;
              doc.x = currentX;
              doc.restore();
            }
          }
        } catch (err) {
          console.error('Erro ao adicionar numeração de páginas:', err);
        }
      };

      // Adicionar numeração antes de finalizar
      addPageNumbersToAllPages();

      // Finalizar PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  gerarPDFTermoAssinado
};

