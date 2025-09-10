import express from 'express';
import cors from 'cors';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_HASH = process.env.ADMIN_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token ausente' });
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

app.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  if (login !== 'vip') return res.status(401).json({ error: 'Usuário inválido' });
  // Senha fixa alfanumérica
  if (senha !== 'MinhaSenhaF0rte') return res.status(401).json({ error: 'Senha inválida' });
  if (!JWT_SECRET) return res.status(500).json({ error: 'Configuração ausente' });
  const token = jwt.sign({ login: 'vip' }, JWT_SECRET, { expiresIn: '30m' });
  res.json({ token });
});

app.get('/api/clientes', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'my-panel/data/clientes.yaml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler clientes.yaml', details: err.message });
  }
});

app.get('/download/:audioId', authMiddleware, (req, res) => {
  const audioId = req.params.audioId;
  const audioPath = path.join(process.cwd(), 'my-panel/data/audios', audioId);
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: 'Áudio não disponível' });
  }
  res.download(audioPath);
});

// Endpoint para listar anexos de um cliente
app.get('/api/attachments/:cpf', (req, res) => {
  try {
    const { cpf } = req.params;
    const attachmentsDir = path.join(process.cwd(), 'my-panel/data/attachments');
    
    console.log('🔍 Buscando anexos para CPF:', cpf);
    console.log('📁 Diretório de anexos:', attachmentsDir);
    
    if (!fs.existsSync(attachmentsDir)) {
      console.log('❌ Diretório de anexos não existe');
      return res.json([]);
    }

    const files = fs.readdirSync(attachmentsDir);
    console.log('📄 Arquivos encontrados no diretório:', files);
    
    const attachments = [];

    files.forEach(file => {
      console.log(`🔍 Verificando arquivo: ${file}`);
      console.log(`🔍 Procurando por: ${cpf}_`);
      
      // Verifica se o arquivo começa com o CPF do cliente
      if (file.startsWith(cpf + '_')) {
        console.log(`✅ Arquivo encontrado: ${file}`);
        const filePath = path.join(attachmentsDir, file);
        const stats = fs.statSync(filePath);
        const extension = path.extname(file);
        
        // Extrai o nome original (remove o CPF e timestamp do início)
        const fileNameParts = file.split('_');
        const originalName = fileNameParts.slice(2).join('_'); // Remove CPF e timestamp
        
        // Determina o tipo de arquivo baseado na extensão
        let fileType = 'application/octet-stream';
        switch (extension.toLowerCase()) {
          case '.jpg':
          case '.jpeg':
            fileType = 'image/jpeg';
            break;
          case '.png':
            fileType = 'image/png';
            break;
          case '.gif':
            fileType = 'image/gif';
            break;
          case '.pdf':
            fileType = 'application/pdf';
            break;
          case '.txt':
            fileType = 'text/plain';
            break;
        }

        attachments.push({
          id: file, // Usa o nome do arquivo como ID
          fileName: file,
          originalName: originalName || file,
          fileSize: stats.size,
          uploadDate: stats.mtime.toISOString(),
          description: '', // Sem descrição por enquanto
          fileType: fileType
        });
      }
    });

    console.log(`📋 Total de anexos encontrados: ${attachments.length}`);
    
    // Ordena por data de modificação (mais recente primeiro)
    attachments.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    
    res.json(attachments);
  } catch (err) {
    console.error('❌ Erro ao listar anexos:', err);
    res.status(500).json({ error: 'Erro ao listar anexos', details: err.message });
  }
});

// Endpoint para download de anexo
app.get('/api/attachments/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.cwd(), 'my-panel/data/attachments', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer download do anexo', details: err.message });
  }
});

// Novo endpoint para salvar decisão de auditagem em txt
app.post('/api/audit', (req, res) => {
  try {
    const { tipo, melhoria } = req.body;
    if (!tipo) return res.status(400).json({ error: 'Tipo de decisão é obrigatório' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `audit_decision_${timestamp}.txt`;
    const filePath = path.join(process.cwd(), 'my-panel/data/attachments', fileName);
    let content = `Decisão: ${tipo}\n`;
    if (melhoria) content += `Pontos de melhoria: ${melhoria}\n`;
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, file: fileName });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar decisão', details: err.message });
  }
});

app.use(express.static(path.join(process.cwd(), 'my-panel/src/web/build')));

app.listen(PORT, () => {
  console.log(`Servidor backend rodando em http://localhost:${PORT}`);
}); 