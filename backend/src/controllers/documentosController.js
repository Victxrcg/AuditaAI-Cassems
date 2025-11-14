const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { executeQueryWithRetry } = require('../lib/db');

// Ensure upload directory exists
const uploadsDir = path.join(process.cwd(), 'backend', 'uploads', 'documentos');
fs.mkdirSync(uploadsDir, { recursive: true });

// Função para padronizar nome do arquivo (mesma lógica do compliance)
const sanitizeFileName = (filename) => {
  if (!filename) return 'arquivo_sem_nome';
  
  // Separar nome e extensão
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';
  
  // Normalizar e remover acentos de forma mais inteligente
  let normalized = name
    .normalize('NFD') // Decompor caracteres acentuados
    .replace(/[\u0300-\u036f]/g, ''); // Remover diacríticos
  
  // Substituir caracteres problemáticos por equivalentes seguros
  normalized = normalized
    .replace(/[àáâãäå]/gi, 'a')
    .replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i')
    .replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u')
    .replace(/[ç]/gi, 'c')
    .replace(/[ñ]/gi, 'n')
    .replace(/[ýÿ]/gi, 'y');
  
  // Substituir espaços múltiplos por um único espaço
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Substituir espaços por hífens (mais legível que underscores)
  normalized = normalized.replace(/\s/g, '-');
  
  // Remover caracteres especiais problemáticos, mantendo apenas letras, números, hífens, pontos e underscores
  normalized = normalized.replace(/[^a-zA-Z0-9._-]/g, '');
  
  // Remover hífens/underscores duplos ou múltiplos
  normalized = normalized.replace(/[-_]{2,}/g, '-');
  
  // Remover hífens/underscores do início e fim
  normalized = normalized.replace(/^[-_]+|[-_]+$/g, '');
  
  // Limitar tamanho do nome (máximo 200 caracteres)
  if (normalized.length > 200) {
    normalized = normalized.substring(0, 200);
  }
  
  // Se ficou vazio após sanitização, usar nome padrão
  if (!normalized) {
    normalized = 'arquivo';
  }
  
  // Retornar nome padronizado + extensão
  return normalized + ext.toLowerCase();
};

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = sanitizeFileName(file.originalname);
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
      pasta_pai_id INT NULL,
      criado_por INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (pasta_pai_id) REFERENCES pastas_documentos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);

  // Adicionar coluna pasta_pai_id se não existir (migração)
  try {
    const columns = await executeQueryWithRetry(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pastas_documentos' 
      AND COLUMN_NAME = 'pasta_pai_id'
    `, []);

    if (columns.length === 0) {
      await executeQueryWithRetry(`
        ALTER TABLE pastas_documentos 
        ADD COLUMN pasta_pai_id INT NULL
      `, []);

      try {
        await executeQueryWithRetry(`
          ALTER TABLE pastas_documentos 
          ADD CONSTRAINT fk_pasta_pai 
          FOREIGN KEY (pasta_pai_id) REFERENCES pastas_documentos(id) ON DELETE CASCADE
        `, []);
      } catch (constraintError) {
        console.log('⚠️ Constraint já existe ou erro ao criar:', constraintError.message);
      }
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar/criar coluna pasta_pai_id:', error.message);
  }

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
    
    // Padronizar nome do arquivo para salvar no banco
    const nomePadronizado = sanitizeFileName(originalname);
    
    const result = await executeQueryWithRetry(`
      INSERT INTO documentos (nome_arquivo, caminho, tamanho, mimetype, organizacao, enviado_por, pasta_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [nomePadronizado, filePath, size, mimetype, org, userId || null, pastaId || null]);
    res.json({ success: true, id: Number(result.insertId), filename: nomePadronizado, size });
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

// Função auxiliar para contar documentos recursivamente (incluindo subpastas)
const contarDocumentosRecursivo = async (pastaId) => {
  // Contar documentos diretos
  const docsDiretos = await executeQueryWithRetry(
    'SELECT COUNT(*) as count FROM documentos WHERE pasta_id = ?',
    [pastaId]
  );
  let total = Number(docsDiretos[0]?.count || 0);

  // Buscar subpastas
  const subpastas = await executeQueryWithRetry(
    'SELECT id FROM pastas_documentos WHERE pasta_pai_id = ?',
    [pastaId]
  );

  // Contar documentos de subpastas recursivamente
  for (const subpasta of subpastas) {
    total += await contarDocumentosRecursivo(subpasta.id);
  }

  return total;
};

// Listar pastas
exports.listarPastas = async (req, res) => {
  try {
    await ensureTables();
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    let where = '';
    const params = [];
    
    if (userOrganization && userOrganization !== 'portes') {
      // Para usuários não-Portes, mostrar:
      // 1. Pastas da própria organização
      // 2. Pastas de compliance vinculadas a competências da própria organização
      where = `WHERE (
        p.organizacao = ? 
        OR (
          p.titulo LIKE 'Documentos Compliance%' 
          AND EXISTS (
            SELECT 1 FROM compliance_fiscal cf 
            WHERE cf.pasta_documentos_id = p.id 
            AND cf.organizacao_criacao = ?
          )
        )
      )`;
      params.push(userOrganization, userOrganization);
    } else if (userOrganization === 'portes') {
      // Portes vê todas as pastas (sem filtro)
      where = '';
    }
    
    // Mapeamento de ordem das subpastas de compliance (sequência dos cards)
    const ordemSubpastas = {
      'Relatório Técnico': 1,
      'Relatório Faturamento': 2,
      'Comprovação de Compensações': 3,
      'Comprovação de Email': 4,
      'Notas Fiscais': 5
    };

    const rows = await executeQueryWithRetry(`
      SELECT p.*, 
             COUNT(d.id) as total_documentos_diretos
      FROM pastas_documentos p
      LEFT JOIN documentos d ON p.id = d.pasta_id
      ${where}
      GROUP BY p.id, p.titulo, p.descricao, p.organizacao, p.pasta_pai_id, p.criado_por, p.created_at, p.updated_at
      ORDER BY 
        p.pasta_pai_id IS NULL DESC,
        CASE 
          WHEN p.pasta_pai_id IS NOT NULL AND p.titulo IN ('Relatório Técnico', 'Relatório Faturamento', 'Comprovação de Compensações', 'Comprovação de Email', 'Notas Fiscais') THEN
            CASE p.titulo
              WHEN 'Relatório Técnico' THEN 1
              WHEN 'Relatório Faturamento' THEN 2
              WHEN 'Comprovação de Compensações' THEN 3
              WHEN 'Comprovação de Email' THEN 4
              WHEN 'Notas Fiscais' THEN 5
              ELSE 99
            END
          ELSE 0
        END,
        p.titulo ASC
    `, params);
    
    // Processar e calcular total de documentos incluindo subpastas
    const processedRows = await Promise.all(rows.map(async (row) => {
      const totalRecursivo = await contarDocumentosRecursivo(row.id);
      return {
        ...row,
        id: Number(row.id),
        total_documentos: totalRecursivo,
        total_documentos_diretos: Number(row.total_documentos_diretos),
        pasta_pai_id: row.pasta_pai_id ? Number(row.pasta_pai_id) : null,
        criado_por: row.criado_por ? Number(row.criado_por) : null
      };
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
    const { titulo, descricao, pasta_pai_id } = req.body;
    const userId = req.headers['x-user-id'] || req.body.userId;
    const organizacao = req.headers['x-user-organization'] || req.body.organizacao || 'cassems';
    
    if (!titulo) {
      return res.status(400).json({ error: 'Título da pasta é obrigatório' });
    }

    // Se pasta_pai_id for fornecido, validar que existe e pertence à mesma organização
    if (pasta_pai_id) {
      const pastaPai = await executeQueryWithRetry(
        'SELECT id, organizacao FROM pastas_documentos WHERE id = ?',
        [pasta_pai_id]
      );
      
      if (!pastaPai || pastaPai.length === 0) {
        return res.status(400).json({ error: 'Pasta pai não encontrada' });
      }

      // A subpasta deve ter a mesma organização da pasta pai
      const orgFinal = pastaPai[0].organizacao || organizacao;
      
      const result = await executeQueryWithRetry(`
        INSERT INTO pastas_documentos (titulo, descricao, organizacao, pasta_pai_id, criado_por)
        VALUES (?, ?, ?, ?, ?)
      `, [titulo, descricao || null, orgFinal, pasta_pai_id, userId || null]);
      
      res.json({ 
        success: true, 
        id: Number(result.insertId), 
        titulo,
        descricao: descricao || null,
        pasta_pai_id: Number(pasta_pai_id)
      });
    } else {
      // Pasta raiz (sem pai)
      const result = await executeQueryWithRetry(`
        INSERT INTO pastas_documentos (titulo, descricao, organizacao, criado_por)
        VALUES (?, ?, ?, ?)
      `, [titulo, descricao || null, organizacao, userId || null]);
      
      res.json({ 
        success: true, 
        id: Number(result.insertId), 
        titulo,
        descricao: descricao || null,
        pasta_pai_id: null
      });
    }
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
    
    // Verificar se a pasta existe
    const pastaInfo = await executeQueryWithRetry(
      'SELECT id, titulo, pasta_pai_id FROM pastas_documentos WHERE id = ?',
      [id]
    );
    
    if (!pastaInfo || pastaInfo.length === 0) {
      return res.status(404).json({ 
        error: 'Pasta não encontrada' 
      });
    }

    // Verificar se é uma pasta de compliance (tem subpastas criadas automaticamente)
    const isComplianceFolder = pastaInfo[0].titulo && pastaInfo[0].titulo.includes('Documentos Compliance');
    
    // Se for pasta de compliance, verificar se está vinculada a uma competência
    if (isComplianceFolder) {
      const complianceVinculado = await executeQueryWithRetry(
        'SELECT id FROM compliance_fiscal WHERE pasta_documentos_id = ?',
        [id]
      );
      
      if (complianceVinculado && complianceVinculado.length > 0) {
        return res.status(400).json({
          error: 'Não é possível remover pasta de compliance vinculada a uma competência. A pasta está associada ao compliance fiscal e não pode ser removida diretamente.',
          complianceId: complianceVinculado[0].id
        });
      }
      
      // Se a competência foi deletada, tratar subpastas primeiro
      const subpastas = await executeQueryWithRetry(
        'SELECT id, titulo FROM pastas_documentos WHERE pasta_pai_id = ?',
        [id]
      );
      
      if (subpastas && subpastas.length > 0) {
        // Verificar quais subpastas estão vazias e quais têm documentos
        const subpastasVazias = [];
        const subpastasComDocs = [];
        
        for (const subpasta of subpastas) {
          const docsSubpasta = await executeQueryWithRetry(
            'SELECT COUNT(*) as count FROM documentos WHERE pasta_id = ?',
            [subpasta.id]
          );
          const count = Number(docsSubpasta[0]?.count || 0);
          if (count > 0) {
            subpastasComDocs.push({
              id: subpasta.id,
              titulo: subpasta.titulo,
              totalDocs: count
            });
          } else {
            subpastasVazias.push(subpasta);
          }
        }
        
        // Remover subpastas vazias automaticamente
        if (subpastasVazias.length > 0) {
          for (const subpasta of subpastasVazias) {
            await executeQueryWithRetry(
              'DELETE FROM pastas_documentos WHERE id = ?',
              [subpasta.id]
            );
          }
          console.log(`✅ ${subpastasVazias.length} subpastas vazias removidas automaticamente`);
        }
        
        // Se ainda há subpastas com documentos, bloquear remoção
        if (subpastasComDocs.length > 0) {
          const subpastasNomes = subpastasComDocs.map(s => `${s.titulo} (${s.totalDocs} docs)`).join(', ');
          return res.status(400).json({
            error: `Não é possível remover pasta. Algumas subpastas contêm documentos: ${subpastasNomes}. Remova os documentos primeiro.`,
            subpastasComDocumentos: subpastasComDocs
          });
        }
      }
      
      // Verificar documentos na pasta principal (após remover subpastas vazias)
      const docs = await executeQueryWithRetry(
        'SELECT COUNT(*) as count FROM documentos WHERE pasta_id = ?', 
        [id]
      );
      
      if (docs[0]?.count > 0) {
        return res.status(400).json({ 
          error: `Não é possível remover pasta. A pasta contém ${docs[0].count} documento(s). Mova ou remova os documentos primeiro.`,
          totalDocumentos: docs[0].count
        });
      }
    } else {
      // Para pastas normais (não compliance), verificar documentos e subpastas normalmente
      const docs = await executeQueryWithRetry(
        'SELECT COUNT(*) as count FROM documentos WHERE pasta_id = ?', 
        [id]
      );
      
      // Contar documentos em subpastas recursivamente
      const contarDocsSubpastas = async (pastaId) => {
        let total = Number(docs[0]?.count || 0);
        
        const subpastas = await executeQueryWithRetry(
          'SELECT id FROM pastas_documentos WHERE pasta_pai_id = ?',
          [pastaId]
        );
        
        for (const subpasta of subpastas) {
          const docsSubpasta = await executeQueryWithRetry(
            'SELECT COUNT(*) as count FROM documentos WHERE pasta_id = ?',
            [subpasta.id]
          );
          total += Number(docsSubpasta[0]?.count || 0);
          
          // Recursivo para subpastas de subpastas
          total += await contarDocsSubpastas(subpasta.id);
        }
        
        return total;
      };
      
      const totalDocs = await contarDocsSubpastas(id);
      
      if (totalDocs > 0) {
        return res.status(400).json({ 
          error: `Não é possível remover pasta com documentos. A pasta contém ${totalDocs} documento(s) (incluindo documentos em subpastas). Mova ou remova os documentos primeiro.`,
          totalDocumentos: totalDocs
        });
      }
      
      // Verificar subpastas
      const subpastas = await executeQueryWithRetry(
        'SELECT id, titulo FROM pastas_documentos WHERE pasta_pai_id = ?',
        [id]
      );

      if (subpastas && subpastas.length > 0) {
        const subpastasNomes = subpastas.map(s => s.titulo).join(', ');
        return res.status(400).json({
          error: `Não é possível remover pasta com subpastas. A pasta contém ${subpastas.length} subpasta(s): ${subpastasNomes}. Remova ou mova as subpastas primeiro.`,
          totalSubpastas: subpastas.length,
          subpastas: subpastas.map(s => ({ id: s.id, titulo: s.titulo }))
        });
      }
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


