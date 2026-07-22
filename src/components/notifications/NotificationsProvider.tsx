"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { getNotifications, markAllRead as markAllReadAction, markRead as markReadAction, type Notif } from "@/app/(app)/notifications/actions";
import { notifyChime, ensureAudioUnlocked } from "@/lib/sound";

export interface Toast {
  id: string;
  type: string;
  title: string;
  body: string | null;
  stage: string | null;
  created_at: string;
}

interface Ctx {
  items: Notif[];
  unread: number;
  toasts: Toast[];
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Subscribe to 'box_ready' notifications (returns an unsubscribe fn). */
  onBoxReady: (cb: (n: Notif) => void) => () => void;
  /** Subscribe to every incoming notification (returns an unsubscribe fn). */
  onAny: (cb: (n: Notif) => void) => () => void;
}

const NotificationsContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const boxReadyCbs = useRef<Set<(n: Notif) => void>>(new Set());
  const anyCbs = useRef<Set<(n: Notif) => void>>(new Set());

  const unread = items.filter((i) => !i.read).length;

  // initial load + audio unlock
  useEffect(() => {
    ensureAudioUnlocked();
    getNotifications().then(setItems).catch(() => {});
  }, []);

  const pushToast = useCallback((n: Notif) => {
    const toast: Toast = { id: n.id, type: n.type, title: n.title, body: n.body, stage: n.stage, created_at: n.created_at };
    setToasts((t) => [toast, ...t].slice(0, 4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 7000);
  }, []);

  // realtime subscription
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 50)));
          pushToast(n);
          notifyChime(n.type);
          anyCbs.current.forEach((cb) => cb(n));
          if (n.type === "box_ready") boxReadyCbs.current.forEach((cb) => cb(n));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, pushToast]);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void markReadAction(id);
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllReadAction();
  }, []);

  const onBoxReady = useCallback((cb: (n: Notif) => void) => {
    boxReadyCbs.current.add(cb);
    return () => {
      boxReadyCbs.current.delete(cb);
    };
  }, []);

  const onAny = useCallback((cb: (n: Notif) => void) => {
    anyCbs.current.add(cb);
    return () => {
      anyCbs.current.delete(cb);
    };
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ items, unread, toasts, dismissToast, markRead, markAllRead, onBoxReady, onAny }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
