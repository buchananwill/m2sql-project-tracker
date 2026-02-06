'use client';

import { Textarea, Paper } from '@mantine/core';
import { useState, useEffect } from 'react';
import { useDebouncedValue } from '@mantine/hooks';

interface MermaidEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MermaidEditor({ value, onChange }: MermaidEditorProps) {
  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(value);

  // Debounce the local value before notifying parent
  const [debouncedValue] = useDebouncedValue(localValue, 500);

  // Sync external value changes (e.g., from file upload)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Notify parent when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Textarea
        label="Mermaid Diagram"
        placeholder="Paste or type your Mermaid classDiagram..."
        minRows={20}
        maxRows={30}
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        styles={{
          input: {
            fontFamily: 'monospace',
            fontSize: '0.9rem',
          },
        }}
      />
    </Paper>
  );
}
