/**
 * Numeric Gradient Filter Editor
 * Allows configuring interpolated color gradient filters
 */

'use client';

import { TextInput, Stack, Group, Button, NumberInput, ActionIcon } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { ColorPicker } from './ColorPicker';
import type { NumericGradientRule } from '@/lib/types/color-filters';
import styles from './NumericGradientFilterEditor.module.css';

interface NumericGradientFilterEditorProps {
  filter: NumericGradientRule;
  onChange: (filter: NumericGradientRule) => void;
  availableColumns: string[];
}

export function NumericGradientFilterEditor({
  filter,
  onChange,
  availableColumns,
}: NumericGradientFilterEditorProps) {
  const handleAddStop = () => {
    const newStops = [
      ...filter.stops,
      { value: 0, color: '#ffffff' },
    ];
    onChange({ ...filter, stops: newStops });
  };

  const handleRemoveStop = (index: number) => {
    const newStops = filter.stops.filter((_, i) => i !== index);
    onChange({ ...filter, stops: newStops });
  };

  const handleStopChange = (
    index: number,
    field: 'value' | 'color',
    value: number | string
  ) => {
    const newStops = [...filter.stops];
    if (field === 'value') {
      newStops[index] = { ...newStops[index], value: value as number };
    } else {
      newStops[index] = { ...newStops[index], color: value as string };
    }
    onChange({ ...filter, stops: newStops });
  };

  return (
    <Stack gap="sm" className={styles.container}>
      <TextInput
        label="Column Name"
        placeholder="e.g., hours_estimate, progress"
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
        {filter.stops.map((stop, index) => (
          <Group key={index} gap="xs" align="flex-end">
            <NumberInput
              label={index === 0 ? 'Value' : undefined}
              placeholder="Numeric value"
              value={stop.value}
              onChange={(val) =>
                handleStopChange(index, 'value', Number(val) || 0)
              }
              style={{ flex: 1 }}
            />
            <ColorPicker
              label={index === 0 ? 'Color' : undefined}
              value={stop.color}
              onChange={(color) => handleStopChange(index, 'color', color)}
            />
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => handleRemoveStop(index)}
              disabled={filter.stops.length <= 1}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>

      <Button
        leftSection={<IconPlus size={16} />}
        variant="light"
        onClick={handleAddStop}
        size="sm"
      >
        Add Gradient Stop
      </Button>
    </Stack>
  );
}
