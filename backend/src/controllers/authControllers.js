// backend/src/controllers/authControllers.js
const { getDbPoolWithTunnel } = require('../lib/db');
const { normalizeOrganizationCode } = require('../utils/normalizeOrganization');
const nodemailer = require('nodemailer');

// In-memory store for verification codes (email => { code, expiresAt })
const emailVerificationStore = new Map();

// Create mail transporter from env or noop fallback
function createMailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Boolean(process.env.SMTP_SECURE === 'true'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Fallback transporter that logs emails in dev environments
  return {
    sendMail: async (options) => {
      console.log('📧 [DEV] Email enviado (simulado):', options);
      return { messageId: 'dev-simulated' };
    }
  };
}
const mailer = createMailTransporter();

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
    const { nome, email, senha, nomeEmpresa, perfil = 'usuario', organizacaoCodigo } = req.body;
    // Também aceita código de organização via query param (para links diretos)
    const orgCodigoFromQuery = req.query.org || organizacaoCodigo;

    // Se tiver código de organização na query/body, não precisa de nomeEmpresa
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Se não tiver código de organização, nomeEmpresa é obrigatório
    if (!orgCodigoFromQuery && !nomeEmpresa) {
      return res.status(400).json({ error: 'Nome da empresa ou código de organização é obrigatório' });
    }

    ({ pool, server } = await getDbPoolWithTunnel());

    // Verificar se email já existe
    const existingUser = await pool.query(`SELECT id, ativo FROM usuarios_cassems WHERE email = ?`, [email]);

    if (existingUser && existingUser.length > 0) {
      const user = existingUser[0];
      // Se o usuário existe mas está inativo, permitir reenvio do código
      if (user.ativo === 0) {
        // Gerar novo código de verificação
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos
        emailVerificationStore.set(email, { code, expiresAt });
        
        const appName = process.env.APP_NAME || 'Compliance App';
        const from = process.env.SMTP_FROM || 'no-reply@portes.com.br';
        await mailer.sendMail({
          from,
          to: email,
          subject: `${appName} - Confirme seu email`,
          text: `Bem-vindo ao ${appName}! Seu código de verificação é: ${code}. Expira em 10 minutos.`,
          html: `<div style="font-family: Arial, sans-serif; line-height:1.6;">
            <h2>Bem-vindo ao ${appName}!</h2>
            <p>Use o código abaixo para confirmar seu email e ativar sua conta:</p>
            <div style="font-size:28px; font-weight:bold; letter-spacing:6px;">${code}</div>
            <p style="color:#555;">O código expira em 10 minutos.</p>
          </div>`
        });
        
        return res.status(400).json({ 
          error: 'Email já cadastrado mas não verificado', 
          needsVerification: true,
          message: 'Reenviamos um novo código de verificação para seu email.'
        });
      }
      // Se está ativo, não permitir cadastro novamente
      return res.status(400).json({ error: 'Email já está em uso e verificado' });
    }

    // Criar tabela de organizações se não existir (compatibilidade)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS organizacoes (
          id INT(11) NOT NULL AUTO_INCREMENT,
          nome VARCHAR(255) NOT NULL,
          codigo VARCHAR(100) NOT NULL UNIQUE,
          cor_identificacao VARCHAR(7) DEFAULT '#3B82F6',
          ativa TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY idx_codigo (codigo),
          KEY idx_ativa (ativa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (err) {
      console.log('Tabela organizacoes já existe ou erro ao criar:', err.message);
    }

    // Determinar organização
    let organizacao = 'cassems';
    let cor_identificacao = '#3B82F6';
    
    // Se tiver código de organização fornecido (link direto), usar ele
    if (orgCodigoFromQuery) {
      organizacao = normalizeOrganizationCode(orgCodigoFromQuery);
      
      // Buscar organização na tabela para pegar cor e nome
      try {
        const [orgExiste] = await pool.query(
          'SELECT id, cor_identificacao, nome FROM organizacoes WHERE codigo = ?',
          [organizacao]
        );

        if (orgExiste && orgExiste.length > 0) {
          cor_identificacao = orgExiste[0].cor_identificacao || cor_identificacao;
          // Se não tiver nomeEmpresa, usar o nome da organização
          if (!nomeEmpresa) {
            nomeEmpresa = orgExiste[0].nome;
          }
        } else {
          // Organização não existe, criar automaticamente
          const nomeOrg = nomeEmpresa || 
            organizacao.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          
          await pool.query(`
            INSERT INTO organizacoes (nome, codigo, cor_identificacao, ativa)
            VALUES (?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE nome = VALUES(nome)
          `, [nomeOrg, organizacao, cor_identificacao]);
          
          console.log(`✅ Organização criada automaticamente via link direto: ${nomeOrg} (${organizacao})`);
        }
      } catch (err) {
        console.log('⚠️ Erro ao verificar/criar organização via código (continuando):', err.message);
      }
    }
    // Caso contrário, determinar organização baseada no email e nome da empresa (comportamento original)
    else {
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
    }

    // Definir perfil baseado na organização: Portes = admin, outras = usuario
    const perfilFinal = organizacao === 'portes' ? 'admin' : (perfil || 'usuario');
    
    // Buscar organização na tabela ou criar se não existir (apenas se não foi criada acima)
    if (!orgCodigoFromQuery) {
      try {
        const [orgExiste] = await pool.query(
          'SELECT id, cor_identificacao FROM organizacoes WHERE codigo = ?',
          [organizacao]
        );

        if (orgExiste && orgExiste.length > 0) {
          // Usar cor da tabela se existir
          cor_identificacao = orgExiste[0].cor_identificacao || cor_identificacao;
        } else {
          // Criar organização automaticamente se não existir
          const nomeOrg = nomeEmpresa || 
            (organizacao === 'portes' ? 'PORTES ADVOGADOS' : 
             organizacao === 'cassems' ? 'CASSEMS' : 
             organizacao === 'rede_frota' ? 'MARAJÓ / REDE FROTA' : 
             organizacao.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '));
          
          await pool.query(`
            INSERT INTO organizacoes (nome, codigo, cor_identificacao, ativa)
            VALUES (?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE nome = VALUES(nome)
          `, [nomeOrg, organizacao, cor_identificacao]);
          
          console.log(`✅ Organização criada automaticamente: ${nomeOrg} (${organizacao})`);
        }
      } catch (err) {
        console.log('⚠️ Erro ao verificar/criar organização na tabela (continuando com padrão):', err.message);
        // Continuar com valores padrão se houver erro
      }
    }

    // Hash da senha (simplificado - produção: bcrypt)
    const hashedPassword = senha;

    const result = await pool.query(
      `INSERT INTO usuarios_cassems (nome, nome_empresa, email, senha, perfil, ativo, organizacao, cor_identificacao) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [nome, nomeEmpresa, email, hashedPassword, perfilFinal, organizacao, cor_identificacao]
    );

    // Enviar código de verificação para ativar a conta
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos
    emailVerificationStore.set(email, { code, expiresAt });
    const appName = process.env.APP_NAME || 'Compliance App';
    const from = process.env.SMTP_FROM || 'no-reply@portes.com.br';
    await mailer.sendMail({
      from,
      to: email,
      subject: `${appName} - Confirme seu email` ,
      text: `Bem-vindo ao ${appName}! Seu código de verificação é: ${code}. Expira em 10 minutos.`,
      html: `<div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>Bem-vindo ao ${appName}!</h2>
        <p>Use o código abaixo para confirmar seu email e ativar sua conta:</p>
        <div style="font-size:28px; font-weight:bold; letter-spacing:6px;">${code}</div>
        <p style="color:#555;">O código expira em 10 minutos.</p>
      </div>`
    });

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
      message: 'Usuário registrado. Enviamos um código para confirmar o email.',
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

// Enviar código de verificação por email
exports.sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos
    emailVerificationStore.set(email, { code, expiresAt });

    const appName = process.env.APP_NAME || 'Compliance App';
    const from = process.env.SMTP_FROM || 'no-reply@portes.com.br';

    await mailer.sendMail({
      from,
      to: email,
      subject: `${appName} - Código de verificação`,
      text: `Seu código de verificação é: ${code}. Ele expira em 10 minutos.`,
      html: `<div style="font-family: Arial, sans-serif; line-height:1.6;">
        <h2>${appName}</h2>
        <p>Use o código abaixo para concluir o acesso:</p>
        <div style="font-size:28px; font-weight:bold; letter-spacing:6px;">${code}</div>
        <p style="color:#555;">O código expira em 10 minutos.</p>
      </div>`
    });

    // Nunca expor o código na resposta
    return res.json({ success: true, message: 'Código enviado' });
  } catch (err) {
    console.error('❌ Erro ao enviar código de verificação:', err);
    return res.status(500).json({ error: 'Falha ao enviar código' });
  }
};

// Verificar código de verificação
exports.verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'Email e código são obrigatórios' });
    }

    const entry = emailVerificationStore.get(email);
    if (!entry) {
      return res.status(400).json({ error: 'Solicite um novo código' });
    }
    if (Date.now() > entry.expiresAt) {
      emailVerificationStore.delete(email);
      return res.status(400).json({ error: 'Código expirado' });
    }
    if (entry.code !== code) {
      return res.status(400).json({ error: 'Código inválido' });
    }
    // Código válido: consumir e confirmar; ativar usuário se existir
    emailVerificationStore.delete(email);

    try {
      let pool, server;
      ({ pool, server } = await getDbPoolWithTunnel());
      await pool.execute(`UPDATE usuarios_cassems SET ativo = 1, updated_at = NOW() WHERE email = ?`, [email]);
      if (server) server.close();
    } catch (e) {
      console.warn('Aviso: falha ao ativar usuário após verificação:', e.message);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao verificar código:', err);
    return res.status(500).json({ error: 'Falha na verificação' });
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
