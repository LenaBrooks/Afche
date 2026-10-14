import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { FormEvent, useState } from "react";
import { isAuthenticated } from "../../utils/auth";
import { fadeUp, snappySpring } from "../../utils/motion";

const AdminLogin: NextPage = () => {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const reduceMotion = useReducedMotion();

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
        setError(data.error || "ورود ناموفق بود");
        return;
      }
      router.push("/admin");
    } catch {
      setError("خطای شبکه. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>ورود مدیر</title>
      </Head>
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-white">
        <motion.div
          className="pointer-events-none absolute top-1/4 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#e8c58c]/10 blur-3xl"
          animate={
            reduceMotion
              ? undefined
              : { scale: [1, 1.15, 1], opacity: [0.25, 0.45, 0.25] }
          }
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
          className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"
        >
          <motion.h1 variants={fadeUp} className="mb-2 text-2xl font-semibold">
            ورود مدیر
          </motion.h1>
          <motion.p variants={fadeUp} className="mb-8 text-sm text-white/60">
            برای مدیریت و تأیید عکس‌ها وارد شوید.
          </motion.p>
          <motion.form
            variants={fadeUp}
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1 text-sm">
              نام کاربری
              <input
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 outline-none transition focus:border-[#e8c58c]/50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              رمز عبور
              <input
                type="password"
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 outline-none transition focus:border-[#e8c58c]/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </label>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </motion.p>
            )}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={reduceMotion || loading ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion || loading ? undefined : { scale: 0.98 }}
              transition={snappySpring}
              className="rounded-xl border border-white bg-white px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {loading ? "در حال ورود…" : "ورود"}
            </motion.button>
          </motion.form>
          <motion.div variants={fadeUp}>
            <Link
              href="/"
              className="mt-6 inline-block text-sm text-white/60 hover:text-white"
            >
              بازگشت به گالری ←
            </Link>
          </motion.div>
        </motion.div>
      </main>
    </>
  );
};

export default AdminLogin;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (isAuthenticated(req)) {
    return {
      redirect: { destination: "/admin", permanent: false },
    };
  }
  return { props: {} };
};
