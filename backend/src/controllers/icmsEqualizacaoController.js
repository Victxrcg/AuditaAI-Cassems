// backend/src/controllers/icmsEqualizacaoController.js
const { getDbPoolWithTunnel, executeQueryWithRetry } = require('../lib/db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configurar OpenAI (opcional)
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI configurado com sucesso para ICMS e Equalização');
  } else {
    console.log('⚠️ OpenAI não configurado - funcionalidades de IA desabilitadas');
  }
} catch (error) {
  console.log('⚠️ Erro ao configurar OpenAI:', error.message);
}

// Função para carregar pdf-parse dinamicamente
let pdfParseModule = null;
const loadPdfParse = async () => {
  if (!pdfParseModule) {
    try {
      // Limpar cache do require para garantir que estamos pegando a versão correta
      delete require.cache[require.resolve('pdf-parse')];
      const imported = require('pdf-parse');
      
      console.log('🔍 pdf-parse importado, tipo:', typeof imported);
      console.log('🔍 pdf-parse tem default?', !!imported.default);
      console.log('🔍 pdf-parse keys:', Object.keys(imported || {}));
      
      // pdf-parse versão 2.x pode exportar como objeto com PDFParse (P maiúsculo)
      // Mas mesmo sendo uma classe, pode ser chamada como função
      // Tentar diferentes formas de acesso - PRIORIDADE: função direta primeiro
      if (typeof imported === 'function') {
        // Se o próprio imported é uma função, usar diretamente
        pdfParseModule = imported;
        console.log('✅ pdf-parse carregado como função direta');
      } else if (imported.PDFParse && typeof imported.PDFParse === 'function') {
        // Versão que exporta como PDFParse (classe), mas pode ser chamada como função
        // Vamos criar um wrapper que tenta ambos os métodos
        pdfParseModule = async (buffer) => {
          try {
            // Tentar como função primeiro
            return await imported.PDFParse(buffer);
          } catch (e) {
            // Se falhar, tentar como classe
            if (e.message && e.message.includes('cannot be invoked without')) {
              return await new imported.PDFParse(buffer);
            }
            throw e;
          }
        };
        console.log('✅ pdf-parse carregado via .PDFParse (wrapper)');
      } else if (imported.default && typeof imported.default === 'function') {
        pdfParseModule = imported.default;
        console.log('✅ pdf-parse carregado via .default');
      } else if (imported.pdfParse && typeof imported.pdfParse === 'function') {
        pdfParseModule = imported.pdfParse;
        console.log('✅ pdf-parse carregado via .pdfParse');
      } else {
        // Última tentativa: usar o próprio imported
        pdfParseModule = imported;
        console.log('⚠️ pdf-parse usando imported diretamente, tipo:', typeof pdfParseModule);
      }
      
      if (!pdfParseModule) {
        throw new Error('Não foi possível extrair a função pdfParse do módulo');
      }
      
      console.log('✅ pdf-parse carregado com sucesso, tipo final:', typeof pdfParseModule);
      console.log('✅ pdf-parse é função?', typeof pdfParseModule === 'function');
      console.log('✅ pdf-parse é classe?', typeof pdfParseModule === 'function' && pdfParseModule.prototype);
    } catch (error) {
      console.error('❌ Erro ao carregar pdf-parse:', error);
      console.error('❌ Stack:', error.stack);
      throw new Error('pdf-parse não está disponível: ' + error.message);
    }
  }
  return pdfParseModule;
};

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/icms-equalizacao');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `extrato-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.xls', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, XLS, XLSX ou CSV.'));
    }
  }
});

// Função helper para converter BigInt para Number (necessário para JSON.stringify)
const convertBigIntToNumber = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToNumber(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    // Usar Object.keys para garantir que pegamos todas as propriedades, mesmo as não enumeráveis
    const keys = Object.keys(obj);
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'bigint') {
        converted[key] = Number(value);
      } else {
        converted[key] = convertBigIntToNumber(value);
      }
    }
    return converted;
  }
  
  return obj;
};

// Garantir que a tabela existe
const ensureTable = async (pool) => {
  try {
    // Usar CREATE TABLE IF NOT EXISTS para evitar erros de tabela já existente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS icms_equalizacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome_arquivo VARCHAR(255) NOT NULL,
        caminho_arquivo VARCHAR(500) NOT NULL,
        tamanho_arquivo BIGINT NULL,
        mimetype VARCHAR(100) NULL,
        extrato_simplificado TEXT NULL,
        status_processamento ENUM('pendente', 'processando', 'concluido', 'erro') DEFAULT 'pendente',
        erro_processamento TEXT NULL,
        organizacao VARCHAR(50) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_organizacao (organizacao),
        INDEX idx_created_by (created_by),
        INDEX idx_status (status_processamento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    console.log('✅ Tabela icms_equalizacao verificada/criada');

    // Verificar e adicionar colunas que possam estar faltando (migrações futuras)
    try {
      const [columnsResult] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'icms_equalizacao'
      `);

      const columns = Array.isArray(columnsResult) ? columnsResult : [];
      const columnNames = columns.map(col => col.COLUMN_NAME);
      
      // Adicionar colunas que possam estar faltando (verificando se já existem antes)
      if (!columnNames.includes('extrato_simplificado')) {
        try {
          await pool.query(`
            ALTER TABLE icms_equalizacao 
            ADD COLUMN extrato_simplificado TEXT NULL
          `);
          console.log('✅ Coluna extrato_simplificado adicionada');
        } catch (colError) {
          // Ignorar se a coluna já existir
          if (colError.code !== 'ER_DUP_FIELDNAME' && !colError.message.includes('Duplicate column')) {
            throw colError;
          }
        }
      }

      if (!columnNames.includes('status_processamento')) {
        try {
          await pool.query(`
            ALTER TABLE icms_equalizacao 
            ADD COLUMN status_processamento ENUM('pendente', 'processando', 'concluido', 'erro') DEFAULT 'pendente'
          `);
          console.log('✅ Coluna status_processamento adicionada');
        } catch (colError) {
          // Ignorar se a coluna já existir
          if (colError.code !== 'ER_DUP_FIELDNAME' && !colError.message.includes('Duplicate column')) {
            throw colError;
          }
        }
      }

      if (!columnNames.includes('erro_processamento')) {
        try {
          await pool.query(`
            ALTER TABLE icms_equalizacao 
            ADD COLUMN erro_processamento TEXT NULL
          `);
          console.log('✅ Coluna erro_processamento adicionada');
        } catch (colError) {
          // Ignorar se a coluna já existir
          if (colError.code !== 'ER_DUP_FIELDNAME' && !colError.message.includes('Duplicate column')) {
            throw colError;
          }
        }
      }
    } catch (migrationError) {
      // Ignorar erros de migração (colunas podem já existir)
      if (migrationError.code !== 'ER_DUP_FIELDNAME' && !migrationError.message.includes('Duplicate column')) {
        console.log('⚠️ Erro ao verificar migrações (pode ser ignorado):', migrationError.message);
      }
    }

  } catch (error) {
    // Se for erro de tabela já existente, ignorar
    if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
      console.log('✅ Tabela icms_equalizacao já existe');
      return;
    }
    console.error('❌ Erro ao garantir tabela icms_equalizacao:', error);
    throw error;
  }
};

// Processar PDF com IA para gerar extrato simplificado (versão sem streaming)
const processarPDFComIA = async (caminhoArquivo, nomeArquivo) => {
  if (!openai) {
    throw new Error('OpenAI não configurado');
  }

    try {
      // Carregar e extrair texto do PDF
      const pdfParse = await loadPdfParse();
      
      if (!pdfParse) {
        throw new Error('pdfParse não foi carregado corretamente');
      }
      
      console.log('🔍 [processarPDFComIA] Tipo de pdfParse:', typeof pdfParse);
      console.log('🔍 [processarPDFComIA] pdfParse é função?', typeof pdfParse === 'function');
      
      const dataBuffer = fs.readFileSync(caminhoArquivo);
      
      // Tentar chamar como função primeiro, se falhar, tentar como classe
      let pdfData;
      try {
        if (typeof pdfParse === 'function') {
          // Verificar se é uma classe (tem prototype e constructor)
          const isClass = pdfParse.prototype && pdfParse.prototype.constructor && 
                         (pdfParse.prototype.constructor === pdfParse || 
                          pdfParse.name === 'PDFParse' ||
                          pdfParse.toString().startsWith('class'));
          
          if (isClass) {
            // É uma classe, usar new
            console.log('🔍 [processarPDFComIA] Usando pdfParse como classe (new)');
            pdfData = await new pdfParse(dataBuffer);
          } else {
            // É uma função, chamar diretamente
            console.log('🔍 [processarPDFComIA] Usando pdfParse como função');
            pdfData = await pdfParse(dataBuffer);
          }
        } else {
          throw new Error('pdfParse não é uma função ou classe válida');
        }
      } catch (funcError) {
        console.error('❌ [processarPDFComIA] Erro ao processar PDF (primeira tentativa):', funcError.message);
        // Se falhar, tentar o método alternativo
        try {
          if (funcError.message && funcError.message.includes('cannot be invoked without')) {
            // Tentar como classe
            console.log('🔍 [processarPDFComIA] Tentando pdfParse como classe (new) após erro "cannot be invoked without"');
            pdfData = await new pdfParse(dataBuffer);
          } else if (funcError.message && funcError.message.includes('is not a constructor')) {
            // Tentar como função
            console.log('🔍 [processarPDFComIA] Tentando pdfParse como função após erro "is not a constructor"');
            pdfData = await pdfParse(dataBuffer);
          } else {
            throw funcError;
          }
        } catch (classError) {
          console.error('❌ [processarPDFComIA] Erro ao processar PDF (segunda tentativa):', classError.message);
          throw new Error(`Erro ao processar PDF: ${classError.message}`);
        }
      }
      
      console.log('🔍 [processarPDFComIA] pdfData recebido, tipo:', typeof pdfData);
      console.log('🔍 [processarPDFComIA] pdfData keys:', Object.keys(pdfData || {}));
      console.log('🔍 [processarPDFComIA] pdfData.text existe?', !!pdfData.text);
      console.log('🔍 [processarPDFComIA] pdfData.doc existe?', !!pdfData.doc);
      
      // Tentar diferentes formas de extrair o texto
      let textoPDF = '';
      if (pdfData.text) {
        textoPDF = pdfData.text;
      } else if (pdfData.doc && pdfData.doc.text) {
        textoPDF = pdfData.doc.text;
      } else if (typeof pdfData === 'string') {
        textoPDF = pdfData;
      } else if (pdfData.toString && typeof pdfData.toString === 'function') {
        textoPDF = pdfData.toString();
      } else if (pdfData.data && pdfData.data.text) {
        textoPDF = pdfData.data.text;
      } else if (pdfData.result && pdfData.result.text) {
        textoPDF = pdfData.result.text;
      }
      
      // Se ainda não tiver texto, verificar se precisa chamar um método
      if (!textoPDF || textoPDF.trim().length === 0) {
        // Tentar chamar métodos comuns
        if (typeof pdfData.getText === 'function') {
          textoPDF = await pdfData.getText();
        } else if (typeof pdfData.extractText === 'function') {
          textoPDF = await pdfData.extractText();
        } else if (typeof pdfData.parse === 'function') {
          textoPDF = await pdfData.parse();
        }
      }

      console.log('🔍 [processarPDFComIA] Texto extraído, length:', textoPDF?.length || 0);

    if (!textoPDF || textoPDF.trim().length === 0) {
      throw new Error('Não foi possível extrair texto do PDF. O arquivo pode estar protegido ou ser uma imagem.');
    }

    // Truncar texto se muito longo (aumentar limite para garantir que não corte)
    const maxTokens = 150000; // Aumentado para garantir documentos grandes
    const textoTruncado = textoPDF.length > maxTokens * 4 
      ? textoPDF.substring(0, maxTokens * 4) + '\n\n[... documento truncado ...]'
      : textoPDF;
    
    // Contar quantas ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" existem no texto
    const ocorrenciasEncontradas = (textoPDF.match(/ICMS\s+EQUALIZAÇÃO\s+SIMPLES\s+NACIONAL/gi) || []).length;
    console.log('🔍 [processarPDFComIA] Ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" no texto:', ocorrenciasEncontradas);
    console.log('🔍 [processarPDFComIA] Texto após truncamento, length:', textoTruncado.length);
    if (textoPDF.length > maxTokens * 4) {
      console.log('⚠️ [processarPDFComIA] ATENÇÃO: Texto foi truncado! Pode haver ocorrências perdidas.');
    }

    // Criar prompt com instruções muito mais enfáticas
    const prompt = `
Você é um especialista em análise de extratos fiscais. Sua tarefa é EXTRAIR TODAS as ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" do documento abaixo.

ARQUIVO: ${nomeArquivo}

CONTEÚDO COMPLETO DO EXTRATO:
${textoTruncado}

═══════════════════════════════════════════════════════════════
INSTRUÇÕES OBRIGATÓRIAS - SEGUIR À RISCA:
═══════════════════════════════════════════════════════════════

1. PROCURE POR TODAS AS OCORRÊNCIAS:
   - Varre o documento COMPLETO do início ao fim
   - Procure por "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" (pode estar em uma ou duas linhas)
   - Procure também por variações como "ICMS EQUALIZAÇÃO SIMPLES\nNACIONAL" ou "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" com espaços diferentes
   - NÃO PARE na primeira, segunda ou terceira ocorrência - continue até o FIM do documento

2. PARA CADA OCORRÊNCIA ENCONTRADA, extraia:
   - Referência: mês/ano no formato MM/AAAA (ex: 06/2022, 08/2022, 10/2022)
   - Pagamento: data no formato DD/MM/AAAA (ex: 03/08/2022)
   - Número DAEMS: número completo do documento
   - Tipo de Tributo: sempre "ICMS EQUALIZAÇÃO SIMPLES NACIONAL"
   - Valor Principal: apenas o valor principal, converta vírgula para ponto (ex: 208,87 → 208.87)

3. EXTRAÇÃO DE DADOS DA EMPRESA:
   - Procure no CABEÇALHO do extrato (primeiras linhas do documento)
   - Procure por "Insc. Estadual:", "Inscrição Estadual:", "IE:", ou variações similares
   - Extraia o NÚMERO REAL da Inscrição Estadual que aparece após esses rótulos
   - Se encontrar, use o número EXATO do documento (não invente números)
   - Se NÃO encontrar, deixe como string vazia "" ou null
   - NUNCA use números fictícios como "123456789" - apenas números reais do documento

4. FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
{
  "empresa": {
    "razao_social": "nome da empresa extraído do documento",
    "inscricao_estadual": "número real da inscrição estadual do documento OU string vazia se não encontrar"
  },
  "itens": [
    {
      "referencia": "06/2022",
      "pagamento": "03/08/2022",
      "numero_daems": "102833710642",
      "tipo_tributo": "ICMS EQUALIZAÇÃO SIMPLES NACIONAL",
      "valor_principal": 208.87
    },
    {
      "referencia": "08/2022",
      "pagamento": "04/10/2022",
      "numero_daems": "103959660875",
      "tipo_tributo": "ICMS EQUALIZAÇÃO SIMPLES NACIONAL",
      "valor_principal": 42.91
    },
    {
      "referencia": "10/2022",
      "pagamento": "12/12/2022",
      "numero_daems": "104551101100",
      "tipo_tributo": "ICMS EQUALIZAÇÃO SIMPLES NACIONAL",
      "valor_principal": 314.39
    }
    // ADICIONE TODAS AS OCORRÊNCIAS ENCONTRADAS - NÃO PARE ATÉ TER VARIDO TODO O DOCUMENTO
  ],
  "total": 565.17
}

5. REGRAS CRÍTICAS:
   - O array "itens" DEVE conter TODAS as ocorrências encontradas
   - Se encontrar 3 ocorrências, retorne 3 itens. Se encontrar 5, retorne 5. Se encontrar 10, retorne 10.
   - Calcule o TOTAL somando TODOS os valores principais
   - Use formato numérico (não string) para valores, com ponto como separador decimal
   - Se não encontrar nenhuma, retorne itens: [] e total: 0.00

6. VERIFICAÇÃO FINAL:
   Antes de retornar, confirme mentalmente:
   - Quantas vezes a palavra "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" aparece no texto?
   - Quantos itens você está retornando no array?
   - Esses números DEVEM SER IGUAIS!
   - A Inscrição Estadual é um número REAL do documento, não um número inventado?

═══════════════════════════════════════════════════════════════
RETORNE APENAS O JSON VÁLIDO, SEM TEXTO ADICIONAL.
═══════════════════════════════════════════════════════════════
`;

    // Chamar OpenAI com formato JSON
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de extratos fiscais do ICMS. Extraia APENAS as informações relacionadas a 'ICMS EQUALIZAÇÃO SIMPLES NACIONAL' e retorne em formato JSON estruturado válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    });

    const respostaIA = completion.choices[0].message.content;
    console.log('📋 Resposta da IA:', respostaIA);
    
    // Tentar parsear o JSON
    let extratoSimplificado;
    try {
      extratoSimplificado = JSON.parse(respostaIA);
      
      // Validar e calcular total se necessário
      if (extratoSimplificado.itens && Array.isArray(extratoSimplificado.itens)) {
        const totalCalculado = extratoSimplificado.itens.reduce((sum, item) => {
          const valor = parseFloat(item.valor_principal) || 0;
          return sum + valor;
        }, 0);
        extratoSimplificado.total = parseFloat(totalCalculado.toFixed(2));
      } else {
        extratoSimplificado.itens = [];
        extratoSimplificado.total = 0.00;
      }
      
      // Garantir que empresa existe
      if (!extratoSimplificado.empresa) {
        extratoSimplificado.empresa = {};
      }
      
      // Retornar como JSON string para armazenar no banco
      return JSON.stringify(extratoSimplificado);
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON da IA:', parseError);
      console.error('❌ Resposta recebida:', respostaIA);
      // Se não conseguir parsear, retornar estrutura vazia
      return JSON.stringify({
        empresa: {},
        itens: [],
        total: 0.00,
        erro: "Erro ao processar extrato"
      });
    }

  } catch (error) {
    console.error('❌ Erro ao processar PDF com IA:', error);
    throw error;
  }
};

// Listar todos os extratos
exports.listarExtratos = async (req, res) => {
  let pool, server;
  try {
    console.log('🔍 Iniciando listagem de extratos ICMS e Equalização...');
    ({ pool, server } = await getDbPoolWithTunnel());
    console.log('✅ Pool de conexão obtido');
    
    await ensureTable(pool);
    console.log('✅ Tabela verificada/criada');

    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = req.headers['x-user-id'] || null;
    console.log('🔍 Organização:', userOrg, 'User ID:', userId);

    // Filtrar por organização se não for Portes
    let query = `
      SELECT 
        ie.*,
        u.nome as created_by_nome,
        u.organizacao as created_by_organizacao
      FROM icms_equalizacao ie
      LEFT JOIN usuarios_cassems u ON ie.created_by = u.id
    `;
    const params = [];

    if (userOrg !== 'portes') {
      // Filtrar por organização do usuário OU registros sem organização (compatibilidade)
      query += ` WHERE (ie.organizacao = ? OR ie.organizacao IS NULL)`;
      params.push(userOrg);
    }
    // Se for "portes", não filtra (mostra todos os registros, incluindo NULL)

    query += ` ORDER BY ie.created_at DESC`;

    console.log('🔍 Executando query:', query);
    console.log('🔍 Parâmetros:', params);
    console.log('🔍 Organização do usuário:', userOrg);
    
    // pool.query do mariadb retorna [rows, fields] para SELECT
    const [rows] = await pool.query(query, params);
    
    // Garantir que rows seja sempre um array
    const rowsArray = Array.isArray(rows) ? rows : (rows ? [rows] : []);
    
    console.log('✅ Extratos encontrados no banco:', rowsArray.length);
    
    if (rowsArray.length > 0) {
      console.log('🔍 Primeiros extratos:');
      rowsArray.slice(0, 3).forEach((row, idx) => {
        console.log(`  [${idx}] ID: ${row.id}, Nome: ${row.nome_arquivo}, Org: ${row.organizacao}, Tamanho: ${row.tamanho_arquivo} (tipo: ${typeof row.tamanho_arquivo})`);
      });
    } else {
      console.log('⚠️ Nenhum extrato encontrado! Verificando se há registros na tabela...');
      // Query de debug para ver todos os registros
      const [debugRows] = await pool.query('SELECT id, nome_arquivo, organizacao FROM icms_equalizacao LIMIT 5');
      const debugArray = Array.isArray(debugRows) ? debugRows : (debugRows ? [debugRows] : []);
      console.log('🔍 Todos os registros na tabela (primeiros 5):', debugArray);
      console.log('🔍 Query executada:', query);
      console.log('🔍 Parâmetros usados:', params);
    }

    // Converter BigInt para Number (necessário porque JSON.stringify não suporta BigInt)
    // Fazer conversão manual linha por linha para garantir que todos os BigInt sejam convertidos
    const processedData = rowsArray.map(row => {
      const converted = {};
      // Usar Object.keys para garantir que pegamos todas as propriedades
      const keys = Object.keys(row);
      for (const key of keys) {
        const value = row[key];
        if (typeof value === 'bigint') {
          converted[key] = Number(value);
        } else if (value === null || value === undefined) {
          converted[key] = value;
        } else if (Array.isArray(value)) {
          converted[key] = value.map(item => typeof item === 'bigint' ? Number(item) : item);
        } else if (typeof value === 'object') {
          // Se for um objeto aninhado, converter recursivamente
          converted[key] = convertBigIntToNumber(value);
        } else {
          converted[key] = value;
        }
      }
      return converted;
    });
    
    console.log('✅ Dados processados e enviados:', processedData.length);
    
    // Verificação final: tentar serializar para garantir que não há BigInt
    let finalData = processedData;
    try {
      JSON.stringify(finalData);
      console.log('✅ JSON válido, sem BigInt');
    } catch (stringifyError) {
      console.error('❌ Erro ao serializar JSON:', stringifyError);
      // Se ainda houver erro, fazer uma última passada de limpeza
      finalData = processedData.map(row => {
        const clean = {};
        for (const key in row) {
          const val = row[key];
          if (typeof val === 'bigint') {
            clean[key] = Number(val);
          } else {
            clean[key] = val;
          }
        }
        return clean;
      });
    }

    res.json({
      success: true,
      data: finalData
    });
  } catch (error) {
    console.error('❌ Erro ao listar extratos:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar extratos',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Upload de extrato
exports.uploadExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = parseInt(req.headers['x-user-id'] || '0');
    
    console.log('🔍 Upload - Organização recebida:', userOrg);
    console.log('🔍 Upload - User ID recebido:', userId);

    const arquivo = req.file;
    const caminhoArquivo = arquivo.path;
    const nomeArquivo = arquivo.originalname;
    const tamanhoArquivo = arquivo.size;
    const mimetype = arquivo.mimetype;

    // Inserir registro no banco com status pendente
    const result = await pool.query(`
      INSERT INTO icms_equalizacao (
        nome_arquivo,
        caminho_arquivo,
        tamanho_arquivo,
        mimetype,
        status_processamento,
        organizacao,
        created_by
      ) VALUES (?, ?, ?, ?, 'pendente', ?, ?)
    `, [nomeArquivo, caminhoArquivo, tamanhoArquivo, mimetype, userOrg || null, userId || null]);
    
    console.log('✅ Registro inserido com organizacao:', userOrg, 'e created_by:', userId);

    // Para INSERT, o resultado pode ser um objeto OkPacket diretamente ou um array
    const insertResult = Array.isArray(result) ? result[0] : result;
    const extratoId = insertResult?.insertId;

    // Se for PDF, marcar como pendente para processamento via streaming
    // O processamento será iniciado pelo frontend via endpoint de streaming
    if (mimetype === 'application/pdf' && openai) {
      await pool.query(`
        UPDATE icms_equalizacao 
        SET status_processamento = 'pendente'
        WHERE id = ?
      `, [extratoId]);
    } else {
      // Se não for PDF ou não tiver OpenAI, marcar como concluído sem processamento
      await pool.query(`
        UPDATE icms_equalizacao 
        SET status_processamento = 'concluido'
        WHERE id = ?
      `, [extratoId]);
    }

    // Buscar registro criado
    const queryResult = await pool.query(`
      SELECT * FROM icms_equalizacao WHERE id = ?
    `, [extratoId]);
    // pool.query retorna [rows, fields], então pegamos o primeiro elemento
    const extrato = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    const extratoArray = Array.isArray(extrato) ? extrato : [];

    // Converter BigInt para Number
    const processedData = convertBigIntToNumber(extratoArray[0] || {});

    res.json({
      success: true,
      message: 'Extrato enviado com sucesso',
      data: processedData
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer upload do extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Buscar extrato específico
exports.buscarExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    let query = `
      SELECT 
        ie.*,
        u.nome as created_by_nome,
        u.organizacao as created_by_organizacao
      FROM icms_equalizacao ie
      LEFT JOIN usuarios_cassems u ON ie.created_by = u.id
      WHERE ie.id = ?
    `;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND ie.organizacao = ?`;
      params.push(userOrg);
    }

    const queryResult = await pool.query(query, params);
    // pool.query retorna [rows, fields], então pegamos o primeiro elemento
    const extrato = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    const extratoArray = Array.isArray(extrato) ? extrato : [];

    if (!extratoArray || extratoArray.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extrato não encontrado'
      });
    }

    // Converter BigInt para Number
    const processedData = convertBigIntToNumber(extratoArray[0]);

    res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    console.error('❌ Erro ao buscar extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Download de extrato
exports.downloadExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    console.log('📥 Download solicitado - ID:', id, 'Org:', userOrg);

    let query = `SELECT * FROM icms_equalizacao WHERE id = ?`;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND organizacao = ?`;
      params.push(userOrg);
    }

    const queryResult = await pool.query(query, params);
    // pool.query retorna [rows, fields], então pegamos o primeiro elemento
    const extrato = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    const extratoArray = Array.isArray(extrato) ? extrato : [];

    console.log('📥 Resultado da query:', extratoArray.length, 'registros encontrados');

    if (!extratoArray || extratoArray.length === 0) {
      console.log('❌ Extrato não encontrado no banco');
      return res.status(404).json({
        success: false,
        error: 'Extrato não encontrado'
      });
    }

    const caminhoArquivo = extratoArray[0].caminho_arquivo;
    console.log('📥 Caminho do arquivo:', caminhoArquivo);
    console.log('📥 Arquivo existe?', fs.existsSync(caminhoArquivo));

    if (!fs.existsSync(caminhoArquivo)) {
      console.log('❌ Arquivo não encontrado no servidor');
      return res.status(404).json({
        success: false,
        error: 'Arquivo não encontrado no servidor'
      });
    }

    // Usar sendFile ao invés de download para melhor compatibilidade com fetch/CORS
    const nomeArquivo = extratoArray[0].nome_arquivo;
    const mimetype = extratoArray[0].mimetype || 'application/octet-stream';
    
    console.log('📥 Enviando arquivo:', nomeArquivo, 'tipo:', mimetype);
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}"`);
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    
    res.sendFile(path.resolve(caminhoArquivo), (err) => {
      if (err) {
        console.error('❌ Erro ao enviar arquivo:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Erro ao enviar arquivo',
            details: err.message
          });
        }
      } else {
        console.log('✅ Arquivo enviado com sucesso');
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer download do extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer download do extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Processar PDF com streaming (Server-Sent Events)
exports.processarPDFStream = async (req, res) => {
  let pool, server;
  try {
    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'Serviço de IA temporariamente indisponível',
        details: 'OpenAI não configurado'
      });
    }

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';
    const userId = parseInt(req.headers['x-user-id'] || '0');

    // Configurar headers para Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-organization, x-user-id');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Função auxiliar para enviar eventos SSE
    const sendEvent = (event, data) => {
      const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(eventData);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    sendEvent('status', { message: 'Buscando extrato...' });

    // Buscar extrato
    let query = `SELECT * FROM icms_equalizacao WHERE id = ?`;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND organizacao = ?`;
      params.push(userOrg);
    }

    const [extrato] = await pool.query(query, params);
    const extratoArray = Array.isArray(extrato) ? extrato : (extrato ? [extrato] : []);

    if (!extratoArray || extratoArray.length === 0) {
      sendEvent('error', { message: 'Extrato não encontrado' });
      res.end();
      return;
    }

    const extratoData = extratoArray[0];

    // Verificar se é PDF
    if (extratoData.mimetype !== 'application/pdf') {
      sendEvent('error', { message: 'Arquivo não é um PDF' });
      res.end();
      return;
    }

    // Atualizar status para processando
    await pool.query(`
      UPDATE icms_equalizacao 
      SET status_processamento = 'processando'
      WHERE id = ?
    `, [id]);

    sendEvent('status', { message: 'Extraindo texto do PDF...' });

    try {
      // Carregar e extrair texto do PDF
      const pdfParse = await loadPdfParse();
      
      if (!pdfParse) {
        throw new Error('pdfParse não foi carregado corretamente');
      }
      
      console.log('🔍 Tipo de pdfParse:', typeof pdfParse);
      console.log('🔍 pdfParse é função?', typeof pdfParse === 'function');
      
      const dataBuffer = fs.readFileSync(extratoData.caminho_arquivo);
      
      // pdf-parse pode ser chamado como função mesmo quando é uma classe
      // Vamos sempre tentar como função primeiro (padrão do pdf-parse)
      let pdfData;
      try {
        if (typeof pdfParse === 'function') {
          // Sempre tentar como função primeiro (mesmo que seja uma classe)
          // O pdf-parse geralmente funciona como função mesmo quando exportado como classe
          console.log('🔍 Tentando pdfParse como função - nome:', pdfParse.name);
          pdfData = await pdfParse(dataBuffer);
        } else {
          throw new Error('pdfParse não é uma função válida');
        }
      } catch (funcError) {
        console.error('❌ Erro ao processar PDF (primeira tentativa):', funcError.message);
        // Se falhar como função, tentar como classe
        try {
          if (funcError.message && funcError.message.includes('cannot be invoked without')) {
            // Tentar como classe
            console.log('🔍 Tentando pdfParse como classe (new) após erro "cannot be invoked without"');
            const instance = new pdfParse(dataBuffer);
            // Verificar se retorna uma Promise
            if (instance && typeof instance.then === 'function') {
              pdfData = await instance;
            } else {
              pdfData = instance;
            }
          } else {
            throw funcError;
          }
        } catch (classError) {
          console.error('❌ Erro ao processar PDF (segunda tentativa):', classError.message);
          throw new Error(`Erro ao processar PDF: ${classError.message}`);
        }
      }
      
      console.log('🔍 pdfData recebido, tipo:', typeof pdfData);
      console.log('🔍 pdfData keys:', Object.keys(pdfData || {}));
      console.log('🔍 pdfData.text existe?', !!pdfData.text);
      console.log('🔍 pdfData.doc existe?', !!pdfData.doc);
      console.log('🔍 pdfData.text length:', pdfData.text?.length || 0);
      
      // Tentar diferentes formas de extrair o texto
      let textoPDF = '';
      if (pdfData.text) {
        textoPDF = pdfData.text;
      } else if (pdfData.doc && pdfData.doc.text) {
        textoPDF = pdfData.doc.text;
      } else if (typeof pdfData === 'string') {
        textoPDF = pdfData;
      } else if (pdfData.toString && typeof pdfData.toString === 'function') {
        textoPDF = pdfData.toString();
      } else if (pdfData.data && pdfData.data.text) {
        textoPDF = pdfData.data.text;
      } else if (pdfData.result && pdfData.result.text) {
        textoPDF = pdfData.result.text;
      }
      
      // Se ainda não tiver texto, verificar se precisa chamar um método
      if (!textoPDF || textoPDF.trim().length === 0) {
        // Tentar chamar métodos comuns
        if (typeof pdfData.getText === 'function') {
          textoPDF = await pdfData.getText();
        } else if (typeof pdfData.extractText === 'function') {
          textoPDF = await pdfData.extractText();
        } else if (typeof pdfData.parse === 'function') {
          textoPDF = await pdfData.parse();
        }
      }

      console.log('🔍 Texto extraído, length:', textoPDF?.length || 0);
      console.log('🔍 Primeiros 200 caracteres:', textoPDF?.substring(0, 200) || 'vazio');
      
      // Contar quantas ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" existem no texto
      const ocorrenciasEncontradas = (textoPDF.match(/ICMS\s+EQUALIZAÇÃO\s+SIMPLES\s+NACIONAL/gi) || []).length;
      console.log('🔍 Ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" no texto:', ocorrenciasEncontradas);
      
      // Procurar por variações também
      const variacoes = [
        { nome: 'Padrão principal', pattern: /ICMS\s+EQUALIZAÇÃO\s+SIMPLES\s+NACIONAL/gi },
        { nome: 'Com ponto', pattern: /ICMS.*EQUALIZAÇÃO.*SIMPLES.*NACIONAL/gi },
        { nome: 'Sem ICMS', pattern: /EQUALIZAÇÃO\s+SIMPLES\s+NACIONAL/gi },
        { nome: 'Case insensitive simples', pattern: /equalização\s+simples\s+nacional/gi }
      ];
      
      variacoes.forEach(({ nome, pattern }) => {
        const matches = textoPDF.match(pattern) || [];
        if (matches.length > 0) {
          console.log(`🔍 ${nome} encontrou ${matches.length} ocorrências`);
          // Mostrar contexto das primeiras 3 ocorrências
          const indices = [];
          let searchIndex = 0;
          for (let i = 0; i < Math.min(3, matches.length); i++) {
            const index = textoPDF.indexOf(matches[i], searchIndex);
            if (index !== -1) {
              indices.push(index);
              searchIndex = index + matches[i].length;
              // Mostrar contexto de 100 caracteres antes e depois
              const inicio = Math.max(0, index - 100);
              const fim = Math.min(textoPDF.length, index + matches[i].length + 100);
              console.log(`   Contexto ${i + 1}: ...${textoPDF.substring(inicio, fim)}...`);
            }
          }
        }
      });

      if (!textoPDF || textoPDF.trim().length === 0) {
        throw new Error('Não foi possível extrair texto do PDF');
      }

      sendEvent('status', { message: 'Texto extraído. Analisando com IA...' });

      // Truncar texto se muito longo (aumentar limite para garantir que não corte)
      const maxTokens = 150000; // Aumentado para garantir documentos grandes
      const textoTruncado = textoPDF.length > maxTokens * 4 
        ? textoPDF.substring(0, maxTokens * 4) + '\n\n[... documento truncado ...]'
        : textoPDF;
      
      console.log('🔍 Texto após truncamento, length:', textoTruncado.length);
      if (textoPDF.length > maxTokens * 4) {
        console.log('⚠️ ATENÇÃO: Texto foi truncado! Pode haver ocorrências perdidas.');
      }

      // Criar prompt com instruções muito mais enfáticas
      const prompt = `
Você é um especialista em análise de extratos fiscais. Sua tarefa é EXTRAIR TODAS as ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" do documento abaixo.

ARQUIVO: ${extratoData.nome_arquivo}

CONTEÚDO COMPLETO DO EXTRATO:
${textoTruncado}

═══════════════════════════════════════════════════════════════
INSTRUÇÕES OBRIGATÓRIAS - SEGUIR À RISCA:
═══════════════════════════════════════════════════════════════

1. PROCURE POR TODAS AS OCORRÊNCIAS:
   - Varre o documento COMPLETO do início ao fim
   - Procure por "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" (pode estar em uma ou duas linhas)
   - Procure também por variações como "ICMS EQUALIZAÇÃO SIMPLES\nNACIONAL" ou "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" com espaços diferentes
   - NÃO PARE na primeira, segunda ou terceira ocorrência - continue até o FIM do documento

2. PARA CADA OCORRÊNCIA ENCONTRADA, extraia:
   - Referência: mês/ano no formato MM/AAAA (ex: 06/2022, 08/2022, 10/2022)
   - Pagamento: data no formato DD/MM/AAAA (ex: 03/08/2022)
   - Número DAEMS: número completo do documento
   - Tipo de Tributo: sempre "ICMS EQUALIZAÇÃO SIMPLES NACIONAL"
   - Valor Principal: apenas o valor principal, converta vírgula para ponto (ex: 208,87 → 208.87)

3. EXTRAÇÃO DE DADOS DA EMPRESA:
   - Procure no CABEÇALHO do extrato (primeiras linhas do documento)
   - Procure por "Insc. Estadual:", "Inscrição Estadual:", "IE:", ou variações similares
   - Extraia o NÚMERO REAL da Inscrição Estadual que aparece após esses rótulos
   - Se encontrar, use o número EXATO do documento (não invente números)
   - Se NÃO encontrar, deixe como string vazia "" ou null
   - NUNCA use números fictícios como "123456789" - apenas números reais do documento

4. FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):
{
  "empresa": {
    "razao_social": "nome da empresa extraído do documento",
    "inscricao_estadual": "número real da inscrição estadual do documento OU string vazia se não encontrar"
  },
  "itens": [
    {
      "referencia": "06/2022",
      "pagamento": "03/08/2022",
      "numero_daems": "102833710642",
      "tipo_tributo": "ICMS EQUALIZAÇÃO SIMPLES NACIONAL",
      "valor_principal": 208.87
    },
    {
      "referencia": "08/2022",
      "pagamento": "04/10/2022",
      "numero_daems": "103959660875",
      "tipo_tributo": "ICMS EQUALIZAÇÃO SIMPLES NACIONAL",
      "valor_principal": 42.91
    },
    {
      "referencia": "10/2022",
      "pagamento": "12/12/2022",
      "numero_daems": "104551101100",
      "tipo_tributo": "ICMS EQUALIZAÇÃO SIMPLES NACIONAL",
      "valor_principal": 314.39
    }
    // ADICIONE TODAS AS OCORRÊNCIAS ENCONTRADAS - NÃO PARE ATÉ TER VARIDO TODO O DOCUMENTO
  ],
  "total": 565.17
}

5. REGRAS CRÍTICAS:
   - O array "itens" DEVE conter TODAS as ocorrências encontradas
   - Se encontrar 3 ocorrências, retorne 3 itens. Se encontrar 5, retorne 5. Se encontrar 10, retorne 10.
   - Calcule o TOTAL somando TODOS os valores principais
   - Use formato numérico (não string) para valores, com ponto como separador decimal
   - Se não encontrar nenhuma, retorne itens: [] e total: 0.00

6. VERIFICAÇÃO FINAL:
   Antes de retornar, confirme mentalmente:
   - Quantas vezes a palavra "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" aparece no texto?
   - Quantos itens você está retornando no array?
   - Esses números DEVEM SER IGUAIS!
   - A Inscrição Estadual é um número REAL do documento, não um número inventado?
   - IMPORTANTE: Se você encontrou pelo menos 1 ocorrência de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" no texto, 
     você DEVE retornar pelo menos 1 item no array "itens". NUNCA retorne um array vazio se encontrou ocorrências!

7. ATENÇÃO ESPECIAL:
   - Se o documento contém "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" mas você não conseguiu extrair os dados completos,
     ainda assim retorne os dados parciais que conseguiu extrair (mesmo que faltem alguns campos).
   - É MELHOR retornar dados incompletos do que retornar um array vazio quando há ocorrências no documento.
   - Se você encontrou a frase mas não conseguiu extrair referência, pagamento ou número DAEMS, 
     use valores padrão como "-" ou null, mas NÃO deixe o array vazio.

═══════════════════════════════════════════════════════════════
RETORNE APENAS O JSON VÁLIDO, SEM TEXTO ADICIONAL.
Se encontrou ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" no texto, 
o array "itens" NÃO PODE estar vazio!
═══════════════════════════════════════════════════════════════
`;

      sendEvent('status', { message: 'IA está processando o extrato...' });

      // Chamar OpenAI com streaming
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em análise de extratos fiscais do ICMS. Extraia APENAS as informações relacionadas a 'ICMS EQUALIZAÇÃO SIMPLES NACIONAL' e retorne em formato JSON estruturado válido."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        stream: true,
        max_tokens: 16000, // Aumentado para garantir espaço para muitos itens
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      let fullText = '';
      let accumulatedChunk = '';
      let lastValidExtrato = null;

      sendEvent('status', { message: 'Recebendo resposta da IA...' });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullText += content;
          accumulatedChunk += content;
          
          // Tentar parsear JSON parcial para enviar extrato sendo construído
          try {
            // Tentar encontrar um JSON válido no texto acumulado
            // Procurar por um objeto JSON completo ou parcial
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const partialExtrato = JSON.parse(jsonMatch[0]);
                // Validar se tem estrutura básica
                if (partialExtrato.itens && Array.isArray(partialExtrato.itens)) {
                  // Calcular total parcial
                  const totalParcial = partialExtrato.itens.reduce((sum, item) => {
                    const valor = parseFloat(item.valor_principal) || 0;
                    return sum + valor;
                  }, 0);
                  partialExtrato.total = parseFloat(totalParcial.toFixed(2));
                  
                  // Só enviar se mudou
                  if (JSON.stringify(partialExtrato) !== JSON.stringify(lastValidExtrato)) {
                    lastValidExtrato = partialExtrato;
                    sendEvent('extrato_parcial', { extrato: partialExtrato });
                  }
                }
              } catch (e) {
                // JSON ainda incompleto, continuar
              }
            }
          } catch (e) {
            // Ignorar erros de parsing parcial
          }
          
          // Enviar chunks de texto para debug (opcional)
          if (accumulatedChunk.length >= 10 || /[\s.,;:!?{}[\]]/.test(content)) {
            // Não enviar mais o texto bruto, apenas o extrato parcial
            accumulatedChunk = '';
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }

      sendEvent('status', { message: 'Processando resultado...' });

      console.log('📝 Texto completo retornado pela IA (primeiros 500 chars):', fullText.substring(0, 500));
      console.log('📝 Texto completo retornado pela IA (últimos 500 chars):', fullText.substring(Math.max(0, fullText.length - 500)));
      console.log('📝 Tamanho total do texto:', fullText.length);

      // Parsear JSON
      let extratoSimplificado;
      try {
        extratoSimplificado = JSON.parse(fullText);
        
        console.log('✅ JSON parseado com sucesso:', {
          temItens: !!extratoSimplificado.itens,
          quantidadeItens: extratoSimplificado.itens?.length || 0,
          temEmpresa: !!extratoSimplificado.empresa,
          empresa: extratoSimplificado.empresa,
          total: extratoSimplificado.total
        });
        
        // Verificar se encontramos ocorrências no texto mas a IA retornou array vazio
        if (ocorrenciasEncontradas > 0 && (!extratoSimplificado.itens || extratoSimplificado.itens.length === 0)) {
          console.error('❌ PROBLEMA DETECTADO:');
          console.error(`   - Encontramos ${ocorrenciasEncontradas} ocorrências de "ICMS EQUALIZAÇÃO SIMPLES NACIONAL" no texto`);
          console.error(`   - Mas a IA retornou ${extratoSimplificado.itens?.length || 0} itens`);
          console.error('   - Isso indica que a IA não conseguiu extrair os dados corretamente');
          console.error('   - Verifique o prompt e o texto enviado para a IA');
        }
        
        // Validar e calcular total
        if (extratoSimplificado.itens && Array.isArray(extratoSimplificado.itens)) {
          console.log('📊 Itens encontrados:', extratoSimplificado.itens.length);
          if (extratoSimplificado.itens.length > 0) {
            console.log('📊 Primeiro item:', JSON.stringify(extratoSimplificado.itens[0], null, 2));
          } else if (ocorrenciasEncontradas > 0) {
            console.warn('⚠️ ATENÇÃO: Array vazio retornado pela IA, mas encontramos ocorrências no texto!');
          }
          const totalCalculado = extratoSimplificado.itens.reduce((sum, item) => {
            const valor = parseFloat(item.valor_principal) || 0;
            return sum + valor;
          }, 0);
          extratoSimplificado.total = parseFloat(totalCalculado.toFixed(2));
        } else {
          console.warn('⚠️ Array de itens não encontrado ou inválido. Criando array vazio.');
          if (ocorrenciasEncontradas > 0) {
            console.warn(`⚠️ Mas encontramos ${ocorrenciasEncontradas} ocorrências no texto!`);
          }
          extratoSimplificado.itens = [];
          extratoSimplificado.total = 0.00;
        }
        
        if (!extratoSimplificado.empresa) {
          extratoSimplificado.empresa = {};
        }
        
        const extratoJSON = JSON.stringify(extratoSimplificado);
        console.log('💾 Extrato final a ser salvo:', extratoJSON.substring(0, 500));

        // Atualizar no banco
        await pool.query(`
          UPDATE icms_equalizacao 
          SET extrato_simplificado = ?,
              status_processamento = 'concluido'
          WHERE id = ?
        `, [extratoJSON, id]);

        sendEvent('complete', { 
          success: true,
          extrato: extratoSimplificado,
          message: 'Extrato processado com sucesso!'
        });

      } catch (parseError) {
        console.error('❌ Erro ao parsear JSON da IA:', parseError);
        await pool.query(`
          UPDATE icms_equalizacao 
          SET status_processamento = 'erro',
              erro_processamento = ?
          WHERE id = ?
        `, [parseError.message, id]);
        
        sendEvent('error', { message: 'Erro ao processar resposta da IA' });
      }

    } catch (error) {
      console.error(`❌ Erro ao processar extrato ${id}:`, error);
      await pool.query(`
        UPDATE icms_equalizacao 
        SET status_processamento = 'erro',
            erro_processamento = ?
        WHERE id = ?
      `, [error.message, id]);
      
      sendEvent('error', { message: error.message || 'Erro ao processar PDF' });
    }

    res.end();
  } catch (error) {
    console.error('❌ Erro no processamento streaming:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } else {
      const sendEvent = (event, data) => {
        const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        res.write(eventData);
      };
      sendEvent('error', { message: error.message });
      res.end();
    }
  } finally {
    if (server) server.close();
  }
};

// Remover extrato
exports.removerExtrato = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureTable(pool);

    const { id } = req.params;
    const userOrg = req.headers['x-user-organization'] || 'cassems';

    // Buscar extrato antes de remover
    let query = `SELECT * FROM icms_equalizacao WHERE id = ?`;
    const params = [id];

    if (userOrg !== 'portes') {
      query += ` AND organizacao = ?`;
      params.push(userOrg);
    }

    const queryResult = await pool.query(query, params);
    // pool.query retorna [rows, fields], então pegamos o primeiro elemento
    const extrato = Array.isArray(queryResult) ? queryResult[0] : queryResult;
    const extratoArray = Array.isArray(extrato) ? extrato : (extrato ? [extrato] : []);

    if (!extratoArray || extratoArray.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extrato não encontrado'
      });
    }

    // Remover arquivo físico
    const caminhoArquivo = extratoArray[0].caminho_arquivo;
    if (fs.existsSync(caminhoArquivo)) {
      try {
        fs.unlinkSync(caminhoArquivo);
      } catch (error) {
        console.warn('⚠️ Erro ao remover arquivo físico:', error);
      }
    }

    // Remover do banco
    await pool.query(`DELETE FROM icms_equalizacao WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: 'Extrato removido com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao remover extrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover extrato',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Exportar multer para uso nas rotas
exports.upload = upload;

