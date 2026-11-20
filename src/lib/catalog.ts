/** The marker icons a spot can have, by key. */
export const ICONS = [
  "fish", "fish-alt", "shrimp", "shell", "snail", "turtle", "bird", "worm",
  "bug", "anchor", "ship", "sailboat", "wheel", "lifebuoy", "compass",
  "navigation", "flag", "pennant", "pin", "star", "heart", "target",
  "crosshair", "tent", "caravan", "car", "parking", "house", "warehouse",
  "fence", "wall", "container", "construction", "pine", "trees", "mountain",
  "waves", "droplets", "leaf", "binoculars", "fuel", "warning",
] as const;
export type IconKey = (typeof ICONS)[number];

/** The colours a spot or path can have: keys to the theme's tokens. */
export const COLORS = {
  blue: { label: "Blue", token: "var(--chart-1)" },
  orange: { label: "Orange", token: "var(--chart-2)" },
  teal: { label: "Teal", token: "var(--chart-3)" },
  yellow: { label: "Yellow", token: "var(--chart-4)" },
  pink: { label: "Pink", token: "var(--chart-5)" },
  red: { label: "Red", token: "var(--destructive)" },
  green: { label: "Green", token: "var(--success)" },
  sky: { label: "Sky", token: "var(--info)" },
  navy: { label: "Navy", token: "var(--primary)" },
  gray: { label: "Gray", token: "var(--muted-foreground)" },
} as const;
export type ColorKey = keyof typeof COLORS;
export const COLOR_KEYS = Object.keys(COLORS) as [ColorKey, ...ColorKey[]];

export const PATH_KINDS = {
  trotline: "Trotline",
  trolling: "Trolling path",
} as const;
