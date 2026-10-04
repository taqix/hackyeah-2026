import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import type { View } from 'react-native';

import type { FileDrop } from './use-file-drop';

function carriesFiles(event: DragEvent): boolean {
  return !!event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files');
}

/**
 * Lets a workout file be dragged from the desktop onto the drop area. A file
 * let go anywhere else on the page is ignored, so the browser never leaves the
 * form to show it.
 */
export function useFileDrop(onDrop: (file: File) => void): FileDrop {
  // On the web a View's ref is its DOM element.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dropped = useEffectEvent(onDrop);
  // Stable, so React does not detach and re-attach the area on every render.
  const dropRef = useCallback((view: View | null) => setNode(view as unknown as HTMLElement | null), []);

  useEffect(() => {
    if (!node) return undefined;
    // dragenter and dragleave fire for every child crossed; count them to know when the file left.
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) dropped(file);
    };
    const outside = (event: DragEvent) => {
      if (!carriesFiles(event) || node.contains(event.target as Node)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    };

    node.addEventListener('dragenter', enter);
    node.addEventListener('dragover', over);
    node.addEventListener('dragleave', leave);
    node.addEventListener('drop', drop);
    window.addEventListener('dragover', outside);
    window.addEventListener('drop', outside);
    return () => {
      node.removeEventListener('dragenter', enter);
      node.removeEventListener('dragover', over);
      node.removeEventListener('dragleave', leave);
      node.removeEventListener('drop', drop);
      window.removeEventListener('dragover', outside);
      window.removeEventListener('drop', outside);
    };
  }, [node]);

  return { dropRef, dragging };
}
