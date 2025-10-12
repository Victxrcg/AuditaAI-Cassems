const mariadb = require('mariadb');

// Configuração da conexão direta ao MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',      // usuário do .env do servidor
  password: process.env.DB_PASSWORD || 'portes2025', // senha do .env do servidor
  database: process.env.DB_NAME || 'cassems',
  waitForConnections: true,
  connectionLimit: 5,      // Reduzir para evitar sobrecarga
  queueLimit: 0,
  acquireTimeout: 30000,   // 30 segundos para obter conexão
  timeout: 30000,          // 30 segundos timeout geral
  reconnect: true,
  idleTimeout: 600000,     // 10 minutos para fechar conexões inativas
  connectionTimeout: 30000, // 30 segundos para estabelecer conexão
  multipleStatements: false,
  charset: 'utf8mb4',
  // Configurações adicionais para estabilidade
  resetAfterUse: true,
  allowPublicKeyRetrieval: true,
  ssl: false
};

// Pool de conexões
let pool = null;

// Função para obter pool de conexões com retry
async function getDbPool(retryCount = 0, maxRetries = 3) {
  if (!pool) {
    console.log('🔌 Criando pool de conexões MySQL...');
    console.log('📊 Configuração:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '✅ Configurado' : '❌ Não configurado',
      connectionLimit: dbConfig.connectionLimit,
      acquireTimeout: dbConfig.acquireTimeout
    });
    
    pool = mariadb.createPool(dbConfig);
    
    // Testar conexão com retry
    try {
      console.log(`🔄 Tentativa ${retryCount + 1} - Obtendo conexão de teste...`);
      const connection = await pool.getConnection();
      console.log('✅ Conexão MySQL estabelecida com sucesso');
      console.log('🔍 Info da conexão:', {
        threadId: connection.threadId,
        serverInfo: connection.serverInfo?.version
      });
      connection.release();
    } catch (error) {
      console.error(`❌ Tentativa ${retryCount + 1} falhou:`, error.message);
      console.error('❌ Código do erro:', error.code);
      
      // Reset pool em caso de erro
      if (pool) {
        try {
          await pool.end();
        } catch (closeError) {
          console.error('❌ Erro ao fechar pool:', closeError);
        }
      }
      pool = null;
      
      // Retry se não excedeu o limite
      if (retryCount < maxRetries - 1) {
        console.log(`🔄 Aguardando 2 segundos antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return getDbPool(retryCount + 1, maxRetries);
      }
      
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

// Função para verificar status do pool
function getPoolStatus() {
  if (!pool) {
    return { status: 'not_initialized' };
  }
  
  return {
    status: 'initialized',
    activeConnections: pool.activeConnections(),
    idleConnections: pool.idleConnections(),
    totalConnections: pool.totalConnections()
  };
}

// Função para resetar o pool em caso de problemas
async function resetPool() {
  console.log('🔄 Resetando pool de conexões...');
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      console.error('❌ Erro ao fechar pool:', error);
    }
    pool = null;
  }
  console.log('✅ Pool resetado');
}

// Função para executar query com retry automático
async function executeQueryWithRetry(query, params = [], maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const poolInstance = await getDbPool();
      const result = await poolInstance.query(query, params);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`❌ Tentativa ${attempt + 1} de query falhou:`, error.message);
      
      // Se for erro de pool timeout ou conexão, resetar o pool
      if (error.message.includes('pool timeout') || 
          error.message.includes('connection') ||
          error.message.includes('ECONNREFUSED')) {
        console.log('🔄 Erro de conexão detectado, resetando pool...');
        await resetPool();
        
        if (attempt < maxRetries) {
          console.log(`⏳ Aguardando 1 segundo antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        // Para outros erros, não tentar novamente
        break;
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  getDbPool,
  getDbPoolWithTunnel,
  closeAllConnections,
  getPoolStatus,
  resetPool,
  executeQueryWithRetry
};
