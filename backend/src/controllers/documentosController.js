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
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

async function ensureTable() {
  await executeQueryWithRetry(`
    CREATE TABLE IF NOT EXISTS documentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_arquivo VARCHAR(255) NOT NULL,
      caminho VARCHAR(500) NOT NULL,
      tamanho BIGINT NULL,
      mimetype VARCHAR(100) NULL,
      organizacao VARCHAR(50) NULL,
      enviado_por INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);
}

exports.listar = async (req, res) => {
  try {
    await ensureTable();
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    let where = '';
    const params = [];
    if (userOrganization && userOrganization !== 'portes') {
      where = 'WHERE organizacao = ?';
      params.push(userOrganization);
    }
    const rows = await executeQueryWithRetry(`
      SELECT id, nome_arquivo, caminho, tamanho, mimetype, organizacao, enviado_por, created_at
      FROM documentos
      ${where}
      ORDER BY created_at DESC
    `, params);
    
    // Converter BigInt para Number para evitar erro de serialização JSON
    const processedRows = rows.map(row => ({
      ...row,
      id: Number(row.id),
      tamanho: Number(row.tamanho),
      enviado_por: row.enviado_por ? Number(row.enviado_por) : null
    }));
    
    res.json(processedRows);
  } catch (err) {
    console.error('❌ Erro ao listar documentos:', err);
    res.status(500).json({ error: 'Erro ao listar documentos', details: err.message });
  }
};

exports.enviar = async (req, res) => {
  try {
    await ensureTable();
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const { originalname, path: filePath, size, mimetype } = req.file;
    const { userId, organizacao } = req.body;
    const org = organizacao || req.headers['x-user-organization'] || 'cassems';
    const result = await executeQueryWithRetry(`
      INSERT INTO documentos (nome_arquivo, caminho, tamanho, mimetype, organizacao, enviado_por)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [originalname, filePath, size, mimetype, org, userId || null]);
    res.json({ success: true, id: Number(result.insertId), filename: originalname, size });
  } catch (err) {
    console.error('❌ Erro ao enviar documento:', err);
    res.status(500).json({ error: 'Erro ao enviar documento', details: err.message });
  }
};

exports.baixar = async (req, res) => {
  try {
    await ensureTable();
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
    await ensureTable();
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


