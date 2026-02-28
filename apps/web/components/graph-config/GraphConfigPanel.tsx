/**
 * GraphConfigPanel component
 * Right-side drawer for configuring graph layout and display settings:
 * - Layout direction (TB / LR / BT / RL)
 * - Node spacing (nodesep / ranksep)
 * - Node sizing mode (fix width / fix height)
 * - Data-driven sizing (numeric column → node dimension)
 * - Per-table column visibility
 * - Edge inclusion in layout algorithm
 * - Collapse hierarchy relationship
 *
 * All controls write directly to pendingGraphConfig in the store.
 * The "Apply Layout" button commits pending → applied, triggering re-layout.
 */

'use client';

import { useMemo } from 'react';
import {
  Drawer, Stack, Switch, Text, Checkbox, Divider,
  SegmentedControl, Slider, NumberInput, Select, Button,
} from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';
import { buildGraphFromDatabase } from '@/lib/reactflow-transform';
import type { RankDir, DataDrivenSizingConfig } from '@/stores/slices/uiSlice';
import styles from './GraphConfigPanel.module.css';

export function GraphConfigPanel() {
  const opened = useAppStore((state) => state.uiState.graphConfigPanelOpen);
  const setOpened = useAppStore((state) => state.setGraphConfigPanelOpen);
  const pendingConfig = useAppStore((state) => state.uiState.pendingGraphConfig);
  const appliedConfig = useAppStore((state) => state.uiState.appliedGraphConfig);
  const updatePendingGraphConfig = useAppStore((state) => state.updatePendingGraphConfig);
  const applyGraphConfig = useAppStore((state) => state.applyGraphConfig);
  const autoApplyLayout = useAppStore((state) => state.uiState.autoApplyLayout);
  const setAutoApplyLayout = useAppStore((state) => state.setAutoApplyLayout);
  const database = useAppStore((state) => state.database);

  // Dirty flag: pending config differs from applied config
  const isDirty = useMemo(
    () => JSON.stringify(pendingConfig) !== JSON.stringify(appliedConfig),
    [pendingConfig, appliedConfig],
  );

  // Extract table → columns mapping, junction table names, and numeric columns
  const { tableColumns, junctionTableNames, junctionTablesWithTokens, numericColumns } = useMemo(() => {
    if (!database) return {
      tableColumns: {} as Record<string, string[]>,
      junctionTableNames: [] as string[],
      junctionTablesWithTokens: [] as { value: string; label: string }[],
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

    // Build junction tables with arrow tokens for the collapse dropdown
    const jtWithTokens = (database.arrowMappings || []).map((m) => ({
      value: m.junctionTable,
      label: `${m.junctionTable} (${m.arrowToken})`,
    }));

    return {
      tableColumns,
      junctionTableNames: Array.from(jtNames).sort(),
      junctionTablesWithTokens: jtWithTokens,
      numericColumns: Array.from(numericCols).sort(),
    };
  }, [database]);

  // Helpers to update pending config
  const updateSizing = (patch: Partial<DataDrivenSizingConfig>) => {
    updatePendingGraphConfig({
      dataDrivenSizing: { ...pendingConfig.dataDrivenSizing, ...patch },
    });
  };

  const toggleColumnVisibility = (tableName: string, column: string) => {
    const current = pendingConfig.hiddenColumns[tableName] || [];
    const isHidden = current.includes(column);
    const updated = isHidden
      ? current.filter((c) => c !== column)
      : [...current, column];

    updatePendingGraphConfig({
      hiddenColumns: {
        ...pendingConfig.hiddenColumns,
        [tableName]: updated,
      },
    });
  };

  const toggleEdgeSource = (junctionTable: string) => {
    const isExcluded = pendingConfig.excludedEdgeSources.includes(junctionTable);
    updatePendingGraphConfig({
      excludedEdgeSources: isExcluded
        ? pendingConfig.excludedEdgeSources.filter((s) => s !== junctionTable)
        : [...pendingConfig.excludedEdgeSources, junctionTable],
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
        {/* Apply Layout controls */}
        <Stack gap="xs">
          <Button
            fullWidth
            size="md"
            disabled={!isDirty || autoApplyLayout}
            onClick={applyGraphConfig}
          >
            Apply Layout
          </Button>
          <Switch
            label="Auto-apply layout changes"
            checked={autoApplyLayout}
            onChange={(e) => setAutoApplyLayout(e.currentTarget.checked)}
          />
        </Stack>

        {/* Layout Direction */}
        <div>
          <Text fw={600} size="sm" mb="xs">Layout Direction</Text>
          <SegmentedControl
            fullWidth
            value={pendingConfig.rankdir}
            onChange={(val) => updatePendingGraphConfig({ rankdir: val as RankDir })}
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
                Between nodes (nodesep): {pendingConfig.nodesep}px
              </Text>
              <Slider
                min={0}
                max={400}
                step={10}
                value={pendingConfig.nodesep}
                onChange={(val) => updatePendingGraphConfig({ nodesep: val })}
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                Between ranks (ranksep): {pendingConfig.ranksep}px
              </Text>
              <Slider
                min={0}
                max={400}
                step={10}
                value={pendingConfig.ranksep}
                onChange={(val) => updatePendingGraphConfig({ ranksep: val })}
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
              checked={pendingConfig.fixWidth}
              onChange={(e) => updatePendingGraphConfig({ fixWidth: e.currentTarget.checked })}
            />
            <Switch
              label="Fix height"
              checked={pendingConfig.fixHeight}
              onChange={(e) => updatePendingGraphConfig({ fixHeight: e.currentTarget.checked })}
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
              checked={pendingConfig.dataDrivenSizing.enabled}
              onChange={(e) => updateSizing({ enabled: e.currentTarget.checked })}
            />
            {pendingConfig.dataDrivenSizing.enabled && (
              <Stack gap="sm" mt="xs">
                <Select
                  label="Numeric column"
                  placeholder="Select column"
                  value={pendingConfig.dataDrivenSizing.column || null}
                  onChange={(val) => updateSizing({ column: val || '' })}
                  data={numericColumns.map((c) => ({ label: c, value: c }))}
                  size="xs"
                />
                <div>
                  <Text size="xs" c="dimmed" mb={4}>Scale axis</Text>
                  <SegmentedControl
                    fullWidth
                    size="xs"
                    value={pendingConfig.dataDrivenSizing.axis}
                    onChange={(val) => updateSizing({ axis: val as 'width' | 'height' })}
                    data={[
                      { label: 'Width', value: 'width' },
                      { label: 'Height', value: 'height' },
                    ]}
                  />
                </div>
                <NumberInput
                  label="Scale factor (px per unit)"
                  value={pendingConfig.dataDrivenSizing.scaleFactor}
                  onChange={(val) => {
                    if (typeof val === 'number') updateSizing({ scaleFactor: val });
                  }}
                  clampBehavior="blur"
                  min={1}
                  max={200}
                  size="xs"
                />
                <NumberInput
                  label="Minimum size (px)"
                  value={pendingConfig.dataDrivenSizing.minSize}
                  onChange={(val) => {
                    if (typeof val === 'number') updateSizing({ minSize: val });
                  }}
                  clampBehavior="blur"
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
                      const hidden = pendingConfig.hiddenColumns[tableName]?.includes(col) ?? false;
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
                const excluded = pendingConfig.excludedEdgeSources.includes(jt);
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

        <Divider />

        {/* Collapse Hierarchy */}
        <div>
          <Text fw={600} size="sm" mb="xs">Collapse Hierarchy</Text>
          <Text size="xs" c="dimmed" mb="xs">
            Which relationship type defines parent-child for node collapse/expand.
            Empty = auto-detect composition (*--).
          </Text>
          <Select
            placeholder="Auto-detect (*--)"
            value={pendingConfig.collapseRelationship || null}
            onChange={(val) => updatePendingGraphConfig({ collapseRelationship: val || '' })}
            data={junctionTablesWithTokens}
            clearable
            size="xs"
          />
        </div>
      </Stack>
    </Drawer>
  );
}
