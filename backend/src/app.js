require('dotenv').config();
const express = require('express');
const cors = require('cors');
const complianceRoutes = require('./routes/complianceRoutes');
const documentosRoutes = require('./routes/documentosRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const authRoutes = require('./routes/authRoutes');
const cronogramaRoutes = require('./routes/cronogramaRoutes');
const plaudRoutes = require('./routes/plaudRoutes');
const plaudController = require('./controllers/plaudController');
const checklistRoutes = require('./routes/checklistRoutes');
const healthRoutes = require('./routes/healthRoutes');
const emailRoutes = require('./routes/emailRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const organizacoesRoutes = require('./routes/organizacoesRoutes');
const icmsEqualizacaoRoutes = require('./routes/icmsEqualizacaoRoutes');
const { getPoolStatus, getDbPool } = require('./lib/db');
const app = express();

// Middlewares
// Configuração de CORS mais permissiva e robusta
app.use(cors({
  origin: function (origin, callback) {
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:4011',
      'http://localhost:3000',
      'http://127.0.0.1:4011',
      'http://127.0.0.1:3000',
      'https://compliance.portes.com.br',
      'https://api-compliance.portes.com.br'
    ];
    
    // Permitir requisições sem origin (ex: Postman, curl, mobile apps)
    if (!origin) {
      return callback(null, true);
    }
    
    // Permitir se está na lista ou é localhost/127.0.0.1
    if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      // Em produção, ser mais restritivo, mas por enquanto permitir para desenvolvimento
      console.log('⚠️ [CORS] Origin não autorizada, mas permitindo:', origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-user-organization',
    'x-user-id',
    'x-tipo-compliance',
    'Range',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'Content-Length'],
  maxAge: 86400 // 24 horas
}));

// Normalizar charset de JSON para evitar erros do iconv-lite/raw-body
app.use((req, _res, next) => {
  const ct = req.headers['content-type'];
  if (ct && typeof ct === 'string' && ct.toLowerCase().includes('application/json')) {
    // Força charset utf-8 quando vier algo inesperado/exótico
    if (!/charset\s*=\s*utf-8/i.test(ct)) {
      req.headers['content-type'] = 'application/json; charset=utf-8';
    }
  }
  next();
});

// Aquecer iconv-lite para garantir encodings básicos carregados
try {
  require('iconv-lite').encodingExists('utf-8');
} catch (_) {}

// Middleware para lidar com preflight requests (ANTES de qualquer rota)
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:4011',
    'http://localhost:3000',
    'http://127.0.0.1:4011',
    'http://127.0.0.1:3000',
    'https://compliance.portes.com.br',
    'https://api-compliance.portes.com.br'
  ];
  
  console.log('🔍 [CORS] Preflight request recebido de:', origin);
  
  // Sempre retornar header Access-Control-Allow-Origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('✅ [CORS] Origin permitida:', origin);
  } else if (origin) {
    // Se a origin não está na lista mas é válida, permitir mesmo assim em desenvolvimento
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('⚠️ [CORS] Origin não está na lista, mas permitindo:', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log('⚠️ [CORS] Sem origin, usando *');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, x-tipo-compliance, Range, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
  
  console.log('✅ [CORS] Headers CORS definidos para preflight');
  return res.sendStatus(200);
});

// Middleware adicional para garantir CORS em todas as respostas
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:4011',
    'http://localhost:3000',
    'http://127.0.0.1:4011',
    'http://127.0.0.1:3000',
    'https://compliance.portes.com.br',
    'https://api-compliance.portes.com.br'
  ];
  
  // Sempre definir Access-Control-Allow-Origin
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // Em desenvolvimento, permitir qualquer origin localhost
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', origin); // Permitir mesmo assim
      }
    }
  } else {
    // Se não há origin, usar * (não recomendado com credentials, mas funciona)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, x-tipo-compliance, Range, Accept, Origin, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
  
  // Se for OPTIONS, responder imediatamente
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Webhook Plaud precisa do body bruto para verificação de assinatura (antes de express.json)
app.post('/api/plaud/webhook', express.raw({ type: 'application/json' }), (req, res) => plaudController.webhook(req, res));

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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-organization, x-user-id, x-tipo-compliance, Accept, Origin, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 horas
  }
  
  next();
});

// Rotas - ORDEM IMPORTANTE: rotas específicas antes das genéricas
app.use('/api/compliance', complianceRoutes);
app.use('/api/compliance/icms-equalizacao', icmsEqualizacaoRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/organizacoes', organizacoesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cronograma', cronogramaRoutes);
app.use('/api/plaud', plaudRoutes);
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
