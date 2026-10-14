import type { AppProps } from "next/app";
import "../styles/index.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  // No page-level wait animation — route changes must feel instant.
  return <Component {...pageProps} />;
}
