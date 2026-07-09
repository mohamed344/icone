"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/theme-context";
import { resolveMode, ENABLED_LANGUAGES } from "@/lib/theme/theme-config";
import type { AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const LANG_LABEL: Record<string, string> = { en: "EN", ar: "ع", fr: "FR" };

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({ mode, action }: { mode: "login" | "register"; action: Action }) {
  const t = useT();
  const { theme, setTheme, ready } = useTheme();
  // Gate on `ready` so the first client render matches the server (avoids a
  // hydration mismatch: resolveMode("system") reads matchMedia on the client).
  const isDark = ready && resolveMode(theme.mode) === "dark";
  const [showPwd, setShowPwd] = useState(false);
  const isLogin = mode === "login";

  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  const showLang = ENABLED_LANGUAGES.length > 1;
  const cycleLang = () =>
    setTheme({
      language:
        ENABLED_LANGUAGES[(ENABLED_LANGUAGES.indexOf(theme.language) + 1) % ENABLED_LANGUAGES.length],
    });

  return (
    <div className="animate-fade-up">
      {/* mini theme/lang controls */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/login" className="flex items-center gap-2 lg:invisible">
          <Image src="/icone-mark.png" alt={t("app.name")} width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="font-display font-semibold text-foreground">{t("app.name")}</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {showLang && (
            <button
              onClick={cycleLang}
              type="button"
              className="ring-accent inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-muted transition-colors hover:text-[var(--accent)]"
            >
              <Languages className="h-4 w-4" />
              {LANG_LABEL[theme.language]}
            </button>
          )}
          <button
            onClick={() => setTheme({ mode: isDark ? "light" : "dark" })}
            type="button"
            className="ring-accent grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-muted transition-colors hover:text-[var(--accent)]"
            aria-label="Theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        {isLogin ? t("auth.login.title") : t("auth.register.title")}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isLogin ? t("auth.login.subtitle") : t("auth.register.subtitle")}
      </p>

      {state?.error && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.notice && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.notice}</span>
        </div>
      )}

      <form action={formAction} className="mt-8 space-y-4">
        {!isLogin && (
          <Input name="name" label={t("auth.name")} placeholder="Your name" icon={<User className="h-4 w-4" />} autoComplete="name" />
        )}
        <Input
          name="email"
          type="email"
          required
          label={t("auth.email")}
          placeholder="you@company.com"
          icon={<Mail className="h-4 w-4" />}
          autoComplete="email"
        />
        <div className="relative">
          <Input
            name="password"
            type={showPwd ? "text" : "password"}
            required
            label={t("auth.password")}
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute end-3 top-[2.4rem] text-faint transition-colors hover:text-foreground"
            aria-label="Toggle password"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {isLogin && (
          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-muted">
              <input type="checkbox" name="remember" className="peer sr-only" />
              <span className="grid h-4 w-4 place-items-center rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] peer-checked:bg-accent-gradient peer-checked:border-transparent" />
              {t("auth.remember")}
            </label>
            <a href="#" className="font-medium text-[var(--accent)] hover:underline">
              {t("auth.forgot")}
            </a>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {isLogin ? t("auth.signIn") : t("auth.signUp")}
              <ArrowRight className="h-4 w-4 flip-rtl" />
            </>
          )}
        </Button>

        {!isLogin && <p className="text-center text-xs text-faint">{t("auth.terms")}</p>}
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
        <Link
          href={isLogin ? "/register" : "/login"}
          className="font-semibold text-[var(--accent)] hover:underline"
        >
          {isLogin ? t("auth.createOne") : t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
