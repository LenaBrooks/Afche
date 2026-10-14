import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import {
  ensureAdminSession,
  markAdminAuthed,
} from "../../utils/adminSession";

const AdminLogin: NextPage = () => {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    userRef.current?.focus();
    void router.prefetch("/admin");
    void ensureAdminSession().then((ok) => {
      if (ok) void router.replace("/admin");
    });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || "ورود ناموفق بود";
        setError(msg);
        if (!reduceMotion) {
          setShake(true);
          window.setTimeout(() => setShake(false), 450);
        }
        toast.error(msg);
        return;
      }
      markAdminAuthed();
      toast.success("ورود موفق");
      await router.replace("/admin");
    } catch {
      const msg = "خطای شبکه. دوباره تلاش کنید.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>ورود مدیر</title>
      </Head>
      <main className="af-admin mx-auto flex min-h-screen max-w-md flex-col justify-center px-3 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[var(--af-text)] sm:px-4">
        <motion.div
          animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)] p-5 shadow-[var(--af-shadow)] sm:p-8"
        >
          <p className="af-brand mb-2 text-xs font-semibold text-[var(--af-accent)]">
            AFCHE
          </p>
          <h1 className="mb-2 text-2xl font-bold">ورود مدیر</h1>
          <p className="mb-8 text-sm text-[var(--af-muted)]">
            برای مدیریت و تأیید عکس‌ها وارد شوید.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--af-muted)]">نام کاربری</span>
              <input
                ref={userRef}
                className="af-focusable min-h-11 rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-input-bg)] px-3 py-2.5 text-[var(--af-text)] outline-none transition focus:border-[var(--af-accent)]/50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[var(--af-muted)]">رمز عبور</span>
              <input
                type="password"
                className="af-focusable min-h-11 rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-input-bg)] px-3 py-2.5 text-[var(--af-text)] outline-none transition focus:border-[var(--af-accent)]/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-[var(--af-radius-md)] border border-[var(--af-danger)]/25 bg-[var(--af-danger-soft)] px-3 py-2 text-sm text-[var(--af-danger)]"
              >
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="mt-1 w-full">
              {loading ? "در حال ورود…" : "ورود"}
            </Button>
          </form>

          <Link
            href="/"
            prefetch
            className="mt-6 inline-block text-sm text-[var(--af-muted)] transition hover:text-[var(--af-text)]"
          >
            بازگشت به گالری
          </Link>
        </motion.div>
      </main>
    </>
  );
};

export default AdminLogin;
