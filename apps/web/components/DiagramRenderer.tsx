'use client';

import { useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import { transformDatabaseToReactFlow } from '@/lib/reactflow-transform';
import { Paper, Text, Loader, ActionIcon, Tooltip } from '@mantine/core';
import { IconPalette } from '@tabler/icons-react';
import { useAppStore } from '@/stores/useAppStore';
import { TaskNode } from '@/components/nodes';
import { ColorCodingPanel } from '@/components/color-coding/ColorCodingPanel';
import styles from './DiagramRenderer.module.css';

export function DiagramRenderer() {
  // Subscribe to database from store
  const database = useAppStore((state) => state.database);
  const setColorCodingPanelOpen = useAppStore((state) => state.setColorCodingPanelOpen);

  // Define custom node types
  const nodeTypes = useMemo(() => ({ task: TaskNode }), []);

  // Memoize the transformation to avoid recalculating on every render
  const graph = useMemo(() => {
    if (!database) return null;
    return transformDatabaseToReactFlow(database);
  }, [database]);

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
        <Tooltip label="Color Coding" position="left">
          <ActionIcon
            className={styles.toggleButton}
            size="lg"
            variant="filled"
            color="blue"
            onClick={() => setColorCodingPanelOpen(true)}
          >
            <IconPalette size={20} />
          </ActionIcon>
        </Tooltip>

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
      </Paper>

      <ColorCodingPanel />
    </>
  );
}
