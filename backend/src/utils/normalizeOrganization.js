/**
 * Normaliza código/nome de organização para o código canônico usado no banco.
 * Evita duplicatas como "marajó / rede frota" vs "rede_frota".
 * @param {string} org - Código ou nome da organização (ex: "Marajó / rede frota", "rede_frota")
 * @returns {string} - Código canônico (ex: "rede_frota", "cassems", "portes")
 */
function normalizeOrganizationCode(org) {
  if (!org || typeof org !== 'string') return (org || '').trim();
  const s = String(org).toLowerCase().trim();
  // Marajó/Rede Frota: usar "marajó / rede frota" (org existente com logo)
  if (s.includes('maraj') || s.includes('rede frota') || s.includes('rede_frota')) return 'marajó / rede frota';
  if (s.includes('cassems')) return 'cassems';
  if (s.includes('porte')) return 'portes';
  // Fallback: normalizar espaços e caracteres especiais para underscore
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100) || s;
}

module.exports = { normalizeOrganizationCode };
