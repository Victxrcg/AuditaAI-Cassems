const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { executeQueryWithRetry } = require('../lib/db');

// Ensure upload directory exists
const uploadsDir = path.join(process.cwd(), 'backend', 'uploads', 'documentos');
fs.mkdirSync(uploadsDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, unique + '-' + safeName);
  }
});

exports.upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

async function ensureTables() {
  // Criar tabela de pastas
  await executeQueryWithRetry(`
    CREATE TABLE IF NOT EXISTS pastas_documentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT NULL,
      organizacao VARCHAR(50) NULL,
      criado_por INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);

  // Verificar se a coluna pasta_id existe na tabela documentos
  try {
    const columns = await executeQueryWithRetry(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'documentos' 
      AND COLUMN_NAME = 'pasta_id'
    `, []);

    // Se a coluna não existir, adicionar
    if (columns.length === 0) {
      await executeQueryWithRetry(`
        ALTER TABLE documentos 
        ADD COLUMN pasta_id INT NULL
      `, []);
      
      // Adicionar constraint separadamente para evitar conflitos
      try {
        await executeQueryWithRetry(`
          ALTER TABLE documentos 
          ADD CONSTRAINT fk_documentos_pasta 
          FOREIGN KEY (pasta_id) REFERENCES pastas_documentos(id) ON DELETE SET NULL
        `, []);
      } catch (constraintError) {
        console.log('⚠️ Constraint já existe ou erro ao criar:', constraintError.message);
      }
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar/criar coluna pasta_id:', error.message);
  }

  // Criar tabela de documentos se não existir
  await executeQueryWithRetry(`
    CREATE TABLE IF NOT EXISTS documentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_arquivo VARCHAR(255) NOT NULL,
      caminho VARCHAR(500) NOT NULL,
      tamanho BIGINT NULL,
      mimetype VARCHAR(100) NULL,
      organizacao VARCHAR(50) NULL,
      enviado_por INT NULL,
      pasta_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pasta_id) REFERENCES pastas_documentos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);
}

exports.listar = async (req, res) => {
  try {
    await ensureTables();
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    console.log('📁 Listar documentos - org header:', userOrganization);
    let where = '';
    const params = [];
    let sql = `SELECT d.id, d.nome_arquivo, d.caminho, d.tamanho, d.mimetype, d.organizacao, d.enviado_por, d.pasta_id, d.created_at
               FROM documentos d`;
    if (userOrganization && userOrganization !== 'portes') {
      // Para usuários não-Portes, considerar documentos da sua organização OU de pastas da sua organização
      sql += ` LEFT JOIN pastas_documentos p ON p.id = d.pasta_id`;
      where = ` WHERE (LOWER(d.organizacao) = LOWER(?) OR LOWER(p.organizacao) = LOWER(?))`;
      params.push(userOrganization, userOrganization);
    }
    sql += `${where} ORDER BY d.created_at DESC`;
    console.log('📁 SQL documentos:', sql, 'params:', params);
    const rows = await executeQueryWithRetry(sql, params);
    console.log('📁 Total documentos retornados:', rows.length);
    
    // Converter BigInt para Number para evitar erro de serialização JSON
    const processedRows = rows.map(row => ({
      ...row,
      id: Number(row.id),
      tamanho: Number(row.tamanho),
      enviado_por: row.enviado_por ? Number(row.enviado_por) : null,
      pasta_id: row.pasta_id ? Number(row.pasta_id) : null
    }));
    
    res.json(processedRows);
  } catch (err) {
    console.error('❌ Erro ao listar documentos:', err);
    res.status(500).json({ error: 'Erro ao listar documentos', details: err.message });
  }
};

exports.enviar = async (req, res) => {
  try {
    await ensureTables();
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const { originalname, path: filePath, size, mimetype } = req.file;
    const { userId, organizacao, pastaId } = req.body;
    let org = organizacao || req.headers['x-user-organization'] || 'cassems';
    // Se veio pastaId, herdar a organização da pasta
    if (pastaId) {
      const rows = await executeQueryWithRetry('SELECT organizacao FROM pastas_documentos WHERE id = ?', [pastaId]);
      if (rows && rows[0] && rows[0].organizacao) {
        org = rows[0].organizacao;
      }
    }
    const result = await executeQueryWithRetry(`
      INSERT INTO documentos (nome_arquivo, caminho, tamanho, mimetype, organizacao, enviado_por, pasta_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [originalname, filePath, size, mimetype, org, userId || null, pastaId || null]);
    res.json({ success: true, id: Number(result.insertId), filename: originalname, size });
  } catch (err) {
    console.error('❌ Erro ao enviar documento:', err);
    res.status(500).json({ error: 'Erro ao enviar documento', details: err.message });
  }
};

exports.baixar = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const rows = await executeQueryWithRetry('SELECT nome_arquivo, caminho FROM documentos WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    const doc = rows[0];
    if (!fs.existsSync(doc.caminho)) return res.status(404).json({ error: 'Arquivo não existe no servidor' });
    res.download(doc.caminho, doc.nome_arquivo);
  } catch (err) {
    console.error('❌ Erro ao baixar documento:', err);
    res.status(500).json({ error: 'Erro ao baixar documento', details: err.message });
  }
};

exports.remover = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const rows = await executeQueryWithRetry('SELECT caminho FROM documentos WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    const filePath = rows[0].caminho;
    await executeQueryWithRetry('DELETE FROM documentos WHERE id = ?', [id]);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao remover documento:', err);
    res.status(500).json({ error: 'Erro ao remover documento', details: err.message });
  }
};

// Stream de arquivos (suporte a Range) - ideal para vídeos
exports.stream = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const rows = await executeQueryWithRetry('SELECT nome_arquivo, caminho, mimetype, tamanho FROM documentos WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Documento não encontrado' });
    const doc = rows[0];

    if (!fs.existsSync(doc.caminho)) return res.status(404).json({ error: 'Arquivo não existe no servidor' });

    const fileSize = doc.tamanho || fs.statSync(doc.caminho).size;
    const range = req.headers.range;
    const contentType = doc.mimetype || 'application/octet-stream';

    // Habilita CORS básico para este endpoint também
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, x-user-organization, x-user-id, Accept, Origin, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (!range) {
      // Sem Range: retorna o arquivo completo
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      const fileStream = fs.createReadStream(doc.caminho);
      return fileStream.pipe(res);
    }

    // Com Range: retorna parcial (206)
    const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE, fileSize - 1);

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const contentLength = (end - start) + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Type', contentType);

    const stream = fs.createReadStream(doc.caminho, { start, end });
    stream.pipe(res);
  } catch (err) {
    console.error('❌ Erro no stream de documento:', err);
    res.status(500).json({ error: 'Erro ao transmitir documento', details: err.message });
  }
};

// ===== FUNÇÕES PARA PASTAS =====

// Listar pastas
exports.listarPastas = async (req, res) => {
  try {
    await ensureTables();
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    let where = '';
    const params = [];
    if (userOrganization && userOrganization !== 'portes') {
      where = 'WHERE p.organizacao = ?';
      params.push(userOrganization);
    }
    const rows = await executeQueryWithRetry(`
      SELECT p.*, 
             COUNT(d.id) as total_documentos
      FROM pastas_documentos p
      LEFT JOIN documentos d ON p.id = d.pasta_id
      ${where}
      GROUP BY p.id, p.titulo, p.descricao, p.organizacao, p.criado_por, p.created_at, p.updated_at
      ORDER BY p.titulo ASC
    `, params);
    
    const processedRows = rows.map(row => ({
      ...row,
      id: Number(row.id),
      total_documentos: Number(row.total_documentos),
      criado_por: row.criado_por ? Number(row.criado_por) : null
    }));
    
    res.json(processedRows);
  } catch (err) {
    console.error('❌ Erro ao listar pastas:', err);
    res.status(500).json({ error: 'Erro ao listar pastas', details: err.message });
  }
};

// Criar pasta
exports.criarPasta = async (req, res) => {
  try {
    await ensureTables();
    const { titulo, descricao } = req.body;
    const userId = req.headers['x-user-id'] || req.body.userId;
    const organizacao = req.headers['x-user-organization'] || req.body.organizacao || 'cassems';
    
    if (!titulo) {
      return res.status(400).json({ error: 'Título da pasta é obrigatório' });
    }
    
    const result = await executeQueryWithRetry(`
      INSERT INTO pastas_documentos (titulo, descricao, organizacao, criado_por)
      VALUES (?, ?, ?, ?)
    `, [titulo, descricao || null, organizacao, userId || null]);
    
    res.json({ 
      success: true, 
      id: Number(result.insertId), 
      titulo,
      descricao: descricao || null
    });
  } catch (err) {
    console.error('❌ Erro ao criar pasta:', err);
    res.status(500).json({ error: 'Erro ao criar pasta', details: err.message });
  }
};

// Atualizar pasta
exports.atualizarPasta = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { titulo, descricao } = req.body;
    
    if (!titulo) {
      return res.status(400).json({ error: 'Título da pasta é obrigatório' });
    }
    
    await executeQueryWithRetry(`
      UPDATE pastas_documentos 
      SET titulo = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [titulo, descricao || null, id]);
    
    res.json({ success: true, message: 'Pasta atualizada com sucesso' });
  } catch (err) {
    console.error('❌ Erro ao atualizar pasta:', err);
    res.status(500).json({ error: 'Erro ao atualizar pasta', details: err.message });
  }
};

// Remover pasta
exports.removerPasta = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    
    // Verificar se a pasta tem documentos
    const docs = await executeQueryWithRetry(
      'SELECT COUNT(*) as count FROM documentos WHERE pasta_id = ?', 
      [id]
    );
    
    if (docs[0].count > 0) {
      return res.status(400).json({ 
        error: 'Não é possível remover pasta com documentos. Mova ou remova os documentos primeiro.' 
      });
    }
    
    await executeQueryWithRetry('DELETE FROM pastas_documentos WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pasta removida com sucesso' });
  } catch (err) {
    console.error('❌ Erro ao remover pasta:', err);
    res.status(500).json({ error: 'Erro ao remover pasta', details: err.message });
  }
};

// Mover documento para pasta
exports.moverDocumento = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { pastaId } = req.body;
    
    // Atualizar pasta; se destino tem organização definida, atualizar também o campo organizacao do documento
    if (pastaId) {
      const rows = await executeQueryWithRetry('SELECT organizacao FROM pastas_documentos WHERE id = ?', [pastaId]);
      const orgDestino = rows && rows[0] ? rows[0].organizacao : null;
      await executeQueryWithRetry(`
        UPDATE documentos 
        SET pasta_id = ?, organizacao = COALESCE(?, organizacao)
        WHERE id = ?
      `, [pastaId, orgDestino, id]);
    } else {
      await executeQueryWithRetry(`
        UPDATE documentos 
        SET pasta_id = NULL
        WHERE id = ?
      `, [id]);
    }
    
    res.json({ success: true, message: 'Documento movido com sucesso' });
  } catch (err) {
    console.error('❌ Erro ao mover documento:', err);
    res.status(500).json({ error: 'Erro ao mover documento', details: err.message });
  }
};

// Listar organizações disponíveis (para Portes selecionar destino)
exports.listarOrganizacoes = async (_req, res) => {
  try {
    await ensureTables();
    // Buscar organizações a partir de cronograma; se vazio, complementar com documentos e pastas
    const orgsCrono = await executeQueryWithRetry(`
      SELECT DISTINCT organizacao FROM cronograma WHERE organizacao IS NOT NULL AND organizacao <> '' ORDER BY organizacao
    `, []);
    const set = new Set(orgsCrono.map(o => (o.organizacao || '').toLowerCase()));
    const orgsDocs = await executeQueryWithRetry(`
      SELECT DISTINCT organizacao FROM documentos WHERE organizacao IS NOT NULL AND organizacao <> ''
    `, []);
    orgsDocs.forEach(o => set.add((o.organizacao || '').toLowerCase()));
    const orgsPastas = await executeQueryWithRetry(`
      SELECT DISTINCT organizacao FROM pastas_documentos WHERE organizacao IS NOT NULL AND organizacao <> ''
    `, []);
    orgsPastas.forEach(o => set.add((o.organizacao || '').toLowerCase()));

    const list = Array.from(set).filter(Boolean).sort();
    res.json(list);
  } catch (err) {
    console.error('❌ Erro ao listar organizações:', err);
    res.status(500).json({ error: 'Erro ao listar organizações', details: err.message });
  }
};


