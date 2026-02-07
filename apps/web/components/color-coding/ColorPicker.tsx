/**
 * ColorPicker wrapper component
 * Wraps Mantine's ColorInput with preset palette support
 */

'use client';

import { ColorInput } from '@mantine/core';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presets?: string[];
}

export function ColorPicker({ value, onChange, label, presets }: ColorPickerProps) {
  const defaultPresets = [
    '#90ee90', // Light green
    '#ffd700', // Gold
    '#d3d3d3', // Light gray
    '#ffcccb', // Light red
    '#e3f2fd', // Light blue
    '#fff9c4', // Light yellow
    '#f44336', // Red
    '#ff9800', // Orange
    '#ffeb3b', // Yellow
    '#4caf50', // Green
    '#2196f3', // Blue
    '#9c27b0', // Purple
  ];

  return (
    <ColorInput
      className={styles.colorPicker}
      label={label}
      value={value}
      onChange={onChange}
      format="hex"
      swatches={presets || defaultPresets}
      swatchesPerRow={6}
      withEyeDropper={false}
    />
  );
}
