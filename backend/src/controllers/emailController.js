const { executeQueryWithRetry } = require('../lib/db');
const { enviarNotasFiscais } = require('../services/emailService');
const fs = require('fs');

// Função para garantir que a tabela de logs de email existe
async function ensureEmailLogsTable() {
  try {
    await executeQueryWithRetry(`
      CREATE TABLE IF NOT EXISTS logs_email (
        id INT AUTO_INCREMENT PRIMARY KEY,
        competencia_id VARCHAR(50) NULL,
        email_remetente VARCHAR(255) NOT NULL,
        email_destinatario VARCHAR(255) NOT NULL,
        assunto VARCHAR(500) NULL,
        status ENUM('enviado', 'falhou', 'pendente') DEFAULT 'pendente',
        message_id VARCHAR(255) NULL,
        error_message TEXT NULL,
        anexos_enviados INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, []);
    console.log('✅ Tabela logs_email verificada/criada');
  } catch (error) {
    console.error('❌ Erro ao criar tabela logs_email:', error);
  }
}

// Função para enviar notas fiscais por email
exports.enviarNotasFiscais = async (req, res) => {
  try {
    console.log('📧 Controller enviarNotasFiscais chamado');
    console.log('📧 Headers:', req.headers);
    console.log('📧 Body:', req.body);
    
    // Garantir que a tabela de logs existe
    await ensureEmailLogsTable();

    const { 
      emailRemetente, 
      emailDestinatario, 
      competenciaId 
    } = req.body;

    // Validações básicas
    if (!emailRemetente || !emailDestinatario || !competenciaId) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: emailRemetente, emailDestinatario, competenciaId'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRemetente) || !emailRegex.test(emailDestinatario)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email inválido'
      });
    }

    console.log('📧 Iniciando envio de notas fiscais:', {
      emailRemetente,
      emailDestinatario,
      competenciaId
    });

    // Buscar anexos da competência (tipo 'notas_fiscais')
    const anexosQuery = `
      SELECT 
        id,
        nome_arquivo,
        caminho_arquivo,
        tamanho_arquivo,
        mimetype,
        tipo_anexo
      FROM anexos 
      WHERE competencia_id = ? AND tipo_anexo = 'notas_fiscais'
    `;

    console.log('🔍 Executando query para buscar anexos...');
    const anexos = await executeQueryWithRetry(anexosQuery, [competenciaId]);
    console.log('🔍 Anexos encontrados:', anexos);

    if (!anexos || anexos.length === 0) {
      console.log('❌ Nenhuma nota fiscal encontrada, retornando 404');
      return res.status(404).json({
        success: false,
        error: 'Nenhuma nota fiscal encontrada para esta competência'
      });
    }

    console.log(`📎 Encontrados ${anexos.length} anexos para envio`);

    // Verificar se os arquivos existem fisicamente
    const anexosValidos = [];
    for (const anexo of anexos) {
      if (fs.existsSync(anexo.caminho_arquivo)) {
        anexosValidos.push(anexo);
      } else {
        console.warn(`⚠️ Arquivo não encontrado: ${anexo.caminho_arquivo}`);
      }
    }

    if (anexosValidos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum arquivo válido encontrado no servidor'
      });
    }

    // Enviar email com os anexos
    const resultado = await enviarNotasFiscais(
      emailRemetente,
      emailDestinatario,
      competenciaId,
      anexosValidos
    );

    if (resultado.success) {
      // Log do envio no banco de dados (opcional)
      try {
        await executeQueryWithRetry(`
          INSERT INTO logs_email (
            competencia_id,
            email_remetente,
            email_destinatario,
            assunto,
            status,
            message_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
          competenciaId,
          emailRemetente,
          emailDestinatario,
          `Notas Fiscais - Competência ${competenciaId}`,
          'enviado',
          resultado.messageId
        ]);
      } catch (logError) {
        console.warn('⚠️ Erro ao salvar log de email:', logError.message);
        // Não falha o envio por causa do log
      }

      console.log('✅ Enviando resposta de sucesso...');
      res.json({
        success: true,
        message: 'Notas fiscais enviadas com sucesso',
        messageId: resultado.messageId,
        anexosEnviados: anexosValidos.length
      });
      console.log('✅ Resposta de sucesso enviada!');
    } else {
      res.status(500).json({
        success: false,
        error: resultado.error || 'Erro ao enviar email',
        message: resultado.message
      });
    }

  } catch (error) {
    console.error('❌ Erro no controller de envio de email:', error);
    console.error('❌ Stack trace:', error.stack);
    console.log('❌ Enviando resposta de erro...');
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
    console.log('❌ Resposta de erro enviada!');
  }
};

// Função para testar configuração de email
exports.testarEmail = async (req, res) => {
  try {
    const { emailDestinatario } = req.body;

    if (!emailDestinatario) {
      return res.status(400).json({
        success: false,
        error: 'Email destinatário é obrigatório'
      });
    }

    const { enviarEmailComAnexos } = require('../services/emailService');

    const resultado = await enviarEmailComAnexos(
      emailDestinatario,
      process.env.SMTP_FROM || 'no-reply@portes.com.br',
      'Teste de Email - AuditaAI',
      `
        <div style="font-family: Arial, sans-serif;">
          <h2>✅ Teste de Email</h2>
          <p>Este é um email de teste do sistema AuditaAI.</p>
          <p>Se você recebeu este email, a configuração está funcionando corretamente!</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `,
      [] // Sem anexos no teste
    );

    if (resultado.success) {
      res.json({
        success: true,
        message: 'Email de teste enviado com sucesso',
        messageId: resultado.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: resultado.error,
        message: resultado.message
      });
    }

  } catch (error) {
    console.error('❌ Erro no teste de email:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao enviar email de teste',
      message: error.message
    });
  }
};
