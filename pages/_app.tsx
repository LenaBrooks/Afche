import type { AppProps } from "next/app";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import "../styles/index.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  // Use pathname only — shallow /p/[id] must NOT remount the gallery page
  // or the lightbox controls will jitter / remount on every photo open.
  const pageKey = router.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <Component {...pageProps} />
      </motion.div>
    </AnimatePresence>
  );
}
