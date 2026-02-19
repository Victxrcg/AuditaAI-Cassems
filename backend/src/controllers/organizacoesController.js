// backend/src/controllers/organizacoesController.js
const { getDbPoolWithTunnel, executeQueryWithRetry } = require('../lib/db');
const { normalizeOrganizationCode } = require('../utils/normalizeOrganization');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Função helper para verificar se usuário é Portes
const isPortesUser = (userOrganization) => {
  return userOrganization && userOrganization.toLowerCase() === 'portes';
};

// Configurar multer para upload de logos
const logosDir = path.join(process.cwd(), 'backend', 'uploads', 'logos');
fs.mkdirSync(logosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logosDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(ext, '');
    cb(null, `logo-${unique}-${safeName}${ext}`);
  }
});

exports.uploadLogo = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  },
  fileFilter: (_req, file, cb) => {
    // Aceitar apenas imagens
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos (jpeg, jpg, png, gif, webp, svg)'));
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
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  
  return obj;
};

// Criar tabela organizacoes se não existir e migrar slug para codigo se necessário
const criarTabelaOrganizacoes = async (pool) => {
  try {
    // Primeiro, tentar criar a tabela (pode já existir)
    try {
      const createQuery = `
        CREATE TABLE IF NOT EXISTS organizacoes (
          id INT(11) NOT NULL AUTO_INCREMENT,
          nome VARCHAR(255) NOT NULL,
          codigo VARCHAR(100) NOT NULL UNIQUE,
          cor_identificacao VARCHAR(7) DEFAULT '#3B82F6',
          logo_url VARCHAR(500) DEFAULT NULL,
          ativa TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY idx_codigo (codigo),
          KEY idx_ativa (ativa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      await pool.query(createQuery);
      console.log('✅ Tabela organizacoes criada/verificada');
    } catch (createError) {
      console.log('⚠️ Erro ao criar tabela (pode já existir):', createError.message);
    }

    // Verificar se precisa migrar slug para codigo
    try {
      const columnsResult = await pool.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'organizacoes' 
        AND COLUMN_NAME IN ('slug', 'codigo')
      `);
      
      const columnsArray = Array.isArray(columnsResult) ? columnsResult : (columnsResult && columnsResult[0] ? (Array.isArray(columnsResult[0]) ? columnsResult[0] : [columnsResult[0]]) : []);
      const columnNames = columnsArray.map(c => c.COLUMN_NAME || c.column_name || c.COLUMN_NAME || c.column_name);
      const hasSlug = columnNames.some(name => name && name.toLowerCase() === 'slug');
      const hasCodigo = columnNames.some(name => name && name.toLowerCase() === 'codigo');
      
      console.log('🔍 Verificando colunas - hasSlug:', hasSlug, 'hasCodigo:', hasCodigo);
      
      if (hasSlug && !hasCodigo) {
        // Migrar slug para codigo
        console.log('🔄 Migrando coluna slug para codigo...');
        
        // Primeiro, remover índices antigos (MySQL não suporta IF EXISTS, então usamos try/catch)
        try {
          await pool.query(`ALTER TABLE organizacoes DROP INDEX slug`);
          console.log('✅ Índice slug removido');
        } catch (e) {
          console.log('⚠️ Índice slug não encontrado ou já removido');
        }
        try {
          await pool.query(`ALTER TABLE organizacoes DROP INDEX idx_slug`);
          console.log('✅ Índice idx_slug removido');
        } catch (e) {
          console.log('⚠️ Índice idx_slug não encontrado ou já removido');
        }
        
        // Renomear coluna slug para codigo (isso preserva os dados)
        await pool.query(`ALTER TABLE organizacoes CHANGE COLUMN slug codigo VARCHAR(100) NOT NULL`);
        console.log('✅ Coluna renomeada de slug para codigo');
        
        // Criar novo índice único para codigo (se ainda não existir)
        try {
          await pool.query(`ALTER TABLE organizacoes ADD UNIQUE KEY idx_codigo (codigo)`);
          console.log('✅ Índice idx_codigo criado');
        } catch (e) {
          // Pode já existir ou ter sido criado automaticamente pelo UNIQUE na coluna
          console.log('⚠️ Índice idx_codigo pode já existir:', e.message);
        }
        
        console.log('✅ Coluna slug migrada para codigo com sucesso');
      } else if (!hasCodigo && !hasSlug) {
        // Adicionar coluna codigo se não existir nenhuma das duas
        console.log('🔄 Adicionando coluna codigo...');
        // Primeiro adicionar sem UNIQUE para permitir valores NULL temporários
        await pool.query(`ALTER TABLE organizacoes ADD COLUMN codigo VARCHAR(100) AFTER nome`);
        // Preencher com valores baseados em nome ou id
        await pool.query(`UPDATE organizacoes SET codigo = LOWER(REPLACE(REPLACE(REPLACE(nome, ' ', '_'), '/', '_'), '-', '_')) WHERE codigo IS NULL`);
        // Tornar NOT NULL e UNIQUE
        await pool.query(`ALTER TABLE organizacoes MODIFY COLUMN codigo VARCHAR(100) NOT NULL`);
        try {
          await pool.query(`ALTER TABLE organizacoes ADD UNIQUE KEY idx_codigo (codigo)`);
        } catch (e) {
          console.log('⚠️ Não foi possível criar índice único (pode haver duplicatas)');
        }
        console.log('✅ Coluna codigo adicionada com sucesso');
      } else {
        console.log('✅ Coluna codigo já existe, nenhuma migração necessária');
      }

      // Verificar se precisa adicionar coluna logo_url
      const logoUrlCheck = await pool.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'organizacoes' 
        AND COLUMN_NAME = 'logo_url'
      `);
      
      const logoUrlArray = Array.isArray(logoUrlCheck) ? logoUrlCheck : (logoUrlCheck && logoUrlCheck[0] ? (Array.isArray(logoUrlCheck[0]) ? logoUrlCheck[0] : [logoUrlCheck[0]]) : []);
      const hasLogoUrl = logoUrlArray.length > 0;
      
      if (!hasLogoUrl) {
        console.log('🔄 Adicionando coluna logo_url...');
        await pool.query(`ALTER TABLE organizacoes ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL AFTER cor_identificacao`);
        console.log('✅ Coluna logo_url adicionada com sucesso');
      } else {
        console.log('✅ Coluna logo_url já existe');
      }
    } catch (migrationError) {
      console.error('⚠️ Erro ao verificar/migrar colunas (continuando):', migrationError.message);
      console.error('⚠️ Stack:', migrationError.stack);
      // Continuar mesmo se a migração falhar - a tabela pode já estar correta
    }
    
    console.log('✅ Tabela organizacoes verificada/migrada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar/migrar tabela organizacoes:', error);
    // Não lançar erro para não bloquear o fluxo
    console.error('⚠️ Continuando mesmo com erro na tabela...');
  }
};

// Migrar organizações existentes da tabela usuarios_cassems
const migrarOrganizacoesExistentes = async (pool) => {
  try {
    // Buscar todas as organizações únicas dos usuários
    const result = await pool.query(`
      SELECT DISTINCT organizacao 
      FROM usuarios_cassems 
      WHERE organizacao IS NOT NULL AND organizacao != ''
      ORDER BY organizacao
    `);
    
    // MariaDB pode retornar array direto ou resultado em formato específico
    const orgsArray = Array.isArray(result) ? result : (result && result[0] ? (Array.isArray(result[0]) ? result[0] : [result[0]]) : []);
    console.log(`🔍 Encontradas ${orgsArray.length} organizações para migrar`);

    // Mapear organizações conhecidas para nomes amigáveis
    const mapeamentoNomes = {
      'cassems': { nome: 'CASSEMS', cor: '#3B82F6' },
      'portes': { nome: 'PORTES ADVOGADOS', cor: '#10B981' },
      'rede_frota': { nome: 'MARAJÓ / REDE FROTA', cor: '#8B5CF6' },
      'marajó / rede frota': { nome: 'MARAJÓ / REDE FROTA', cor: '#8B5CF6' }
    };

    let inseridas = 0;
    for (const org of orgsArray) {
      const codigoOriginal = org.organizacao;
      const codigo = normalizeOrganizationCode(codigoOriginal);
      
      // Verificar se já existe
      const existentesResult = await pool.query(
        'SELECT id FROM organizacoes WHERE codigo = ?',
        [codigo]
      );
      
      const existentesArray = Array.isArray(existentesResult) ? existentesResult : (existentesResult && existentesResult[0] ? (Array.isArray(existentesResult[0]) ? existentesResult[0] : [existentesResult[0]]) : []);
      const exists = existentesArray.length > 0;

      if (!exists) {
        // Usar mapeamento ou gerar nome a partir do codigo
        const config = mapeamentoNomes[codigo] || {
          nome: codigo.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
          cor: '#6366F1'
        };

        await pool.query(`
          INSERT INTO organizacoes (nome, codigo, cor_identificacao, ativa)
          VALUES (?, ?, ?, 1)
        `, [config.nome, codigo, config.cor]);

        inseridas++;
        console.log(`✅ Organização migrada: ${config.nome} (${codigo})`);
      }

      // Atualizar usuários com codigo variante para usar o canônico
      if (codigoOriginal !== codigo) {
        await pool.query(
          'UPDATE usuarios_cassems SET organizacao = ? WHERE organizacao = ?',
          [codigo, codigoOriginal]
        );
        console.log(`✅ Usuários atualizados: ${codigoOriginal} -> ${codigo}`);
      }
    }

    console.log(`✅ Migração concluída: ${inseridas} organizações inseridas`);
    return inseridas;
  } catch (error) {
    console.error('❌ Erro ao migrar organizações:', error);
    throw error;
  }
};

// Listar todas as organizações
exports.listarOrganizacoes = async (req, res) => {
  let pool, server;
  try {
    console.log('🔍 Iniciando listagem de organizações...');
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    console.log('🔍 Organização do usuário:', userOrganization);
    
    // Apenas Portes pode ver todas as organizações
    if (!isPortesUser(userOrganization)) {
      console.log('❌ Acesso negado - usuário não é Portes');
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem listar organizações'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    console.log('✅ Pool obtido com sucesso');
    
    // Criar tabela se não existir
    console.log('🔍 Criando/verificando tabela organizacoes...');
    await criarTabelaOrganizacoes(pool);
    console.log('✅ Tabela verificada');
    
    // Migrar organizações existentes se necessário
    try {
      console.log('🔍 Iniciando migração de organizações...');
      await migrarOrganizacoesExistentes(pool);
      console.log('✅ Migração concluída');
    } catch (migrationError) {
      console.error('⚠️ Erro na migração (continuando):', migrationError.message);
      console.error('⚠️ Stack:', migrationError.stack);
      // Continuar mesmo se a migração falhar
    }

    // Usar executeQueryWithRetry para garantir retry automático
    const { executeQueryWithRetry } = require('../lib/db');
    
    console.log('🔍 Buscando organizações do banco...');
    let rows;
    try {
      rows = await executeQueryWithRetry(`
        SELECT 
          o.id,
          o.nome,
          o.codigo,
          o.cor_identificacao,
          o.ativa,
          o.logo_url,
          o.created_at,
          o.updated_at,
          (SELECT COUNT(*) FROM usuarios_cassems u WHERE u.organizacao = o.codigo) as total_usuarios
        FROM organizacoes o
        ORDER BY o.nome ASC
      `);
      console.log('✅ Query executada com sucesso');
      console.log('🔍 Resultado tipo:', typeof rows);
      console.log('🔍 Resultado é array?', Array.isArray(rows));
      console.log('🔍 Total de linhas:', Array.isArray(rows) ? rows.length : 'N/A');
    } catch (queryError) {
      console.error('❌ Erro na query:', queryError);
      console.error('❌ Stack:', queryError.stack);
      throw queryError;
    }

    // Processar resultado e converter BigInt para Number
    const rowsArray = Array.isArray(rows) ? rows : (rows && rows[0] ? [rows[0]] : []);
    console.log('🔍 Organizações processadas:', rowsArray.length);

    // Converter BigInt para Number (necessário porque JSON.stringify não suporta BigInt)
    let processedData = convertBigIntToNumber(rowsArray);

    // Remover duplicatas - preferir org "marajó / rede frota" (id 8 com logo)
    const mapeamentoNomesResposta = {
      'marajó / rede frota': 'MARAJÓ / REDE FROTA',
      rede_frota: 'MARAJÓ / REDE FROTA',
      cassems: 'CASSEMS',
      portes: 'PORTES ADVOGADOS'
    };
    // Ordenar para manter a org cujo codigo já é o canônico (ex: "marajó / rede frota" com logo)
    processedData.sort((a, b) => {
      const canonA = normalizeOrganizationCode(a.codigo);
      const canonB = normalizeOrganizationCode(b.codigo);
      const matchA = a.codigo === canonA ? 1 : 0;
      const matchB = b.codigo === canonB ? 1 : 0;
      return matchB - matchA;
    });
    const codigosCanonicos = new Set();
    processedData = processedData.filter((org) => {
      const canonico = normalizeOrganizationCode(org.codigo);
      if (codigosCanonicos.has(canonico)) return false;
      codigosCanonicos.add(canonico);
      org.codigo = canonico;
      if (mapeamentoNomesResposta[canonico]) org.nome = mapeamentoNomesResposta[canonico];
      return true;
    });

    res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    console.error('❌ Erro ao listar organizações:', error);
    console.error('❌ Stack completo:', error.stack);
    res.status(500).json({
      error: 'Erro ao listar organizações',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar server (ignorando):', closeError.message);
      }
    }
  }
};

// Buscar organização por ID
exports.buscarOrganizacao = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    // Apenas Portes pode buscar qualquer organização
    if (!isPortesUser(userOrganization)) {
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem buscar organizações'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM usuarios_cassems u WHERE u.organizacao = o.codigo) as total_usuarios
      FROM organizacoes o
      WHERE o.id = ?
    `, [id]);

    const rowsArray = Array.isArray(rows) ? rows : (rows && rows[0] ? [rows[0]] : []);

    if (rowsArray.length === 0) {
      return res.status(404).json({
        error: 'Organização não encontrada'
      });
    }

    // Converter BigInt para Number
    const processedData = convertBigIntToNumber(rowsArray[0]);

    res.json({
      success: true,
      data: processedData
    });
  } catch (error) {
    console.error('❌ Erro ao buscar organização:', error);
    res.status(500).json({
      error: 'Erro ao buscar organização',
      details: error.message
    });
  } finally {
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar server (ignorando):', closeError.message);
      }
    }
  }
};

// Criar nova organização
exports.criarOrganizacao = async (req, res) => {
  let pool, server;
  try {
    const userOrganization = req.headers['x-user-organization'] || req.body.organizacao;
    
    // Apenas Portes pode criar organizações
    if (!isPortesUser(userOrganization)) {
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem criar organizações'
      });
    }

    const { nome, codigo, cor_identificacao, logo_url } = req.body;

    if (!nome || !codigo) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: 'Nome e código são obrigatórios'
      });
    }

    // Normalizar codigo
    const codigoNormalizado = codigo.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .substring(0, 100);

    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Criar tabela se não existir
    await criarTabelaOrganizacoes(pool);

    // Verificar se codigo já existe
    const existentes = await pool.query(
      'SELECT id FROM organizacoes WHERE codigo = ?',
      [codigoNormalizado]
    );

    const exists = Array.isArray(existentes) ? existentes.length > 0 : (existentes && existentes[0]);

    if (exists) {
      return res.status(400).json({
        error: 'Código já existe',
        details: 'Já existe uma organização com este código'
      });
    }

    const cor = cor_identificacao || '#6366F1';

    const result = await pool.query(`
      INSERT INTO organizacoes (nome, codigo, cor_identificacao, logo_url, ativa)
      VALUES (?, ?, ?, ?, 1)
    `, [nome, codigoNormalizado, cor, logo_url || null]);

    const insertId = result.insertId ? result.insertId : (Array.isArray(result) && result[0]?.insertId) || result[0]?.insertId;

    // Buscar organização criada
    const novaOrga = await pool.query(`
      SELECT * FROM organizacoes WHERE id = ?
    `, [insertId]);
    
    const novaOrgaArray = Array.isArray(novaOrga) ? novaOrga : (novaOrga && novaOrga[0] ? [novaOrga[0]] : []);

    // Converter BigInt para Number
    const processedData = convertBigIntToNumber(novaOrgaArray[0]);

    res.status(201).json({
      success: true,
      message: 'Organização criada com sucesso',
      data: processedData
    });
  } catch (error) {
    console.error('❌ Erro ao criar organização:', error);
    res.status(500).json({
      error: 'Erro ao criar organização',
      details: error.message
    });
  } finally {
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar server (ignorando):', closeError.message);
      }
    }
  }
};

// Atualizar organização
exports.atualizarOrganizacao = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const userOrganization = req.headers['x-user-organization'] || req.body.organizacao;
    
    // Apenas Portes pode atualizar organizações
    if (!isPortesUser(userOrganization)) {
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem atualizar organizações'
      });
    }

    const { nome, codigo, cor_identificacao, logo_url, ativa } = req.body;

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar se organização existe
    const existentes = await pool.query(
      'SELECT * FROM organizacoes WHERE id = ?',
      [id]
    );
    
    const existentesArray = Array.isArray(existentes) ? existentes : (existentes && existentes[0] ? [existentes[0]] : []);

    if (existentesArray.length === 0) {
      return res.status(404).json({
        error: 'Organização não encontrada'
      });
    }

    // Se mudou o codigo, verificar se não conflita
    if (codigo && codigo !== existentesArray[0].codigo) {
      const codigoNormalizado = codigo.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')
        .substring(0, 100);

      const conflito = await pool.query(
        'SELECT id FROM organizacoes WHERE codigo = ? AND id != ?',
        [codigoNormalizado, id]
      );
      
      const conflitoArray = Array.isArray(conflito) ? conflito : (conflito && conflito[0] ? [conflito[0]] : []);

      if (conflitoArray.length > 0) {
        return res.status(400).json({
          error: 'Código já existe',
          details: 'Já existe outra organização com este código'
        });
      }

      // Atualizar codigo na tabela usuarios_cassems também
      await pool.query(
        'UPDATE usuarios_cassems SET organizacao = ? WHERE organizacao = ?',
        [codigoNormalizado, existentesArray[0].codigo]
      );
    }

    // Construir query de atualização
    const updates = [];
    const params = [];

    if (nome !== undefined) {
      updates.push('nome = ?');
      params.push(nome);
    }

    if (codigo !== undefined) {
      // Verificar se o código está sendo alterado
      const codigoAtual = existentesArray[0].codigo;
      
      if (codigo !== codigoAtual) {
        // Se o código está mudando, normalizar apenas para verificar conflitos
        const codigoNormalizado = codigo.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '_')
          .replace(/-+/g, '_')
          .substring(0, 100);

        const conflito = await pool.query(
          'SELECT id FROM organizacoes WHERE codigo = ? AND id != ?',
          [codigoNormalizado, id]
        );
        
        const conflitoArray = Array.isArray(conflito) ? conflito : (conflito && conflito[0] ? [conflito[0]] : []);

        if (conflitoArray.length > 0) {
          return res.status(400).json({
            error: 'Código já existe',
            details: 'Já existe outra organização com este código'
          });
        }

        // Atualizar codigo na tabela usuarios_cassems também
        await pool.query(
          'UPDATE usuarios_cassems SET organizacao = ? WHERE organizacao = ?',
          [codigoNormalizado, codigoAtual]
        );
        
        updates.push('codigo = ?');
        params.push(codigoNormalizado);
      } else {
        // Se o código não mudou, NÃO atualizar (manter o código original)
        console.log('🔍 Código não alterado, mantendo código original:', codigoAtual);
      }
    }

    if (cor_identificacao !== undefined) {
      updates.push('cor_identificacao = ?');
      params.push(cor_identificacao);
    }

    if (logo_url !== undefined) {
      updates.push('logo_url = ?');
      params.push(logo_url || null);
    }

    if (ativa !== undefined) {
      updates.push('ativa = ?');
      params.push(ativa ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Nenhum campo para atualizar'
      });
    }

    params.push(id);

    console.log('🔍 Atualizando organização:', {
      id,
      updates: updates.join(', '),
      params: params.slice(0, -1), // Excluir o id do log
      logo_url: logo_url
    });

    await pool.query(`
      UPDATE organizacoes 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `, params);

    console.log('✅ Organização atualizada com sucesso');

    // Buscar organização atualizada
    const atualizada = await pool.query(`
      SELECT * FROM organizacoes WHERE id = ?
    `, [id]);
    
    const atualizadaArray = Array.isArray(atualizada) ? atualizada : (atualizada && atualizada[0] ? [atualizada[0]] : []);

    // Converter BigInt para Number
    const processedData = convertBigIntToNumber(atualizadaArray[0]);

    res.json({
      success: true,
      message: 'Organização atualizada com sucesso',
      data: processedData
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar organização:', error);
    res.status(500).json({
      error: 'Erro ao atualizar organização',
      details: error.message
    });
  } finally {
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar server (ignorando):', closeError.message);
      }
    }
  }
};

// Upload de logo da organização
exports.uploadLogoOrganizacao = async (req, res) => {
  let pool, server;
  try {
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    // Apenas Portes pode fazer upload de logos
    if (!isPortesUser(userOrganization)) {
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem fazer upload de logos'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Nenhum arquivo enviado',
        details: 'Por favor, selecione uma imagem para fazer upload'
      });
    }

    // Construir URL relativa para acessar o arquivo
    // A URL será acessível via uma rota de serviço estático
    const logoUrl = `/api/organizacoes/logos/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Logo enviada com sucesso',
      logo_url: logoUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload de logo:', error);
    res.status(500).json({
      error: 'Erro ao fazer upload de logo',
      details: error.message
    });
  }
};

// Servir logos estáticas
exports.servirLogo = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(logosDir, filename);
    
    console.log('🔍 Tentando servir logo:', filename);
    console.log('🔍 Caminho completo:', filePath);
    console.log('🔍 Arquivo existe?', fs.existsSync(filePath));
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Logo não encontrada no caminho:', filePath);
      return res.status(404).json({ error: 'Logo não encontrada' });
    }

    // Detectar tipo MIME baseado na extensão
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    const contentType = mimeTypes[ext] || 'image/jpeg';
    
    // Enviar arquivo com headers apropriados
    res.setHeader('Content-Type', contentType);
    res.sendFile(path.resolve(filePath));
    console.log('✅ Logo servida com sucesso:', filename);
  } catch (error) {
    console.error('❌ Erro ao servir logo:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: 'Erro ao servir logo', details: error.message });
  }
};

// Deletar organização
exports.deletarOrganizacao = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    // Apenas Portes pode deletar organizações
    if (!isPortesUser(userOrganization)) {
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem deletar organizações'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar se organização existe
    const existentes = await pool.query(
      'SELECT * FROM organizacoes WHERE id = ?',
      [id]
    );
    
    const existentesArray = Array.isArray(existentes) ? existentes : (existentes && existentes[0] ? [existentes[0]] : []);

    if (existentesArray.length === 0) {
      return res.status(404).json({
        error: 'Organização não encontrada'
      });
    }

    // Verificar se há usuários vinculados
    const usuarios = await pool.query(
      'SELECT COUNT(*) as total FROM usuarios_cassems WHERE organizacao = ?',
      [existentesArray[0].codigo]
    );
    
    const usuariosArray = Array.isArray(usuarios) ? usuarios : (usuarios && usuarios[0] ? [usuarios[0]] : []);
    
    // Converter BigInt para Number
    const usuariosProcessed = convertBigIntToNumber(usuariosArray);
    const totalUsuarios = usuariosProcessed[0]?.total ? Number(usuariosProcessed[0].total) : 0;

    if (totalUsuarios > 0) {
      return res.status(400).json({
        error: 'Não é possível excluir',
        details: `Existem ${totalUsuarios} usuário(s) vinculado(s) a esta organização. Transfira os usuários antes de excluir.`
      });
    }

    // Deletar organização
    await pool.query('DELETE FROM organizacoes WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Organização excluída com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar organização:', error);
    res.status(500).json({
      error: 'Erro ao deletar organização',
      details: error.message
    });
  } finally {
    if (server && typeof server.close === 'function') {
      try {
        server.close();
      } catch (closeError) {
        console.error('⚠️ Erro ao fechar server (ignorando):', closeError.message);
      }
    }
  }
};

