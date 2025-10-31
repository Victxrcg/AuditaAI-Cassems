require('dotenv').config();
const express = require('express');
const cors = require('cors');
const complianceRoutes = require('./routes/complianceRoutes');
const documentosRoutes = require('./routes/documentosRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const authRoutes = require('./routes/authRoutes');
const cronogramaRoutes = require('./routes/cronogramaRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const healthRoutes = require('./routes/healthRoutes');
const emailRoutes = require('./routes/emailRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const organizacoesRoutes = require('./routes/organizacoesRoutes');
const { getPoolStatus, getDbPool } = require('./lib/db');
const app = express();

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:4011',
    'http://localhost:3000',
    'http://127.0.0.1:4011',
    'http://127.0.0.1:3000',
    'https://compliance.portes.com.br',
    'https://api-compliance.portes.com.br'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-user-organization',
    'x-user-id',
    'Range',
    'Accept',
    'Origin',
    'X-Requested-With'
  ]
}));

// Middleware para lidar com preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, Range, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Middleware específico para uploads grandes
app.use((req, res, next) => {
  // Aumentar timeout para requisições de upload
  req.setTimeout(30 * 60 * 1000); // 30 minutos
  res.setTimeout(30 * 60 * 1000); // 30 minutos
  
  // Headers específicos para uploads
  if (req.path.includes('/anexos/')) {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, Accept, Origin, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 horas
  }
  
  next();
});

// Rotas - ORDEM IMPORTANTE: rotas específicas antes das genéricas
app.use('/api/compliance', complianceRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/organizacoes', organizacoesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cronograma', cronogramaRoutes);
app.use('/api/email', emailRoutes); // ← MOVER PARA ANTES das rotas genéricas
app.use('/api/pdf', pdfRoutes);
app.use('/api', checklistRoutes);
app.use('/api', healthRoutes);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date() });
});

// Rota de teste específica para email - DIRETA no app.js
app.post('/api/email/enviar-notas-fiscais', async (req, res) => {
  console.log('🔍 Rota direta chamada!');
  console.log('🔍 Body:', req.body);
  res.json({ 
    success: true, 
    message: 'Rota direta funcionando!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Rota de status do banco de dados
app.get('/api/db-status', async (req, res) => {
  try {
    const poolStatus = getPoolStatus();

    // Tentar fazer uma query simples para testar a conexão
    let dbConnection = false;
    try {
      const pool = await getDbPool();
      const connection = await pool.getConnection();
      await connection.query('SELECT 1 as test');
      connection.release();
      dbConnection = true;
    } catch (error) {
      console.error('❌ Erro ao testar conexão DB:', error.message);
      dbConnection = false;
    }

    res.json({
      api: 'OK',
      database: dbConnection ? 'OK' : 'ERROR',
      pool: poolStatus,
      timestamp: new Date(),
      environment: {
        node_env: process.env.NODE_ENV,
        db_host: process.env.DB_HOST,
        db_port: process.env.DB_PORT,
        db_user: process.env.DB_USER,
        db_name: process.env.DB_NAME
      }
    });
  } catch (error) {
    res.status(500).json({
      api: 'ERROR',
      database: 'ERROR',
      error: error.message,
      timestamp: new Date()
    });
  }
});

const PORT = Number(process.env['API-PORTA'] || process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
