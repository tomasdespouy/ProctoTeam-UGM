export const colors = {
  ugmNavy: '#1A1D47',
  ugmBlue: '#242F62',
  ugmDeep: '#0F1123',
  ugmCyan: '#00BBFF',
  ugmCyanDark: '#00B8E6',
  ugmCyanBright: '#00D4FF',
  ugmGray: '#D9D9D9',
  ugmWhite: '#FFFFFF',
} as const;

export const shadows = {
  card: '0px 3px 10px 2px rgba(0,0,0,0.27)',
  figma: '0 10px 40px rgba(0, 212, 255, 0.2)',
  figmaHover: '0 15px 50px rgba(0, 212, 255, 0.4)',
  glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
} as const;

export const radii = {
  card: '15px',
  default: '0.9375rem',
} as const;

export const fonts = {
  headline: "'Space Grotesk', sans-serif",
  body: "'Inter', sans-serif",
} as const;

export const borders = {
  cardAccent: `2px solid ${colors.ugmCyan}`,
} as const;

export const tokens = {
  colors,
  shadows,
  radii,
  fonts,
  borders,
} as const;

export default tokens;
