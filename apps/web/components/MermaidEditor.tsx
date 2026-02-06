'use client';

import { Textarea, Paper, Box } from '@mantine/core';
import { useState, useEffect, useRef } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useAppStore } from '@/stores/useAppStore';

export function MermaidEditor() {
  // Subscribe to store
  const mermaidText = useAppStore((state) => state.mermaidText);
  const parseAndSetDatabase = useAppStore((state) => state.parseAndSetDatabase);

  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(mermaidText);

  // Debounce the local value before notifying store
  const [debouncedValue] = useDebouncedValue(localValue, 500);

  // Keep stable reference to parseAndSetDatabase
  const parseRef = useRef(parseAndSetDatabase);
  useEffect(() => {
    parseRef.current = parseAndSetDatabase;
  }, [parseAndSetDatabase]);

  // Track if we're syncing from external source to prevent stale updates
  const isSyncingRef = useRef(false);

  // Sync external value changes (e.g., from file upload or pull)
  useEffect(() => {
    console.log('[MermaidEditor] Value prop changed, length:', mermaidText.length);

    // Mark that we're syncing from external source
    isSyncingRef.current = true;
    setLocalValue(mermaidText);

    // Clear sync flag after a short delay (longer than debounce)
    const timer = setTimeout(() => {
      isSyncingRef.current = false;
    }, 600);

    return () => clearTimeout(timer);
  }, [mermaidText]);

  // Notify store when debounced value changes
  useEffect(() => {
    console.log(
      '[MermaidEditor] Debounced value updated, length:',
      debouncedValue.length
    );
    console.log(
      '[MermaidEditor] Comparing with value prop, length:',
      mermaidText.length
    );
    console.log('[MermaidEditor] isSyncing:', isSyncingRef.current);

    // Don't notify if we're currently syncing from external source
    if (isSyncingRef.current) {
      console.log(
        '[MermaidEditor] Skipping onChange - currently syncing from external source'
      );
      return;
    }

    if (debouncedValue !== mermaidText) {
      console.log('[MermaidEditor] Values differ, calling parseAndSetDatabase');
      parseRef.current(debouncedValue);
    } else {
      console.log('[MermaidEditor] Values same, not calling parseAndSetDatabase');
    }
  }, [debouncedValue, mermaidText]);

  return (
    <Paper shadow="sm" withBorder p="md">
      <Textarea
        label="Mermaid Diagram"
        placeholder="Paste or type your Mermaid classDiagram..."
        value={localValue}
        onChange={(e) => setLocalValue(e.currentTarget.value)}
        styles={{
          input: {
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            resize: 'vertical',
            minHeight: '300px',
            maxHeight: '600px',
            overflow: 'auto',
          },
        }}
      />
    </Paper>
  );
}
