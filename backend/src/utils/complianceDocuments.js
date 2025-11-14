const fs = require('fs');
const path = require('path');
const { executeQueryWithRetry } = require('../lib/db');

const DOCUMENTS_UPLOAD_DIR = path.join(process.cwd(), 'backend', 'uploads', 'documentos');
fs.mkdirSync(DOCUMENTS_UPLOAD_DIR, { recursive: true });

const runQuery = async (pool, sql, params = []) => {
  if (pool && typeof pool.query === 'function') {
    const result = await pool.query(sql, params);

    if (Array.isArray(result)) {
      if (result.length === 2 && Array.isArray(result[0])) {
        return result[0];
      }
      if (result.length === 1 && Array.isArray(result[0])) {
        return result[0];
      }
      return result;
    }

    if (result && Array.isArray(result.rows)) {
      return result.rows;
    }

    return result;
  }
  return executeQueryWithRetry(sql, params);
};

const ensureDocumentTables = async (pool) => {
  await runQuery(pool, `
    CREATE TABLE IF NOT EXISTS pastas_documentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descricao TEXT NULL,
      organizacao VARCHAR(50) NULL,
      criado_por INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);

  await runQuery(pool, `
    CREATE TABLE IF NOT EXISTS documentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_arquivo VARCHAR(255) NOT NULL,
      caminho VARCHAR(500) NOT NULL,
      tamanho BIGINT NULL,
      mimetype VARCHAR(100) NULL,
      organizacao VARCHAR(50) NULL,
      enviado_por INT NULL,
      pasta_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pasta_id) REFERENCES pastas_documentos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `, []);
};

const ensureComplianceColumns = async (pool) => {
  const pastaColumn = await runQuery(pool, `
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'compliance_fiscal'
      AND COLUMN_NAME = 'pasta_documentos_id'
  `, []);

  if (!pastaColumn || pastaColumn.length === 0) {
    await runQuery(pool, `
      ALTER TABLE compliance_fiscal 
      ADD COLUMN pasta_documentos_id INT NULL
    `, []);

    try {
      await runQuery(pool, `
        ALTER TABLE compliance_fiscal 
        ADD CONSTRAINT fk_compliance_pasta_documentos 
        FOREIGN KEY (pasta_documentos_id) REFERENCES pastas_documentos(id) 
        ON DELETE SET NULL
      `, []);
    } catch (error) {
      // Constraint pode já existir
      console.log('⚠️ fk_compliance_pasta_documentos:', error.message);
    }
  }

  const documentoColumn = await runQuery(pool, `
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'compliance_anexos'
      AND COLUMN_NAME = 'documento_id'
  `, []);

  if (!documentoColumn || documentoColumn.length === 0) {
    await runQuery(pool, `
      ALTER TABLE compliance_anexos 
      ADD COLUMN documento_id INT NULL
    `, []);

    try {
      await runQuery(pool, `
        ALTER TABLE compliance_anexos 
        ADD CONSTRAINT fk_compliance_anexos_documentos 
        FOREIGN KEY (documento_id) REFERENCES documentos(id) 
        ON DELETE SET NULL
      `, []);
    } catch (error) {
      console.log('⚠️ fk_compliance_anexos_documentos:', error.message);
    }
  }
};

const ensureComplianceDocumentsInfrastructure = async (pool) => {
  await ensureDocumentTables(pool);
  await ensureComplianceColumns(pool);
};

const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(year, month, day);
    }

    const timestamp = Date.parse(trimmed);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }

  try {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  } catch (error) {
    return null;
  }

  return null;
};

const formatDatePtBr = (value) => {
  const date = parseDateValue(value);
  if (!date) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const resolveFolderOrganization = (competencia) => {
  return competencia.organizacao_documentos
    || competencia.organizacao_criacao
    || competencia.organizacao
    || competencia.ultima_alteracao_organizacao
    || null;
};

const buildComplianceFolderMetadata = (competencia) => {
  const inicio = formatDatePtBr(competencia.competencia_inicio);
  const fim = formatDatePtBr(competencia.competencia_fim);
  const referencia = formatDatePtBr(competencia.competencia_referencia);
  const folderOrganizacao = resolveFolderOrganization(competencia);

  let titulo;
  if (inicio && fim) {
    titulo = `Documentos Compliance Período (${inicio}) - (${fim})`;
  } else if (inicio || fim) {
    titulo = `Documentos Compliance Período (${inicio || fim})`;
  } else if (referencia) {
    titulo = `Documentos Compliance Referência (${referencia})`;
  } else {
    titulo = `Documentos Compliance Competência #${competencia.id}`;
  }

  const partesDescricao = [
    `Documentos anexados automaticamente para a competência ${competencia.id}`
  ];

  if (inicio) partesDescricao.push(`Início: ${inicio}`);
  if (fim) partesDescricao.push(`Fim: ${fim}`);
  if (!inicio && !fim && referencia) partesDescricao.push(`Referência: ${referencia}`);
  if (folderOrganizacao) partesDescricao.push(`Organização: ${folderOrganizacao}`);

  const descricao = partesDescricao.join(' | ');

  return { titulo, descricao, organizacao: folderOrganizacao };
};

// Criar ou buscar subpasta para um tipo de anexo
const getOrCreateSubpasta = async (pool, pastaPaiId, tipoAnexo, organizacao, criadoPor) => {
  const subpastaNome = TIPO_ANEXO_TO_SUBPASTA_NAME[tipoAnexo];
  if (!subpastaNome) {
    console.log(`⚠️ getOrCreateSubpasta: Tipo de anexo ${tipoAnexo} não tem mapeamento`);
    return null;
  }

  console.log(`🔍 getOrCreateSubpasta: Buscando subpasta "${subpastaNome}" com pasta_pai_id=${pastaPaiId}`);

  // Verificar se subpasta já existe
  const existingSubpasta = await runQuery(pool, `
    SELECT id, titulo, pasta_pai_id FROM pastas_documentos 
    WHERE pasta_pai_id = ? AND titulo = ?
  `, [pastaPaiId, subpastaNome]);

  console.log(`🔍 getOrCreateSubpasta: Resultado da busca:`, existingSubpasta);

  if (existingSubpasta && existingSubpasta.length > 0) {
    const subpastaId = Number(existingSubpasta[0].id);
    console.log(`✅ getOrCreateSubpasta: Subpasta já existe: ID=${subpastaId}`);
    return subpastaId;
  }

  // Buscar organização da pasta pai se não foi fornecida
  if (!organizacao) {
    const pastaPaiRows = await runQuery(pool, `
      SELECT organizacao FROM pastas_documentos WHERE id = ?
    `, [pastaPaiId]);
    if (pastaPaiRows && pastaPaiRows.length > 0) {
      organizacao = pastaPaiRows[0].organizacao;
    }
  }

  console.log(`📁 getOrCreateSubpasta: Criando subpasta "${subpastaNome}" com organizacao=${organizacao}`);

  // Criar subpasta
  const subpastaResult = await runQuery(pool, `
    INSERT INTO pastas_documentos (titulo, descricao, organizacao, pasta_pai_id, criado_por)
    VALUES (?, ?, ?, ?, ?)
  `, [
    subpastaNome,
    `Documentos da categoria ${subpastaNome}`,
    organizacao || null,
    pastaPaiId,
    criadoPor || null
  ]);

  const subpastaId = Number(subpastaResult.insertId);
  console.log(`✅ getOrCreateSubpasta: Subpasta criada: ID=${subpastaId}`);
  return subpastaId;
};

const createOrUpdateComplianceFolder = async (pool, competencia) => {
  await ensureComplianceDocumentsInfrastructure(pool);

  const metadata = buildComplianceFolderMetadata(competencia);
  let pastaId = competencia.pasta_documentos_id ? Number(competencia.pasta_documentos_id) : null;

  const folderOrganizacao = metadata.organizacao
    || competencia.organizacao_documentos
    || competencia.organizacao_criacao
    || competencia.organizacao
    || competencia.ultima_alteracao_organizacao
    || null;

  const criadoPor = competencia.created_by || null;

  if (!pastaId) {
    // Criar pasta principal
    const insertResult = await runQuery(pool, `
      INSERT INTO pastas_documentos (titulo, descricao, organizacao, criado_por)
      VALUES (?, ?, ?, ?)
    `, [
      metadata.titulo,
      metadata.descricao,
      folderOrganizacao || null,
      criadoPor
    ]);

    pastaId = Number(insertResult.insertId);

    await runQuery(pool, `
      UPDATE compliance_fiscal
      SET pasta_documentos_id = ?
      WHERE id = ?
    `, [pastaId, competencia.id]);

    // Criar subpastas automaticamente para as categorias principais
    console.log('📁 Criando subpastas para a competência:', competencia.id);
    for (const tipoAnexo of TIPOS_ANEXO_PRINCIPAIS) {
      try {
        const subpastaId = await getOrCreateSubpasta(
          pool,
          pastaId,
          tipoAnexo,
          folderOrganizacao,
          criadoPor
        );
        if (subpastaId) {
          console.log(`✅ Subpasta criada: ${TIPO_ANEXO_TO_SUBPASTA_NAME[tipoAnexo]} (ID: ${subpastaId})`);
        }
      } catch (error) {
        console.error(`❌ Erro ao criar subpasta ${tipoAnexo}:`, error);
      }
    }
  } else {
    // Atualizar pasta principal
    await runQuery(pool, `
      UPDATE pastas_documentos
      SET titulo = ?, descricao = ?, organizacao = COALESCE(?, organizacao), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [metadata.titulo, metadata.descricao, folderOrganizacao || null, pastaId]);

    // Garantir que as subpastas existem (caso a pasta já exista mas as subpastas não)
    for (const tipoAnexo of TIPOS_ANEXO_PRINCIPAIS) {
      try {
        await getOrCreateSubpasta(
          pool,
          pastaId,
          tipoAnexo,
          folderOrganizacao,
          criadoPor
        );
      } catch (error) {
        console.error(`❌ Erro ao verificar/criar subpasta ${tipoAnexo}:`, error);
      }
    }
  }

  return pastaId;
};

const syncComplianceFolderById = async (pool, competenciaId) => {
  await ensureComplianceDocumentsInfrastructure(pool);

  const rows = await runQuery(pool, `
    SELECT 
      id,
      created_by,
      organizacao_criacao,
      pasta_documentos_id,
      competencia_inicio,
      competencia_fim,
      competencia_referencia
    FROM compliance_fiscal
    WHERE id = ?
  `, [competenciaId]);

  if (!rows || rows.length === 0) {
    return null;
  }

  const competencia = rows[0];
  competencia.id = Number(competenciaId);

  const pastaId = await createOrUpdateComplianceFolder(pool, competencia);

  // Migrar documentos existentes para subpastas (se houver)
  if (pastaId) {
    try {
      await migrarDocumentosParaSubpastas(pool, pastaId);
    } catch (migError) {
      console.error('⚠️ Erro ao migrar documentos durante sincronização (continuando):', migError);
    }
  }

  return pastaId;
};

// Mapeamento de tipos de anexo para nomes de categorias (pastas físicas)
const TIPO_ANEXO_TO_CATEGORY = {
  'relatorio_inicial': 'relatorio_tecnico',
  'relatorio_faturamento': 'relatorio_faturamento',
  'imposto_compensado': 'comprovacao_compensacoes',
  'emails': 'comprovacao_email',
  'estabelecimento': 'notas_fiscais',
  'valor_compensado': 'valor_compensado',
  'resumo_folha_pagamento': 'resumo_folha_pagamento',
  'planilha_quantidade_empregados': 'planilha_quantidade_empregados',
  'decreto_3048_1999_vigente': 'decreto_3048_1999_vigente',
  'solucao_consulta_cosit_79_2023_vigente': 'solucao_consulta_cosit_79_2023_vigente'
};

// Mapeamento de tipos de anexo para nomes amigáveis das subpastas
const TIPO_ANEXO_TO_SUBPASTA_NAME = {
  'relatorio_inicial': 'Relatório Técnico',
  'relatorio_faturamento': 'Relatório Faturamento',
  'imposto_compensado': 'Comprovação de Compensações',
  'emails': 'Comprovação de Email',
  'estabelecimento': 'Notas Fiscais',
  'valor_compensado': 'Valor Compensado',
  'resumo_folha_pagamento': 'Resumo Folha de Pagamento',
  'planilha_quantidade_empregados': 'Planilha Quantidade Empregados',
  'decreto_3048_1999_vigente': 'Decreto 3048/1999 Vigente',
  'solucao_consulta_cosit_79_2023_vigente': 'Solução Consulta COSIT 79/2023 Vigente'
};

// Tipos de anexo que devem ter subpastas criadas (principais categorias)
// Ordem deve corresponder à sequência dos cards no frontend:
// 1. Período (não é subpasta, é a pasta principal)
// 2. Relatório Técnico (id: '2')
// 3. Relatório Faturamento (id: '3')
// 4. Comprovação de Compensações (id: '4')
// 5. Comprovação de Email (id: '6')
// 6. Notas Fiscais (id: '7')
const TIPOS_ANEXO_PRINCIPAIS = [
  'relatorio_inicial',        // id: '2' - Relatório Técnico
  'relatorio_faturamento',    // id: '3' - Relatório Faturamento
  'imposto_compensado',       // id: '4' - Comprovação de Compensações
  'emails',                    // id: '6' - Comprovação de Email
  'estabelecimento'            // id: '7' - Notas Fiscais
];

// Função para formatar período como string para pasta
const formatPeriodoForFolder = (competencia) => {
  const inicio = parseDateValue(competencia.competencia_inicio);
  const fim = parseDateValue(competencia.competencia_fim);
  
  if (inicio && fim) {
    const inicioStr = inicio.toISOString().split('T')[0].replace(/-/g, '-');
    const fimStr = fim.toISOString().split('T')[0].replace(/-/g, '-');
    return `${inicioStr}_${fimStr}`;
  } else if (inicio) {
    return inicio.toISOString().split('T')[0].replace(/-/g, '-');
  } else if (fim) {
    return fim.toISOString().split('T')[0].replace(/-/g, '-');
  } else if (competencia.competencia_referencia) {
    const ref = parseDateValue(competencia.competencia_referencia);
    if (ref) {
      return ref.toISOString().split('T')[0].replace(/-/g, '-');
    }
  }
  
  return `competencia_${competencia.id}`;
};

// Função para obter caminho da pasta da categoria
const getCategoryFolderPath = (competencia, tipoAnexo) => {
  const periodoFolder = formatPeriodoForFolder(competencia);
  const categoryFolder = TIPO_ANEXO_TO_CATEGORY[tipoAnexo] || tipoAnexo;
  const fullPath = path.join(DOCUMENTS_UPLOAD_DIR, periodoFolder, categoryFolder);
  return fullPath;
};

// Função para garantir que a estrutura de pastas da categoria existe
const ensureCategoryFolderStructure = (competencia, tipoAnexo) => {
  const categoryPath = getCategoryFolderPath(competencia, tipoAnexo);
  if (!fs.existsSync(categoryPath)) {
    fs.mkdirSync(categoryPath, { recursive: true });
    console.log(`📁 Pasta de categoria criada: ${categoryPath}`);
  }
  return categoryPath;
};

const saveDocumentFile = (buffer, sanitizedName, complianceId, competencia = null, tipoAnexo = null) => {
  // Se temos informações da competência e tipo de anexo, usar estrutura hierárquica
  if (competencia && tipoAnexo) {
    const categoryPath = ensureCategoryFolderStructure(competencia, tipoAnexo);
    const unique = `${Date.now()}-${complianceId}-${Math.round(Math.random() * 1e9)}`;
    const storedName = `${unique}-${sanitizedName}`;
    const filePath = path.join(categoryPath, storedName);
    fs.writeFileSync(filePath, buffer);
    return { storedName, filePath };
  }
  
  // Fallback para estrutura antiga (retrocompatibilidade)
  const unique = `${Date.now()}-${complianceId}-${Math.round(Math.random() * 1e9)}`;
  const storedName = `${unique}-${sanitizedName}`;
  const filePath = path.join(DOCUMENTS_UPLOAD_DIR, storedName);
  fs.writeFileSync(filePath, buffer);
  return { storedName, filePath };
};

const removeDocumentFileIfExists = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.log('⚠️ Erro ao remover arquivo de documentos:', error.message);
  }
};

// Função para obter ID da subpasta baseado no tipo de anexo
const getSubpastaIdByTipoAnexo = async (pool, pastaPaiId, tipoAnexo) => {
  const subpastaNome = TIPO_ANEXO_TO_SUBPASTA_NAME[tipoAnexo];
  if (!subpastaNome) {
    console.log(`⚠️ getSubpastaIdByTipoAnexo: Tipo de anexo ${tipoAnexo} não tem mapeamento para subpasta`);
    return null;
  }

  console.log(`🔍 getSubpastaIdByTipoAnexo: Buscando subpasta pasta_pai_id=${pastaPaiId}, titulo="${subpastaNome}"`);

  // Primeiro, verificar se a pasta pai existe
  const pastaPaiCheck = await runQuery(pool, `
    SELECT id, titulo FROM pastas_documentos WHERE id = ?
  `, [pastaPaiId]);

  if (!pastaPaiCheck || pastaPaiCheck.length === 0) {
    console.error(`❌ getSubpastaIdByTipoAnexo: Pasta pai ${pastaPaiId} não encontrada!`);
    return null;
  }

  console.log(`✅ getSubpastaIdByTipoAnexo: Pasta pai encontrada: "${pastaPaiCheck[0].titulo}"`);

  // Buscar todas as subpastas da pasta pai para debug
  const todasSubpastas = await runQuery(pool, `
    SELECT id, titulo, pasta_pai_id FROM pastas_documentos 
    WHERE pasta_pai_id = ?
  `, [pastaPaiId]);

  console.log(`🔍 getSubpastaIdByTipoAnexo: Todas as subpastas da pasta ${pastaPaiId}:`, todasSubpastas);

  // Buscar subpasta específica
  const rows = await runQuery(pool, `
    SELECT id, titulo, pasta_pai_id FROM pastas_documentos 
    WHERE pasta_pai_id = ? AND titulo = ?
  `, [pastaPaiId, subpastaNome]);

  console.log(`🔍 getSubpastaIdByTipoAnexo: Resultado da busca específica:`, rows);

  if (rows && rows.length > 0) {
    const subpastaId = Number(rows[0].id);
    console.log(`✅ getSubpastaIdByTipoAnexo: Subpasta encontrada: ID=${subpastaId}, Nome="${rows[0].titulo}"`);
    return subpastaId;
  }

  // Se não encontrou, tentar criar a subpasta
  console.log(`⚠️ getSubpastaIdByTipoAnexo: Subpasta não encontrada, tentando criar: ${subpastaNome}`);
  try {
    // Buscar organização da pasta pai
    const pastaPaiInfo = await runQuery(pool, `
      SELECT organizacao FROM pastas_documentos WHERE id = ?
    `, [pastaPaiId]);
    
    const organizacao = pastaPaiInfo && pastaPaiInfo.length > 0 ? pastaPaiInfo[0].organizacao : null;
    
    const subpastaId = await getOrCreateSubpasta(pool, pastaPaiId, tipoAnexo, organizacao, null);
    if (subpastaId) {
      console.log(`✅ getSubpastaIdByTipoAnexo: Subpasta criada com sucesso: ID=${subpastaId}`);
      return subpastaId;
    }
  } catch (error) {
    console.error(`❌ getSubpastaIdByTipoAnexo: Erro ao criar subpasta:`, error);
    console.error(`❌ Stack trace:`, error.stack);
  }

  console.log(`❌ getSubpastaIdByTipoAnexo: Não foi possível obter/criar subpasta para ${tipoAnexo}`);
  return null;
};

// Função para migrar documentos existentes para subpastas corretas
const migrarDocumentosParaSubpastas = async (pool, pastaPaiId) => {
  console.log(`🔄 Iniciando migração de documentos para subpastas (pasta_pai_id=${pastaPaiId})`);
  
  try {
    // Buscar todos os documentos na pasta principal
    const documentos = await runQuery(pool, `
      SELECT d.id, d.nome_arquivo, d.pasta_id, ca.tipo_anexo
      FROM documentos d
      INNER JOIN compliance_anexos ca ON d.id = ca.documento_id
      WHERE d.pasta_id = ?
    `, [pastaPaiId]);

    console.log(`📋 Encontrados ${documentos.length} documentos para migrar`);

    let migrados = 0;
    let erros = 0;

    for (const doc of documentos) {
      try {
        if (!doc.tipo_anexo) {
          console.log(`⚠️ Documento ${doc.id} não tem tipo_anexo, pulando...`);
          continue;
        }

        // Buscar subpasta correspondente
        const subpastaId = await getSubpastaIdByTipoAnexo(pool, pastaPaiId, doc.tipo_anexo);
        
        if (subpastaId && subpastaId !== doc.pasta_id) {
          // Atualizar pasta_id do documento
          await runQuery(pool, `
            UPDATE documentos 
            SET pasta_id = ? 
            WHERE id = ?
          `, [subpastaId, doc.id]);
          
          console.log(`✅ Documento ${doc.id} (${doc.nome_arquivo}) migrado para subpasta ${subpastaId} (${doc.tipo_anexo})`);
          migrados++;
        } else if (!subpastaId) {
          console.log(`⚠️ Subpasta não encontrada para tipo_anexo=${doc.tipo_anexo}, documento ${doc.id} permanece na pasta principal`);
        } else {
          console.log(`ℹ️ Documento ${doc.id} já está na subpasta correta`);
        }
      } catch (error) {
        console.error(`❌ Erro ao migrar documento ${doc.id}:`, error);
        erros++;
      }
    }

    console.log(`✅ Migração concluída: ${migrados} migrados, ${erros} erros`);
    return { migrados, erros, total: documentos.length };
  } catch (error) {
    console.error('❌ Erro na migração de documentos:', error);
    throw error;
  }
};

module.exports = {
  DOCUMENTS_UPLOAD_DIR,
  runQuery,
  ensureComplianceDocumentsInfrastructure,
  createOrUpdateComplianceFolder,
  syncComplianceFolderById,
  saveDocumentFile,
  removeDocumentFileIfExists,
  buildComplianceFolderMetadata,
  formatDatePtBr,
  resolveFolderOrganization,
  getCategoryFolderPath,
  ensureCategoryFolderStructure,
  formatPeriodoForFolder,
  TIPO_ANEXO_TO_CATEGORY,
  TIPO_ANEXO_TO_SUBPASTA_NAME,
  getSubpastaIdByTipoAnexo,
  getOrCreateSubpasta,
  migrarDocumentosParaSubpastas
};

