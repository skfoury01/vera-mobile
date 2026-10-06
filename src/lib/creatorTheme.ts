// Canonical getTheme(key).preview.accent from Verapage src/lib/creatorThemes.ts.
// Keep this palette in sync with the backend; no alternative mobile theme colors.
export const CREATOR_THEME_ACCENTS = {
  midnight: '#a855f7', platinum: '#e2e8f0', obsidian: '#64748b', royal: '#fbbf24',
  champagne: '#fde047', pink: '#fb7185', sapphire: '#06b6d4', rose: '#f472b6',
} as const;
export type CreatorThemeKey = keyof typeof CREATOR_THEME_ACCENTS;
export const VERA_ACCENT = '#9B5CFF';

function luminance(hex: string) {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function creatorTheme(key: unknown) {
  const themeKey = typeof key === 'string' && Object.hasOwn(CREATOR_THEME_ACCENTS, key) ? key as CreatorThemeKey : null;
  const accent = themeKey ? CREATOR_THEME_ACCENTS[themeKey] : VERA_ACCENT;
  const light = '#FFFFFF', dark = '#12091F';
  const lightContrast = (luminance(light) + 0.05) / (luminance(accent) + 0.05);
  const darkContrast = (luminance(accent) + 0.05) / (luminance(dark) + 0.05);
  return {
    key: themeKey, accent,
    onAccent: lightContrast > darkContrast ? light : dark,
    // Keep text readable for Obsidian while its ring/border still uses canonical slate.
    textAccent: (luminance(accent) + 0.05) / (luminance('#130C1C') + 0.05) >= 4.5 ? accent : '#F8F5FC',
    soft: `${accent}14`, border: `${accent}29`, glow: `${accent}24`,
  };
}
