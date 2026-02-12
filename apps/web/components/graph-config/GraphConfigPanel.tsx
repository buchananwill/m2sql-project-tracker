/**
 * GraphConfigPanel component
 * Right-side drawer for configuring graph layout and display settings:
 * - Layout direction (TB / LR / BT / RL)
 * - Node spacing (nodesep / ranksep)
 * - Node sizing mode (fix width / fix height)
 * - Data-driven sizing (numeric column → node dimension)
 * - Per-table column visibility
 * - Edge inclusion in layout algorithm
 *
 * All controls update local state immediately for responsive UI.
 * The "Apply Layout" button commits local state to the store,
 * triggering the graph re-layout.
 */

'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Drawer, Stack, Switch, Text, Checkbox, Divider,
  SegmentedControl, Slider, NumberInput, Select, Button,
} from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';
import { buildGraphFromDatabase } from '@/lib/reactflow-transform';
import type { GraphRendererConfig, RankDir, DataDrivenSizingConfig } from '@/stores/slices/uiSlice';
import styles from './GraphConfigPanel.module.css';

export function GraphConfigPanel() {
  const opened = useAppStore((state) => state.uiState.graphConfigPanelOpen);
  const setOpened = useAppStore((state) => state.setGraphConfigPanelOpen);
  const storeConfig = useAppStore((state) => state.uiState.graphConfig);
  const setGraphConfig = useAppStore((state) => state.setGraphConfig);
  const database = useAppStore((state) => state.database);

  // Local config state — mirrors the store but updates immediately on user input.
  // Changes are only committed to the store (triggering graph re-layout) when
  // the user clicks "Apply Layout".
  const [localConfig, setLocalConfig] = useState<GraphRendererConfig>(storeConfig);

  // Sync local state from store when the panel opens (reset unsaved edits)
  const prevOpenedRef = useRef(false);
  useEffect(() => {
    if (opened && !prevOpenedRef.current) {
      setLocalConfig(storeConfig);
    }
    prevOpenedRef.current = opened;
  }, [opened, storeConfig]);

  // Dirty flag: local config differs from store config
  const isDirty = useMemo(
    () => JSON.stringify(localConfig) !== JSON.stringify(storeConfig),
    [localConfig, storeConfig],
  );

  // Apply: commit local state to the store → triggers graph re-layout
  const applyLayout = () => {
    setGraphConfig(localConfig);
  };

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

  // Helpers to update local config
  const update = (patch: Partial<GraphRendererConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...patch }));
  };

  const updateSizing = (patch: Partial<DataDrivenSizingConfig>) => {
    setLocalConfig((prev) => ({
      ...prev,
      dataDrivenSizing: { ...prev.dataDrivenSizing, ...patch },
    }));
  };

  const toggleColumnVisibility = (tableName: string, column: string) => {
    setLocalConfig((prev) => {
      const current = prev.hiddenColumns[tableName] || [];
      const isHidden = current.includes(column);
      const updated = isHidden
        ? current.filter((c) => c !== column)
        : [...current, column];

      return {
        ...prev,
        hiddenColumns: {
          ...prev.hiddenColumns,
          [tableName]: updated,
        },
      };
    });
  };

  const toggleEdgeSource = (junctionTable: string) => {
    setLocalConfig((prev) => {
      const isExcluded = prev.excludedEdgeSources.includes(junctionTable);
      return {
        ...prev,
        excludedEdgeSources: isExcluded
          ? prev.excludedEdgeSources.filter((s) => s !== junctionTable)
          : [...prev.excludedEdgeSources, junctionTable],
      };
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
        {/* Apply Layout button — prominent, sticky-feeling at the top */}
        <Button
          fullWidth
          size="md"
          disabled={!isDirty}
          onClick={applyLayout}
        >
          Apply Layout
        </Button>

        {/* Layout Direction */}
        <div>
          <Text fw={600} size="sm" mb="xs">Layout Direction</Text>
          <SegmentedControl
            fullWidth
            value={localConfig.rankdir}
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
                Between nodes (nodesep): {localConfig.nodesep}px
              </Text>
              <Slider
                min={0}
                max={400}
                step={10}
                value={localConfig.nodesep}
                onChange={(val) => update({ nodesep: val })}
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Between ranks (ranksep): {localConfig.ranksep}px
              </Text>
              <Slider
                min={0}
                max={400}
                step={10}
                value={localConfig.ranksep}
                onChange={(val) => update({ ranksep: val })}
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
              checked={localConfig.fixWidth}
              onChange={(e) => update({ fixWidth: e.currentTarget.checked })}
            />
            <Switch
              label="Fix height"
              checked={localConfig.fixHeight}
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
              checked={localConfig.dataDrivenSizing.enabled}
              onChange={(e) => updateSizing({ enabled: e.currentTarget.checked })}
            />
            {localConfig.dataDrivenSizing.enabled && (
              <Stack gap="sm" mt="xs">
                <Select
                  label="Numeric column"
                  placeholder="Select column"
                  value={localConfig.dataDrivenSizing.column || null}
                  onChange={(val) => updateSizing({ column: val || '' })}
                  data={numericColumns.map((c) => ({ label: c, value: c }))}
                  size="xs"
                />
                <div>
                  <Text size="xs" c="dimmed" mb={4}>Scale axis</Text>
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={localConfig.dataDrivenSizing.axis}
                    onChange={(val) => updateSizing({ axis: val as 'width' | 'height' })}
                    data={[
                      { label: 'Width', value: 'width' },
                      { label: 'Height', value: 'height' },
                    ]}
                  />
                </div>
                <NumberInput
                  label="Scale factor (px per unit)"
                  value={localConfig.dataDrivenSizing.scaleFactor}
                  onChange={(val) => updateSizing({ scaleFactor: typeof val === 'number' ? val : 20 })}
                  min={1}
                  max={200}
                  size="xs"
                />
                <NumberInput
                  label="Minimum size (px)"
                  value={localConfig.dataDrivenSizing.minSize}
                  onChange={(val) => updateSizing({ minSize: typeof val === 'number' ? val : 80 })}
                  min={0}
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
                      const hidden = localConfig.hiddenColumns[tableName]?.includes(col) ?? false;
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
                const excluded = localConfig.excludedEdgeSources.includes(jt);
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
