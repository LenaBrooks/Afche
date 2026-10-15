import type { Variants } from "framer-motion";

// direction > 0 = عکس بعدی (در RTL: خروج به راست، ورود از چپ)
// direction < 0 = عکس قبلی (خروج به چپ، ورود از راست)
// direction === 0 = باز شدن اولیه — فقط fade
const SLIDE = 72;

export const variants: Variants = {
  enter: (direction: number) => ({
    x: direction === 0 ? 0 : direction > 0 ? -SLIDE : SLIDE,
    opacity: direction === 0 ? 0 : 0.35,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction === 0 ? 0 : direction > 0 ? SLIDE : -SLIDE,
    opacity: 0,
  }),
};
