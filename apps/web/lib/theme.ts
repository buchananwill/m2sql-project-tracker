/**
 * Mantine theme configuration.
 * Customize colors, fonts, and component styles here.
 */

import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /** Primary color used for interactive elements */
  primaryColor: 'blue',

  /** Font family for all text */
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  /** Monospace font for code/editor */
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',

  /** Enable smooth scrolling */
  respectReducedMotion: true,

  /** Customize component defaults */
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        p: 'md',
      },
    },
  },
});
