import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";
import {
  ADMIN_PREFETCH_ROUTES,
  clearAdminAuthed,
  ensureAdminSession,
  getAdminSessionCache,
} from "../utils/adminSession";

type Props = {
  children: ReactNode;
};

/**
 * Client auth gate for admin pages.
 * Skips getServerSideProps round-trips so route changes stay on the client.
 * When session is already cached, children render immediately (no spinner flash).
 */
export default function AdminGate({ children }: Props) {
  const router = useRouter();
  const [ok, setOk] = useState(() => getAdminSessionCache() === true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const authed = await ensureAdminSession();
      if (cancelled) return;
      if (!authed) {
        clearAdminAuthed();
        void router.replace("/admin/login");
        return;
      }
      setOk(true);
      for (const href of ADMIN_PREFETCH_ROUTES) {
        void router.prefetch(href);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ok) {
    return (
      <div className="af-admin flex min-h-screen items-center justify-center bg-[var(--af-bg)] text-[var(--af-text)]">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--af-accent)]/30 border-t-[var(--af-accent)]"
          aria-label="در حال بررسی نشست"
        />
      </div>
    );
  }

  return <>{children}</>;
}
