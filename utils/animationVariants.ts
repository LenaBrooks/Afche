import type { Variants } from "framer-motion";

// direction > 0 = رفتن به عکس بعدی (سمت چپ در RTL)
// direction === 0 = باز شدن اولیه — فقط fade، بدون پرش افقی
export const variants: Variants = {
  enter: (direction: number) => ({
    x: direction === 0 ? 0 : direction > 0 ? -28 : 28,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction === 0 ? 0 : direction > 0 ? 28 : -28,
    opacity: 0,
  }),
};
