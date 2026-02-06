'use client';

import { Textarea, Paper } from '@mantine/core';
import { useState, useEffect, useRef } from 'react';
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

  // Keep stable reference to onChange
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Track if we're syncing from external source to prevent stale updates
  const isSyncingRef = useRef(false);

  // Sync external value changes (e.g., from file upload)
  useEffect(() => {
    console.log('[MermaidEditor] Value prop changed, length:', value.length);

    // Mark that we're syncing from external source
    isSyncingRef.current = true;
    setLocalValue(value);

    // Clear sync flag after a short delay (longer than debounce)
    const timer = setTimeout(() => {
      isSyncingRef.current = false;
    }, 600);

    return () => clearTimeout(timer);
  }, [value]);

  // Notify parent when debounced value changes
  useEffect(() => {
    console.log('[MermaidEditor] Debounced value updated, length:', debouncedValue.length);
    console.log('[MermaidEditor] Comparing with value prop, length:', value.length);
    console.log('[MermaidEditor] isSyncing:', isSyncingRef.current);

    // Don't notify if we're currently syncing from external source
    if (isSyncingRef.current) {
      console.log('[MermaidEditor] Skipping onChange - currently syncing from external source');
      return;
    }

    if (debouncedValue !== value) {
      console.log('[MermaidEditor] Values differ, calling onChange');
      onChangeRef.current(debouncedValue);
    } else {
      console.log('[MermaidEditor] Values same, not calling onChange');
    }
  }, [debouncedValue, value]);

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
