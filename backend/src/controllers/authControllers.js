// backend/src/controllers/authControllers.js
const { getDbPoolWithTunnel } = require('../lib/db');

// Login
exports.login = async (req, res) => {
  let pool, server;
  try {
    console.log("📩 Body recebido no login:", req.body);

    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Buscar usuário por email incluindo campos de organização
    const rows = await pool.query(`
      SELECT 
        id, nome, email, senha, perfil, ativo, created_at, updated_at,
        organizacao, permissoes, cor_identificacao
      FROM usuarios_cassems 
      WHERE email = ?
    `, [email]);

    console.log('🔍 Debug login - Email:', email);
    console.log(' Debug login - Rows:', rows);

    // Verificar se encontrou usuário
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0];
    console.log(' User encontrado:', user);

    // Verificar se o usuário está ativo
    if (user.ativo !== 1) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    // Verificar senha (simplificado - produção: bcrypt)
    if (user.senha !== senha) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Remover senha antes de enviar
    delete user.senha;

    // Adicionar informações de organização para o frontend
    const userWithOrg = {
      ...user,
      organizacao_nome: user.organizacao === 'portes' ? 'Portes' : 'Cassems',
      cor_primaria: user.cor_identificacao,
      cor_secundaria: user.organizacao === 'portes' ? '#D1FAE5' : '#DBEAFE'
    };

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: userWithOrg
    });
  } catch (err) {
    console.error('❌ Erro no login:', err);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: err.message
    });
  }
};

// Registrar usuário
exports.registrar = async (req, res) => {
  let pool, server;
  try {
    const { nome, email, senha, perfil = 'visualizador' } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar se email já existe
    const existingUser = await pool.query(`SELECT id FROM usuarios_cassems WHERE email = ?`, [email]);

    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }

    // Determinar organização baseada no email
    let organizacao = 'cassems';
    let cor_identificacao = '#3B82F6';
    
    if (email.includes('@portes.com')) {
      organizacao = 'portes';
      cor_identificacao = '#10B981';
    }

    // Hash da senha (simplificado - produção: bcrypt)
    const hashedPassword = senha;

    const result = await pool.query(
      `INSERT INTO usuarios_cassems (nome, email, senha, perfil, ativo, organizacao, cor_identificacao) VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [nome, email, hashedPassword, perfil, organizacao, cor_identificacao]
    );

    // Buscar o usuário criado (sem senha)
    const newUserRows = await pool.query(
      `SELECT 
        id, nome, email, perfil, ativo, created_at, 
        organizacao, permissoes, cor_identificacao
      FROM usuarios_cassems 
      WHERE id = ?`,
      [result.insertId]
    );

    const newUser = newUserRows[0];
    const userWithOrg = {
      ...newUser,
      organizacao_nome: newUser.organizacao === 'portes' ? 'Portes' : 'Cassems',
      cor_primaria: newUser.cor_identificacao,
      cor_secundaria: newUser.organizacao === 'portes' ? '#D1FAE5' : '#DBEAFE'
    };

    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      user: userWithOrg
    });
  } catch (err) {
    console.error('❌ Erro no registro:', err);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: err.message
    });
  }
};

// Obter informações do usuário atual
exports.getCurrentUser = async (req, res) => {
  let pool, server;
  try {
    const { userId } = req.params;

    ({ pool, server } = await getDbPoolWithTunnel());

    const rows = await pool.query(`
      SELECT 
        id, nome, email, perfil, ativo, created_at, updated_at,
        organizacao, permissoes, cor_identificacao
      FROM usuarios_cassems 
      WHERE id = ?
    `, [userId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = rows[0];
    const userWithOrg = {
      ...user,
      organizacao_nome: user.organizacao === 'portes' ? 'Portes' : 'Cassems',
      cor_primaria: user.cor_identificacao,
      cor_secundaria: user.organizacao === 'portes' ? '#D1FAE5' : '#DBEAFE'
    };

    res.json({
      success: true,
      data: userWithOrg
    });
  } catch (err) {
    console.error('❌ Erro ao obter usuário:', err);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: err.message
    });
  }
};

// Verificar token (para futuras implementações)
exports.verificarToken = async (req, res) => {
  res.json({
    success: true,
    message: 'Token válido'
  });
};
