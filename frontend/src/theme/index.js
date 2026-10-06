import { createTheme } from '@mui/material/styles';

// JAZ Home Theatres: deep charcoal, warm metallic gold, ivory. Gold signals hierarchy —
// it is used sparingly (active states, key figures, primary accents), never as a fill everywhere.
export const brand = {
  night: '#14110d', // app frame (header + sidebar)
  charcoal: '#1f1a14',
  charcoalSoft: '#2b241c',
  gold: '#a8813d',
  goldBright: '#d4ab55',
  goldDark: '#7d5f28', // gold that passes contrast as text on white
  goldLight: '#f4ecdc',
  ivory: '#f3ead8',
  ink: '#1c1813',
  body: '#5a5246',
  muted: '#8f877a',
  line: '#e7e1d5',
  bg: '#f6f4ef',
  paper: '#ffffff'
};

// Chart series: charcoal and gold lead; the rest stay muted so gold keeps meaning something.
export const chartColors = ['#1f1a14', '#a8813d', '#6b5a43', '#d4ab55', '#8f877a', '#3f5f78', '#2e8b57', '#c4861b'];

const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
export const serif = `'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif`;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { light: '#efebe3', main: brand.charcoal, dark: brand.night, 200: '#c9c1b3', 800: brand.night, contrastText: brand.ivory },
    secondary: { light: brand.goldLight, main: brand.gold, dark: brand.goldDark, contrastText: '#ffffff' },
    success: { light: '#dcf1e3', main: '#2e8b57', dark: '#21693f' },
    warning: { light: '#fbefd3', main: '#c4861b', dark: '#9a6812' },
    error: { light: '#f8e0dc', main: '#b8432f', dark: '#933422' },
    info: { light: '#e9eef2', main: '#3f5f78', dark: '#2e475b' },
    grey: { 100: '#f6f4ef', 200: '#eeeae2', 300: brand.line, 500: brand.muted, 700: brand.body, 900: brand.ink },
    text: { primary: brand.ink, secondary: brand.body, dark: brand.ink },
    divider: brand.line,
    background: { paper: brand.paper, default: brand.bg }
  },
  typography: {
    fontFamily: sans,
    h1: { fontFamily: serif, fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-0.01em', color: brand.ink },
    h2: { fontFamily: serif, fontSize: '1.95rem', fontWeight: 600, letterSpacing: '-0.005em', color: brand.ink },
    h3: { fontSize: '1.15rem', fontWeight: 650, letterSpacing: '-0.012em', color: brand.ink },
    h4: { fontSize: '1.02rem', fontWeight: 650, letterSpacing: '-0.01em', color: brand.ink },
    h5: { fontSize: '0.9rem', fontWeight: 600, color: brand.ink },
    h6: { fontSize: '0.8rem', fontWeight: 600, color: brand.ink },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.006em' },
    subtitle2: { fontWeight: 600 },
    body1: { fontSize: '0.95rem', letterSpacing: '-0.003em' },
    body2: { fontSize: '0.875rem', letterSpacing: '-0.002em' },
    overline: { letterSpacing: '0.14em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.004em' }
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' } }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 18, transition: 'background-color .2s ease, box-shadow .2s ease, border-color .2s ease' },
        containedPrimary: { '&:hover': { backgroundColor: brand.charcoalSoft } },
        containedSecondary: { color: '#fff', '&:hover': { backgroundColor: brand.goldDark } },
        outlinedPrimary: { borderColor: '#cfc6b6', '&:hover': { borderColor: brand.charcoal, backgroundColor: 'rgba(31,26,20,.04)' } },
        sizeLarge: { paddingBlock: 11, fontSize: '0.95rem' }
      }
    },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { rounded: { borderRadius: 10 } } },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 10, border: `1px solid ${brand.line}`, boxShadow: '0 1px 2px rgba(28,24,19,.04), 0 10px 26px -20px rgba(28,24,19,.28)' }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8, backgroundColor: '#fdfcfa',
          '& fieldset': { borderColor: brand.line },
          '&:hover fieldset': { borderColor: '#cbbf9f' },
          '&.Mui-focused': { backgroundColor: '#fff' },
          '&.Mui-focused fieldset': { borderColor: brand.gold, borderWidth: 1.5, boxShadow: `0 0 0 3px ${brand.goldLight}` }
        }
      }
    },
    MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: brand.goldDark } } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 46, '&.Mui-selected': { color: brand.ink } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: brand.gold, height: 2 } } },
    MuiStepIcon: { styleOverrides: { root: { '&.Mui-active': { color: brand.gold }, '&.Mui-completed': { color: brand.charcoal } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: brand.line } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 6, background: brand.ink, fontSize: 12, padding: '6px 10px' } } }
  }
});

export default theme;
