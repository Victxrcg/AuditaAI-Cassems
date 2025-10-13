require('dotenv').config();
const express = require('express');
const cors = require('cors');
const complianceRoutes = require('./routes/complianceRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const authRoutes = require('./routes/authRoutes');
const cronogramaRoutes = require('./routes/cronogramaRoutes');
const { getPoolStatus, getDbPool } = require('./lib/db');
ta 
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api/compliance', complianceRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auth', authRoutes); // Mudança: de /api para /api/auth
app.use('/api/cronograma', cronogramaRoutes);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date() });
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