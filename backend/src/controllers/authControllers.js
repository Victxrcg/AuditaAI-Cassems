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

    // Buscar usuário por email
    const rows = await pool.query(`SELECT * FROM usuarios_cassems WHERE email = ?`, [email]);

    console.log('🔍 Debug login - Email:', email);
    console.log(' Debug login - Rows:', rows);

    // Verificar se encontrou usuário
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0]; // ✅ pegar o primeiro elemento do array
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

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      user
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

    // Hash da senha (simplificado - produção: bcrypt)
    const hashedPassword = senha; // ou Buffer.from(senha).toString('base64');

    const result = await pool.query(
      `INSERT INTO usuarios_cassems (nome, email, senha, perfil, ativo) VALUES (?, ?, ?, ?, 1)`,
      [nome, email, hashedPassword, perfil]
    );

    // Buscar o usuário criado (sem senha)
    const newUserRows = await pool.query(
      `SELECT id, nome, email, perfil, ativo, created_at FROM usuarios_cassems WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      user: newUserRows[0]
    });
  } catch (err) {
    console.error('❌ Erro no registro:', err);
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
