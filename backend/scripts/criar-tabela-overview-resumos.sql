-- Tabela para histórico de resumos (overview) do cronograma
-- Execute este script no banco usado pela aplicação (ex: cassems)

CREATE TABLE IF NOT EXISTS overview_resumos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NULL,
  user_org VARCHAR(100) NOT NULL,
  organizacao_filtro VARCHAR(100) NOT NULL DEFAULT 'todas',
  status_filtro VARCHAR(50) NOT NULL DEFAULT 'todos',
  periodo_inicio DATE NULL,
  periodo_fim DATE NULL,
  titulo VARCHAR(255) NOT NULL,
  overview_text LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_org (user_org),
  INDEX idx_created_at (created_at)
);
