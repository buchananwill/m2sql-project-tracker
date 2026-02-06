'use client';

import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import type { Database } from '@m2sql/model';
import { transformDatabaseToReactFlow } from '@/lib/reactflow-transform';
import { Paper, Text } from '@mantine/core';

interface DiagramRendererProps {
  database: Database | null;
}

export function DiagramRenderer({ database }: DiagramRendererProps) {
  if (!database) {
    return (
      <Paper p="xl" withBorder style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text c="dimmed">Load a Mermaid file to see the diagram</Text>
      </Paper>
    );
  }

  const { nodes, edges } = transformDatabaseToReactFlow(database);

  return (
    <Paper shadow="sm" style={{ height: '600px' }} withBorder>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <MiniMap />
      </ReactFlow>
    </Paper>
  );
}
