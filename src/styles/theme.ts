/**
 * AeroChat — Design Tokens
 *
 * "Expedition Tech" aesthetic: brutally minimal.
 * Two colors only. No purple. No gradients. No rounded elements.
 */

import { StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────
// Color Palette (2 colors, period)
// ─────────────────────────────────────────────────────

export const Colors = {
  /** Obsidian Black — primary background */
  BLACK: '#0A0A0A',
  /** Stark White — primary foreground */
  WHITE: '#F5F5F5',
  /** Dim variant for muted text / inactive states */
  DIM: '#555555',
  /** Signal indicator — slightly brighter for active bits */
  SIGNAL: '#AAAAAA',
} as const;

// ─────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────

export const Fonts = {
  /** Monospaced font for terminal aesthetic */
  MONO: 'Courier',
  MONO_SIZE_SM: 11,
  MONO_SIZE_MD: 13,
  MONO_SIZE_LG: 16,
  MONO_SIZE_XL: 20,
} as const;

// ─────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────

export const Layout = {
  /** No border radius anywhere — sharp edges only */
  BORDER_RADIUS: 0,
  /** Consistent padding unit */
  PADDING: 12,
  /** Border width for dividers */
  BORDER_WIDTH: 1,
  /** Status bar height offset */
  STATUS_BAR_HEIGHT: 44,
} as const;

// ─────────────────────────────────────────────────────
// Common Styles
// ─────────────────────────────────────────────────────

export const CommonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.BLACK,
  },
  divider: {
    height: Layout.BORDER_WIDTH,
    backgroundColor: Colors.DIM,
  },
  monoText: {
    fontFamily: Fonts.MONO,
    fontSize: Fonts.MONO_SIZE_MD,
    color: Colors.WHITE,
  },
  monoTextDim: {
    fontFamily: Fonts.MONO,
    fontSize: Fonts.MONO_SIZE_SM,
    color: Colors.DIM,
  },
});
