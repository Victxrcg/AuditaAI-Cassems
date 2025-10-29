const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Usar a mesma configuração de email que já está funcionando no authControllers
function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Boolean(process.env.SMTP_SECURE === 'true'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback transporter que simula envio em desenvolvimento
  return {
    sendMail: async (options) => {
      console.log('📧 [DEV] Email enviado (simulado):', options);
      return { messageId: 'dev-simulated' };
    }
  };
}

// Função para enviar email com anexos
const enviarEmailComAnexos = async (destinatario, remetente, assunto, corpo, anexos = [], replyTo) => {
  try {
    const transporter = createTransporter();

    // Preparar anexos
    console.log('🔍 DEBUG: Processando anexos no emailService...');
    console.log('🔍 DEBUG: Anexos recebidos:', anexos);
    
    const attachments = anexos.map(anexo => {
      console.log(`🔍 DEBUG: Processando anexo: ${anexo.filename}`);
      console.log(`🔍 DEBUG: Caminho: ${anexo.path}`);
      console.log(`🔍 DEBUG: Content-Type: ${anexo.contentType}`);
      
      // Verificar se o arquivo existe
      if (fs.existsSync(anexo.path)) {
        const stats = fs.statSync(anexo.path);
        console.log(`🔍 DEBUG: Arquivo existe, tamanho: ${stats.size} bytes`);
        
        // Ler o arquivo como buffer para evitar problemas de timing
        const fileBuffer = fs.readFileSync(anexo.path);
        console.log(`🔍 DEBUG: Buffer lido, tamanho: ${fileBuffer.length} bytes`);
        
        return {
          filename: anexo.filename,
          content: fileBuffer,
          contentType: anexo.contentType || 'application/pdf'
        };
      } else {
        console.error(`❌ DEBUG: Arquivo não existe: ${anexo.path}`);
        return null;
      }
    }).filter(attachment => attachment !== null);

    console.log('🔍 DEBUG: Attachments preparados:', attachments);

    const mailOptions = {
      from: remetente,
      to: destinatario,
      subject: assunto,
      html: corpo,
      attachments: attachments,
      ...(replyTo ? { replyTo } : {})
    };

    console.log('📧 Enviando email:', {
      from: remetente,
      to: destinatario,
      subject: assunto,
      attachments: attachments.length
    });

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado com sucesso:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email enviado com sucesso'
    };

  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Erro ao enviar email'
    };
  }
};

// Função específica para enviar anexos por email
const enviarNotasFiscais = async (emailRemetente, emailDestinatario, competenciaId, anexos, assuntoOpcional, tipoAnexo, competenciaPeriodo) => {
  try {
    // Determinar assunto padrão baseado no tipo de anexo e período
    let assuntoPadrao = `Arquivo - Competência ${competenciaId}`;
    if (competenciaPeriodo && competenciaPeriodo.trim()) {
      if (tipoAnexo === 'relatorio_faturamento') {
        assuntoPadrao = `Relatório Faturamento - Competência Período (${competenciaPeriodo})`;
      } else if (tipoAnexo === 'estabelecimento') {
        assuntoPadrao = `Notas Fiscais - Competência Período (${competenciaPeriodo})`;
      }
    } else {
      if (tipoAnexo === 'relatorio_faturamento') {
        assuntoPadrao = `Relatório Faturamento - Competência ${competenciaId}`;
      } else if (tipoAnexo === 'estabelecimento') {
        assuntoPadrao = `Notas Fiscais - Competência ${competenciaId}`;
      }
    }
    
    const assunto = assuntoOpcional && assuntoOpcional.trim() ? assuntoOpcional.trim() : assuntoPadrao;
    
    // Usar o mesmo formato de email que já está funcionando no sistema
    const appName = process.env.APP_NAME || 'Compliance App';
    const from = process.env.SMTP_FROM || 'no-reply@portes.com.br';
    
    // Determinar título e mensagem baseado no tipo de anexo
    const tituloEmail = tipoAnexo === 'relatorio_faturamento' 
      ? '📊 Relatório de Faturamento Enviado'
      : '📄 Notas Fiscais Enviadas';
    
    const mensagemEmail = assuntoOpcional && assuntoOpcional.trim() 
      ? assuntoOpcional.trim() 
      : tipoAnexo === 'relatorio_faturamento'
        ? `Segue em anexo o relatório de faturamento da competência <strong>${competenciaId}</strong>.`
        : `Segue em anexo as notas fiscais da competência <strong>${competenciaId}</strong>.`;
    
    const corpo = `
      <div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>${tituloEmail}</h2>
        
        <p>Olá,</p>
        
        <p>${mensagemEmail}</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">📋 Detalhes do Envio:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Remetente:</strong> ${emailRemetente}</li>
            <li><strong>Competência:</strong> ${competenciaId}</li>
            <li><strong>Data de Envio:</strong> ${new Date().toLocaleDateString('pt-BR')}</li>
            <li><strong>Arquivos Anexados:</strong> ${anexos.length}</li>
          </ul>
        </div>
        
        <p>Este email foi enviado automaticamente pelo sistema ${appName}.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #6b7280; font-size: 12px;">
          Sistema de Compliance Fiscal - ${appName}<br>
          Enviado em: ${new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    `;

    return await enviarEmailComAnexos(emailDestinatario, from, assunto, corpo, anexos, emailRemetente);

  } catch (error) {
    console.error('❌ Erro ao enviar notas fiscais:', error);
    return {
      success: false,
      error: error.message,
      message: 'Erro ao enviar notas fiscais'
    };
  }
};

module.exports = {
  enviarEmailComAnexos,
  enviarNotasFiscais,
  createTransporter
};
