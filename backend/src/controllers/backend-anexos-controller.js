// Funcionalidades de Anexos para Compliance Fiscal - Cassems
const { getDbPoolWithTunnel } = require('../lib/db');
const fs = require('fs');

// Upload de anexo
exports.uploadAnexo = async (req, res) => {
  let pool, server;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { complianceId, tipoAnexo } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Ler o arquivo como buffer para armazenar no banco
    const fileData = fs.readFileSync(req.file.path);
    
    // Inserir anexo na tabela compliance_anexos
    const result = await pool.query(`
      INSERT INTO compliance_anexos (compliance_id, tipo_anexo, nome_arquivo, caminho_arquivo, file_data, tamanho_arquivo, tipo_mime)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      complianceId,
      tipoAnexo,
      req.file.originalname,
      req.file.path,
      fileData,
      req.file.size,
      req.file.mimetype
    ]);

    // Converter insertId para Number para evitar problemas de serialização
    const anexoId = Number(result.insertId);

    // Atualizar o campo de anexo na tabela compliance_fiscal
    const anexoField = `${tipoAnexo}_anexo_id`;
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${anexoField} = ? 
      WHERE id = ?
    `, [anexoId, complianceId]);

    // Remover arquivo temporário
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        anexo_id: anexoId,
        filename: req.file.originalname,
        size: req.file.size,
        tipo_mime: req.file.mimetype
      }
    });
  } catch (error) {
    console.error(' Erro ao fazer upload do anexo:', error);
    res.status(500).json({
      error: 'Erro ao fazer upload do anexo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Buscar anexo por ID
exports.getAnexo = async (req, res) => {
  let pool, server;
  try {
    const { anexoId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT nome_arquivo, file_data, tipo_mime, tamanho_arquivo
      FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    const anexo = rows[0];
    
    res.setHeader('Content-Type', anexo.tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${anexo.nome_arquivo}"`);
    res.setHeader('Content-Length', anexo.tamanho_arquivo);
    
    res.send(anexo.file_data);
  } catch (error) {
    console.error(' Erro ao buscar anexo:', error);
    res.status(500).json({
      error: 'Erro ao buscar anexo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Listar anexos de uma competência
exports.listAnexos = async (req, res) => {
  let pool, server;
  try {
    const { complianceId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT id, nome_arquivo, tipo_anexo, tamanho_arquivo, created_at
      FROM compliance_anexos 
      WHERE compliance_id = ?
      ORDER BY created_at DESC
    `, [complianceId]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(' Erro ao listar anexos:', error);
    res.status(500).json({
      error: 'Erro ao listar anexos',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Remover anexo
exports.removeAnexo = async (req, res) => {
  let pool, server;
  try {
    const { anexoId } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    // Buscar informações do anexo
    const anexoRows = await pool.query(`
      SELECT compliance_id, tipo_anexo
      FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    if (!anexoRows || anexoRows.length === 0) {
      return res.status(404).json({ error: 'Anexo não encontrado' });
    }

    const anexo = anexoRows[0];
    
    // Remover anexo da tabela compliance_anexos
    await pool.query(`
      DELETE FROM compliance_anexos 
      WHERE id = ?
    `, [anexoId]);

    // Atualizar campo de anexo na tabela compliance_fiscal
    const anexoField = `${anexo.tipo_anexo}_anexo_id`;
    await pool.query(`
      UPDATE compliance_fiscal 
      SET ${anexoField} = NULL 
      WHERE id = ? AND ${anexoField} = ?
    `, [anexo.compliance_id, anexoId]);

    res.json({
      success: true,
      message: 'Anexo removido com sucesso'
    });
  } catch (error) {
    console.error(' Erro ao remover anexo:', error);
    res.status(500).json({
      error: 'Erro ao remover anexo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};

// Buscar anexos por tipo de competência
exports.getAnexosByTipo = async (req, res) => {
  let pool, server;
  try {
    const { complianceId, tipoAnexo } = req.params;
    ({ pool, server } = await getDbPoolWithTunnel());
    
    const rows = await pool.query(`
      SELECT id, nome_arquivo, tipo_anexo, tamanho_arquivo, created_at
      FROM compliance_anexos 
      WHERE compliance_id = ? AND tipo_anexo = ?
      ORDER BY created_at DESC
    `, [complianceId, tipoAnexo]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(' Erro ao buscar anexos por tipo:', error);
    res.status(500).json({
      error: 'Erro ao buscar anexos por tipo',
      details: error.message
    });
  } finally {
    if (server) server.close();
  }
};
