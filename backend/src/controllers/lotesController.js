const { getDbPoolWithTunnel } = require('../lib/db');

exports.listarLotes = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    const [rows] = await pool.query(`
      SELECT id, nome_arquivo, data_lote, importado_em, total_registros
      FROM lotes_cancelamento
      ORDER BY data_lote DESC, id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.warn('⚠️ Falha ao buscar lotes no banco. Ativando fallback de desenvolvimento.', err.message);

    // Fallback simples em desenvolvimento para não quebrar a UI
    if (process.env.NODE_ENV === 'development') {
      const hoje = new Date();
      const iso = (d) => new Date(d).toISOString();
      const mock = [
        { id: 3, nome_arquivo: 'UNIMED_CANCELAMENTO_15072025.csv', data_lote: iso(hoje), importado_em: iso(hoje), total_registros: 291 },
        { id: 2, nome_arquivo: 'UNIMED_CANCELAMENTO_14072025.csv', data_lote: iso(hoje.getTime() - 86400000), importado_em: iso(hoje), total_registros: 180 },
        { id: 1, nome_arquivo: 'UNIMED_CANCELAMENTO_13072025.csv', data_lote: iso(hoje.getTime() - 172800000), importado_em: iso(hoje), total_registros: 150 },
      ];
      return res.json(mock);
    }
    res.status(500).json({ error: 'Erro ao buscar lotes', details: err.message });
  }
  // Não fechar conexão - será reutilizada
};

// Função para normalizar CPF/CNPJ (preservar zeros à esquerda)
function normalizeCpfCnpj(cpfCnpj) {
  if (!cpfCnpj) return '';
  
  // Remover caracteres não numéricos
  let clean = cpfCnpj.toString().replace(/\D/g, '');
  
  // Se for CPF (11 dígitos), padStart com zeros
  if (clean.length <= 11) {
    clean = clean.padStart(11, '0');
  }
  // Se for CNPJ (14 dígitos), padStart com zeros
  else if (clean.length <= 14) {
    clean = clean.padStart(14, '0');
  }
  
  return clean;
}

// Função para normalizar data (DD/MM/YYYY -> YYYY-MM-DD)
function normalizeDateToISO(dateStr) {
  if (!dateStr) return null;
  
  // Se já estiver no formato ISO, retornar como está
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Se estiver no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [dia, mes, ano] = dateStr.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  
  return dateStr;
}

// Função para parsear valores monetários
function parseDecimal(value) {
  if (!value) return null;
  
  // Remover R$, espaços e converter vírgula para ponto
  const clean = value.toString()
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? null : parsed;
}

// Função para mapear colunas do CSV
function mapearColunas(cabecalho) {
  console.log(' Analisando cabeçalho do CSV:', cabecalho);
  
  // Normalizar nomes das colunas (remover espaços, converter para minúsculo)
  const colunasNormalizadas = cabecalho.map(col => 
    col.trim().toLowerCase().replace(/\s+/g, '_')
  );
  
  console.log('📋 Colunas normalizadas:', colunasNormalizadas);
  
  // Mapear colunas necessárias
  const mapeamento = {
    numero_contrato: null,
    data_vencimento: null,
    especie: null,
    nome_cliente: null,
    cod_registro_plano_ans: null,
    cpf_cnpj: null,
    codigo_titulo: null,
    valor_original: null,
    valor_atual: null,
    dias_atraso: null
  };
  
  // Procurar por cada coluna necessária
  const chaves = Object.keys(mapeamento);
  
  chaves.forEach(chave => {
    // Procurar por variações do nome da coluna
    const variacoes = getVariacoesColuna(chave);
    
    for (let i = 0; i < colunasNormalizadas.length; i++) {
      const coluna = colunasNormalizadas[i];
      
      // Se já encontrou esta coluna, pular (evitar duplicatas)
      if (mapeamento[chave] !== null) continue;
      
      // Verificar se a coluna atual corresponde a alguma variação
      if (variacoes.some(variacao => coluna.includes(variacao))) {
        mapeamento[chave] = i;
        console.log(`✅ Mapeado: ${chave} -> coluna ${i} (${cabecalho[i]})`);
        break;
      }
    }
  });
  
  // Verificar colunas não encontradas
  const colunasNaoEncontradas = chaves.filter(chave => mapeamento[chave] === null);
  if (colunasNaoEncontradas.length > 0) {
    console.log('⚠️ Colunas não encontradas:', colunasNaoEncontradas);
  }
  
  return mapeamento;
}

// Função para obter variações de nomes de colunas
function getVariacoesColuna(chave) {
  const variacoes = {
    numero_contrato: ['numero', 'contrato', 'numero_contrato', 'n_contrato', 'contrato_numero'],
    data_vencimento: ['data', 'vencimento', 'data_vencimento', 'venc', 'dt_vencimento'],
    especie: ['especie', 'esp', 'tipo', 'modalidade'],
    nome_cliente: ['nome', 'cliente', 'nome_cliente', 'razao_social', 'nome_razao'],
    cod_registro_plano_ans: ['codigo', 'registro', 'plano', 'ans', 'cod_registro', 'plano_ans'],
    cpf_cnpj: ['cpf', 'cnpj', 'cpf_cnpj', 'documento', 'doc'],
    codigo_titulo: ['codigo_titulo', 'titulo', 'cod_titulo', 'numero_titulo', 'cdigo_ttulo', 'cdigo_t_tulo', 'c_digo_t_tulo', 't_tulo', 'cdigo', 'ttulo', 'Cdigo Ttulo', 'cdigo_t_tulo'],
    valor_original: ['valor_original', 'valor', 'original', 'vlr_original'],
    valor_atual: ['valor_atual', 'atual', 'vlr_atual', 'valor_total'],
    dias_atraso: ['dias_atraso', 'atraso', 'dias', 'dias_em_atraso']
  };
  
  return variacoes[chave] || [chave];
}

exports.importarLote = async (req, res) => {
  let pool, server;
  try {
    const { csvContent, nomeArquivo, dataLote } = req.body;
    
    if (!csvContent || !nomeArquivo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Conteúdo CSV e nome do arquivo são obrigatórios' 
      });
    }

    // Parsear o CSV (usando ; como delimitador)
    const linhas = csvContent.split('\n').filter(linha => linha.trim());
    const cabecalho = linhas[0].split(';').map(col => col.trim());
    const dados = linhas.slice(1).filter(linha => linha.trim() && !linha.match(/^;+$/));

    console.log(`CSV processado: ${dados.length} registros`);
    console.log(`Cabeçalho original:`, cabecalho);
    console.log(`Primeira linha de dados:`, dados[0]);
    console.log(`Linhas completas:`, linhas);

    // Mapear colunas automaticamente
    const mapeamento = mapearColunas(cabecalho);
    console.log(`Mapeamento resultante:`, mapeamento);
    
    // Verificar se encontrou as colunas essenciais
    const colunasEssenciais = ['numero_contrato', 'nome_cliente', 'cpf_cnpj', 'codigo_titulo'];
    const colunasFaltando = colunasEssenciais.filter(col => mapeamento[col] === null);
    
    console.log(`Colunas essenciais encontradas:`, colunasEssenciais.map(col => ({
      coluna: col,
      indice: mapeamento[col],
      encontrada: mapeamento[col] !== null
    })));
    
    if (colunasFaltando.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Colunas essenciais não encontradas: ${colunasFaltando.join(', ')}`,
        cabecalhoEncontrado: cabecalho,
        colunasFaltando: colunasFaltando,
        mapeamento: mapeamento
      });
    }

    // Processar cada linha usando o mapeamento
    const registros = dados.map((linha, index) => {
      const campos = linha.split(';').map(campo => campo.trim());
      console.log(`Processando linha ${index + 1}:`, campos);
      
      const registro = {};
      
      // Extrair dados usando o mapeamento
      Object.keys(mapeamento).forEach(chave => {
        const indiceColuna = mapeamento[chave];
        if (indiceColuna !== null && campos[indiceColuna] !== undefined) {
          registro[chave] = campos[indiceColuna];
        } else {
          registro[chave] = null;
        }
      });
      
      // Processar valores específicos
      if (registro.valor_original) {
        registro.valor_original = parseDecimal(registro.valor_original);
      }
      if (registro.valor_atual) {
        registro.valor_atual = parseDecimal(registro.valor_atual);
      }
      if (registro.dias_atraso) {
        registro.dias_atraso = parseInt(registro.dias_atraso) || 0;
      }
      
      console.log(`Registro processado ${index + 1}:`, registro);
      return registro;
    });

    console.log(`Total de registros processados: ${registros.length}`);
    console.log(`Primeiro registro:`, registros[0]);

    // Filtrar registros válidos
    const registrosValidos = registros.filter(r => {
      const isValid = r.numero_contrato && r.nome_cliente && r.cpf_cnpj && r.codigo_titulo;
      console.log(`Validando registro:`, {
        numero_contrato: r.numero_contrato,
        nome_cliente: r.nome_cliente,
        cpf_cnpj: r.cpf_cnpj,
        codigo_titulo: r.codigo_titulo,
        isValid: isValid
      });
      return isValid;
    });

    console.log(`✅ Registros válidos: ${registrosValidos.length} de ${registros.length}`);

    if (registrosValidos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum registro válido encontrado no arquivo CSV',
        totalRegistros: registros.length,
        registrosInvalidos: registros.length,
        mapeamento: mapeamento,
        primeiroRegistro: registros[0],
        debug: {
          cabecalho: cabecalho,
          dados: dados.slice(0, 2), // Primeiras 2 linhas de dados
          linhas: linhas
        }
      });
    }

    // Conectar ao banco
    ({ pool, server } = await getDbPoolWithTunnel());

    // Gerar próximo ID do lote
    const [maxIdResult] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM lotes_cancelamento');
    const novoLoteId = maxIdResult[0].next_id;

    // Data do lote (usar fornecida ou atual)
    const dataLoteFormatada = dataLote || new Date().toISOString().split('T')[0];

    // Inserir o lote
    await pool.query(
      'INSERT INTO lotes_cancelamento (id, nome_arquivo, data_lote, total_registros) VALUES (?, ?, ?, ?)',
      [novoLoteId, nomeArquivo, dataLoteFormatada, registrosValidos.length]
    );

    console.log(` Lote ${novoLoteId} criado com sucesso`);

    // Inserir os registros de clientes
    const batchSize = 100;
    let registrosInseridos = 0;
    let registrosIgnorados = 0;
    
    for (let i = 0; i < registrosValidos.length; i += batchSize) {
      const batch = registrosValidos.slice(i, i + batchSize);
      
      const values = batch.map(registro => {
        const dataVencimento = registro.data_vencimento ? normalizeDateToISO(registro.data_vencimento) : null;
        const valorOriginal = registro.valor_original !== null ? registro.valor_original : null;
        const valorAtual = registro.valor_atual !== null ? registro.valor_atual : null;
        const cpfCnpjNormalizado = normalizeCpfCnpj(registro.cpf_cnpj);
        
        // Criar um código único para este lote para evitar conflitos
        const codigoTituloUnico = registro.codigo_titulo;
        
        return [
          novoLoteId,
          registro.numero_contrato,
          dataVencimento,
          registro.especie,
          registro.nome_cliente,
          registro.cod_registro_plano_ans,
          cpfCnpjNormalizado,
          codigoTituloUnico, // Usar código do título original sem adicionar ID do lote
          valorOriginal,
          valorAtual,
          registro.dias_atraso
        ];
      });

      // Usar INSERT IGNORE para evitar erros de duplicata
      const [result] = await pool.query(`
        INSERT IGNORE INTO clientes_cancelamentos 
        (lote_id, numero_contrato, data_vencimento, especie, nome_cliente, cod_registro_plano_ans, cpf_cnpj, codigo_titulo, valor_original, valor_atual, dias_atraso)
        VALUES ?
      `, [values]);
      
      registrosInseridos += result.affectedRows;
      registrosIgnorados += (values.length - result.affectedRows);
      
      console.log(` Batch ${Math.floor(i/batchSize) + 1}: ${result.affectedRows} inseridos, ${values.length - result.affectedRows} ignorados`);
    }

    console.log(`✅ Total: ${registrosInseridos} registros inseridos, ${registrosIgnorados} duplicatas ignoradas`);

    // Atualizar total de registros do lote com o número real de registros inseridos
    await pool.query(
      'UPDATE lotes_cancelamento SET total_registros = ? WHERE id = ?',
      [registrosInseridos, novoLoteId]
    );

    // Buscar o lote criado para retornar
    const [loteResult] = await pool.query(
      'SELECT id, nome_arquivo, data_lote, importado_em, total_registros FROM lotes_cancelamento WHERE id = ?',
      [novoLoteId]
    );

    // Verificar quantos registros foram realmente inseridos para este lote
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM clientes_cancelamentos WHERE lote_id = ?',
      [novoLoteId]
    );

    console.log(`🔍 Verificação: ${countResult[0].total} registros encontrados no lote ${novoLoteId}`);

    res.json({
      success: true,
      message: `Lote importado com sucesso! ${registrosInseridos} registros inseridos, ${registrosIgnorados} duplicatas ignoradas.`,
      lote: loteResult[0],
      estatisticas: {
        totalLinhas: dados.length,
        registrosValidos: registrosValidos.length,
        registrosInseridos: registrosInseridos,
        registrosIgnorados: registrosIgnorados,
        registrosInvalidos: dados.length - registrosValidos.length,
        colunasMapeadas: Object.keys(mapeamento).filter(k => mapeamento[k] !== null).length,
        colunasIgnoradas: cabecalho.length - Object.keys(mapeamento).filter(k => mapeamento[k] !== null).length,
        registrosReaisNoBanco: countResult[0].total
      },
      mapeamento: mapeamento
    });

  } catch (err) {
    console.error('❌ Erro ao importar lote:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao importar lote', 
      details: err.message 
    });
  }
}; 
