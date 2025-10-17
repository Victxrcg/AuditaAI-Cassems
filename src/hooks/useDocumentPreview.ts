import { useState, useCallback, useRef } from 'react';

interface DocumentPreviewState {
  isVisible: boolean;
  document: any | null;
  position: { x: number; y: number };
}

export const useDocumentPreview = () => {
  const [previewState, setPreviewState] = useState<DocumentPreviewState>({
    isVisible: false,
    document: null,
    position: { x: 0, y: 0 }
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showPreview = useCallback((document: any, event: React.MouseEvent) => {
    // Cancelar timeout anterior se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const previewWidth = 320;
    const previewHeight = 250;
    
    // Usar posição do mouse como base
    let x = event.clientX + 15; // 15px à direita do cursor
    let y = event.clientY - 10; // 10px acima do cursor
    
    // Ajustar se sair da tela à direita
    if (x + previewWidth > viewportWidth - 20) {
      x = event.clientX - previewWidth - 15; // À esquerda do cursor
    }
    
    // Ajustar se sair da tela à esquerda
    if (x < 20) {
      x = 20; // Margem mínima
    }
    
    // Ajustar se sair da tela acima
    if (y < 20) {
      y = 20; // Margem mínima
    }
    
    // Ajustar se sair da tela abaixo
    if (y + previewHeight > viewportHeight - 20) {
      y = viewportHeight - previewHeight - 20;
    }
    
    setPreviewState({
      isVisible: true,
      document,
      position: { x, y }
    });
  }, []);

  const hidePreview = useCallback(() => {
    // Adicionar delay para evitar flickering
    timeoutRef.current = setTimeout(() => {
      setPreviewState(prev => ({
        ...prev,
        isVisible: false
      }));
    }, 200); // Aumentar delay para dar tempo de mover o mouse para o preview
  }, []);

  const hidePreviewImmediately = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setPreviewState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, []);

  const updatePosition = useCallback((event: React.MouseEvent) => {
    if (!previewState.isVisible) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const previewWidth = 320;
    const previewHeight = 250;
    
    // Usar posição do mouse como base
    let x = event.clientX + 15; // 15px à direita do cursor
    let y = event.clientY - 10; // 10px acima do cursor
    
    // Ajustar se sair da tela à direita
    if (x + previewWidth > viewportWidth - 20) {
      x = event.clientX - previewWidth - 15; // À esquerda do cursor
    }
    
    // Ajustar se sair da tela à esquerda
    if (x < 20) {
      x = 20; // Margem mínima
    }
    
    // Ajustar se sair da tela acima
    if (y < 20) {
      y = 20; // Margem mínima
    }
    
    // Ajustar se sair da tela abaixo
    if (y + previewHeight > viewportHeight - 20) {
      y = viewportHeight - previewHeight - 20;
    }

    setPreviewState(prev => ({
      ...prev,
      position: { x, y }
    }));
  }, [previewState.isVisible]);

  return {
    previewState,
    showPreview,
    hidePreview,
    hidePreviewImmediately,
    updatePosition
  };
};
