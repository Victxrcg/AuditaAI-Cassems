// backend/src/controllers/usuariosController.js
const { getDbPoolWithTunnel } = require('../lib/db');
const { normalizeOrganizationCode } = require('../utils/normalizeOrganization');

// Função para migrar enum de perfil para aceitar apenas 'admin' e 'usuario'
const migrarEnumPerfil = async (pool) => {
  try {
    // Verificar o tipo atual da coluna perfil
    const [columnInfo] = await pool.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'usuarios_cassems' 
      AND COLUMN_NAME = 'perfil'
    `);
    
    if (columnInfo && columnInfo.length > 0) {
      const columnType = (columnInfo[0].COLUMN_TYPE || '').toLowerCase();

      // Se a coluna não está exatamente com o enum esperado, executar migração
      if (!columnType.includes("enum('admin','usuario'")) {
        console.log('🔧 Ajustando coluna "perfil" para aceitar somente admin/usuario...');

        // Converter perfis antigos/inválidos para 'usuario'
        await pool.query(`
          UPDATE usuarios_cassems 
          SET perfil = 'usuario' 
          WHERE perfil NOT IN ('admin', 'usuario') OR perfil IS NULL OR perfil = ''
        `);

        // Alterar o tipo da coluna para o novo enum
        await pool.query(`
          ALTER TABLE usuarios_cassems 
          MODIFY COLUMN perfil ENUM('admin', 'usuario') DEFAULT 'usuario'
        `);

        console.log('✅ Coluna "perfil" ajustada com sucesso');
      }
    }
  } catch (err) {
    console.warn('⚠️ Aviso ao migrar enum de perfil (pode já estar atualizado):', err.message);
    // Não bloquear se a migração falhar - pode ser que já esteja atualizado
  }
};

// Listar todos os usuários
exports.listarUsuarios = async (req, res) => {
  let pool, server;
  try {
    // Obter organização do usuário logado (se fornecido via header ou query)
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Migrar enum se necessário (executar uma vez)
    await migrarEnumPerfil(pool);
    
    let query = `
      SELECT 
        u.id,
        u.nome,
        u.nome_empresa,
        u.email,
        u.perfil,
        u.ativo,
        u.created_at,
        u.updated_at,
        u.organizacao,
        u.cor_identificacao,
        u.permissoes,
        o.nome as organizacao_nome
      FROM usuarios_cassems u
      LEFT JOIN organizacoes o ON u.organizacao = o.codigo
    `;
    
    let params = [];
    
    // Se não for Portes, filtrar apenas usuários da mesma organização
    if (userOrganization && userOrganization !== 'portes') {
      query += ` WHERE organizacao = ?`;
      params.push(userOrganization);
    }
    
    query += ` ORDER BY nome ASC`;
    
    console.log('🔍 Query executada:', query);
    console.log('🔍 Parâmetros:', params);
    console.log('🔍 Organização do usuário:', userOrganization);
    
    const rows = await pool.execute(query, params);
    
    console.log(' Debug - Tipo de retorno:', typeof rows);
    console.log(' Debug - É array:', Array.isArray(rows));
    console.log('🔍 Debug - Usuários encontrados:', rows.length);
    console.log(' Debug - Dados:', rows);
    
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar usuários:', err);
    res.status(500).json({ 
      error: 'Erro ao buscar usuários', 
      details: err.message 
    });
  }
};

// Buscar usuário específico
exports.buscarUsuario = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Migrar enum se necessário
    await migrarEnumPerfil(pool);
    
    const [rows] = await pool.query(`
      SELECT 
        id,
        nome,
        nome_empresa,
        email,
        perfil,
        ativo,
        created_at,
        updated_at,
        organizacao,
        cor_identificacao
      FROM usuarios_cassems
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Erro ao buscar usuário:', err);
    res.status(500).json({ 
      error: 'Erro ao buscar usuário', 
      details: err.message 
    });
  }
};

// Criar novo usuário
exports.criarUsuario = async (req, res) => {
  let pool, server;
  try {
    const { nome, email, senha, perfil = 'usuario', ativo = true } = req.body;
    
    if (!nome || !email || !senha) {
      return res.status(400).json({ 
        error: 'Nome, email e senha são obrigatórios' 
      });
    }
    
    ({ pool, server } = await getDbPoolWithTunnel());

    // Garantir que a coluna perfil está com enum atualizado
    await migrarEnumPerfil(pool);
    
    // Verificar se email já existe
    const [existingUser] = await pool.query(`
      SELECT id FROM usuarios_cassems WHERE email = ?
    `, [email]);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ 
        error: 'Email já está em uso' 
      });
    }
    
    // Hash da senha (simplificado - em produção usar bcrypt)
    const hashedPassword = Buffer.from(senha).toString('base64');
    
    const [result] = await pool.query(`
      INSERT INTO usuarios_cassems (nome, email, senha, perfil, ativo)
      VALUES (?, ?, ?, ?, ?)
    `, [nome, email, hashedPassword, perfil, ativo]);
    
    // Buscar o usuário criado (sem senha)
    const [newUser] = await pool.query(`
      SELECT id, nome, email, perfil, ativo, created_at
      FROM usuarios_cassems WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: newUser[0]
    });
  } catch (err) {
    console.error('❌ Erro ao criar usuário:', err);
    res.status(500).json({ 
      error: 'Erro ao criar usuário', 
      details: err.message 
    });
  }
};

// Atualizar usuário
exports.atualizarUsuario = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    const { nome, email, perfil, ativo, organizacao, permissoes } = req.body;
    
    // Validar perfil - apenas admin (Portes) ou usuario (outras empresas)
    if (perfil && !['admin', 'usuario'].includes(perfil)) {
      return res.status(400).json({ 
        error: 'Perfil inválido. Use apenas "admin" (usuários Portes) ou "usuario" (outras empresas)' 
      });
    }
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Migrar enum se necessário
    await migrarEnumPerfil(pool);
    
    // Verificar se usuário existe
    const [existingUser] = await pool.query(`
      SELECT id FROM usuarios_cassems WHERE id = ?
    `, [id]);
    
    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se email já existe em outro usuário
    if (email) {
      const [emailCheck] = await pool.query(`
        SELECT id FROM usuarios_cassems WHERE email = ? AND id != ?
      `, [email, id]);
      
      if (emailCheck.length > 0) {
        return res.status(400).json({ 
          error: 'Email já está em uso por outro usuário' 
        });
      }
    }
    
    // Processar permissoes - converter para JSON se necessário
    let permissoesJSON = null;
    if (permissoes !== undefined && permissoes !== null) {
      if (typeof permissoes === 'string') {
        // Se já é string JSON, validar
        try {
          const parsed = JSON.parse(permissoes);
          // Se parseou com sucesso, manter como string JSON
          permissoesJSON = permissoes;
        } catch {
          // Se não for JSON válido, tratar como string simples e converter para array
          permissoesJSON = permissoes.trim() !== '' ? JSON.stringify([permissoes]) : null;
        }
      } else if (Array.isArray(permissoes)) {
        // Se for array, converter para JSON string
        permissoesJSON = permissoes.length > 0 ? JSON.stringify(permissoes) : null;
      }
    } else if (permissoes === null || permissoes === '') {
      // Se for null ou string vazia, manter como null
      permissoesJSON = null;
    }

    // Normalizar código da organização para evitar duplicatas (ex: "marajó / rede frota" -> "rede_frota")
    const organizacaoNormalizada = organizacao != null ? normalizeOrganizationCode(organizacao) : null;

    await pool.query(`
      UPDATE usuarios_cassems 
      SET nome = COALESCE(?, nome),
          email = COALESCE(?, email),
          perfil = COALESCE(?, perfil),
          ativo = COALESCE(?, ativo),
          organizacao = COALESCE(?, organizacao),
          permissoes = COALESCE(?, permissoes),
          updated_at = NOW()
      WHERE id = ?
    `, [nome, email, perfil, ativo, organizacao != null ? organizacaoNormalizada : organizacao, permissoesJSON, id]);
    
    // Buscar o usuário atualizado com nome da organização
    const [updatedUser] = await pool.query(`
      SELECT 
        u.id, 
        u.nome, 
        u.nome_empresa, 
        u.email, 
        u.perfil, 
        u.ativo, 
        u.created_at, 
        u.updated_at, 
        u.organizacao, 
        u.cor_identificacao, 
        u.permissoes,
        o.nome as organizacao_nome
      FROM usuarios_cassems u
      LEFT JOIN organizacoes o ON u.organizacao = o.codigo
      WHERE u.id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: updatedUser[0]
    });
  } catch (err) {
    console.error('❌ Erro ao atualizar usuário:', err);
    res.status(500).json({ 
      error: 'Erro ao atualizar usuário', 
      details: err.message 
    });
  }
};

// Deletar usuário
exports.deletarUsuario = async (req, res) => {
  let pool, server;
  try {
    const { id } = req.params;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Verificar se usuário existe
    const [existingUser] = await pool.query(`
      SELECT id FROM usuarios_cassems WHERE id = ?
    `, [id]);
    
    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    await pool.query('DELETE FROM usuarios_cassems WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (err) {
    console.error('❌ Erro ao deletar usuário:', err);
    res.status(500).json({ 
      error: 'Erro ao deletar usuário', 
      details: err.message 
    });
  }
};

// Listar todas as organizações únicas
exports.listarOrganizacoes = async (req, res) => {
  let pool, server;
  try {
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.execute(`
      SELECT DISTINCT 
        organizacao,
        COUNT(*) as total_usuarios,
        MIN(created_at) as primeira_criacao,
        MAX(created_at) as ultima_criacao
      FROM usuarios_cassems 
      GROUP BY organizacao
      ORDER BY total_usuarios DESC
    `);
    
    console.log('🔍 Organizações encontradas:', rows.length);
    
    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar organizações:', err);
    res.status(500).json({ 
      error: 'Erro ao buscar organizações', 
      details: err.message 
    });
  }
};

