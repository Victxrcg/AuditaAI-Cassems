// backend/src/controllers/icmsEqualizacaoController.js
const { getDbPoolWithTunnel, executeQueryWithRetry } = require('../lib/db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configurar OpenAI (opcional)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI configurado com sucesso para ICMS e Equalização');
  } else {
    console.log('⚠️ OpenAI não configurado - funcionalidades de IA desabilitadas');
  }
} catch (error) {
  console.log('⚠️ Erro ao configurar OpenAI:', error.message);
}

// Função para carregar pdf-parse dinamicamente
let pdfParse = null;
const loadPdfParse = async () => {
  if (!pdfParse) {
    try {
      const imported = require('pdf-parse');
      pdfParse = imported.PDFParse;
    } catch (error) {
      console.error('❌ Erro ao carregar pdf-parse:', error);
      throw new Error('pdf-parse não está disponível');
    }
  }
  return pdfParse;
};

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/icms-equalizacao');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `extrato-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.xls', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, XLS, XLSX ou CSV.'));
    }
  }
});

// Garantir que a tabela existe
const ensureTable = async (pool) => {
  try {
    // Verificar se a tabela já existe
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'icms_equalizacao'
    `);

    if (!tables || tables.length === 0) {
      console.log('📋 Criando tabela icms_equalizacao...');
      
      // Criar tabela
      await pool.query(`
        CREATE TABLE icms_equalizacao (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome_arquivo VARCHAR(255) NOT NULL,
          caminho_arquivo VARCHAR(500) NOT NULL,
          tamanho_arquivo BIGINT NULL,
          mimetype VARCHAR(100) NULL,
          extrato_simplificado TEXT NULL,
          status_processamento ENUM('pendente', 'processando', 'concluido', 'erro') DEFAULT 'pendente',
          erro_processamento TEXT NULL,
          organizacao VARCHAR(50) NULL,
          created_by INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_organizacao (organizacao),
          INDEX idx_created_by (created_by),
          INDEX idx_status (status_processamento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      
      console.log('✅ Tabela icms_equalizacao criada com sucesso');
    } else {
      console.log('✅ Tabela icms_equalizacao já existe');
    }

    // Verificar e adicionar colunas que possam estar faltando (migrações futuras)
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'icms_equalizacao'
    `);

    const columnNames = (columns || []).map(col => col.COLUMN_NAME);
    
    // Adicionar colunas que possam estar faltando
    if (!columnNames.includes('extrato_simplificado')) {
      await pool.query(`
        ALTER TABLE icms_equalizacao 
        ADD COLUMN extrato_simplificado TEXT NULL
      `);
      console.log('✅ Coluna extrato_simplificado adicionada');
    }

    if (!columnNames.includes('status_processamento')) {
      await pool.query(`
        ALTER TABLE icms_equalizacao 
        ADD COLUMN status_processamento ENUM('pendente', 'processando', 'concluido', 'erro') DEFAULT 'pendente'
      `);
      console.log('✅ Coluna status_processamento adicionada');
    }

    if (!columnNames.includes('erro_processamento')) {
      await pool.query(`
        ALTER TABLE icms_equalizacao 
        ADD COLUMN erro_processamento TEXT NULL
      `);
      console.log('✅ Coluna erro_processamento adicionada');
    }

  } catch (error) {
    console.error('❌ Erro ao garantir tabela icms_equalizacao:', error);
    console.error('❌ Stack trace:', error.stack);
    // Não lançar erro aqui, apenas logar - a tabela pode já existir
    // Se houver erro crítico, será capturado no endpoint
    if (error.code !== 'ER_TABLE_EXISTS_ERROR' && !error.message.includes('already exists')) {
      throw error;
    }
  }
};

// Processar PDF com IA para gerar extrato simplificado
const processarPDFComIA = async (caminhoArquivo, nomeArquivo) => {
  if (!openai) {
    throw new Error('OpenAI não configurado');
  }

  try {
    // Carregar e extrair texto do PDF
    const PDFParse = await loadPdfParse();
    const dataBuffer = fs.readFileSync(caminhoArquivo);
    const pdfData = await PDFParse(dataBuffer);
    const textoPDF = pdfData.text;

    if (!textoPDF || textoPDF.trim().length === 0) {
      throw new Error('Não foi possível extrair texto do PDF. O arquivo pode estar protegido ou ser uma imagem.');
    }

    // Truncar texto se muito longo (limite de tokens)
    const maxTokens = 100000; // Aproximadamente 400k caracteres
    const textoTruncado = textoPDF.length > maxTokens * 4 
      ? textoPDF.substring(0, maxTokens * 4) + '\n\n[... documento truncado ...]'
      : textoPDF;

    // Criar prompt para IA gerar extrato simplificado
    const prompt = `
Analise o seguinte extrato do ICMS e gere um extrato simplificado com as informações mais importantes.

ARQUIVO: ${nomeArquivo}

CONTEÚDO DO EXTRATO:
${textoTruncado}

INSTRUÇÕES:
1. Extraia as informações principais do extrato do ICMS
2. Organize em seções claras e objetivas
3. Destaque valores importantes, períodos, CNPJs, estabelecimentos
4. Mantenha apenas informações relevantes para análise fiscal
5. Use formatação clara e estruturada
6. Se houver tabelas ou dados numéricos importantes, inclua-os de forma organizada

FORMATO DE SAÍDA:
Gere um extrato simplificado em formato de texto estruturado, com seções claras e informações relevantes extraídas do documento original.
`;

    // Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de extratos fiscais do ICMS. Extraia e organize informações importantes de forma clara e estruturada."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.2
    });

    const extratoSimplificado = completion.choices[0].message.content;
    return extratoSimplificado;

  } catch (error) {
    console.error('❌ Erro ao processar PDF com IA:', error);
    throw error;
  }
};

// Listar todos os extratos
exports.listarExtratos = async (req, res) => {
  let pool, server;
  try {
    console.log('🔍 Iniciando listagem de extratos ICMS e Equalização...');
    ({ pool, server } = await getDbPoolWithTunnel());
    console.log('✅ Pool de conexão obtido');
    
    await ensureTable(pool);
    console.log('✅ Tabela verificada/criada');

    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'] || null;
    console.log('🔍 Organização:', userOrg, 'User ID:', userId);

    // Filtrar por organização se não for Portes
    let query = `
      SELECT 
        ie.*,
        u.nome as created_by_nome,
        u.organizacao as created_by_organizacao
      FROM icms_equalizacao ie
      LEFT JOIN usuarios_cassems u ON ie.created_by = u.id
    `;
    const params = [];

    if (userOrg !== 'portes') {
      query += ` WHERE ie.organizacao = ?`;
      params.push(userOrg);
    }

    query += ` ORDER BY ie.created_at DESC`;

    console.log('🔍 Executando query:', query);
    console.log('🔍 Parâmetros:', params);
    
    const [rows] = await pool.query(query, params);
    console.log('✅ Extratos encontrados:', rows?.length || 0);

    res.json({
      success: true,
      data: rows || []
    });
  } catch (error) {
    console.error('❌ Erro ao listar extratos:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar extratos',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Upload de extrato
exports.uploadExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = parseInt(req.headers['x-user-id'] || '0');

    const arquivo = req.file;
    const caminhoArquivo = arquivo.path;
    const nomeArquivo = arquivo.originalname;
    const tamanhoArquivo = arquivo.size;
    const mimetype = arquivo.mimetype;

    // Inserir registro no banco com status pendente
    const [result] = await pool.query(`
      INSERT INTO icms_equalizacao (
        nome_arquivo,
        caminho_arquivo,
        tamanho_arquivo,
        mimetype,
        status_processamento,
        organizacao,
        created_by
      ) VALUES (?, ?, ?, ?, 'pendente', ?, ?)
    `, [nomeArquivo, caminhoArquivo, tamanhoArquivo, mimetype, userOrg, userId]);

    const extratoId = result.insertId;

    // Processar PDF em background se for PDF
    if (mimetype === 'application/pdf' && openai) {
      // Atualizar status para processando
      await pool.query(`
        UPDATE icms_equalizacao 
        SET status_processamento = 'processando'
        WHERE id = ?
      `, [extratoId]);

      // Processar em background (não bloquear resposta)
      // Criar novo pool para o processamento assíncrono
      processarPDFComIA(caminhoArquivo, nomeArquivo)
        .then(async (extratoSimplificado) => {
          // Criar novo pool para atualização
          let updatePool, updateServer;
          try {
            const poolResult = await getDbPoolWithTunnel();
            updatePool = poolResult.pool;
            updateServer = poolResult.server;
            // Atualizar com extrato simplificado
            await updatePool.query(`
              UPDATE icms_equalizacao 
              SET extrato_simplificado = ?,
                  status_processamento = 'concluido'
              WHERE id = ?
            `, [extratoSimplificado, extratoId]);
            console.log(`✅ Extrato ${extratoId} processado com sucesso`);
          } catch (updateError) {
            console.error(`❌ Erro ao atualizar extrato ${extratoId}:`, updateError);
          } finally {
            if (updateServer) updateServer.close();
          }
        })
        .catch(async (error) => {
          console.error(`❌ Erro ao processar extrato ${extratoId}:`, error);
          // Criar novo pool para atualização de erro
          let errorPool, errorServer;
          try {
            const poolResult = await getDbPoolWithTunnel();
            errorPool = poolResult.pool;
            errorServer = poolResult.server;
            await errorPool.query(`
              UPDATE icms_equalizacao 
              SET status_processamento = 'erro',
                  erro_processamento = ?
              WHERE id = ?
            `, [error.message, extratoId]);
          } catch (updateError) {
            console.error(`❌ Erro ao atualizar status de erro do extrato ${extratoId}:`, updateError);
          } finally {
            if (errorServer) errorServer.close();
          }
        });
    } else {
      // Se não for PDF ou não tiver IA, marcar como concluído sem processamento
      await pool.query(`
        UPDATE icms_equalizacao 
        SET status_processamento = 'concluido'
        WHERE id = ?
      `, [extratoId]);
    }

    // Buscar registro criado
    const [extrato] = await pool.query(`
      SELECT * FROM icms_equalizacao WHERE id = ?
    `, [extratoId]);

    res.json({
      success: true,
      message: 'Extrato enviado com sucesso',
      data: extrato[0]
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer upload do extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Buscar extrato específico
exports.buscarExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    let query = `
      SELECT 
        ie.*,
        u.nome as created_by_nome,
        u.organizacao as created_by_organizacao
      FROM icms_equalizacao ie
      LEFT JOIN usuarios_cassems u ON ie.created_by = u.id
      WHERE ie.id = ?
    `;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND ie.organizacao = ?`;
      params.push(userOrg);
    }

    const [extrato] = await pool.query(query, params);

    if (!extrato || extrato.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extrato não encontrado'
      });
    }

    res.json({
      success: true,
      data: extrato[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Download de extrato
exports.downloadExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    let query = `SELECT * FROM icms_equalizacao WHERE id = ?`;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND organizacao = ?`;
      params.push(userOrg);
    }

    const [extrato] = await pool.query(query, params);

    if (!extrato || extrato.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extrato não encontrado'
      });
    }

    const caminhoArquivo = extrato[0].caminho_arquivo;

    if (!fs.existsSync(caminhoArquivo)) {
      return res.status(404).json({
        success: false,
        error: 'Arquivo não encontrado no servidor'
      });
    }

    res.download(caminhoArquivo, extrato[0].nome_arquivo);
  } catch (error) {
    console.error('❌ Erro ao fazer download do extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer download do extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Remover extrato
exports.removerExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    // Buscar extrato antes de remover
    let query = `SELECT * FROM icms_equalizacao WHERE id = ?`;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND organizacao = ?`;
      params.push(userOrg);
    }

    const [extrato] = await pool.query(query, params);

    if (!extrato || extrato.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extrato não encontrado'
      });
    }

    // Remover arquivo físico
    const caminhoArquivo = extrato[0].caminho_arquivo;
    if (fs.existsSync(caminhoArquivo)) {
      try {
        fs.unlinkSync(caminhoArquivo);
      } catch (error) {
        console.warn('⚠️ Erro ao remover arquivo físico:', error);
      }
    }

    // Remover do banco
    await pool.query(`DELETE FROM icms_equalizacao WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: 'Extrato removido com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Exportar multer para uso nas rotas
exports.upload = upload;

