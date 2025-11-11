const { executeQueryWithRetry } = require('../lib/db');

let tablesEnsured = false;

const ensureTables = async () => {
  if (tablesEnsured) return;

  await executeQueryWithRetry(`
    CREATE TABLE IF NOT EXISTS cronograma_alertas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(50) NOT NULL,
      cronograma_id INT NOT NULL,
      checklist_id INT NULL,
      organizacao VARCHAR(50) NOT NULL,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT NULL,
      created_by INT NULL,
      created_by_nome VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tipo (tipo),
      INDEX idx_cronograma (cronograma_id),
      INDEX idx_checklist (checklist_id),
      INDEX idx_organizacao (organizacao),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);

  await executeQueryWithRetry(`
    CREATE TABLE IF NOT EXISTS cronograma_alertas_ack (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alerta_id INT NOT NULL,
      user_id INT NOT NULL,
      acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_alerta_user (alerta_id, user_id),
      INDEX idx_user (user_id),
      CONSTRAINT fk_alerta_ack FOREIGN KEY (alerta_id) REFERENCES cronograma_alertas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);

  tablesEnsured = true;
};

const buscarUsuario = async (userId) => {
  if (!userId) return { nome: null, organizacao: null };
  try {
    const rows = await executeQueryWithRetry(`
      SELECT nome, organizacao
      FROM usuarios_cassems
      WHERE id = ?
    `, [userId]);

    if (rows && rows.length > 0) {
      return {
        nome: rows[0].nome || null,
        organizacao: rows[0].organizacao || null
      };
    }
  } catch (error) {
    console.error('⚠️ Erro ao buscar usuário para alerta:', error);
  }
  return { nome: null, organizacao: null };
};

const registrarAlerta = async ({
  tipo,
  cronogramaId,
  checklistId = null,
  organizacao,
  titulo,
  descricao = null,
  userId = null
}) => {
  try {
    await ensureTables();

    const userInfo = await buscarUsuario(userId);

    console.log('🔔 Registrando alerta de cronograma:', {
      tipo,
      cronogramaId,
      checklistId,
      organizacao,
      titulo,
      descricao,
      userId,
      userInfo
    });

    await executeQueryWithRetry(`
      INSERT INTO cronograma_alertas (
        tipo,
        cronograma_id,
        checklist_id,
        organizacao,
        titulo,
        descricao,
        created_by,
        created_by_nome
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tipo,
      cronogramaId,
      checklistId,
      organizacao,
      titulo,
      descricao,
      userId,
      userInfo.nome
    ]);
  } catch (error) {
    console.error('⚠️ Erro ao registrar alerta do cronograma:', error);
  }
};

module.exports = {
  ensureTables,
  registrarAlerta
};

