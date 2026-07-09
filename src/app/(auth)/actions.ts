"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome, type Role } from "@/lib/auth/session";

export interface AuthState {
  error?: string;
  notice?: string;
}

/** Email + password sign-in. Returns an error state, or redirects on success. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const { data } = await supabase.from("profiles").select("role, status").eq("id",
    (await supabase.auth.getUser()).data.user?.id ?? "").single();

  if (data?.status === "disabled") {
    await supabase.auth.signOut();
    return { error: "This account has been disabled. Contact your administrator." };
  }

  redirect(roleHome(data?.role as Role | undefined));
}

/**
 * Bootstrap register — only works while no account exists yet (the first user
 * becomes admin via the DB trigger). Refuses once registration is closed.
 */
export async function bootstrapRegister(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("name") ?? "").trim();
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };

  const supabase = await createClient();

  const { data: open } = await supabase.rpc("registration_open");
  if (open === false) {
    return { error: "Registration is closed. Ask an administrator to create your account." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };

  // If email confirmation is off, a session exists now → go straight in.
  if (data.session) redirect("/admin");

  return { notice: "Account created. Check your email to confirm, then sign in." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
