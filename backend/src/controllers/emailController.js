const { executeQueryWithRetry } = require('../lib/db');
const { enviarNotasFiscais } = require('../services/emailService');
const fs = require('fs');
const path = require('path');

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
      competenciaId,
      assunto,
      tipoAnexo
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

    console.log('📧 Iniciando envio de anexos da competência:', {
      emailRemetente,
      emailDestinatario,
      competenciaId,
      tipoAnexo
    });

    // Buscar anexos da competência (tipo 'estabelecimento' para item 7 - Notas Fiscais)
    // CORREÇÃO: Usar tabela compliance_anexos e incluir file_data (dados binários)
    const anexosQuery = `
      SELECT 
        id,
        nome_arquivo,
        caminho_arquivo,
        tamanho_arquivo,
        tipo_mime as mimetype,
        tipo_anexo,
        file_data
      FROM compliance_anexos 
      WHERE compliance_id = ? AND tipo_anexo = ?
    `;

    // Debug: buscar TODOS os anexos da competência primeiro
    console.log('🔍 DEBUG: Buscando TODOS os anexos da competência...');
    const debugQuery = `SELECT id, nome_arquivo, tipo_anexo FROM compliance_anexos WHERE compliance_id = ?`;
    const todosAnexos = await executeQueryWithRetry(debugQuery, [competenciaId]);
    console.log('🔍 DEBUG: Todos os anexos da competência:', todosAnexos);

    const tipoParaBuscar = tipoAnexo && typeof tipoAnexo === 'string' && tipoAnexo.trim() ? tipoAnexo.trim() : 'estabelecimento';
    console.log(`🔍 Executando query para buscar anexos do tipo ${tipoParaBuscar}...`);
    const anexos = await executeQueryWithRetry(anexosQuery, [competenciaId, tipoParaBuscar]);
    console.log(`🔍 Anexos encontrados (tipo ${tipoParaBuscar}):`, anexos);
    
    // Manter variável para uso posterior no envio de email

    if (!anexos || anexos.length === 0) {
      console.log('❌ Nenhuma nota fiscal encontrada, retornando 404');
      return res.status(404).json({
        success: false,
        error: 'Nenhuma nota fiscal encontrada para esta competência'
      });
    }

    console.log(`📎 Encontrados ${anexos.length} anexos para envio`);

    // CORREÇÃO: Usar dados binários diretamente da tabela, não arquivos físicos
    console.log('🔍 DEBUG: Usando dados binários da tabela compliance_anexos...');
    
    const anexosValidos = [];
    
    for (const anexo of anexos) {
      console.log(`🔍 Processando anexo: ${anexo.nome_arquivo}`);
      console.log(`🔍 Tamanho dos dados binários: ${anexo.file_data ? anexo.file_data.length : 0} bytes`);
      console.log(`🔍 Tipo dos dados: ${typeof anexo.file_data}`);
      console.log(`🔍 É Buffer: ${Buffer.isBuffer(anexo.file_data)}`);
      
      if (anexo.file_data && anexo.file_data.length > 0) {
        // Criar um arquivo temporário com os dados binários
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `temp_${anexo.id}_${anexo.nome_arquivo}`);
        
        try {
          // Escrever dados binários para arquivo temporário
          fs.writeFileSync(tempFilePath, anexo.file_data);
          
          // Verificar se o arquivo foi criado corretamente
          const stats = fs.statSync(tempFilePath);
          console.log(`🔍 Arquivo temporário criado: ${tempFilePath}`);
          console.log(`🔍 Tamanho do arquivo temporário: ${stats.size} bytes`);
          console.log(`🔍 Tamanho esperado: ${anexo.file_data.length} bytes`);
          
          if (stats.size === 0) {
            console.error(`❌ Arquivo temporário está vazio!`);
            continue;
          }
          
          if (stats.size !== anexo.file_data.length) {
            console.warn(`⚠️ Tamanho do arquivo temporário (${stats.size}) diferente do esperado (${anexo.file_data.length})`);
          }
          
          anexosValidos.push({
            filename: anexo.nome_arquivo,
            path: tempFilePath,
            contentType: anexo.mimetype
          });
          
          console.log(`✅ Arquivo temporário válido: ${anexo.nome_arquivo}`);
        } catch (error) {
          console.error(`❌ Erro ao criar arquivo temporário para ${anexo.nome_arquivo}:`, error.message);
        }
      } else {
        console.log(`⚠️ Sem dados binários para ${anexo.nome_arquivo}`);
      }
    }

    if (anexosValidos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum arquivo válido encontrado no servidor'
      });
    }

    // Enviar email com os anexos (tipoParaBuscar já foi definido acima)
    const resultado = await enviarNotasFiscais(
      emailRemetente,
      emailDestinatario,
      competenciaId,
      anexosValidos,
      assunto,
      tipoParaBuscar
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
          assunto && assunto.trim() ? assunto.trim() : `Notas Fiscais - Competência ${competenciaId}`,
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
      
      // Limpar arquivos temporários após um delay para garantir que o nodemailer terminou
      console.log('🧹 Aguardando antes de limpar arquivos temporários...');
      setTimeout(() => {
        console.log('🧹 Limpando arquivos temporários...');
        for (const anexo of anexosValidos) {
          try {
            if (fs.existsSync(anexo.path)) {
              fs.unlinkSync(anexo.path);
              console.log(`🗑️ Arquivo temporário removido: ${anexo.path}`);
            }
          } catch (error) {
            console.warn(`⚠️ Erro ao remover arquivo temporário ${anexo.path}:`, error.message);
          }
        }
      }, 2000); // Aguardar 2 segundos
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
