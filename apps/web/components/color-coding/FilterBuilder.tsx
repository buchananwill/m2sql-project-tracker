/**
 * FilterBuilder component
 * Manages a list of filters with drag-and-drop reordering
 */

'use client';

import { useState } from 'react';
import { Stack, Group, Button, Select, ActionIcon, Text, Collapse, Paper } from '@mantine/core';
import { IconTrash, IconGripVertical, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
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
import type { ColorFilter } from '@/lib/types/color-filters';
import { TextMatchFilterEditor } from './TextMatchFilterEditor';
import { NumericGradientFilterEditor } from './NumericGradientFilterEditor';
import { NumericBandsFilterEditor } from './NumericBandsFilterEditor';
import styles from './FilterBuilder.module.css';

interface FilterBuilderProps {
  filters: ColorFilter[];
  onChange: (filters: ColorFilter[]) => void;
  availableColumns: string[];
}

function SortableFilterItem({
  filter,
  index,
  onUpdate,
  onRemove,
  availableColumns,
}: {
  filter: ColorFilter;
  index: number;
  onUpdate: (filter: ColorFilter) => void;
  onRemove: () => void;
  availableColumns: string[];
}) {
  const [expanded, setExpanded] = useState(true);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `filter-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getFilterLabel = (filter: ColorFilter): string => {
    switch (filter.type) {
      case 'text_match': {
        const matchTypeLabel = {
          exact: '=',
          contains: 'contains',
          regex: 'regex',
        }[filter.matchType];
        const caseLabel = filter.ignoreCase ? ' (ignore case)' : '';
        return `Text: ${filter.column || '(column)'} ${matchTypeLabel} "${filter.pattern || '(pattern)'}"${caseLabel}`;
      }
      case 'numeric_gradient':
        return `Gradient: ${filter.column || '(column)'} (${filter.stops.length} stops)`;
      case 'numeric_bands':
        return `Bands: ${filter.column || '(column)'} (${filter.bands.length} bands)`;
      default:
        return 'Unknown Filter';
    }
  };

  return (
    <Paper ref={setNodeRef} style={style} className={styles.filterItem} withBorder>
      <Group gap="xs" mb={expanded ? 'sm' : 0}>
        <ActionIcon variant="subtle" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
          <IconGripVertical size={16} />
        </ActionIcon>
        <Text size="sm" style={{ flex: 1 }}>
          {getFilterLabel(filter)}
        </Text>
        <ActionIcon
          variant="subtle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </ActionIcon>
        <ActionIcon color="red" variant="subtle" onClick={onRemove}>
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      <Collapse in={expanded}>
        {filter.type === 'text_match' && (
          <TextMatchFilterEditor
            filter={filter}
            onChange={onUpdate}
            availableColumns={availableColumns}
          />
        )}
        {filter.type === 'numeric_gradient' && (
          <NumericGradientFilterEditor
            filter={filter}
            onChange={onUpdate}
            availableColumns={availableColumns}
          />
        )}
        {filter.type === 'numeric_bands' && (
          <NumericBandsFilterEditor
            filter={filter}
            onChange={onUpdate}
            availableColumns={availableColumns}
          />
        )}
      </Collapse>
    </Paper>
  );
}

export function FilterBuilder({ filters, onChange, availableColumns }: FilterBuilderProps) {
  const [filterTypeToAdd, setFilterTypeToAdd] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('filter-', ''));
      const newIndex = parseInt(String(over.id).replace('filter-', ''));
      onChange(arrayMove(filters, oldIndex, newIndex));
    }
  };

  const handleAddFilter = () => {
    if (!filterTypeToAdd) return;

    let newFilter: ColorFilter;
    switch (filterTypeToAdd) {
      case 'text_match':
        newFilter = {
          type: 'text_match',
          column: '',
          matchType: 'contains',
          pattern: '',
          ignoreCase: true,
          color: '#90ee90',
        };
        break;
      case 'numeric_gradient':
        newFilter = {
          type: 'numeric_gradient',
          column: '',
          stops: [
            { value: 0, color: '#ffffff' },
            { value: 100, color: '#000000' },
          ],
        };
        break;
      case 'numeric_bands':
        newFilter = {
          type: 'numeric_bands',
          column: '',
          bands: [{ min: 0, max: 10, color: '#ffffff' }],
        };
        break;
      default:
        return;
    }

    onChange([...filters, newFilter]);
    setFilterTypeToAdd(null);
  };

  const handleRemoveFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const handleUpdateFilter = (index: number, filter: ColorFilter) => {
    const newFilters = [...filters];
    newFilters[index] = filter;
    onChange(newFilters);
  };

  return (
    <Stack gap="md" className={styles.container}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filters.map((_, i) => `filter-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <Stack gap="sm">
            {filters.map((filter, index) => (
              <SortableFilterItem
                key={`filter-${index}`}
                filter={filter}
                index={index}
                onUpdate={(f) => handleUpdateFilter(index, f)}
                onRemove={() => handleRemoveFilter(index)}
                availableColumns={availableColumns}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      {filters.length === 0 && (
        <Text size="sm" c="dimmed" ta="center">
          No filters added yet. Add a filter below to get started.
        </Text>
      )}

      <Group gap="xs">
        <Select
          placeholder="Select filter type"
          value={filterTypeToAdd}
          onChange={setFilterTypeToAdd}
          data={[
            { value: 'text_match', label: 'Text Match' },
            { value: 'numeric_gradient', label: 'Numeric Gradient' },
            { value: 'numeric_bands', label: 'Numeric Bands' },
          ]}
          style={{ flex: 1 }}
        />
        <Button onClick={handleAddFilter} disabled={!filterTypeToAdd}>
          Add Filter
        </Button>
      </Group>
    </Stack>
  );
}
