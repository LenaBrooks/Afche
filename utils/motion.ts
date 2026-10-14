import type { Transition, Variants } from "framer-motion";

export const softSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.85,
};

export const snappySpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: softSpring,
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.12,
    },
  },
};

export const galleryItem: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: softSpring,
  },
};

export const heroStagger: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};
