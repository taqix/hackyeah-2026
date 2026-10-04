import type { View } from 'react-native';

export type FileDrop = {
  /** Attach to the drop area. */
  dropRef: (view: View | null) => void;
  /** A file is held over the area. */
  dragging: boolean;
};

const none = () => undefined;

/** Phones pick files through the system picker only; dropping is a web feature (use-file-drop.web.ts). */
export function useFileDrop(_onDrop: (file: File) => void): FileDrop {
  return { dropRef: none, dragging: false };
}
