/**
 * Living Notebook palette — warm, papery, earthy.
 * Ported from the glm53 "Living Notebook" design system.
 *
 * Light  = cream paper / ink dark
 * Dark   = old leather book, never pure black
 */

/* ── subject binder colors (earthy, 6-color ring) ── */
export const SUBJECT_PALETTE = [
  '#4c4689', // Indigo
  '#6f8462', // Sage
  '#b07c24', // Amber
  '#b45a3c', // Terracotta
  '#7d4f76', // Plum
  '#4e6e58', // Forest
];

/* ── dark-mode variants of subject colors ── */
export const SUBJECT_PALETTE_DARK = [
  '#9a93d6', // Indigo (moonlit)
  '#9cb48c', // Sage (soft)
  '#d5a24a', // Amber (warm)
  '#d98a6d', // Terracotta (pale)
  '#c094b8', // Plum (blush)
  '#8fb49b', // Forest (mint)
];

export default {
  light: {
    /* paper / background */
    text: '#1a1410',       // ink dark, never pure black
    background: '#faf7f2', // warm cream, never pure white
    card: '#fffcf6',       // slightly brighter cream card
    border: '#e7dece',     // manila folder edge
    subtext: '#7a6e5d',    // muted foreground
    tint: '#4c4689',       // deep indigo (primary)
    tabIconDefault: '#9c9385',
    tabIconSelected: '#4c4689',
    primary: '#4c4689',
    success: '#6f8462',    // sage
    warning: '#b07c24',    // amber

    /* living-notebook extras */
    paper: '#faf7f2',
    ink: '#1a1410',
    desk: '#e9e0cf',       // outside / desk around notebook
    rule: '#e5dbc7',       // lined paper rules
    margin: '#c98a70',     // notebook margin, soft terracotta
    inkAccent: '#8a6d3b',  // fountain pen sepia
    secondary: '#f1eadd',  // manila folder fill
    destructive: '#b5472f',
    sage: '#6f8462',
    amber: '#b07c24',
    terracotta: '#b45a3c',
    plum: '#7d4f76',
    forest: '#4e6e58',
  },
  dark: {
    /* old leather book */
    text: '#EDE6DA',       // warm off-white, never pure white
    background: '#1c1814', // old leather, never pure black
    card: '#252019',       // parchment card
    border: '#372f24',     // warm sepia border
    subtext: '#a3937e',    // muted warm foreground
    tint: '#b2abe2',       // moonlit indigo
    tabIconDefault: '#6b5f50',
    tabIconSelected: '#b2abe2',
    primary: '#b2abe2',
    success: '#9cb48c',    // sage (soft)
    warning: '#d5a24a',    // amber (warm)

    /* living-notebook extras */
    paper: '#1c1814',
    ink: '#EDE6DA',
    desk: '#120f0b',       // dark desk
    rule: '#342d22',       // dark ruled lines
    margin: '#96604a',     // dark margin line
    inkAccent: '#c2a06a',  // warm sepia ink
    secondary: '#302a21',  // dark manila
    destructive: '#d97b62',
    sage: '#9cb48c',
    amber: '#d5a24a',
    terracotta: '#d98a6d',
    plum: '#c094b8',
    forest: '#8fb49b',
  },
};
