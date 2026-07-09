import { AuthForm } from "@/components/auth/AuthForm";
import { signIn } from "../actions";

export default function LoginPage() {
  return <AuthForm mode="login" action={signIn} />;
}
