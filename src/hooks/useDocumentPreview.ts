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
    
    // Posição simples: à direita do elemento, com margem
    let x = rect.right + 20;
    let y = rect.top;
    
    // Se não couber à direita, mostrar à esquerda
    if (x + 320 > viewportWidth) {
      x = rect.left - 340;
    }
    
    // Se ainda não couber, centralizar
    if (x < 20) {
      x = (viewportWidth - 320) / 2;
    }
    
    // Ajustar verticalmente se sair da tela
    if (y + 250 > viewportHeight) {
      y = viewportHeight - 270;
    }
    
    // Garantir margens mínimas
    x = Math.max(20, x);
    y = Math.max(20, y);

    console.log('🔍 Preview position:', { 
      x, 
      y, 
      rect: { right: rect.right, top: rect.top, left: rect.left },
      viewport: { width: viewportWidth, height: viewportHeight }
    });
    
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
