import { randomUUID } from 'expo-crypto';

/**
 * A new v4 UUID for one user action (generate, chat, completion, undo). Keep it
 * with the action and send it again only when resending that same action after
 * a transport failure; the server then replays the saved result.
 */
export function newRequestId(): string {
  return randomUUID();
}
