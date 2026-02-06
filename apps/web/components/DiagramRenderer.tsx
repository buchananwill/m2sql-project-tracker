'use client';

import { useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import { transformDatabaseToReactFlow } from '@/lib/reactflow-transform';
import { Paper, Text, Loader, Center } from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';

export function DiagramRenderer() {
  // Subscribe to database from store
  const database = useAppStore((state) => state.database);

  // Memoize the transformation to avoid recalculating on every render
  const graph = useMemo(() => {
    if (!database) return null;
    return transformDatabaseToReactFlow(database);
  }, [database]);

  if (!database) {
    return (
      <Paper
        p="xl"
        withBorder
        style={{
          height: '600px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text c="dimmed">Load a Mermaid file to see the diagram</Text>
      </Paper>
    );
  }

  if (!graph) {
    return (
      <Paper p="xl" withBorder style={{ height: '600px' }}>
        <Center h="100%">
          <Loader size="lg" />
        </Center>
      </Paper>
    );
  }

  return (
    <Paper shadow="sm" style={{ height: '600px' }} withBorder>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
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
  );
}
