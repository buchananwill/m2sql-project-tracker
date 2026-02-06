'use client';

import { Textarea, Paper } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';

interface MermaidEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MermaidEditor({ value, onChange }: MermaidEditorProps) {
  // Debounce parsing to avoid excessive re-renders
  const debouncedOnChange = useDebouncedCallback((newValue: string) => {
    onChange(newValue);
  }, 500);

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Textarea
        label="Mermaid Diagram"
        placeholder="Paste or type your Mermaid classDiagram..."
        minRows={20}
        maxRows={30}
        value={value}
        onChange={(e) => {
          const newValue = e.currentTarget.value;
          debouncedOnChange(newValue);
        }}
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
