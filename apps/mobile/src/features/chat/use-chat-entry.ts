import { useEffect, useRef, useState } from 'react';

import { useSession } from '@/api/hooks';
import type { ChatRouteParams } from '@/navigation/routes';

/**
 * The dock between mounts, as the shell may unmount it while closed: whose it
 * is, the open request it last applied, the unsent words and the attached
 * session. Opening it again on the same request (the shell's toggle) carries
 * on from there; a new request applies afresh.
 */
const dockMemory: { account: string | null; request: string | null; draft: string; aboutId: string | null } = {
  account: null,
  request: null,
  draft: '',
  aboutId: null,
};

/** Every value that makes an open request, so a repeat of the same one doesn't apply again. */
const requestKeyOf = (params: ChatRouteParams, openKey: string | number | undefined) =>
  [openKey ?? '', params.prefill ?? '', params.about ?? '', params.intent ?? ''].join('\u0000');

/** 8.1: opened from a session (not Move it) asks what to change, until something is sent. */
const askAboutOf = (params: ChatRouteParams) => (params.intent === 'move' ? null : (params.about ?? null));

export type ChatEntryOptions = {
  params: ChatRouteParams;
  openKey?: string | number;
  /** The dock stays mounted between requests and may be unmounted while closed; the page is opened once. */
  dock: boolean;
  /** Move it (8.15): sends the request for this session at once, once per open request. */
  onMove: (sessionId: string) => void;
};

/**
 * How chat was opened, applied to the message box: `prefill` fills it,
 * `about` attaches a session and asks about it (8.1), `intent=move` sends Move
 * it. In the dock a later request applies the same way, and a request with
 * neither leaves the box and the attachment as they are.
 */
export function useChatEntry({ params, openKey, dock, onMove }: ChatEntryOptions) {
  const account = useSession().data?.user.id ?? null;
  const request = requestKeyOf(params, openKey);

  const [start] = useState(() => {
    const memory = dock && dockMemory.account === account ? dockMemory : null;
    const resumed = memory?.request === request;
    return {
      resumed,
      draft: (!resumed && params.prefill) || memory?.draft || '',
      aboutId: (!resumed && params.about) || memory?.aboutId || null,
    };
  });
  const [draft, setDraft] = useState(start.draft);
  const [aboutId, setAboutId] = useState<string | null>(start.aboutId);
  const [askAbout, setAskAbout] = useState(() => (start.resumed ? null : askAboutOf(params)));

  // A later open request while the panel stays mounted (the dock) applies like a fresh open.
  const [applied, setApplied] = useState(request);
  if (applied !== request) {
    setApplied(request);
    if (params.prefill) setDraft(params.prefill);
    if (params.about) setAboutId(params.about);
    setAskAbout(askAboutOf(params));
  }

  // Never twice for one request, so a dock reopened on it doesn't move the session again.
  const moved = useRef(start.resumed ? request : null);
  useEffect(() => {
    if (params.intent !== 'move' || !params.about || moved.current === request) return;
    moved.current = request;
    onMove(params.about);
  }, [params.intent, params.about, request, onMove]);

  useEffect(() => {
    if (!dock) return;
    dockMemory.account = account;
    dockMemory.request = request;
    dockMemory.draft = draft;
    dockMemory.aboutId = aboutId;
  }, [dock, account, request, draft, aboutId]);

  return {
    draft,
    setDraft,
    aboutId,
    setAboutId,
    /** The session chat asks about (8.1) until something is sent. */
    askAbout,
    /** Something was sent: the question about the session has its answer. */
    answered: () => setAskAbout(null),
    /** Changes once per open request the panel applies (the box takes focus). */
    request: applied,
  };
}
