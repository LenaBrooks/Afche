import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import {
  ensureAdminSession,
  markAdminAuthed,
} from "../../utils/adminSession";

const AdminLogin: NextPage = () => {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [brandTilt, setBrandTilt] = useState({ x: 0, y: 0, active: false });
  const userRef = useRef<HTMLInputElement>(null);
  const brandWrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  function onBrandMove(e: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const el = brandWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setBrandTilt({
      x: py * -10,
      y: px * 14,
      active: true,
    });
  }

  function onBrandLeave() {
    setBrandTilt({ x: 0, y: 0, active: false });
  }

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
        return;
      }
      markAdminAuthed();
      await router.replace("/admin");
    } catch {
      setError("خطای شبکه. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>ورود مدیر · افچه</title>
        <meta name="theme-color" content="#07060a" />
      </Head>

      <main className="af-login relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* Atmosphere */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(232,197,140,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_10%_80%,rgba(120,150,170,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_70%,rgba(232,197,140,0.08),transparent_45%)]" />
          <div className="af-login-orb-a absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,197,140,0.28),transparent_68%)] blur-2xl" />
          <div className="af-login-orb-b absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(160,180,200,0.14),transparent_70%)] blur-3xl" />
          <div className="af-login-grid absolute inset-0" />
          <div className="af-login-noise absolute inset-0" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(7,6,10,0.35)_70%,#07060a_100%)]" />
        </div>

        <div className="relative z-10 w-full max-w-[420px]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-10 text-center"
          >
            <div
              ref={brandWrapRef}
              className="af-login-brand-wrap mb-4"
              onMouseMove={onBrandMove}
              onMouseLeave={onBrandLeave}
            >
              <p
                className={`af-login-brand text-5xl sm:text-6xl${
                  brandTilt.active ? " is-tilting" : ""
                }`}
                style={
                  brandTilt.active
                    ? {
                        transform: `rotateX(${brandTilt.x}deg) rotateY(${brandTilt.y}deg)`,
                      }
                    : undefined
                }
              >
                افچه
              </p>
            </div>
            <motion.div
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-5 h-px w-24 origin-center bg-gradient-to-l from-transparent via-[#e8c58c] to-transparent"
            />
            <p className="mx-auto max-w-[22ch] text-sm leading-7 tracking-wide text-[#e8c58c]/80 sm:max-w-none">
              میلاد عزیزتر از جانم، خوشحالم که دوباره برگشتی
            </p>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 36 }}
            animate={
              shake
                ? { opacity: 1, y: 0, x: [0, -10, 10, -7, 7, 0] }
                : { opacity: 1, y: 0, x: 0 }
            }
            transition={
              shake
                ? { duration: 0.4 }
                : { delay: 0.12, duration: 0.75, ease: [0.22, 1, 0.36, 1] }
            }
            className="af-login-panel rounded-2xl p-6 sm:p-8"
          >
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-[11px] font-medium tracking-[0.18em] text-[#e8c58c]/75">
                  نام کاربری
                </span>
                <input
                  ref={userRef}
                  className="af-login-input min-h-12 rounded-xl px-4 py-3 text-[15px] text-white placeholder:text-white/25"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={loading}
                  placeholder="admin"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="text-[11px] font-medium tracking-[0.18em] text-[#e8c58c]/75">
                  رمز عبور
                </span>
                <input
                  type="password"
                  className="af-login-input min-h-12 rounded-xl px-4 py-3 text-[15px] text-white placeholder:text-white/25"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="af-login-submit mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50"
              >
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a1408]/30 border-t-[#1a1408]" />
                )}
                {loading ? "در حال ورود…" : "ورود به پنل"}
              </button>
            </form>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-8 text-center"
          >
            <Link
              href="/"
              prefetch
              className="inline-flex items-center gap-2 text-sm text-white/35 transition hover:text-[#e8c58c]"
            >
              <span aria-hidden>→</span>
              بازگشت به گالری
            </Link>
          </motion.div>
        </div>
      </main>
    </>
  );
};

export default AdminLogin;
