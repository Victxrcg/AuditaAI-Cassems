const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Interfaces
export interface Documento {
  id: number;
  nome_arquivo: string;
  caminho: string;
  tamanho: number;
  mimetype: string;
  organizacao: string;
  enviado_por?: number;
  pasta_id?: number;
  created_at: string;
}

export interface Pasta {
  id: number;
  titulo: string;
  descricao?: string;
  organizacao: string;
  criado_por?: number;
  total_documentos: number;
  created_at: string;
  updated_at: string;
}

// Funções para documentos
export async function listarDocumentos(organizacao?: string) {
  const headers: Record<string, string> = {};
  if (organizacao) headers['x-user-organization'] = organizacao;
  const res = await fetch(`${API_BASE}/documentos`, { headers });
  if (!res.ok) throw new Error('Erro ao listar documentos');
  return res.json();
}

export async function uploadDocumento(file: File, userId?: number, organizacao?: string, pastaId?: number) {
  const form = new FormData();
  form.append('file', file);
  if (userId) form.append('userId', String(userId));
  if (organizacao) form.append('organizacao', organizacao);
  if (pastaId) form.append('pastaId', String(pastaId));
  const res = await fetch(`${API_BASE}/documentos/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Erro ao enviar documento');
  return res.json();
}

export function downloadDocumento(id: number) {
  window.open(`${API_BASE}/documentos/${id}/download`, '_blank');
}

export async function removerDocumento(id: number) {
  const res = await fetch(`${API_BASE}/documentos/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao remover documento');
  return res.json();
}

export async function moverDocumento(id: number, pastaId?: number) {
  const res = await fetch(`${API_BASE}/documentos/${id}/mover`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pastaId })
  });
  if (!res.ok) throw new Error('Erro ao mover documento');
  return res.json();
}

// Funções para pastas
export async function listarPastas(organizacao?: string) {
  const headers: Record<string, string> = {};
  if (organizacao) headers['x-user-organization'] = organizacao;
  const res = await fetch(`${API_BASE}/documentos/pastas`, { headers });
  if (!res.ok) throw new Error('Erro ao listar pastas');
  return res.json();
}

export async function criarPasta(titulo: string, descricao?: string, userId?: number, organizacao?: string) {
  const res = await fetch(`${API_BASE}/documentos/pastas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, descricao, userId, organizacao })
  });
  if (!res.ok) throw new Error('Erro ao criar pasta');
  return res.json();
}

export async function atualizarPasta(id: number, titulo: string, descricao?: string) {
  const res = await fetch(`${API_BASE}/documentos/pastas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, descricao })
  });
  if (!res.ok) throw new Error('Erro ao atualizar pasta');
  return res.json();
}

export async function removerPasta(id: number) {
  const res = await fetch(`${API_BASE}/documentos/pastas/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao remover pasta');
  return res.json();
}


