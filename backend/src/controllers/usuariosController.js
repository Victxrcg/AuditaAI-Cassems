// backend/src/controllers/usuariosController.js
const { getDbPoolWithTunnel } = require('../lib/db');

// Listar todos os usuários
exports.listarUsuarios = async (req, res) => {
  let pool, server;
  try {
    // Obter organização do usuário logado (se fornecido via header ou query)
    const userOrganization = req.headers['x-user-organization'] || req.query.organizacao;
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
    let query = `
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
        cor_identificacao,
        permissoes
      FROM usuarios_cassems
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
    const { nome, email, senha, perfil = 'visualizador', ativo = true } = req.body;
    
    if (!nome || !email || !senha) {
      return res.status(400).json({ 
        error: 'Nome, email e senha são obrigatórios' 
      });
    }
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
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
    const { nome, email, perfil, ativo, organizacao } = req.body;
    
    // Validar perfil
    if (perfil && !['admin', 'compliance'].includes(perfil)) {
      return res.status(400).json({ 
        error: 'Perfil inválido. Use apenas "admin" ou "compliance"' 
      });
    }
    
    ({ pool, server } = await getDbPoolWithTunnel());
    
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
    if (permissoes !== undefined) {
      if (typeof permissoes === 'string') {
        // Se já é string JSON, validar
        try {
          JSON.parse(permissoes);
          permissoesJSON = permissoes;
        } catch {
          // Se não for JSON válido, tratar como array simples
          permissoesJSON = JSON.stringify(permissoes ? [permissoes] : []);
        }
      } else if (Array.isArray(permissoes)) {
        permissoesJSON = JSON.stringify(permissoes);
      } else if (permissoes === null || permissoes === '') {
        permissoesJSON = null;
      }
    }

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
    `, [nome, email, perfil, ativo, organizacao, permissoesJSON, id]);
    
    // Buscar o usuário atualizado
    const [updatedUser] = await pool.query(`
      SELECT id, nome, nome_empresa, email, perfil, ativo, created_at, updated_at, organizacao, cor_identificacao, permissoes
      FROM usuarios_cassems WHERE id = ?
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

