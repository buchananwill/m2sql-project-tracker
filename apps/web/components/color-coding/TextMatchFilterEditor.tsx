/**
 * Text Match Filter Editor
 * Allows configuring exact text matching filters
 */

'use client';

import { TextInput, Stack } from '@mantine/core';
import { ColorPicker } from './ColorPicker';
import type { TextMatchRule } from '@/lib/types/color-filters';
import styles from './TextMatchFilterEditor.module.css';

interface TextMatchFilterEditorProps {
  filter: TextMatchRule;
  onChange: (filter: TextMatchRule) => void;
  availableColumns: string[];
}

export function TextMatchFilterEditor({
  filter,
  onChange,
  availableColumns,
}: TextMatchFilterEditorProps) {
  return (
    <Stack gap="sm" className={styles.container}>
      <TextInput
        label="Column Name"
        placeholder="e.g., status, task_type"
        value={filter.column}
        onChange={(e) =>
          onChange({ ...filter, column: e.currentTarget.value })
        }
        list="text-columns"
      />
      <datalist id="text-columns">
        {availableColumns.map((col) => (
          <option key={col} value={col} />
        ))}
      </datalist>

      <TextInput
        label="Match Text"
        placeholder="e.g., done, milestone"
        value={filter.matches}
        onChange={(e) =>
          onChange({ ...filter, matches: e.currentTarget.value })
        }
      />

      <ColorPicker
        label="Color"
        value={filter.color}
        onChange={(color) => onChange({ ...filter, color })}
      />
    </Stack>
  );
}
