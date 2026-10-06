/**
 * Ink-wash (水墨) palette — V3.5 visual pass.
 *
 * Rather than restyling every component by hand, tailwind.config.ts remaps
 * Tailwind's built-in color families onto these traditional pigments, so every
 * existing `bg-zinc-50` / `text-indigo-600` / `border-rose-200` keeps its role
 * (shade, contrast, state) but renders in the ink-painting palette:
 *
 *   gray / zinc / slate / neutral / stone → 墨  ink (warm, paper-toned greys)
 *   blue / indigo                         → 花青 huaqing (muted indigo ink)
 *   sky / cyan                            → 石青 azurite (blue-green mineral)
 *   purple / violet                       → 黛  dai (dusky plum ink)
 *   red / rose / pink / fuchsia           → 朱砂 cinnabar (seal red)
 *   green / emerald / teal / lime         → 石绿 malachite
 *   amber / orange / yellow               → 赭石 ochre / 藤黄 gamboge
 *
 * Shade semantics match Tailwind's (50 = palest wash, 950 = densest ink), so
 * light-on-dark and dark-on-light pairings keep their contrast.
 */

export const ink = {
  50: "#f7f4ec",
  100: "#efebe0",
  200: "#e0d9ca",
  300: "#c9c0ae",
  400: "#a39a89",
  500: "#7d756a",
  600: "#5e5850",
  700: "#45403a",
  800: "#2f2b27",
  900: "#1f1c19",
  950: "#13110f",
};

export const huaqing = {
  50: "#f1f4f5",
  100: "#e1e8eb",
  200: "#c4d1d7",
  300: "#9fb2bb",
  400: "#76909c",
  500: "#587380",
  600: "#455c68",
  700: "#384a54",
  800: "#2d3b43",
  900: "#232e34",
  950: "#151c20",
};

export const azurite = {
  50: "#eff5f5",
  100: "#dbe9ea",
  200: "#b7d2d4",
  300: "#8db4b8",
  400: "#659397",
  500: "#4c777c",
  600: "#3d6166",
  700: "#324e52",
  800: "#283e41",
  900: "#1f3033",
  950: "#111c1e",
};

export const dai = {
  50: "#f5f2f3",
  100: "#ebe4e7",
  200: "#d6c9cf",
  300: "#b9a6ae",
  400: "#957f89",
  500: "#76626b",
  600: "#5f4e56",
  700: "#4c3f45",
  800: "#3b3136",
  900: "#2c2529",
  950: "#1b1619",
};

export const cinnabar = {
  50: "#fbf3f0",
  100: "#f6e2dc",
  200: "#ecc2b6",
  300: "#de9a88",
  400: "#cc6e57",
  500: "#b54a33",
  600: "#9c3a26",
  700: "#7e2f20",
  800: "#63271c",
  900: "#4b2018",
  950: "#2b110c",
};

export const malachite = {
  50: "#f1f5f1",
  100: "#e0e9e1",
  200: "#c2d4c4",
  300: "#9bb8a0",
  400: "#739a7a",
  500: "#567d5e",
  600: "#44664b",
  700: "#37523d",
  800: "#2c4131",
  900: "#223326",
  950: "#131d16",
};

export const ochre = {
  50: "#faf5ec",
  100: "#f3e7d1",
  200: "#e6cfa4",
  300: "#d5b070",
  400: "#c19248",
  500: "#a87732",
  600: "#8b5f27",
  700: "#6f4b21",
  800: "#573b1c",
  900: "#432e17",
  950: "#26190b",
};

/** Xuan-paper white and dense ink black, replacing pure #fff / #000. */
export const paper = "#fbf8f1";
export const inkBlack = "#13110f";

/** Tailwind family → ink pigment. Used by tailwind.config.ts. */
export const familyMap = {
  gray: ink,
  zinc: ink,
  slate: ink,
  neutral: ink,
  stone: ink,
  blue: huaqing,
  indigo: huaqing,
  sky: azurite,
  cyan: azurite,
  purple: dai,
  violet: dai,
  red: cinnabar,
  rose: cinnabar,
  pink: cinnabar,
  fuchsia: cinnabar,
  green: malachite,
  emerald: malachite,
  teal: malachite,
  lime: malachite,
  amber: ochre,
  orange: ochre,
  yellow: ochre,
} as const;
