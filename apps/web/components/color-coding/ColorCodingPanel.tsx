/**
 * ColorCodingPanel component
 * Right-side drawer for configuring color coding filters
 */

'use client';

import { useMemo } from 'react';
import { Drawer, Tabs, Stack, Button, Text } from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';
import { transformDatabaseToReactFlow } from '@/lib/reactflow-transform';
import { FilterBuilder } from './FilterBuilder';
import type { ColorFilter } from '@/lib/types/color-filters';
import styles from './ColorCodingPanel.module.css';

export function ColorCodingPanel() {
  const opened = useAppStore((state) => state.uiState.colorCodingPanelOpen);
  const setOpened = useAppStore((state) => state.setColorCodingPanelOpen);
  const colorCodingConfig = useAppStore((state) => state.uiState.colorCodingConfig);
  const setColorCodingConfig = useAppStore((state) => state.setColorCodingConfig);
  const database = useAppStore((state) => state.database);

  // Extract available column names from transformed graph nodes
  const availableColumns = useMemo(() => {
    if (!database) return [];

    // Transform database to graph to get actual node data structure
    const graph = transformDatabaseToReactFlow(database);
    const columns = new Set<string>();

    // Extract all keys from node data
    graph.nodes.forEach(node => {
      Object.keys(node.data).forEach(key => {
        // Exclude label (it's a display-only field)
        if (key !== 'label') {
          columns.add(key);
        }
      });
    });

    return Array.from(columns).sort();
  }, [database]);

  const handleBackgroundChange = (filters: ColorFilter[]) => {
    setColorCodingConfig({
      ...colorCodingConfig,
      background: filters,
    });
  };

  const handleBorderChange = (filters: ColorFilter[]) => {
    setColorCodingConfig({
      ...colorCodingConfig,
      border: filters,
    });
  };

  const handleTextChange = (filters: ColorFilter[]) => {
    setColorCodingConfig({
      ...colorCodingConfig,
      text: filters,
    });
  };

  const handleReset = () => {
    setColorCodingConfig({
      background: [],
      border: [],
      text: [],
    });
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
              filters={colorCodingConfig.background}
              onChange={handleBackgroundChange}
              availableColumns={availableColumns}
            />
          </Tabs.Panel>

          <Tabs.Panel value="border" pt="md">
            <FilterBuilder
              filters={colorCodingConfig.border}
              onChange={handleBorderChange}
              availableColumns={availableColumns}
            />
          </Tabs.Panel>

          <Tabs.Panel value="text" pt="md">
            <FilterBuilder
              filters={colorCodingConfig.text}
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
