"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

export interface Notif {
  id: string;
  type: string;
  box_id: string | null;
  title: string;
  body: string | null;
  stage: string | null;
  read: boolean;
  created_at: string;
}

export async function getNotifications(): Promise<Notif[]> {
  const session = await getSessionUser();
  if (!session) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, box_id, title, body, stage, read, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as Notif[]) ?? [];
}

export async function markRead(id: string): Promise<void> {
  const session = await getSessionUser();
  if (!session) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", session.userId);
}

export async function markAllRead(): Promise<void> {
  const session = await getSessionUser();
  if (!session) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", session.userId).eq("read", false);
}
