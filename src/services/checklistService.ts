// Serviço para gerenciar checklist das demandas

interface ChecklistItem {
  id: number;
  titulo: string;
  descricao?: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

interface CreateChecklistItemData {
  titulo: string;
  descricao?: string;
}

interface UpdateChecklistItemData {
  titulo?: string;
  descricao?: string;
  concluido?: boolean;
  ordem?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Obter usuário atual
const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// Listar itens do checklist de uma demanda
export const listChecklistItems = async (cronogramaId: number): Promise<ChecklistItem[]> => {
  try {
    const currentUser = getCurrentUser();
    console.log('🔍 listChecklistItems - cronogramaId:', cronogramaId);
    console.log('🔍 listChecklistItems - currentUser:', currentUser);
    
    const response = await fetch(`${API_BASE}/cronograma/${cronogramaId}/checklist`, {
      headers: {
        'x-user-organization': currentUser?.organizacao || 'cassems',
        'x-user-id': currentUser?.id || '',
      },
    });

    console.log('🔍 listChecklistItems - response status:', response.status);
    
    if (!response.ok) {
      throw new Error('Erro ao carregar checklist');
    }

    const data = await response.json();
    console.log('🔍 listChecklistItems - data received:', data);
    return data.success ? data.data : [];
  } catch (error) {
    console.error('Erro ao listar itens do checklist:', error);
    throw error;
  }
};

// Criar novo item do checklist
export const createChecklistItem = async (
  cronogramaId: number, 
  itemData: CreateChecklistItemData
): Promise<ChecklistItem> => {
  try {
    const currentUser = getCurrentUser();
    const response = await fetch(`${API_BASE}/cronograma/${cronogramaId}/checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-organization': currentUser?.organizacao || 'cassems',
        'x-user-id': currentUser?.id || '',
      },
      body: JSON.stringify(itemData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao criar item do checklist');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao criar item do checklist');
    }

    return data.data;
  } catch (error) {
    console.error('Erro ao criar item do checklist:', error);
    throw error;
  }
};

// Atualizar item do checklist
export const updateChecklistItem = async (
  cronogramaId: number,
  itemId: number,
  itemData: UpdateChecklistItemData
): Promise<ChecklistItem> => {
  try {
    const currentUser = getCurrentUser();
    const response = await fetch(`${API_BASE}/cronograma/${cronogramaId}/checklist/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-organization': currentUser?.organizacao || 'cassems',
        'x-user-id': currentUser?.id || '',
      },
      body: JSON.stringify(itemData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao atualizar item do checklist');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao atualizar item do checklist');
    }

    return data.data;
  } catch (error) {
    console.error('Erro ao atualizar item do checklist:', error);
    throw error;
  }
};

// Excluir item do checklist
export const deleteChecklistItem = async (
  cronogramaId: number,
  itemId: number
): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    const response = await fetch(`${API_BASE}/cronograma/${cronogramaId}/checklist/${itemId}`, {
      method: 'DELETE',
      headers: {
        'x-user-organization': currentUser?.organizacao || 'cassems',
        'x-user-id': currentUser?.id || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao excluir item do checklist');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao excluir item do checklist');
    }
  } catch (error) {
    console.error('Erro ao excluir item do checklist:', error);
    throw error;
  }
};

// Toggle de conclusão de item
export const toggleChecklistItem = async (
  cronogramaId: number,
  itemId: number,
  concluido: boolean
): Promise<ChecklistItem> => {
  return updateChecklistItem(cronogramaId, itemId, { concluido });
};

export type { ChecklistItem, CreateChecklistItemData, UpdateChecklistItemData };
