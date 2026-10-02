/**
 * SchoolBus Parent Application Design Tokens
 * Child Safety & Mobility Platform
 */

export const COLORS = {
  // Brand & Dominant
  primary: '#172554', // Calm deep navy
  primaryLight: '#1E293B',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  blueBorder: '#BFDBFE',
  
  // Surfaces & Background
  background: '#F6F8FB',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  surfaceHighlight: '#F1F5F9',

  // Typography
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Structural Borders
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  borderLight: '#F1F5F9',

  // Semantic Status Tints
  success: '#16A34A',
  successLight: '#DCFCE7',
  successBorder: '#86EFAC',
  successText: '#15803D',

  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FCA5A5',
  dangerText: '#991B1B',

  info: '#0284C7',
  infoLight: '#E0F2FE',
  infoBorder: '#BAE6FD',
  infoText: '#0369A1',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export const SHADOWS = {
  none: {},
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
};
