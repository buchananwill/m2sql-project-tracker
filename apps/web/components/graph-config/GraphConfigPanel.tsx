/**
 * GraphConfigPanel component
 * Right-side drawer for configuring graph layout and display settings:
 * - Layout direction (TB / LR / BT / RL)
 * - Node spacing (nodesep / ranksep)
 * - Node sizing mode (fix width / fix height)
 * - Data-driven sizing (numeric column → node dimension)
 * - Per-table column visibility
 * - Edge inclusion in layout algorithm
 */

'use client';

import { useMemo } from 'react';
import {
  Drawer, Stack, Switch, Text, Checkbox, Divider,
  SegmentedControl, Slider, NumberInput, Select,
} from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';
import { buildGraphFromDatabase } from '@/lib/reactflow-transform';
import type { GraphRendererConfig, RankDir, DataDrivenSizingConfig } from '@/stores/slices/uiSlice';
import styles from './GraphConfigPanel.module.css';

export function GraphConfigPanel() {
  const opened = useAppStore((state) => state.uiState.graphConfigPanelOpen);
  const setOpened = useAppStore((state) => state.setGraphConfigPanelOpen);
  const graphConfig = useAppStore((state) => state.uiState.graphConfig);
  const setGraphConfig = useAppStore((state) => state.setGraphConfig);
  const database = useAppStore((state) => state.database);

  // Extract table → columns mapping, junction table names, and numeric columns
  const { tableColumns, junctionTableNames, numericColumns } = useMemo(() => {
    if (!database) return {
      tableColumns: {} as Record<string, string[]>,
      junctionTableNames: [] as string[],
      numericColumns: [] as string[],
    };

    const graph = buildGraphFromDatabase(database);

    // Group columns by tableName, and detect numeric columns
    const colsByTable: Record<string, Set<string>> = {};
    const numericCols = new Set<string>();
    for (const node of graph.nodes) {
      const table = node.data.tableName as string;
      if (!colsByTable[table]) colsByTable[table] = new Set();
      for (const [key, value] of Object.entries(node.data)) {
        if (key !== 'label' && key !== 'name' && key !== 'tableName' && !key.startsWith('_') && key !== 'pk') {
          colsByTable[table].add(key);
          if (typeof value === 'number') {
            numericCols.add(key);
          }
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

    return {
      tableColumns,
      junctionTableNames: Array.from(jtNames).sort(),
      numericColumns: Array.from(numericCols).sort(),
    };
  }, [database]);

  const update = (patch: Partial<GraphRendererConfig>) => {
    setGraphConfig({ ...graphConfig, ...patch });
  };

  const updateSizing = (patch: Partial<DataDrivenSizingConfig>) => {
    update({ dataDrivenSizing: { ...graphConfig.dataDrivenSizing, ...patch } });
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
        {/* Layout Direction */}
        <div>
          <Text fw={600} size="sm" mb="xs">Layout Direction</Text>
          <SegmentedControl
            fullWidth
            value={graphConfig.rankdir}
            onChange={(val) => update({ rankdir: val as RankDir })}
            data={[
              { label: 'Top-Down', value: 'TB' },
              { label: 'Left-Right', value: 'LR' },
              { label: 'Bottom-Up', value: 'BT' },
              { label: 'Right-Left', value: 'RL' },
            ]}
          />
        </div>

        <Divider />

        {/* Node Spacing */}
        <div>
          <Text fw={600} size="sm" mb="xs">Node Spacing</Text>
          <Stack gap="sm">
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Between nodes (nodesep): {graphConfig.nodesep}px
              </Text>
              <Slider
                min={20}
                max={400}
                step={10}
                value={graphConfig.nodesep}
                onChangeEnd={(val) => update({ nodesep: val })}
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Between ranks (ranksep): {graphConfig.ranksep}px
              </Text>
              <Slider
                min={20}
                max={400}
                step={10}
                value={graphConfig.ranksep}
                onChangeEnd={(val) => update({ ranksep: val })}
              />
            </div>
          </Stack>
        </div>

        <Divider />

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

        {/* Data-Driven Sizing */}
        <div>
          <Text fw={600} size="sm" mb="xs">Data-Driven Sizing</Text>
          <Stack gap="xs">
            <Switch
              label="Enable data-driven sizing"
              checked={graphConfig.dataDrivenSizing.enabled}
              onChange={(e) => updateSizing({ enabled: e.currentTarget.checked })}
            />
            {graphConfig.dataDrivenSizing.enabled && (
              <Stack gap="sm" mt="xs">
                <Select
                  label="Numeric column"
                  placeholder="Select column"
                  value={graphConfig.dataDrivenSizing.column || null}
                  onChange={(val) => updateSizing({ column: val || '' })}
                  data={numericColumns.map((c) => ({ label: c, value: c }))}
                  size="xs"
                />
                <div>
                  <Text size="xs" c="dimmed" mb={4}>Scale axis</Text>
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={graphConfig.dataDrivenSizing.axis}
                    onChange={(val) => updateSizing({ axis: val as 'width' | 'height' })}
                    data={[
                      { label: 'Width', value: 'width' },
                      { label: 'Height', value: 'height' },
                    ]}
                  />
                </div>
                <NumberInput
                  label="Scale factor (px per unit)"
                  value={graphConfig.dataDrivenSizing.scaleFactor}
                  onChange={(val) => updateSizing({ scaleFactor: typeof val === 'number' ? val : 20 })}
                  min={1}
                  max={200}
                  size="xs"
                />
                <NumberInput
                  label="Minimum size (px)"
                  value={graphConfig.dataDrivenSizing.minSize}
                  onChange={(val) => updateSizing({ minSize: typeof val === 'number' ? val : 80 })}
                  min={20}
                  max={500}
                  size="xs"
                />
              </Stack>
            )}
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
