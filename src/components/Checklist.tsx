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
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[95vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="flex-shrink-0 p-3 sm:p-4 md:p-6 pb-2 sm:pb-3">
          <DialogHeader className="pb-2 sm:pb-3">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="break-words">Checklist da Demanda</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm mt-1">
              Gerencie as tarefas e marque o progresso da demanda
            </DialogDescription>
            {demandaPrincipal && (demandaPrincipal.data_inicio || demandaPrincipal.data_fim) && (
              <div className="flex items-start sm:items-center gap-2 mt-2 text-xs sm:text-sm text-gray-600">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words">
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
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0 px-3 sm:px-4 md:px-6">
          <div className="flex flex-col space-y-2 sm:space-y-3 md:space-y-4 pb-2 sm:pb-3">

          {/* Controles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`text-xs sm:text-sm w-full sm:w-auto ${hideCompleted ? "bg-gray-100" : ""}`}
            >
              <span className="hidden sm:inline">{hideCompleted ? "Mostrar concluídos" : "Ocultar concluídos"}</span>
              <span className="sm:hidden">{hideCompleted ? "Mostrar" : "Ocultar"}</span>
            </Button>
            
            <Button
              onClick={() => setShowNewItemForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm w-full sm:w-auto"
              size="sm"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Adicionar Item</span>
              <span className="sm:hidden">Adicionar</span>
            </Button>
          </div>

          {/* Formulário de novo item */}
          {showNewItemForm && (
            <div className="bg-blue-50 p-2.5 sm:p-3 md:p-4 rounded-lg border border-blue-200 flex-shrink-0">
              <h3 className="font-medium text-blue-900 mb-2 sm:mb-3 text-xs sm:text-sm md:text-base">Novo Item</h3>
              <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
                <Input
                  placeholder="Título do item"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm h-9 sm:h-10"
                />
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  rows={2}
                  className="text-xs sm:text-sm resize-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 block">Data Início (opcional)</label>
                    <Input
                      type="date"
                      value={newItemDataInicio}
                      onChange={(e) => setNewItemDataInicio(e.target.value)}
                      className="w-full text-xs sm:text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 block">Data Fim (opcional)</label>
                    <Input
                      type="date"
                      value={newItemDataFim}
                      onChange={(e) => setNewItemDataFim(e.target.value)}
                      className="w-full text-xs sm:text-sm h-9 sm:h-10"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button onClick={handleCreateItem} size="sm" className="text-xs sm:text-sm w-full sm:w-auto h-9 sm:h-10">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
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
                    className="text-xs sm:text-sm w-full sm:w-auto h-9 sm:h-10"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de itens */}
          <div className="space-y-2">
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
                  className={`bg-white border rounded-lg p-2.5 sm:p-3 md:p-4 transition-all ${
                    item.concluido ? 'opacity-75 bg-green-50 border-green-200' : 'hover:shadow-sm'
                  }`}
                >
                  {editingItem?.id === item.id ? (
                    // Modo de edição
                    <div className="space-y-2 sm:space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título do item"
                        className="text-sm"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descrição (opcional)"
                        rows={2}
                        className="text-sm"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">Data Início (opcional)</label>
                          <Input
                            type="date"
                            value={editDataInicio}
                            onChange={(e) => setEditDataInicio(e.target.value)}
                            className="w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1 block">Data Fim (opcional)</label>
                          <Input
                            type="date"
                            value={editDataFim}
                            onChange={(e) => setEditDataFim(e.target.value)}
                            className="w-full text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleEditItem} size="sm" className="text-xs sm:text-sm">
                          <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Salvar
                        </Button>
                        <Button variant="outline" size="sm" onClick={cancelEditing} className="text-xs sm:text-sm">
                          <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Modo de visualização
                    <div className="flex items-start gap-2 sm:gap-3">
                      <button
                        onClick={() => handleToggleItem(item)}
                        className={`mt-1 transition-colors flex-shrink-0 ${
                          item.concluido ? 'text-green-600' : 'text-gray-400 hover:text-green-600'
                        }`}
                      >
                        {item.concluido ? (
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <Circle className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium text-sm sm:text-base ${item.concluido ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.titulo}
                        </h4>
                        {item.descricao && (
                          <p className={`text-xs sm:text-sm mt-1 ${item.concluido ? 'text-gray-400' : 'text-gray-600'}`}>
                            {item.descricao}
                          </p>
                        )}
                        {(item.data_inicio || item.data_fim) && (
                          <div className={`flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs ${item.concluido ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            {item.data_inicio && (
                              <span>Início: {formatDateBR(item.data_inicio)}</span>
                            )}
                            {item.data_fim && (
                              <span>Fim: {formatDateBR(item.data_fim)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(item)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t p-3 sm:p-4 md:p-6 pt-2 sm:pt-3 md:pt-4">
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline" size="sm" className="text-xs sm:text-sm w-full sm:w-auto h-9 sm:h-10">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Checklist;
