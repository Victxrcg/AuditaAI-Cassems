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
    const position = {
      x: rect.right + 10, // Mostrar à direita do elemento
      y: rect.top
    };

    setPreviewState({
      isVisible: true,
      document,
      position
    });
  }, []);

  const hidePreview = useCallback(() => {
    // Adicionar delay para evitar flickering
    timeoutRef.current = setTimeout(() => {
      setPreviewState(prev => ({
        ...prev,
        isVisible: false
      }));
    }, 100);
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
