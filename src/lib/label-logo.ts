/** Mobile station label logo — replace `/public/cd-label-logo.png` when new asset arrives. */
export const LABEL_LOGO_SRC =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_LABEL_LOGO_SRC?.trim()) ||
  "/cd-label-logo.png";
