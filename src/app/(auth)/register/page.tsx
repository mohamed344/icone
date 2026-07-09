import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/AuthForm";
import { bootstrapRegister } from "../actions";

/**
 * Bootstrap register: only reachable while no account exists yet. Once an admin
 * has been created, registration_open() returns false and we send users to /login.
 */
export default async function RegisterPage() {
  const supabase = await createClient();
  const { data: open } = await supabase.rpc("registration_open");
  if (open === false) redirect("/login");

  return <AuthForm mode="register" action={bootstrapRegister} />;
}
