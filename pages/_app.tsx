import type { AppProps } from "next/app";
import ThemeSync from "../components/ThemeSync";
import UploadFloatingBar from "../components/UploadFloatingBar";
import { UploadQueueProvider } from "../components/UploadQueueProvider";
import { ToastProvider } from "../components/ui/Toast";
import type { SiteTheme } from "../utils/siteSettingsShared";
import "../styles/index.css";

type PageProps = {
  settings?: { theme?: SiteTheme };
  theme?: SiteTheme;
};

export default function MyApp({ Component, pageProps }: AppProps<PageProps>) {
  const theme = pageProps.theme || pageProps.settings?.theme;

  return (
    <ToastProvider>
      <UploadQueueProvider>
        <ThemeSync theme={theme} />
        <Component {...pageProps} />
        <UploadFloatingBar />
      </UploadQueueProvider>
    </ToastProvider>
  );
}
