'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
} from 'reactflow';
import { buildGraphFromDatabase, applyDagreLayout } from '@/lib/reactflow-transform';
import type { DagreLayoutOptions } from '@/lib/reactflow-transform';
import { precomputeNodeDimensions } from '@/lib/data-driven-sizing';
import { Paper, Text, Loader, ActionIcon, Tooltip, LoadingOverlay } from '@mantine/core';
import { IconPalette, IconSettings } from '@tabler/icons-react';
import { useAppStore } from '@/stores/useAppStore';
import { TaskNode } from '@/components/nodes';
import { ColorCodingPanel } from '@/components/color-coding/ColorCodingPanel';
import { GraphConfigPanel } from '@/components/graph-config/GraphConfigPanel';
import styles from './DiagramRenderer.module.css';

type LayoutPhase = 'IDLE' | 'MEASURING' | 'LAYOUTING' | 'RENDERED';

/**
 * Inner component that uses ReactFlow hooks (must be inside ReactFlowProvider).
 * Implements a two-phase measure-then-layout pipeline:
 * 1. MEASURING: Render nodes at (0,0) so the DOM measures their actual sizes
 * 2. LAYOUTING: Run dagre with measured sizes, then set final positions
 */
function DiagramFlow({
  rawNodes,
  rawEdges,
}: {
  rawNodes: Node[];
  rawEdges: Edge[];
}) {
  const graphConfig = useAppStore((state) => state.uiState.graphConfig);
  const { fitView } = useReactFlow();

  // Controlled ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Layout phase tracking (ref to avoid re-render loops)
  const layoutPhaseRef = useRef<LayoutPhase>('IDLE');
  const [isLayouting, setIsLayouting] = useState(false);

  // Measured dimensions
  const nodeDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const expectedNodeCountRef = useRef(0);
  const measureTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const layoutRafRef = useRef<number | undefined>(undefined);

  // Track previous raw data to detect when graph content changes
  const prevRawNodesRef = useRef<Node[]>([]);
  const prevLayoutOptionsRef = useRef<string>('');

  // Compute layout options from config
  const layoutOptions: DagreLayoutOptions = useMemo(() => ({
    rankdir: graphConfig.rankdir,
    nodesep: graphConfig.nodesep,
    ranksep: graphConfig.ranksep,
    ranker: "longest-path"
  }), [graphConfig.rankdir, graphConfig.nodesep, graphConfig.ranksep]);

  // Filter edges for layout
  const layoutEdges = useMemo(() =>
    rawEdges.filter(
      (e) => !graphConfig.excludedEdgeSources.includes(e.data?.junctionTable)
    ),
    [rawEdges, graphConfig.excludedEdgeSources]
  );

  // Run dagre layout using measured or pre-computed dimensions
  const runDagreLayout = useCallback(() => {
    layoutPhaseRef.current = 'LAYOUTING';

    // Pre-compute data-driven dimensions so dagre has correct sizes
    // even when DOM measurements haven't completed yet
    const precomputed = precomputeNodeDimensions(rawNodes, {
      dataDrivenSizing: graphConfig.dataDrivenSizing,
      fixWidth: graphConfig.fixWidth,
      fixHeight: graphConfig.fixHeight,
    });

    // Override with DOM-measured dimensions where available (more accurate
    // because they account for content-driven sizing)
    const nodesWithDims = precomputed.map((node) => {
      const dims = nodeDimensionsRef.current.get(node.id);
      if (dims) {
        return { ...node, width: dims.width, height: dims.height };
      }
      return node;
    });

    const { nodes: layoutedNodes } = applyDagreLayout(nodesWithDims, layoutEdges, layoutOptions);

    setNodes(layoutedNodes);
    setEdges(rawEdges);
    setIsLayouting(false);

    // Fit view after layout settles
    requestAnimationFrame(() => {
      layoutPhaseRef.current = 'RENDERED';
      fitView({ padding: 0.1 });
    });
  }, [rawNodes, rawEdges, layoutEdges, layoutOptions, graphConfig.dataDrivenSizing, graphConfig.fixWidth, graphConfig.fixHeight, setNodes, setEdges, fitView]);

  // Intercept node changes to detect measurement events
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    if (layoutPhaseRef.current !== 'MEASURING') return;

    for (const change of changes) {
      if (change.type === 'dimensions' && 'dimensions' in change && change.dimensions) {
        nodeDimensionsRef.current.set(change.id, {
          width: change.dimensions.width,
          height: change.dimensions.height,
        });
      }
    }

    if (nodeDimensionsRef.current.size >= expectedNodeCountRef.current) {
      clearTimeout(measureTimeoutRef.current);
      runDagreLayout();
    }
  }, [onNodesChange, runDagreLayout]);

  // Start measurement phase: place nodes at origin so ReactFlow renders and measures them
  const startMeasurement = useCallback(() => {
    // Cancel any pending layout rAF to prevent race conditions
    // (layout effect's rAF could fire after we clear dimensions)
    if (layoutRafRef.current !== undefined) {
      cancelAnimationFrame(layoutRafRef.current);
      layoutRafRef.current = undefined;
    }

    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges(rawEdges);
      layoutPhaseRef.current = 'RENDERED';
      setIsLayouting(false);
      return;
    }

    layoutPhaseRef.current = 'MEASURING';
    setIsLayouting(true);
    nodeDimensionsRef.current.clear();
    expectedNodeCountRef.current = rawNodes.length;

    // Place nodes at staggered positions so they're rendered but off-screen won't cause issues
    const measureNodes = rawNodes.map((node, i) => ({
      ...node,
      position: { x: 0, y: i * 200 },
      // Clear any previous width/height so ReactFlow re-measures
      width: undefined,
      height: undefined,
    }));

    setNodes(measureNodes);
    setEdges(rawEdges);

    // Timeout fallback: if not all nodes measured in 2s, proceed with what we have
    clearTimeout(measureTimeoutRef.current);
    measureTimeoutRef.current = setTimeout(() => {
      if (layoutPhaseRef.current === 'MEASURING') {
        runDagreLayout();
      }
    }, 2000);
  }, [rawNodes, rawEdges, setNodes, setEdges, runDagreLayout]);

  // Effect: detect when raw graph data changes → trigger measurement
  useEffect(() => {
    const nodesChanged = rawNodes !== prevRawNodesRef.current;
    prevRawNodesRef.current = rawNodes;

    if (nodesChanged) {
      startMeasurement();
    }
  }, [rawNodes, startMeasurement]);

  // Effect: detect layout-only config changes → re-layout without re-measuring
  useEffect(() => {
    const currentKey = JSON.stringify({
      rankdir: layoutOptions.rankdir,
      nodesep: layoutOptions.nodesep,
      ranksep: layoutOptions.ranksep,
      excludedEdgeSources: graphConfig.excludedEdgeSources,
    });

    if (prevLayoutOptionsRef.current && prevLayoutOptionsRef.current !== currentKey) {
      // Layout-only change: re-run dagre with existing measured dimensions
      if (nodeDimensionsRef.current.size > 0 && layoutPhaseRef.current === 'RENDERED') {
        setIsLayouting(true);
        // Use rAF to let the loading overlay paint; track it so
        // startMeasurement can cancel if a sizing change fires in the same batch
        layoutRafRef.current = requestAnimationFrame(() => {
          layoutRafRef.current = undefined;
          runDagreLayout();
        });
      }
    }

    prevLayoutOptionsRef.current = currentKey;
  }, [layoutOptions, graphConfig.excludedEdgeSources, runDagreLayout]);

  // Effect: detect sizing config changes → re-measure
  useEffect(() => {
    // Only trigger if we've already rendered once (avoid double-trigger on mount)
    if (layoutPhaseRef.current === 'RENDERED' && rawNodes.length > 0) {
      startMeasurement();
    }
    // We intentionally only react to these specific sizing configs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphConfig.fixWidth, graphConfig.fixHeight, graphConfig.hiddenColumns, graphConfig.dataDrivenSizing]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(measureTimeoutRef.current);
      if (layoutRafRef.current !== undefined) {
        cancelAnimationFrame(layoutRafRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.reactFlowWrapper} style={{ position: 'relative' }}>
      <LoadingOverlay
        visible={isLayouting}
        zIndex={5}
        overlayProps={{ blur: 1 }}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
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
  );
}

// Memoized node types (must be stable reference outside component)
const nodeTypes = { task: TaskNode };

export function DiagramRenderer() {
  const database = useAppStore((state) => state.database);
  const setColorCodingPanelOpen = useAppStore((state) => state.setColorCodingPanelOpen);
  const setGraphConfigPanelOpen = useAppStore((state) => state.setGraphConfigPanelOpen);

  // Build raw graph from database (no layout yet)
  const rawGraph = useMemo(() => {
    if (!database) return null;
    return buildGraphFromDatabase(database);
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

  if (!rawGraph) {
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

        <ReactFlowProvider>
          <DiagramFlow
            rawNodes={rawGraph.nodes}
            rawEdges={rawGraph.edges}
          />
        </ReactFlowProvider>
      </Paper>

      <ColorCodingPanel />
      <GraphConfigPanel />
    </>
  );
}
