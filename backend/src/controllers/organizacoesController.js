// backend/src/controllers/organizacoesController.js
const { getDbPoolWithTunnel, executeQueryWithRetry } = require('../lib/db');

// Função helper para verificar se usuário é Portes
const isPortesUser = (userOrganization) => {
  return userOrganization && userOrganization.toLowerCase() === 'portes';
};

// Criar tabela organizacoes se não existir
const criarTabelaOrganizacoes = async (pool) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizacoes (
        id INT(11) NOT NULL AUTO_INCREMENT,
        nome VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        cor_identificacao VARCHAR(7) DEFAULT '#3B82F6',
        ativa TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_slug (slug),
        KEY idx_ativa (ativa)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Tabela organizacoes criada/verificada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar tabela organizacoes:', error);
    throw error;
  }
};

// Migrar organizações existentes da tabela usuarios_cassems
const migrarOrganizacoesExistentes = async (pool) => {
  try {
    // Buscar todas as organizações únicas dos usuários
    const organizacoesExistentes = await pool.query(`
      SELECT DISTINCT organizacao 
      FROM usuarios_cassems 
      WHERE organizacao IS NOT NULL AND organizacao != ''
      ORDER BY organizacao
    `);

    const orgsArray = Array.isArray(organizacoesExistentes) ? organizacoesExistentes : (organizacoesExistentes[0] ? [organizacoesExistentes[0]] : []);
    console.log(`🔍 Encontradas ${orgsArray.length} organizações para migrar`);

    // Mapear organizações conhecidas para nomes amigáveis
    const mapeamentoNomes = {
      'cassems': { nome: 'CASSEMS', cor: '#3B82F6' },
      'portes': { nome: 'PORTES ADVOGADOS', cor: '#10B981' },
      'rede_frota': { nome: 'MARAJÓ / REDE FROTA', cor: '#8B5CF6' }
    };

    let inseridas = 0;
    for (const org of orgsArray) {
      const slug = org.organizacao.toLowerCase().trim();
      
      // Verificar se já existe
      const existentes = await pool.query(
        'SELECT id FROM organizacoes WHERE slug = ?',
        [slug]
      );
      
      const exists = Array.isArray(existentes) ? existentes.length > 0 : existentes && existentes[0];

      if (!exists) {
        // Usar mapeamento ou gerar nome a partir do slug
        const config = mapeamentoNomes[slug] || {
          nome: slug.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
          cor: '#6366F1'
        };

        await pool.query(`
          INSERT INTO organizacoes (nome, slug, cor_identificacao, ativa)
          VALUES (?, ?, ?, 1)
        `, [config.nome, slug, config.cor]);

        inseridas++;
        console.log(`✅ Organização migrada: ${config.nome} (${slug})`);
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
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    // Apenas Portes pode ver todas as organizações
    if (!isPortesUser(userOrganization)) {
      return res.status(403).json({
        error: 'Acesso negado',
        details: 'Apenas usuários Portes podem listar organizações'
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Criar tabela se não existir
    await criarTabelaOrganizacoes(pool);
    
    // Migrar organizações existentes se necessário
    await migrarOrganizacoesExistentes(pool);

    const rows = await pool.query(`
      SELECT 
        o.*,
        COUNT(u.id) as total_usuarios
      FROM organizacoes o
      LEFT JOIN usuarios_cassems u ON u.organizacao = o.slug
      GROUP BY o.id
      ORDER BY o.nome ASC
    `);

    res.json({
      success: true,
      data: Array.isArray(rows) ? rows : rows[0] ? [rows[0]] : []
    });
  } catch (error) {
    console.error('❌ Erro ao listar organizações:', error);
    res.status(500).json({
      error: 'Erro ao listar organizações',
      details: error.message
    });
  } finally {
    if (server) server.close();
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
        COUNT(u.id) as total_usuarios
      FROM organizacoes o
      LEFT JOIN usuarios_cassems u ON u.organizacao = o.slug
      WHERE o.id = ?
      GROUP BY o.id
    `, [id]);

    const rowsArray = Array.isArray(rows) ? rows : (rows && rows[0] ? [rows[0]] : []);

    if (rowsArray.length === 0) {
      return res.status(404).json({
        error: 'Organização não encontrada'
      });
    }

    res.json({
      success: true,
      data: rowsArray[0]
    });
  } catch (error) {
    console.error('❌ Erro ao buscar organização:', error);
    res.status(500).json({
      error: 'Erro ao buscar organização',
      details: error.message
    });
  } finally {
    if (server) server.close();
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

    const { nome, slug, cor_identificacao } = req.body;

    if (!nome || !slug) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: 'Nome e slug são obrigatórios'
      });
    }

    // Normalizar slug
    const slugNormalizado = slug.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .substring(0, 100);

    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Criar tabela se não existir
    await criarTabelaOrganizacoes(pool);

    // Verificar se slug já existe
    const existentes = await pool.query(
      'SELECT id FROM organizacoes WHERE slug = ?',
      [slugNormalizado]
    );

    const exists = Array.isArray(existentes) ? existentes.length > 0 : (existentes && existentes[0]);

    if (exists) {
      return res.status(400).json({
        error: 'Slug já existe',
        details: 'Já existe uma organização com este slug'
      });
    }

    const cor = cor_identificacao || '#6366F1';

    const result = await pool.query(`
      INSERT INTO organizacoes (nome, slug, cor_identificacao, ativa)
      VALUES (?, ?, ?, 1)
    `, [nome, slugNormalizado, cor]);

    const insertId = result.insertId ? result.insertId : (Array.isArray(result) && result[0]?.insertId) || result[0]?.insertId;

    // Buscar organização criada
    const novaOrga = await pool.query(`
      SELECT * FROM organizacoes WHERE id = ?
    `, [insertId]);
    
    const novaOrgaArray = Array.isArray(novaOrga) ? novaOrga : (novaOrga && novaOrga[0] ? [novaOrga[0]] : []);

    res.status(201).json({
      success: true,
      message: 'Organização criada com sucesso',
      data: novaOrgaArray[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar organização:', error);
    res.status(500).json({
      error: 'Erro ao criar organização',
      details: error.message
    });
  } finally {
    if (server) server.close();
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

    const { nome, slug, cor_identificacao, ativa } = req.body;

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

    // Se mudou o slug, verificar se não conflita
    if (slug && slug !== existentesArray[0].slug) {
      const slugNormalizado = slug.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')
        .substring(0, 100);

      const conflito = await pool.query(
        'SELECT id FROM organizacoes WHERE slug = ? AND id != ?',
        [slugNormalizado, id]
      );
      
      const conflitoArray = Array.isArray(conflito) ? conflito : (conflito && conflito[0] ? [conflito[0]] : []);

      if (conflitoArray.length > 0) {
        return res.status(400).json({
          error: 'Slug já existe',
          details: 'Já existe outra organização com este slug'
        });
      }

      // Atualizar slug na tabela usuarios_cassems também
      await pool.query(
        'UPDATE usuarios_cassems SET organizacao = ? WHERE organizacao = ?',
        [slugNormalizado, existentesArray[0].slug]
      );
    }

    // Construir query de atualização
    const updates = [];
    const params = [];

    if (nome !== undefined) {
      updates.push('nome = ?');
      params.push(nome);
    }

    if (slug !== undefined) {
      const slugNormalizado = slug.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')
        .substring(0, 100);
      updates.push('slug = ?');
      params.push(slugNormalizado);
    }

    if (cor_identificacao !== undefined) {
      updates.push('cor_identificacao = ?');
      params.push(cor_identificacao);
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

    await pool.query(`
      UPDATE organizacoes 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `, params);

    // Buscar organização atualizada
    const atualizada = await pool.query(`
      SELECT * FROM organizacoes WHERE id = ?
    `, [id]);
    
    const atualizadaArray = Array.isArray(atualizada) ? atualizada : (atualizada && atualizada[0] ? [atualizada[0]] : []);

    res.json({
      success: true,
      message: 'Organização atualizada com sucesso',
      data: atualizadaArray[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar organização:', error);
    res.status(500).json({
      error: 'Erro ao atualizar organização',
      details: error.message
    });
  } finally {
    if (server) server.close();
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
      [existentesArray[0].slug]
    );
    
    const usuariosArray = Array.isArray(usuarios) ? usuarios : (usuarios && usuarios[0] ? [usuarios[0]] : []);

    if (usuariosArray[0]?.total > 0) {
      return res.status(400).json({
        error: 'Não é possível excluir',
        details: `Existem ${usuariosArray[0].total} usuário(s) vinculado(s) a esta organização. Transfira os usuários antes de excluir.`
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
    if (server) server.close();
  }
};

