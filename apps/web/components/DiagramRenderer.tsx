'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from 'reactflow';
import { buildGraphFromDatabase, applyDagreLayout } from '@/lib/reactflow-transform';
import { Paper, Text, Loader, ActionIcon, Tooltip, LoadingOverlay } from '@mantine/core';
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

  // Async graph computation: yields to browser before heavy layout work
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!database) {
      setGraph(null);
      return;
    }

    setIsComputing(true);

    // Yield to the browser so the loading overlay can paint before dagre blocks
    rafRef.current = requestAnimationFrame(() => {
      const raw = buildGraphFromDatabase(database);

      // Filter edges: excluded edge sources are removed from layout but still rendered
      const layoutEdges = raw.edges.filter(
        (e) => !graphConfig.excludedEdgeSources.includes(e.data?.junctionTable)
      );

      const { nodes } = applyDagreLayout(raw.nodes, layoutEdges);

      setGraph({ nodes, edges: raw.edges });
      setIsComputing(false);
    });

    return () => cancelAnimationFrame(rafRef.current);
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

        <div className={styles.reactFlowWrapper} style={{ position: 'relative' }}>
          <LoadingOverlay
            visible={isComputing}
            zIndex={5}
            overlayProps={{ blur: 1 }}
          />
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
