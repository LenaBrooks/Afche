import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import ThemeSync from "../components/ThemeSync";
import UploadFloatingBar from "../components/UploadFloatingBar";
import { UploadQueueProvider } from "../components/UploadQueueProvider";
import { ToastProvider } from "../components/ui/Toast";
import { ADMIN_PREFETCH_ROUTES } from "../utils/adminSession";
import "../styles/index.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // Warm admin chunks as soon as user is anywhere under /admin.
  useEffect(() => {
    if (!router.pathname.startsWith("/admin")) return;
    for (const href of ADMIN_PREFETCH_ROUTES) {
      void router.prefetch(href);
    }
  }, [router, router.pathname]);

  return (
    <ToastProvider>
      <UploadQueueProvider>
        <ThemeSync />
        <Component {...pageProps} />
        <UploadFloatingBar />
      </UploadQueueProvider>
    </ToastProvider>
  );
}
