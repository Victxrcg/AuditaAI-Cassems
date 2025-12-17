// Serviço para gerar PDFs de documentos de compliance
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Gera PDF do termo de confidencialidade assinado
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
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Cabeçalho
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('TERMO DE CONFIDENCIALIDADE', { align: 'center' });
      
      doc.moveDown();
      doc.fontSize(12)
         .font('Helvetica')
         .text('(NDA - NON DISCLOSURE AGREEMENT)', { align: 'center' });

      doc.moveDown(2);

      // Quadro Resumo
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('QUADRO RESUMO', { align: 'left' });

      doc.moveDown();

      // I - CONTRATANTE
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('I – CONTRATANTE/PARTE DIVULGADORA', { align: 'left' });

      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica')
         .text(`I.1. ${dados.dadosCadastro.razao_social || '(NOME EMPRESA)'}, pessoa jurídica no CNPJ sob o nº ${dados.dadosCadastro.cnpj || '(CNPJ)'}, com sede na ${dados.dadosCadastro.endereco || '(ENDEREÇO)'}, ${dados.dadosCadastro.numero || ''}, ${dados.dadosCadastro.cidade || ''}/${dados.dadosCadastro.estado || ''}, CEP ${dados.dadosCadastro.cep || ''}, com os e-mails ${dados.dadosCadastro.email_contato || '(EMAIL)'}, neste ato representada na forma de seus atos societários, doravante denominada "CONTRATANTE".`, {
           align: 'justify',
           lineGap: 2
         });

      doc.moveDown();

      // II - CONTRATADA
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('II – CONTRATADA/PARTE RECEPTORA', { align: 'left' });

      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica')
         .text('DADOS DA EMPRESA PORTES', { align: 'left' });

      doc.moveDown();

      // Conteúdo do termo (simplificado para PDF)
      const termoTexto = dados.termoConteudo
        .replace(/<[^>]*>/g, '') // Remove tags HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      doc.fontSize(10)
         .font('Helvetica')
         .text(termoTexto, {
           align: 'justify',
           lineGap: 2,
           continued: false
         });

      // Assinatura
      if (dados.assinaturaInfo) {
        doc.moveDown(3);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('ASSINADO POR:', { align: 'center' });
        
        doc.moveDown(0.5);
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text(dados.assinaturaInfo.nomeAssinante, { align: 'center' });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Data: ${dados.assinaturaInfo.dataAssinatura}`, { align: 'center' });
        
        doc.moveDown(0.3);
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Hora: ${dados.assinaturaInfo.horaAssinatura}`, { align: 'center' });
      }

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

