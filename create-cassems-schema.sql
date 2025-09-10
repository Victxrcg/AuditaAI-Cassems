-- Script de criação das tabelas para Compliance Fiscal - Cassems
-- Estrutura atualizada com 2 campos por coluna (anexo + texto)

USE cassems;

-- Tabela principal para Compliance Fiscal
CREATE TABLE IF NOT EXISTS compliance_fiscal (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Competência Referência
    competencia_referencia_anexo_id INT,
    competencia_referencia_texto TEXT,
    
    -- Relatório Inicial
    relatorio_inicial_anexo_id INT,
    relatorio_inicial_texto TEXT,
    
    -- Relatório de Faturamento
    relatorio_faturamento_anexo_id INT,
    relatorio_faturamento_texto TEXT,
    
    -- Imposto Compensado
    imposto_compensado_anexo_id INT,
    imposto_compensado_texto TEXT,
    
    -- E-MAILS
    emails_anexo_id INT,
    emails_texto TEXT,
    
    -- Valor Compensado
    valor_compensado_anexo_id INT,
    valor_compensado_texto TEXT,
    
    -- ESTABELECIMENTO
    estabelecimento_anexo_id INT,
    estabelecimento_texto TEXT,
    
    -- RESUMO DA FOLHA DE PAGAMENTO
    resumo_folha_pagamento_anexo_id INT,
    resumo_folha_pagamento_texto TEXT,
    
    -- PLANILHA QUANTIDADE DE EMPREGADOS
    planilha_quantidade_empregados_anexo_id INT,
    planilha_quantidade_empregados_texto TEXT,
    
    -- DECRETO Nº 3.048/1999 ESTÁ VIGENTE?
    decreto_3048_1999_vigente_anexo_id INT,
    decreto_3048_1999_vigente_texto TEXT,
    
    -- SOLUÇÃO DE CONSULTA COSIT 79/2023 ESTÁ VIGENTE?
    solucao_consulta_cosit_79_2023_vigente_anexo_id INT,
    solucao_consulta_cosit_79_2023_vigente_texto TEXT,
    
    -- Parecer
    parecer_anexo_id INT,
    parecer_texto TEXT,
    
    -- Campos de controle
    status ENUM('pendente', 'em_analise', 'aprovado', 'reprovado') DEFAULT 'pendente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Tabela para anexos do Compliance (unificada)
CREATE TABLE IF NOT EXISTS compliance_anexos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    compliance_id INT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(500),
    file_data LONGBLOB,
    tamanho_arquivo INT,
    tipo_mime VARCHAR(100),
    tipo_anexo ENUM(
        'competencia_referencia',
        'relatorio_inicial',
        'relatorio_faturamento',
        'imposto_compensado',
        'emails',
        'valor_compensado',
        'estabelecimento',
        'resumo_folha_pagamento',
        'planilha_quantidade_empregados',
        'decreto_3048_1999_vigente',
        'solucao_consulta_cosit_79_2023_vigente',
        'parecer'
    ) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (compliance_id) REFERENCES compliance_fiscal(id) ON DELETE CASCADE,
    INDEX idx_compliance_id (compliance_id),
    INDEX idx_tipo_anexo (tipo_anexo)
);

-- Tabela para usuários da Cassems
CREATE TABLE IF NOT EXISTS usuarios_cassems (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('admin', 'compliance', 'visualizador') DEFAULT 'visualizador',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_perfil (perfil)
);

-- Tabela para cronograma
CREATE TABLE IF NOT EXISTS cronograma (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_inicio DATE,
    data_fim DATE,
    status ENUM('pendente', 'em_andamento', 'concluido', 'atrasado') DEFAULT 'pendente',
    responsavel_id INT,
    prioridade ENUM('baixa', 'media', 'alta', 'critica') DEFAULT 'media',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (responsavel_id) REFERENCES usuarios_cassems(id),
    INDEX idx_status (status),
    INDEX idx_data_inicio (data_inicio),
    INDEX idx_prioridade (prioridade)
);

-- Inserir usuário admin padrão
INSERT IGNORE INTO usuarios_cassems (nome, email, senha, perfil) VALUES
('Administrador Cassems', 'admin@cassems.com.br', '', 'admin');

-- Inserir dados de exemplo para teste
INSERT IGNORE INTO compliance_fiscal (
    competencia_referencia_texto,
    relatorio_inicial_texto,
    relatorio_faturamento_texto,
    imposto_compensado_texto,
    emails_texto,
    valor_compensado_texto,
    estabelecimento_texto,
    resumo_folha_pagamento_texto,
    planilha_quantidade_empregados_texto,
    decreto_3048_1999_vigente_texto,
    solucao_consulta_cosit_79_2023_vigente_texto,
    parecer_texto,
    status
) VALUES (
    '11',
    'NÓS QUE ANEXAMOS',
    'NOS ANEXAMOS',
    'NÓS',
    'NÓS',
    'NÓS',
    'TANTO NÓS QUANTO ELES',
    'TANTO NÓS QUANTO ELES',
    '',
    'RPA: LINK DA NORMA: https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm',
    'RPA: LINK DA SOLUÇÃO: http://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?...',
    'IA AUTOMÁTICO',
    'pendente'
);

-- Verificar se as tabelas foram criadas
SHOW TABLES;
