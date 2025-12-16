// backend/src/controllers/complianceFirstAccessController.js
const { getDbPoolWithTunnel, executeQueryWithRetry } = require('../lib/db');

// Garantir que a tabela existe
const ensureFirstAccessTable = async (pool) => {
  try {
    await executeQueryWithRetry(`
      CREATE TABLE IF NOT EXISTS compliance_first_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tipo_compliance VARCHAR(50) NOT NULL,
        dados_cadastro JSON NOT NULL,
        assinado_gov BOOLEAN DEFAULT FALSE,
        token_assinatura_gov VARCHAR(500) NULL,
        data_assinatura_gov DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_compliance (user_id, tipo_compliance),
        FOREIGN KEY (user_id) REFERENCES usuarios_cassems(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, []);
    console.log('✅ Tabela compliance_first_access verificada/criada');
  } catch (error) {
    console.error('❌ Erro ao criar tabela compliance_first_access:', error);
    throw error;
  }
};

// Verificar se é o primeiro acesso
exports.checkFirstAccess = async (req, res) => {
  let pool, server;
  try {
    const { userId } = req.body;
    const tipoCompliance = req.params.tipoCompliance || req.query.tipo_compliance || 'rat-fat';
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'ID do usuário é obrigatório' 
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureFirstAccessTable(pool);

    const rows = await executeQueryWithRetry(`
      SELECT id, dados_cadastro, assinado_gov, data_assinatura_gov
      FROM compliance_first_access
      WHERE user_id = ? AND tipo_compliance = ?
    `, [userId, tipoCompliance]);

    const isFirstAccess = rows.length === 0;

    res.json({
      success: true,
      isFirstAccess,
      hasData: !isFirstAccess,
      data: isFirstAccess ? null : {
        id: rows[0].id,
        dados_cadastro: rows[0].dados_cadastro,
        assinado_gov: rows[0].assinado_gov,
        data_assinatura_gov: rows[0].data_assinatura_gov
      }
    });
  } catch (err) {
    console.error('❌ Erro ao verificar primeiro acesso:', err);
    res.status(500).json({ 
      error: 'Erro ao verificar primeiro acesso', 
      details: err.message 
    });
  } finally {
    if (server) server.close();
  }
};

// Salvar dados do primeiro acesso
exports.saveFirstAccess = async (req, res) => {
  let pool, server;
  try {
    const { userId, dadosCadastro, tokenAssinaturaGov } = req.body;
    const tipoCompliance = req.params.tipoCompliance || req.body.tipo_compliance || 'rat-fat';
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'ID do usuário é obrigatório' 
      });
    }

    if (!dadosCadastro) {
      return res.status(400).json({ 
        error: 'Dados de cadastro são obrigatórios' 
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureFirstAccessTable(pool);

    // Verificar se já existe registro
    const existing = await executeQueryWithRetry(`
      SELECT id FROM compliance_first_access
      WHERE user_id = ? AND tipo_compliance = ?
    `, [userId, tipoCompliance]);

    const dadosCadastroJSON = typeof dadosCadastro === 'string' 
      ? JSON.parse(dadosCadastro) 
      : dadosCadastro;

    const assinadoGov = !!tokenAssinaturaGov;
    const dataAssinaturaGov = assinadoGov ? new Date() : null;

    if (existing.length > 0) {
      // Atualizar registro existente
      await executeQueryWithRetry(`
        UPDATE compliance_first_access
        SET dados_cadastro = ?,
            assinado_gov = ?,
            token_assinatura_gov = ?,
            data_assinatura_gov = ?,
            updated_at = NOW()
        WHERE user_id = ? AND tipo_compliance = ?
      `, [
        JSON.stringify(dadosCadastroJSON),
        assinadoGov,
        tokenAssinaturaGov || null,
        dataAssinaturaGov,
        userId,
        tipoCompliance
      ]);

        res.json({
          success: true,
          message: 'Dados atualizados com sucesso',
          data: {
            id: existing[0]?.id,
            dados_cadastro: dadosCadastroJSON,
            assinado_gov: assinadoGov,
            data_assinatura_gov: dataAssinaturaGov
          }
        });
    } else {
      // Criar novo registro
      const result = await executeQueryWithRetry(`
        INSERT INTO compliance_first_access 
        (user_id, tipo_compliance, dados_cadastro, assinado_gov, token_assinatura_gov, data_assinatura_gov)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        userId,
        tipoCompliance,
        JSON.stringify(dadosCadastroJSON),
        assinadoGov,
        tokenAssinaturaGov || null,
        dataAssinaturaGov
      ]);

      res.status(201).json({
        success: true,
        message: 'Dados salvos com sucesso',
        data: {
          id: result.insertId,
          dados_cadastro: dadosCadastroJSON,
          assinado_gov: assinadoGov,
          data_assinatura_gov: dataAssinaturaGov
        }
      });
    }
  } catch (err) {
    console.error('❌ Erro ao salvar primeiro acesso:', err);
    res.status(500).json({ 
      error: 'Erro ao salvar dados do primeiro acesso', 
      details: err.message 
    });
  } finally {
    if (server) server.close();
  }
};

// Obter dados do primeiro acesso
exports.getFirstAccess = async (req, res) => {
  let pool, server;
  try {
    const userId = req.params.userId || req.query.userId;
    const tipoCompliance = req.params.tipoCompliance || req.query.tipo_compliance || 'rat-fat';
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'ID do usuário é obrigatório' 
      });
    }

    ({ pool, server } = await getDbPoolWithTunnel());
    await ensureFirstAccessTable(pool);

    const rows = await executeQueryWithRetry(`
      SELECT id, dados_cadastro, assinado_gov, data_assinatura_gov, created_at, updated_at
      FROM compliance_first_access
      WHERE user_id = ? AND tipo_compliance = ?
    `, [userId, tipoCompliance]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Dados não encontrados' 
      });
    }

      res.json({
        success: true,
        data: {
          id: rows[0]?.id,
          dados_cadastro: rows[0]?.dados_cadastro,
          assinado_gov: rows[0]?.assinado_gov,
          data_assinatura_gov: rows[0]?.data_assinatura_gov,
          created_at: rows[0]?.created_at,
          updated_at: rows[0]?.updated_at
        }
      });
  } catch (err) {
    console.error('❌ Erro ao obter primeiro acesso:', err);
    res.status(500).json({ 
      error: 'Erro ao obter dados do primeiro acesso', 
      details: err.message 
    });
  } finally {
    if (server) server.close();
  }
};

