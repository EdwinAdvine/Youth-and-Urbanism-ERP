/**
 * useCollabEditor — Yjs-based collaborative editing hook for TipTap.
 *
 * NOTE: yjs and y-websocket are NOT installed in this project.
 * This hook returns a stub (isCollabEnabled: false) so the editor
 * continues to work without real-time collaboration extensions.
 * Install `yjs`, `y-websocket`, `@hocuspocus/provider`, and
 * `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-cursor`
 * to enable live collab.
 */

import { useEffect, useRef } from 'react';
import type { Extensions } from '@tiptap/core';

// WebSocket URL template (used when collab is enabled):
// ws://localhost:8010/api/v1/collab/ws/${noteId}?token=${token}

export interface UseCollabEditorOptions {
  noteId: string;
  token: string;
  userName: string;
  userColor?: string;
}

export interface UseCollabEditorReturn {
  /** Whether Yjs collaboration packages are available and enabled. */
  isCollabEnabled: boolean;
  /** TipTap extensions to spread into the editor's `extensions` array. */
  collabExtensions: Extensions;
  /** Whether the WebSocket connection to the collab server is live. */
  isConnected: boolean;
  /** Tear down Yjs doc and WebSocket provider. Call on unmount. */
  cleanup: () => void;
}

/**
 * Returns a stub implementation because yjs is not yet installed.
 * All values are safe defaults that leave the editor fully functional.
 */
export function useCollabEditor(_options: UseCollabEditorOptions): UseCollabEditorReturn {
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);

  return {
    isCollabEnabled: false,
    collabExtensions: [],
    isConnected: false,
    cleanup: () => {
      cleanupRef.current();
    },
  };
}

export default useCollabEditor;
