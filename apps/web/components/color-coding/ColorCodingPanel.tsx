/**
 * ColorCodingPanel component
 * Right-side drawer for configuring color coding filters.
 * Edits are kept in local state for responsive UI, then debounced
 * before flushing to the Zustand store (which triggers node re-renders).
 */

'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Drawer, Tabs, Stack, Button, Text } from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';
import { transformDatabaseToReactFlow } from '@/lib/reactflow-transform';
import { FilterBuilder } from './FilterBuilder';
import type { ColorFilter, ColorCodingConfig } from '@/lib/types/color-filters';
import styles from './ColorCodingPanel.module.css';

const DEBOUNCE_MS = 250;

export function ColorCodingPanel() {
  const opened = useAppStore((state) => state.uiState.colorCodingPanelOpen);
  const setOpened = useAppStore((state) => state.setColorCodingPanelOpen);
  const storeConfig = useAppStore((state) => state.uiState.colorCodingConfig);
  const setStoreConfig = useAppStore((state) => state.setColorCodingConfig);
  const database = useAppStore((state) => state.database);

  const [localConfig, setLocalConfig] = useState<ColorCodingConfig>(storeConfig);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync from store when panel opens
  useEffect(() => {
    if (opened) setLocalConfig(storeConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Update local state immediately, debounce the store write
  const updateConfig = useCallback((config: ColorCodingConfig) => {
    setLocalConfig(config);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setStoreConfig(config);
    }, DEBOUNCE_MS);
  }, [setStoreConfig]);

  // Extract available column names from transformed graph nodes
  const availableColumns = useMemo(() => {
    if (!database) return [];

    const graph = transformDatabaseToReactFlow(database);
    const columns = new Set<string>();

    graph.nodes.forEach(node => {
      Object.keys(node.data).forEach(key => {
        if (key !== 'label') {
          columns.add(key);
        }
      });
    });

    return Array.from(columns).sort();
  }, [database]);

  const handleBackgroundChange = (filters: ColorFilter[]) => {
    updateConfig({ ...localConfig, background: filters });
  };

  const handleBorderChange = (filters: ColorFilter[]) => {
    updateConfig({ ...localConfig, border: filters });
  };

  const handleTextChange = (filters: ColorFilter[]) => {
    updateConfig({ ...localConfig, text: filters });
  };

  const handleReset = () => {
    const emptyConfig: ColorCodingConfig = {
      background: [],
      border: [],
      text: [],
    };
    setLocalConfig(emptyConfig);
    clearTimeout(debounceRef.current);
    setStoreConfig(emptyConfig); // flush immediately on reset
  };

  return (
    <Drawer
      opened={opened}
      onClose={() => setOpened(false)}
      position="right"
      size="500px"
      title="Color Coding Configuration"
      className={styles.drawer}
    >
      <Stack gap="md" className={styles.content}>
        <Text size="sm" c="dimmed">
          Configure color filters for nodes. Filters are evaluated in priority order (top to bottom).
          First matching filter wins.
        </Text>

        <Tabs defaultValue="background">
          <Tabs.List>
            <Tabs.Tab value="background">Background</Tabs.Tab>
            <Tabs.Tab value="border">Border</Tabs.Tab>
            <Tabs.Tab value="text">Text</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="background" pt="md">
            <FilterBuilder
              filters={localConfig.background}
              onChange={handleBackgroundChange}
              availableColumns={availableColumns}
            />
          </Tabs.Panel>

          <Tabs.Panel value="border" pt="md">
            <FilterBuilder
              filters={localConfig.border}
              onChange={handleBorderChange}
              availableColumns={availableColumns}
            />
          </Tabs.Panel>

          <Tabs.Panel value="text" pt="md">
            <FilterBuilder
              filters={localConfig.text}
              onChange={handleTextChange}
              availableColumns={availableColumns}
            />
          </Tabs.Panel>
        </Tabs>

        <Button
          variant="light"
          color="red"
          onClick={handleReset}
          fullWidth
        >
          Reset All Filters
        </Button>
      </Stack>
    </Drawer>
  );
}
