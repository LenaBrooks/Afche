import { useEffect } from "react";
import {
  applySiteTheme,
  DEFAULT_SITE_SETTINGS,
  isSiteTheme,
  THEME_STORAGE_KEY,
  type SiteTheme,
} from "../utils/siteSettingsShared";

type Props = {
  theme?: SiteTheme;
};

/** Keeps html[data-theme] in sync with settings / localStorage. */
export default function ThemeSync({ theme }: Props) {
  useEffect(() => {
    if (isSiteTheme(theme)) {
      applySiteTheme(theme);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (isSiteTheme(stored)) applySiteTheme(stored);

        const res = await fetch("/api/settings");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const next = data?.settings?.theme;
        if (!cancelled && isSiteTheme(next)) applySiteTheme(next);
      } catch {
        if (!cancelled) applySiteTheme(DEFAULT_SITE_SETTINGS.theme);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [theme]);

  return null;
}
