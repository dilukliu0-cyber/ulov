import { useSyncExternalStore } from 'react';

/** Связь React Native <-> живая 3D-сцена (WebView / iframe). */
type Sender = (msg: any) => void;
let sender: Sender | null = null;
let st = { ready: false, error: null as string | null };
let lastState: any = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());
const jumpListeners = new Set<() => void>();

export function setSender(fn: Sender | null) {
  sender = fn;
}

export function send(msg: any) {
  if (msg.type === 'state') lastState = msg;
  if (st.ready && sender) {
    try { sender(msg); } catch {}
  }
}

export function onSceneMessage(raw: string) {
  let m: any;
  try { m = JSON.parse(raw); } catch { return; }
  if (m.type === 'ready') {
    st = { ...st, ready: true };
    emit();
    if (lastState && sender) sender(lastState);
  } else if (m.type === 'error') {
    console.warn('3D error:', m.msg);
    if (!st.ready) { st = { ...st, error: String(m.msg) }; emit(); }
  } else if (m.type === 'jumpDone') {
    jumpListeners.forEach((l) => l());
  }
}

export function markError(msg: string) {
  st = { ...st, error: msg };
  emit();
}

export function useScene3D() {
  return useSyncExternalStore(
    (l) => { ls.add(l); return () => ls.delete(l); },
    () => st,
    () => st,
  );
}
export const scene3dOk = () => st.ready && !st.error;
