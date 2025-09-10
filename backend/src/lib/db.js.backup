const mysql = require('mysql2/promise');


// Configuração da conexão direta ao MySQL
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'portes2025',
  database: process.env.DB_NAME || 'auditaai',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexões
let pool = null;

// Função para obter pool de conexões
async function getDbPool() {
  if (!pool) {
    console.log('🔌 Criando pool de conexões MySQL...');
    console.log('📊 Configuração:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '✅ Configurado' : '❌ Não configurado'
    });
    
    pool = mysql.createPool(dbConfig);
    
    // Testar conexão
    try {
      const connection = await pool.getConnection();
      console.log('✅ Conexão MySQL estabelecida com sucesso');
      connection.release();
    } catch (error) {
      console.error('❌ Erro ao conectar com MySQL:', error);
      throw error;
    }
  }
  
  return pool;
}

// Função para fechar todas as conexões
async function closeAllConnections() {
  if (pool) {
    console.log('🔒 Fechando pool de conexões MySQL...');
    await pool.end();
    pool = null;
    console.log('✅ Pool de conexões fechado');
  }
}

// Função para obter pool (mantém compatibilidade com código existente)
async function getDbPoolWithTunnel() {
  const pool = await getDbPool();
  return { pool, server: null }; // server null para manter compatibilidade
}

module.exports = {
  getDbPool,
  getDbPoolWithTunnel,
  closeAllConnections
}; 