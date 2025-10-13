const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function listarDocumentos(organizacao?: string) {
  const headers: Record<string, string> = {};
  if (organizacao) headers['x-user-organization'] = organizacao;
  const res = await fetch(`${API_BASE}/api/documentos`, { headers });
  if (!res.ok) throw new Error('Erro ao listar documentos');
  return res.json();
}

export async function uploadDocumento(file: File, userId?: number, organizacao?: string) {
  const form = new FormData();
  form.append('file', file);
  if (userId) form.append('userId', String(userId));
  if (organizacao) form.append('organizacao', organizacao);
  const res = await fetch(`${API_BASE}/api/documentos/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Erro ao enviar documento');
  return res.json();
}

export function downloadDocumento(id: number) {
  window.open(`${API_BASE}/api/documentos/${id}/download`, '_blank');
}

export async function removerDocumento(id: number) {
  const res = await fetch(`${API_BASE}/api/documentos/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao remover documento');
  return res.json();
}


