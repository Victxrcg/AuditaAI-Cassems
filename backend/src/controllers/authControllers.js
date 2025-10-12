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
    const rows = await pool.execute(`
      SELECT 
        id, nome, nome_empresa, email, senha, perfil, ativo, created_at, updated_at,
        organizacao, permissoes, cor_identificacao
      FROM usuarios_cassems 
      WHERE email = ?
    `, [email]);

    console.log('🔍 Debug login - Email:', email);
    console.log('🔍 Debug login - Rows:', rows);

    // Verificar se encontrou usuário
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0];
    console.log('👤 User encontrado:', user);
    console.log('👤 Senha recebida:', senha);
    console.log('🔑 Senha no banco:', user.senha);

    // Verificar se o usuário está ativo
    if (user.ativo !== 1) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    // Verificar senha - tentar tanto texto plano quanto hash
    let senhaValida = false;
    
    // Primeiro tenta com texto plano (senhas antigas)
    if (user.senha === senha) {
      console.log('✅ Senha válida (texto plano)');
      senhaValida = true;
    } else {
      // Depois tenta com hash base64 (senhas resetadas)
      const hashedPassword = Buffer.from(senha).toString('base64');
      console.log('�� Hash gerado:', hashedPassword);
      console.log('🔑 Comparando com banco:', user.senha === hashedPassword);
      
      if (user.senha === hashedPassword) {
        console.log('✅ Senha válida (hash base64)');
        senhaValida = true;
      }
    }

    if (!senhaValida) {
      console.log('❌ Senha inválida');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Remover senha antes de enviar
    delete user.senha;

    // Adicionar informações de organização para o frontend
    const userWithOrg = {
      ...user,
      organizacao_nome: user.nome_empresa || (user.organizacao === 'portes' ? 'Portes' : 'Cassems'),
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
    const { nome, email, senha, nomeEmpresa, perfil = 'visualizador' } = req.body;

    if (!nome || !email || !senha || !nomeEmpresa) {
      return res.status(400).json({ error: 'Nome, email, senha e nome da empresa são obrigatórios' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar se email já existe
    const existingUser = await pool.query(`SELECT id FROM usuarios_cassems WHERE email = ?`, [email]);

    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }

    // Determinar organização baseada no email e nome da empresa
    let organizacao = 'cassems';
    let cor_identificacao = '#3B82F6';
    
    // Se for email da Portes, sempre é portes
    if (email.includes('@portes.com')) {
      organizacao = 'portes';
      cor_identificacao = '#10B981';
    }
    // Se o nome da empresa contém "Portes", também é portes
    else if (nomeEmpresa && nomeEmpresa.toLowerCase().includes('portes')) {
      organizacao = 'portes';
      cor_identificacao = '#10B981';
    }
    // Se o nome da empresa contém "Rede Frota", é uma organização específica
    else if (nomeEmpresa && nomeEmpresa.toLowerCase().includes('rede frota')) {
      organizacao = 'rede_frota';
      cor_identificacao = '#8B5CF6'; // Cor roxa para Rede Frota
    }
    // Para outras empresas, usar o nome da empresa como organização (normalizado)
    else if (nomeEmpresa && nomeEmpresa.trim()) {
      // Normalizar nome da empresa para usar como organização
      organizacao = nomeEmpresa.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '_') // Substitui espaços por underscore
        .substring(0, 50); // Limita tamanho
      cor_identificacao = '#6366F1'; // Cor azul padrão para organizações terceiras
    }
    // Caso contrário, é cassems (padrão)
    else {
      organizacao = 'cassems';
      cor_identificacao = '#3B82F6';
    }

    // Hash da senha (simplificado - produção: bcrypt)
    const hashedPassword = senha;

    const result = await pool.query(
      `INSERT INTO usuarios_cassems (nome, nome_empresa, email, senha, perfil, ativo, organizacao, cor_identificacao) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [nome, nomeEmpresa, email, hashedPassword, perfil, organizacao, cor_identificacao]
    );

    // Buscar o usuário criado (sem senha)
    const newUserRows = await pool.query(
      `SELECT 
        id, nome, nome_empresa, email, perfil, ativo, created_at, 
        organizacao, permissoes, cor_identificacao
      FROM usuarios_cassems 
      WHERE id = ?`,
      [result.insertId]
    );

    const newUser = newUserRows[0];
    const userWithOrg = {
      ...newUser,
      organizacao_nome: newUser.nome_empresa || (newUser.organizacao === 'portes' ? 'Portes' : 'Cassems'),
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
        id, nome, nome_empresa, email, perfil, ativo, created_at, updated_at,
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
      organizacao_nome: user.nome_empresa || (user.organizacao === 'portes' ? 'Portes' : 'Cassems'),
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

// Resetar senha
exports.resetPassword = async (req, res) => {
  let pool, server;
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'ID do usuário é obrigatório' 
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar se usuário existe
    const user = await pool.execute(`
      SELECT id, nome, email FROM usuarios_cassems WHERE id = ?
    `, [userId]);

    if (user.length === 0) {
      return res.status(404).json({ 
        error: 'Usuário não encontrado' 
      });
    }

    // Resetar senha para "123456" (padrão)
    const defaultPassword = "123456";
    const hashedPassword = Buffer.from(defaultPassword).toString('base64');

    await pool.execute(`
      UPDATE usuarios_cassems 
      SET senha = ?, updated_at = NOW()
      WHERE id = ?
    `, [hashedPassword, userId]);

    console.log(` Senha resetada para usuário ${user[0].nome} (${user[0].email})`);

    res.json({
      success: true,
      message: 'Senha resetada com sucesso',
      data: {
        userId: user[0].id,
        nome: user[0].nome,
        email: user[0].email,
        novaSenha: defaultPassword
      }
    });
  } catch (err) {
    console.error('❌ Erro ao resetar senha:', err);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: err.message
    });
  }
};
