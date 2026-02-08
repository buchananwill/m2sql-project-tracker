/**
 * GraphConfigPanel component
 * Right-side drawer for configuring graph layout and display settings:
 * - Node sizing mode (fix width / fix height)
 * - Per-table column visibility
 * - Edge inclusion in layout algorithm
 */

'use client';

import { useMemo } from 'react';
import { Drawer, Stack, Switch, Text, Checkbox, Divider, Group } from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';
import { buildGraphFromDatabase } from '@/lib/reactflow-transform';
import type { GraphRendererConfig } from '@/stores/slices/uiSlice';
import styles from './GraphConfigPanel.module.css';

export function GraphConfigPanel() {
  const opened = useAppStore((state) => state.uiState.graphConfigPanelOpen);
  const setOpened = useAppStore((state) => state.setGraphConfigPanelOpen);
  const graphConfig = useAppStore((state) => state.uiState.graphConfig);
  const setGraphConfig = useAppStore((state) => state.setGraphConfig);
  const database = useAppStore((state) => state.database);

  // Extract table → columns mapping and junction table names from the database
  const { tableColumns, junctionTableNames } = useMemo(() => {
    if (!database) return { tableColumns: {} as Record<string, string[]>, junctionTableNames: [] as string[] };

    const graph = buildGraphFromDatabase(database);

    // Group columns by tableName
    const colsByTable: Record<string, Set<string>> = {};
    for (const node of graph.nodes) {
      const table = node.data.tableName as string;
      if (!colsByTable[table]) colsByTable[table] = new Set();
      for (const key of Object.keys(node.data)) {
        if (key !== 'label' && key !== 'name' && key !== 'tableName' && !key.startsWith('_') && key !== 'pk') {
          colsByTable[table].add(key);
        }
      }
    }

    const tableColumns: Record<string, string[]> = {};
    for (const [table, cols] of Object.entries(colsByTable)) {
      tableColumns[table] = Array.from(cols).sort();
    }

    // Extract unique junction table names from edges
    const jtNames = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.data?.junctionTable) {
        jtNames.add(edge.data.junctionTable);
      }
    }

    return { tableColumns, junctionTableNames: Array.from(jtNames).sort() };
  }, [database]);

  const update = (patch: Partial<GraphRendererConfig>) => {
    setGraphConfig({ ...graphConfig, ...patch });
  };

  const toggleColumnVisibility = (tableName: string, column: string) => {
    const current = graphConfig.hiddenColumns[tableName] || [];
    const isHidden = current.includes(column);
    const updated = isHidden
      ? current.filter((c) => c !== column)
      : [...current, column];

    update({
      hiddenColumns: {
        ...graphConfig.hiddenColumns,
        [tableName]: updated,
      },
    });
  };

  const toggleEdgeSource = (junctionTable: string) => {
    const current = graphConfig.excludedEdgeSources;
    const isExcluded = current.includes(junctionTable);
    update({
      excludedEdgeSources: isExcluded
        ? current.filter((s) => s !== junctionTable)
        : [...current, junctionTable],
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={() => setOpened(false)}
      position="right"
      size="400px"
      title="Graph Settings"
    >
      <Stack gap="lg" className={styles.content}>
        {/* Sizing Section */}
        <div>
          <Text fw={600} size="sm" mb="xs">Node Sizing</Text>
          <Stack gap="xs">
            <Switch
              label="Fix width"
              checked={graphConfig.fixWidth}
              onChange={(e) => update({ fixWidth: e.currentTarget.checked })}
            />
            <Switch
              label="Fix height"
              checked={graphConfig.fixHeight}
              onChange={(e) => update({ fixHeight: e.currentTarget.checked })}
            />
          </Stack>
        </div>

        <Divider />

        {/* Column Visibility Section */}
        <div>
          <Text fw={600} size="sm" mb="xs">Column Visibility</Text>
          {Object.keys(tableColumns).length === 0 ? (
            <Text size="sm" c="dimmed">Load data to configure columns</Text>
          ) : (
            <Stack gap="md">
              {Object.entries(tableColumns).map(([tableName, columns]) => (
                <div key={tableName}>
                  <Text size="xs" fw={500} c="dimmed" mb={4}>{tableName}</Text>
                  <Stack gap={4}>
                    {columns.map((col) => {
                      const hidden = graphConfig.hiddenColumns[tableName]?.includes(col) ?? false;
                      return (
                        <Checkbox
                          key={col}
                          label={col}
                          size="xs"
                          checked={!hidden}
                          onChange={() => toggleColumnVisibility(tableName, col)}
                        />
                      );
                    })}
                  </Stack>
                </div>
              ))}
            </Stack>
          )}
        </div>

        <Divider />

        {/* Edge Layout Section */}
        <div>
          <Text fw={600} size="sm" mb="xs">Edge Layout</Text>
          <Text size="xs" c="dimmed" mb="xs">
            Unchecked edge types are still rendered but excluded from the layout algorithm.
          </Text>
          {junctionTableNames.length === 0 ? (
            <Text size="sm" c="dimmed">No edge types found</Text>
          ) : (
            <Stack gap={4}>
              {junctionTableNames.map((jt) => {
                const excluded = graphConfig.excludedEdgeSources.includes(jt);
                return (
                  <Checkbox
                    key={jt}
                    label={jt}
                    size="xs"
                    checked={!excluded}
                    onChange={() => toggleEdgeSource(jt)}
                  />
                );
              })}
            </Stack>
          )}
        </div>
      </Stack>
    </Drawer>
  );
}
