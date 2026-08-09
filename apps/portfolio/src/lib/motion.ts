import type { Transition, Variants } from 'framer-motion';

export const motionEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const motionDuration = { fast: 0.22, normal: 0.5, slow: 0.65 } as const;
export const viewportOnce = { once: true, margin: '-48px' } as const;

const revealTransition: Transition = {
  duration: motionDuration.normal,
  ease: motionEase,
};

export const revealUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

export const revealFromLeft: Variants = {
  hidden: { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: revealTransition },
};

export const revealScaleY: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: revealTransition },
};

export const staggerReveal: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};
