/**
 * Numeric Gradient Filter Editor
 * Grid-based layout with sortable gradient stops.
 * Drag-and-drop reordering enforces non-decreasing value sequence.
 */

'use client';

import { TextInput, Stack, Button, NumberInput, ActionIcon, Text } from '@mantine/core';
import { IconTrash, IconPlus, IconGripVertical } from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ColorPicker } from './ColorPicker';
import type { NumericGradientRule } from '@/lib/types/color-filters';
import styles from './NumericGradientFilterEditor.module.css';

interface NumericGradientFilterEditorProps {
  filter: NumericGradientRule;
  onChange: (filter: NumericGradientRule) => void;
  availableColumns: string[];
}

function SortableStop({
  stop,
  index,
  stopCount,
  minValue,
  maxValue,
  onValueChange,
  onColorChange,
  onRemove,
}: {
  stop: { value: number; color: string };
  index: number;
  stopCount: number;
  minValue: number | undefined;
  maxValue: number | undefined;
  onValueChange: (value: number) => void;
  onColorChange: (color: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `stop-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleValueChange = (val: string | number) => {
    let numVal = Number(val) || 0;
    if (minValue !== undefined) numVal = Math.max(numVal, minValue);
    if (maxValue !== undefined) numVal = Math.min(numVal, maxValue);
    onValueChange(numVal);
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.stopRow}>
      <ActionIcon variant="subtle" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <IconGripVertical size={16} />
      </ActionIcon>
      <NumberInput
        value={stop.value}
        onChange={handleValueChange}
        min={minValue}
        max={maxValue}
        size="xs"
      />
      <ColorPicker
        value={stop.color}
        onChange={onColorChange}
      />
      <ActionIcon
        color="red"
        variant="subtle"
        onClick={onRemove}
        disabled={stopCount <= 1}
      >
        <IconTrash size={16} />
      </ActionIcon>
    </div>
  );
}

export function NumericGradientFilterEditor({
  filter,
  onChange,
  availableColumns,
}: NumericGradientFilterEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddStop = () => {
    const lastStop = filter.stops[filter.stops.length - 1];
    const newStops = [
      ...filter.stops,
      { value: lastStop ? lastStop.value : 0, color: '#ffffff' },
    ];
    onChange({ ...filter, stops: newStops });
  };

  const handleRemoveStop = (index: number) => {
    const newStops = filter.stops.filter((_, i) => i !== index);
    onChange({ ...filter, stops: newStops });
  };

  const handleValueChange = (index: number, value: number) => {
    const newStops = [...filter.stops];
    newStops[index] = { ...newStops[index], value };
    onChange({ ...filter, stops: newStops });
  };

  const handleColorChange = (index: number, color: string) => {
    const newStops = [...filter.stops];
    newStops[index] = { ...newStops[index], color };
    onChange({ ...filter, stops: newStops });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(String(active.id).replace('stop-', ''));
    const newIndex = parseInt(String(over.id).replace('stop-', ''));
    const reordered = arrayMove([...filter.stops], oldIndex, newIndex);

    // Clamp the dragged stop's value to fit between its new neighbors
    const draggedValue = reordered[newIndex].value;
    const prevValue = newIndex > 0 ? reordered[newIndex - 1].value : undefined;
    const nextValue = newIndex < reordered.length - 1 ? reordered[newIndex + 1].value : undefined;

    let clampedValue = draggedValue;
    if (prevValue !== undefined && clampedValue < prevValue) clampedValue = prevValue;
    if (nextValue !== undefined && clampedValue > nextValue) clampedValue = nextValue;

    if (clampedValue !== draggedValue) {
      reordered[newIndex] = { ...reordered[newIndex], value: clampedValue };
    }

    onChange({ ...filter, stops: reordered });
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

      <div className={styles.stopsGrid}>
        <div className={styles.headerRow}>
          <div />
          <Text size="xs" fw={600} c="dimmed">Value</Text>
          <Text size="xs" fw={600} c="dimmed">Color</Text>
          <Text size="xs" fw={600} c="dimmed">Delete</Text>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filter.stops.map((_, i) => `stop-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            {filter.stops.map((stop, index) => (
              <SortableStop
                key={`stop-${index}`}
                stop={stop}
                index={index}
                stopCount={filter.stops.length}
                minValue={index > 0 ? filter.stops[index - 1].value : undefined}
                maxValue={index < filter.stops.length - 1 ? filter.stops[index + 1].value : undefined}
                onValueChange={(val) => handleValueChange(index, val)}
                onColorChange={(color) => handleColorChange(index, color)}
                onRemove={() => handleRemoveStop(index)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

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
