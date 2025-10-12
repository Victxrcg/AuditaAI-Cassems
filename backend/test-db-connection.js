require('dotenv').config();
const { getDbPool, getPoolStatus, executeQueryWithRetry } = require('./src/lib/db');

async function testConnection() {
  console.log('🧪 Testando conexão com o banco de dados...');
  console.log('📊 Variáveis de ambiente:');
  console.log('  DB_HOST:', process.env.DB_HOST || 'localhost');
  console.log('  DB_PORT:', process.env.DB_PORT || '3306');
  console.log('  DB_USER:', process.env.DB_USER || 'root');
  console.log('  DB_NAME:', process.env.DB_NAME || 'cassems');
  console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ Configurado' : '❌ Não configurado');
  
  try {
    // Teste 1: Obter pool
    console.log('\n🔄 Teste 1: Obtendo pool de conexões...');
    const pool = await getDbPool();
    console.log('✅ Pool obtido com sucesso');
    
    // Teste 2: Status do pool
    console.log('\n🔄 Teste 2: Verificando status do pool...');
    const status = getPoolStatus();
    console.log('📊 Status do pool:', status);
    
    // Teste 3: Query simples
    console.log('\n🔄 Teste 3: Executando query simples...');
    const result = await executeQueryWithRetry('SELECT 1 as test, NOW() as current_time');
    console.log('✅ Query executada com sucesso:', result);
    
    // Teste 4: Verificar tabela compliance_fiscal
    console.log('\n🔄 Teste 4: Verificando tabela compliance_fiscal...');
    const competencias = await executeQueryWithRetry(`
      SELECT COUNT(*) as total FROM compliance_fiscal
    `);
    console.log('✅ Tabela compliance_fiscal acessível:', competencias);
    
    // Teste 5: Verificar tabela usuarios_cassems
    console.log('\n🔄 Teste 5: Verificando tabela usuarios_cassems...');
    const usuarios = await executeQueryWithRetry(`
      SELECT COUNT(*) as total FROM usuarios_cassems
    `);
    console.log('✅ Tabela usuarios_cassems acessível:', usuarios);
    
    console.log('\n🎉 Todos os testes passaram! A conexão está funcionando corretamente.');
    
  } catch (error) {
    console.error('\n❌ Erro nos testes:', error.message);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
}

// Executar teste
testConnection().then(() => {
  console.log('\n✅ Teste concluído com sucesso!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Teste falhou:', error);
  process.exit(1);
});
