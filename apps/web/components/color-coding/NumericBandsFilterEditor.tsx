/**
 * Numeric Bands Filter Editor
 * Allows configuring discrete integer range filters
 */

'use client';

import { TextInput, Stack, Group, Button, NumberInput, ActionIcon } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { ColorPicker } from './ColorPicker';
import type { NumericBandsRule } from '@/lib/types/color-filters';
import styles from './NumericBandsFilterEditor.module.css';

interface NumericBandsFilterEditorProps {
  filter: NumericBandsRule;
  onChange: (filter: NumericBandsRule) => void;
  availableColumns: string[];
}

export function NumericBandsFilterEditor({
  filter,
  onChange,
  availableColumns,
}: NumericBandsFilterEditorProps) {
  const handleAddBand = () => {
    const newBands = [
      ...filter.bands,
      { min: 0, max: 10, color: '#ffffff' },
    ];
    onChange({ ...filter, bands: newBands });
  };

  const handleRemoveBand = (index: number) => {
    const newBands = filter.bands.filter((_, i) => i !== index);
    onChange({ ...filter, bands: newBands });
  };

  const handleBandChange = (
    index: number,
    field: 'min' | 'max' | 'color',
    value: number | string
  ) => {
    const newBands = [...filter.bands];
    if (field === 'min') {
      newBands[index] = { ...newBands[index], min: value as number };
    } else if (field === 'max') {
      newBands[index] = { ...newBands[index], max: value as number };
    } else {
      newBands[index] = { ...newBands[index], color: value as string };
    }
    onChange({ ...filter, bands: newBands });
  };

  return (
    <Stack gap="sm" className={styles.container}>
      <TextInput
        label="Column Name"
        placeholder="e.g., priority, severity"
        value={filter.column}
        onChange={(e) =>
          onChange({ ...filter, column: e.currentTarget.value })
        }
        list="numeric-columns"
      />
      <datalist id="numeric-columns">
        {availableColumns.map((col) => (
          <option key={col} value={col} />
        ))}
      </datalist>

      <Stack gap="xs">
        {filter.bands.map((band, index) => (
          <Group key={index} gap="xs" align="flex-end">
            <NumberInput
              label={index === 0 ? 'Min' : undefined}
              placeholder="Min value"
              value={band.min}
              onChange={(val) => {
                if (typeof val === 'number') handleBandChange(index, 'min', val);
              }}
              clampBehavior="blur"
              style={{ flex: 1 }}
            />
            <NumberInput
              label={index === 0 ? 'Max' : undefined}
              placeholder="Max value"
              value={band.max}
              onChange={(val) => {
                if (typeof val === 'number') handleBandChange(index, 'max', val);
              }}
              clampBehavior="blur"
              style={{ flex: 1 }}
            />
            <ColorPicker
              label={index === 0 ? 'Color' : undefined}
              value={band.color}
              onChange={(color) => handleBandChange(index, 'color', color)}
            />
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => handleRemoveBand(index)}
              disabled={filter.bands.length <= 1}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      <Button
        leftSection={<IconPlus size={16} />}
        variant="light"
        onClick={handleAddBand}
        size="sm"
      >
        Add Band
      </Button>
    </Stack>
  );
}
