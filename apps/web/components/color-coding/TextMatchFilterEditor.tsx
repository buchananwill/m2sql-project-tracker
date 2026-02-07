/**
 * Text Match Filter Editor
 * Allows configuring flexible text matching filters
 * Supports exact match, contains, and regex
 */

'use client';

import { TextInput, Stack, Select, Checkbox } from '@mantine/core';
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
  const getPlaceholder = () => {
    switch (filter.matchType) {
      case 'exact':
        return 'e.g., done, milestone';
      case 'contains':
        return 'e.g., progress, test';
      case 'regex':
        return 'e.g., ^(done|completed)$, \\d+%';
      default:
        return '';
    }
  };

  const getPatternLabel = () => {
    switch (filter.matchType) {
      case 'exact':
        return 'Exact Text';
      case 'contains':
        return 'Contains Text';
      case 'regex':
        return 'Regex Pattern';
      default:
        return 'Pattern';
    }
  };

  return (
    <Stack gap="sm" className={styles.container}>
      <TextInput
        label="Column Name"
        placeholder="e.g., status, task_type, name"
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

      <Select
        label="Match Type"
        value={filter.matchType}
        onChange={(value) =>
          onChange({ ...filter, matchType: value as 'exact' | 'contains' | 'regex' })
        }
        data={[
          { value: 'exact', label: 'Exact Match' },
          { value: 'contains', label: 'Contains' },
          { value: 'regex', label: 'Regular Expression' },
        ]}
      />

      <TextInput
        label={getPatternLabel()}
        placeholder={getPlaceholder()}
        value={filter.pattern}
        onChange={(e) =>
          onChange({ ...filter, pattern: e.currentTarget.value })
        }
      />

      <Checkbox
        label="Ignore case"
        checked={filter.ignoreCase ?? false}
        onChange={(e) =>
          onChange({ ...filter, ignoreCase: e.currentTarget.checked })
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
