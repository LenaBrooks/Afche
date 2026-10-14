import { useRouter } from "next/router";
import { useEffect } from "react";
import {
  applyAdminTheme,
  applyPublicTheme,
  readAdminTheme,
} from "../utils/siteSettingsShared";

/** Public gallery stays dark; admin pages use local admin theme preference. */
export default function ThemeSync() {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) applyAdminTheme(readAdminTheme());
    else applyPublicTheme();
  }, [isAdmin]);

  return null;
}
