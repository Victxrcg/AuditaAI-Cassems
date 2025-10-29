import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  Circle, 
  Plus, 
  Trash2, 
  Edit, 
  X,
  Check,
  Clock,
  UserPlus,
  MoreHorizontal,
  Calendar
} from 'lucide-react';
import { 
  listChecklistItems, 
  createChecklistItem, 
  updateChecklistItem, 
  deleteChecklistItem,
  toggleChecklistItem,
  type ChecklistItem,
  type CreateChecklistItemData
} from '@/services/checklistService';
import { formatDateBR } from '@/utils/dateUtils';

interface ChecklistProps {
  cronogramaId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const Checklist: React.FC<ChecklistProps> = ({ cronogramaId, isOpen, onClose }) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemDataInicio, setNewItemDataInicio] = useState('');
  const [newItemDataFim, setNewItemDataFim] = useState('');
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDataInicio, setEditDataInicio] = useState('');
  const [editDataFim, setEditDataFim] = useState('');
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [demandaPrincipal, setDemandaPrincipal] = useState<{ data_inicio?: string; data_fim?: string } | null>(null);
  const { toast } = useToast();
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4011';

  // Carregar dados da demanda principal (cronograma)
  const loadDemandaPrincipal = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userOrg = user.organizacao || 'cassems';
      
      const response = await fetch(`${API_BASE}/cronograma/${cronogramaId}`, {
        headers: {
          'x-user-organization': userOrg
        }
      });
      
      if (response.ok) {
        const cronograma = await response.json();
        setDemandaPrincipal({
          data_inicio: cronograma.data_inicio,
          data_fim: cronograma.data_fim
        });
      }
    } catch (error) {
      console.error('Erro ao carregar demanda principal:', error);
    }
  };

  // Carregar itens do checklist
  const loadChecklistItems = async () => {
    try {
      setLoading(true);
      const checklistItems = await listChecklistItems(cronogramaId);
      console.log('🔍 Debug - Itens recebidos:', checklistItems, 'Tipo:', typeof checklistItems);
      
      // Garantir que seja sempre um array
      const itemsArray = Array.isArray(checklistItems) ? checklistItems : [];
      console.log('🔍 Debug - Items array final:', itemsArray);
      setItems(itemsArray);
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
      setItems([]); // Garantir que seja array vazio em caso de erro
      toast({
        title: "Erro",
        description: "Erro ao carregar checklist",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Criar novo item
  const handleCreateItem = async () => {
    if (!newItemTitle.trim()) return;

    try {
      const newItemData: CreateChecklistItemData = {
        titulo: newItemTitle.trim(),
        descricao: newItemDescription.trim() || undefined,
        data_inicio: newItemDataInicio || undefined,
        data_fim: newItemDataFim || undefined,
      };

      const newItem = await createChecklistItem(cronogramaId, newItemData);
      setItems(prev => [...(prev || []), newItem]);
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemDataInicio('');
      setNewItemDataFim('');
      setShowNewItemForm(false);

      toast({
        title: "Sucesso",
        description: "Item adicionado ao checklist",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar item",
        variant: "destructive",
      });
    }
  };

  // Toggle de conclusão
  const handleToggleItem = async (item: ChecklistItem) => {
    try {
      const updatedItem = await toggleChecklistItem(cronogramaId, item.id, !item.concluido);
      setItems(prev => (prev || []).map(i => i.id === item.id ? updatedItem : i));

      toast({
        title: "Sucesso",
        description: `Item marcado como ${updatedItem.concluido ? 'concluído' : 'pendente'}`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar item",
        variant: "destructive",
      });
    }
  };

  // Editar item
  const handleEditItem = async () => {
    if (!editingItem || !editTitle.trim()) return;

    try {
      const updatedItem = await updateChecklistItem(cronogramaId, editingItem.id, {
        titulo: editTitle.trim(),
        descricao: editDescription.trim() || undefined,
        data_inicio: editDataInicio || undefined,
        data_fim: editDataFim || undefined,
      });

      setItems(prev => (prev || []).map(i => i.id === editingItem.id ? updatedItem : i));
      setEditingItem(null);
      setEditTitle('');
      setEditDescription('');
      setEditDataInicio('');
      setEditDataFim('');

      toast({
        title: "Sucesso",
        description: "Item atualizado com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar item",
        variant: "destructive",
      });
    }
  };

  // Excluir item
  const handleDeleteItem = async (item: ChecklistItem) => {
    if (!confirm(`Tem certeza que deseja excluir "${item.titulo}"?`)) return;

    try {
      await deleteChecklistItem(cronogramaId, item.id);
      setItems(prev => (prev || []).filter(i => i.id !== item.id));

      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir item",
        variant: "destructive",
      });
    }
  };

  // Iniciar edição
  const startEditing = (item: ChecklistItem) => {
    setEditingItem(item);
    setEditTitle(item.titulo);
    setEditDescription(item.descricao || '');
    setEditDataInicio(item.data_inicio ? item.data_inicio.split('T')[0] : '');
    setEditDataFim(item.data_fim ? item.data_fim.split('T')[0] : '');
  };

  // Cancelar edição
  const cancelEditing = () => {
    setEditingItem(null);
    setEditTitle('');
    setEditDescription('');
    setEditDataInicio('');
    setEditDataFim('');
  };

  // Calcular progresso
  const itemsArray = Array.isArray(items) ? items : [];
  const progress = itemsArray.length > 0 ? (itemsArray.filter(item => item.concluido).length / itemsArray.length) * 100 : 0;
  const completedCount = itemsArray.filter(item => item.concluido).length;
  const visibleItems = hideCompleted ? itemsArray.filter(item => !item.concluido) : itemsArray;

  useEffect(() => {
    if (isOpen && cronogramaId) {
      loadChecklistItems();
      loadDemandaPrincipal();
    }
  }, [isOpen, cronogramaId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Checklist da Demanda
          </DialogTitle>
          <DialogDescription>
            Gerencie as tarefas e marque o progresso da demanda
          </DialogDescription>
          {demandaPrincipal && (demandaPrincipal.data_inicio || demandaPrincipal.data_fim) && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {demandaPrincipal.data_inicio && demandaPrincipal.data_fim
                  ? `Período: ${formatDateBR(demandaPrincipal.data_inicio)} a ${formatDateBR(demandaPrincipal.data_fim)}`
                  : demandaPrincipal.data_inicio
                  ? `Início: ${formatDateBR(demandaPrincipal.data_inicio)}`
                  : demandaPrincipal.data_fim
                  ? `Fim: ${formatDateBR(demandaPrincipal.data_fim)}`
                  : null
                }
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">

          {/* Controles */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideCompleted(!hideCompleted)}
              className={hideCompleted ? "bg-gray-100" : ""}
            >
              {hideCompleted ? "Mostrar concluídos" : "Ocultar concluídos"}
            </Button>
            
            <Button
              onClick={() => setShowNewItemForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </div>

          {/* Formulário de novo item */}
          {showNewItemForm && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-3">Novo Item</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Título do item"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full"
                />
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Data Início (opcional)</label>
                    <Input
                      type="date"
                      value={newItemDataInicio}
                      onChange={(e) => setNewItemDataInicio(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Data Fim (opcional)</label>
                    <Input
                      type="date"
                      value={newItemDataFim}
                      onChange={(e) => setNewItemDataFim(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateItem} size="sm">
                    <Check className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowNewItemForm(false);
                      setNewItemTitle('');
                      setNewItemDescription('');
                      setNewItemDataInicio('');
                      setNewItemDataFim('');
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de itens */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Carregando checklist...</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{itemsArray.length === 0 ? "Nenhum item no checklist" : "Todos os itens estão concluídos"}</p>
              </div>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-lg p-4 transition-all ${
                    item.concluido ? 'opacity-75 bg-green-50 border-green-200' : 'hover:shadow-sm'
                  }`}
                >
                  {editingItem?.id === item.id ? (
                    // Modo de edição
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título do item"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descrição (opcional)"
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">Data Início (opcional)</label>
                          <Input
                            type="date"
                            value={editDataInicio}
                            onChange={(e) => setEditDataInicio(e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-1 block">Data Fim (opcional)</label>
                          <Input
                            type="date"
                            value={editDataFim}
                            onChange={(e) => setEditDataFim(e.target.value)}
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleEditItem} size="sm">
                          <Check className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                        <Button variant="outline" size="sm" onClick={cancelEditing}>
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Modo de visualização
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleItem(item)}
                        className={`mt-1 transition-colors ${
                          item.concluido ? 'text-green-600' : 'text-gray-400 hover:text-green-600'
                        }`}
                      >
                        {item.concluido ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium ${item.concluido ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.titulo}
                        </h4>
                        {item.descricao && (
                          <p className={`text-sm mt-1 ${item.concluido ? 'text-gray-400' : 'text-gray-600'}`}>
                            {item.descricao}
                          </p>
                        )}
                        {(item.data_inicio || item.data_fim) && (
                          <div className={`flex items-center gap-3 mt-2 text-xs ${item.concluido ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Clock className="h-3 w-3" />
                            {item.data_inicio && (
                              <span>Início: {formatDateBR(item.data_inicio)}</span>
                            )}
                            {item.data_fim && (
                              <span>Fim: {formatDateBR(item.data_fim)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Checklist;
