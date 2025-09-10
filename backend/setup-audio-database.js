const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function setupAudioDatabase() {
  console.log('🎵 Configurando banco de dados para áudios...\n');

  try {
    // 1. Adicionar coluna file_data
    console.log('🔧 1. Adicionando coluna file_data...');
    const addColumnResponse = await fetch(`${API_BASE}/api/setup/add-binary-column`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const addColumnResult = await addColumnResponse.json();
    console.log('✅ Resultado:', addColumnResult.message);
    
    if (addColumnResult.columns) {
      console.log('📋 Colunas disponíveis:', addColumnResult.columns);
    }

    // 2. Carregar todos os arquivos de áudio
    console.log('\n📤 2. Carregando arquivos de áudio no banco...');
    const uploadResponse = await fetch(`${API_BASE}/api/audios/upload-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const uploadResult = await uploadResponse.json();
    console.log('✅ Resultado:', uploadResult.message);
    
    if (uploadResult.summary) {
      console.log('📊 Resumo:');
      console.log(`   - Total: ${uploadResult.summary.total}`);
      console.log(`   - Sucessos: ${uploadResult.summary.success}`);
      console.log(`   - Erros: ${uploadResult.summary.error}`);
    }

    if (uploadResult.results && uploadResult.results.length > 0) {
      console.log('\n📋 Detalhes dos arquivos:');
      uploadResult.results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const size = result.fileSize ? `(${result.fileSize} bytes)` : '';
        const error = result.error ? ` - ${result.error}` : '';
        console.log(`   ${status} ${result.fileName} ${size}${error}`);
      });
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('💡 Agora os áudios devem funcionar diretamente do banco de dados.');

  } catch (error) {
    console.error('❌ Erro durante a configuração:', error.message);
    console.log('\n💡 Certifique-se de que:');
    console.log('   1. O servidor backend está rodando em http://localhost:3001');
    console.log('   2. Os arquivos de áudio existem nos caminhos especificados no banco');
    console.log('   3. O banco de dados está acessível');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  setupAudioDatabase();
}

module.exports = setupAudioDatabase; 