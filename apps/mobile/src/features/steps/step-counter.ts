export interface StepSource {
  name: 'core-motion' | 'health-connect' | 'unsupported';
  /** Null means available; otherwise return the reason it cannot be used. */
  getUnavailableReason(): Promise<string | null>;
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  readSteps(start: Date, end: Date): Promise<number>;
  openSettings(): Promise<void>;
}

export interface StepCounterState {
  /** Today's system total. Null means no successful, authorized read yet. */
  steps: number | null;
  status: 'idle' | 'loading' | 'ready' | 'permission-required' | 'unavailable' | 'error';
  date: string | null;
  updatedAt: string | null;
  message: string | null;
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createStepCounter(source: StepSource, now = () => new Date()) {
  let state: StepCounterState = {
    steps: null,
    status: 'idle',
    date: null,
    updatedAt: null,
    message: null,
  };
  const listeners = new Set<() => void>();
  let active = false;
  let permissionAttempted = false;
  let permissionRequested = false;
  let pending: Promise<void> | null = null;

  function update(patch: Partial<StepCounterState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  async function read() {
    const date = localDate(now());
    update({
      status: 'loading',
      message: null,
      ...(state.date !== date ? { steps: null, updatedAt: null, date } : {}),
    });

    try {
      const unavailableReason = await source.getUnavailableReason();
      if (!active) return;
      if (unavailableReason) {
        update({ status: 'unavailable', steps: null, updatedAt: null, message: unavailableReason });
        return;
      }

      let granted = await source.hasPermission();
      if (!active) return;
      const shouldRequestPermission = !permissionAttempted || permissionRequested;
      permissionAttempted = true;
      if (!granted && shouldRequestPermission) {
        // A native permission sheet can temporarily move the app out of the foreground.
        // All refreshes share this operation, so returning from it cannot open a second sheet.
        permissionRequested = false;
        granted = await source.requestPermission();
      }
      permissionRequested = false;
      if (!active) return;
      if (!granted) {
        update({ status: 'permission-required', steps: null, updatedAt: null });
        return;
      }

      // Compute the range after permission prompts, using local midnight (including DST).
      const end = now();
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);
      const steps = start.getTime() === end.getTime() ? 0 : await source.readSteps(start, end);
      if (!active) return;
      if (!Number.isSafeInteger(steps) || steps < 0) {
        throw new Error('System returned an invalid step count.');
      }
      if (localDate(now()) !== localDate(end)) {
        update({ status: 'idle', steps: null, updatedAt: null, date: localDate(now()) });
        return;
      }
      update({ status: 'ready', steps, date: localDate(end), updatedAt: end.toISOString() });
    } catch (error) {
      if (!active) return;
      update({
        status: 'error',
        steps: null,
        updatedAt: null,
        message: error instanceof Error ? error.message : 'Could not read system step count.',
      });
    }
  }

  function refresh() {
    if (!active) return Promise.resolve();
    if (!pending) {
      pending = read().finally(() => {
        pending = null;
      });
    }
    return pending;
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setActive(value: boolean) {
      active = value;
      if (active) void refresh();
    },
    refresh,
    requestPermission() {
      permissionRequested = true;
      return refresh();
    },
  };
}
