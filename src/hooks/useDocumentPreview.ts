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

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calcular posição ideal
    let x = rect.right + 10;
    let y = rect.top;
    
    // Se não couber à direita, mostrar à esquerda
    if (x + 320 > viewportWidth) { // 320px é a largura do preview
      x = rect.left - 330; // 330px para dar espaço
    }
    
    // Se não couber à esquerda, centralizar
    if (x < 10) {
      x = (viewportWidth - 320) / 2;
    }
    
    // Ajustar posição vertical se sair da tela
    if (y + 200 > viewportHeight) { // 200px é altura aproximada do preview
      y = viewportHeight - 220;
    }
    
    // Garantir que não saia da tela
    x = Math.max(10, Math.min(x, viewportWidth - 330));
    y = Math.max(10, Math.min(y, viewportHeight - 220));

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

    const rect = event.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.right + 10,
      y: rect.top
    };

    setPreviewState(prev => ({
      ...prev,
      position
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
