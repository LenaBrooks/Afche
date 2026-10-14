import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/router";
import {
  AnchorHTMLAttributes,
  forwardRef,
  PointerEvent,
  ReactNode,
} from "react";

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

/**
 * Prefetches on pointerdown (earlier than hover) for snappier admin navigation.
 */
const AdminNavLink = forwardRef<HTMLAnchorElement, Props>(
  function AdminNavLink({ href, onPointerDown, children, ...rest }, ref) {
    const router = useRouter();
    const url = typeof href === "string" ? href : href.pathname || "";

    function warm(e: PointerEvent<HTMLAnchorElement>) {
      if (url) void router.prefetch(url);
      onPointerDown?.(e);
    }

    return (
      <Link ref={ref} href={href} prefetch onPointerDown={warm} {...rest}>
        {children}
      </Link>
    );
  },
);

export default AdminNavLink;
