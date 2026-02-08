'use client';

import { useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import { buildGraphFromDatabase, applyDagreLayout } from '@/lib/reactflow-transform';
import { Paper, Text, Loader, ActionIcon, Tooltip } from '@mantine/core';
import { IconPalette, IconSettings } from '@tabler/icons-react';
import { useAppStore } from '@/stores/useAppStore';
import { TaskNode } from '@/components/nodes';
import { ColorCodingPanel } from '@/components/color-coding/ColorCodingPanel';
import { GraphConfigPanel } from '@/components/graph-config/GraphConfigPanel';
import styles from './DiagramRenderer.module.css';

export function DiagramRenderer() {
  // Subscribe to database from store
  const database = useAppStore((state) => state.database);
  const setColorCodingPanelOpen = useAppStore((state) => state.setColorCodingPanelOpen);
  const setGraphConfigPanelOpen = useAppStore((state) => state.setGraphConfigPanelOpen);
  const graphConfig = useAppStore((state) => state.uiState.graphConfig);

  // Define custom node types
  const nodeTypes = useMemo(() => ({ task: TaskNode }), []);

  // Build graph: transform → filter edges for layout → apply dagre
  const graph = useMemo(() => {
    if (!database) return null;

    const raw = buildGraphFromDatabase(database);

    // Filter edges: excluded edge sources are removed from layout but still rendered
    const layoutEdges = raw.edges.filter(
      (e) => !graphConfig.excludedEdgeSources.includes(e.data?.junctionTable)
    );

    const { nodes } = applyDagreLayout(raw.nodes, layoutEdges);

    // Return positioned nodes with ALL edges (including excluded ones)
    return { nodes, edges: raw.edges };
  }, [database, graphConfig.excludedEdgeSources]);

  if (!database) {
    return (
      <Paper p="xl" withBorder className={styles.container}>
        <div className={styles.emptyState}>
          <Text c="dimmed">Load a Mermaid file to see the diagram</Text>
        </div>
      </Paper>
    );
  }

  if (!graph) {
    return (
      <Paper p="xl" withBorder className={styles.container}>
        <div className={styles.loadingState}>
          <Loader size="lg" />
        </div>
      </Paper>
    );
  }

  return (
    <>
      <Paper shadow="sm" className={styles.container} withBorder>
        <div className={styles.toolButtons}>
          <Tooltip label="Graph Settings" position="left">
            <ActionIcon
              size="lg"
              variant="filled"
              color="gray"
              onClick={() => setGraphConfigPanelOpen(true)}
            >
              <IconSettings size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Color Coding" position="left">
            <ActionIcon
              size="lg"
              variant="filled"
              color="blue"
              onClick={() => setColorCodingPanelOpen(true)}
            >
              <IconPalette size={20} />
            </ActionIcon>
          </Tooltip>
        </div>

        <div className={styles.reactFlowWrapper}>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.1}
            maxZoom={2}
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
          </ReactFlow>
        </div>
      </Paper>

      <ColorCodingPanel />
      <GraphConfigPanel />
    </>
  );
}
