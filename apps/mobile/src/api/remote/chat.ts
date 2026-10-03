import type { ApiClient } from '../client';
import { notImplemented, type RemoteContext } from './context';

/** GET /chat/messages and POST /chat (with availability), and Undo through POST /plans/undo. */
export function createRemoteChat(ctx: RemoteContext): ApiClient['chat'] {
  return {
    listMessages: () => notImplemented(),
    send: () => notImplemented(),
    undo: () => notImplemented(),
  };
}
