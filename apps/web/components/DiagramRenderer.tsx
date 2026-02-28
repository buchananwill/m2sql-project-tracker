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
import {
  resolveCollapseRelationship,
  buildParentChildMap,
  computeHiddenNodeIds,
  computeNodesWithChildren,
  resolveHiddenNodePositions,
} from '@/lib/collapse-graph';
import { Paper, Text, Loader, ActionIcon, Tooltip, LoadingOverlay, Button } from '@mantine/core';
import { IconPalette, IconSettings, IconLayoutDashboard } from '@tabler/icons-react';
import { useAppStore } from '@/stores/useAppStore';
import { TaskNode } from '@/components/nodes';
import { ColorCodingPanel } from '@/components/color-coding/ColorCodingPanel';
import { GraphConfigPanel } from '@/components/graph-config/GraphConfigPanel';
import { NodePopover } from '@/components/nodes/NodePopover';
import styles from './DiagramRenderer.module.css';

type LayoutPhase = 'IDLE' | 'MEASURING' | 'LAYOUTING' | 'RENDERED';

/**
 * Inner component that uses ReactFlow hooks (must be inside ReactFlowProvider).
 *
 * Receives ALL graph nodes (including applied-hidden ones). Dagre only runs on
 * the applied-visible subset; applied-hidden nodes are placed at their nearest
 * visible ancestor's position. Pending collapse visibility is managed separately
 * via ReactFlow's `hidden` property — nodes appear/disappear immediately at
 * their current positions without triggering layout recalculation.
 */
function DiagramFlow({
  rawNodes,
  rawEdges,
  appliedHiddenNodeIds,
  collapseParentChildMap,
}: {
  rawNodes: Node[];
  rawEdges: Edge[];
  appliedHiddenNodeIds: Set<string>;
  collapseParentChildMap: Map<string, Set<string>>;
}) {
  const graphConfig = useAppStore((state) => state.uiState.appliedGraphConfig);
  const pendingCollapsedNodeIds = useAppStore((state) => state.uiState.pendingGraphConfig.collapsedNodeIds);
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

  // ── Applied-visible subset (stable — only changes on Apply) ──

  const visibleNodes = useMemo(
    () => rawNodes.filter((n) => !appliedHiddenNodeIds.has(n.id)),
    [rawNodes, appliedHiddenNodeIds],
  );

  const visibleEdges = useMemo(
    () => rawEdges.filter(
      (e) => !appliedHiddenNodeIds.has(e.source) && !appliedHiddenNodeIds.has(e.target),
    ),
    [rawEdges, appliedHiddenNodeIds],
  );

  // ── Pending collapse visibility ──────────────────────────────

  const pendingHiddenNodeIds = useMemo(
    () => computeHiddenNodeIds(pendingCollapsedNodeIds, collapseParentChildMap),
    [pendingCollapsedNodeIds, collapseParentChildMap],
  );

  // Ref so layout callbacks read the latest value without being re-created
  const pendingHiddenRef = useRef(pendingHiddenNodeIds);
  pendingHiddenRef.current = pendingHiddenNodeIds;

  // Also keep a ref for the applied-hidden set (used in layout callback)
  const appliedHiddenRef = useRef(appliedHiddenNodeIds);
  appliedHiddenRef.current = appliedHiddenNodeIds;

  // Apply hidden flag to already-rendered nodes/edges whenever the
  // pending hidden set changes. Nodes stay at their positions.
  useEffect(() => {
    if (layoutPhaseRef.current !== 'RENDERED') return;

    setNodes((prev) =>
      prev.map((n) => {
        const shouldHide = pendingHiddenNodeIds.has(n.id);
        return n.hidden === shouldHide ? n : { ...n, hidden: shouldHide };
      }),
    );
    setEdges((prev) =>
      prev.map((e) => {
        const shouldHide =
          pendingHiddenNodeIds.has(e.source) || pendingHiddenNodeIds.has(e.target);
        return e.hidden === shouldHide ? e : { ...e, hidden: shouldHide };
      }),
    );
  }, [pendingHiddenNodeIds, setNodes, setEdges]);

  // ── Layout config ────────────────────────────────────────────

  const layoutOptions: DagreLayoutOptions = useMemo(() => ({
    rankdir: graphConfig.rankdir,
    nodesep: graphConfig.nodesep,
    ranksep: graphConfig.ranksep,
    ranker: "longest-path"
  }), [graphConfig.rankdir, graphConfig.nodesep, graphConfig.ranksep]);

  // Filter edges for dagre (exclude user-unchecked edge sources)
  const layoutEdges = useMemo(() =>
    visibleEdges.filter(
      (e) => !graphConfig.excludedEdgeSources.includes(e.data?.junctionTable)
    ),
    [visibleEdges, graphConfig.excludedEdgeSources]
  );

  // ── Layout pipeline ──────────────────────────────────────────

  const runDagreLayout = useCallback(() => {
    layoutPhaseRef.current = 'LAYOUTING';

    // Pre-compute dimensions for applied-visible nodes only
    const precomputed = precomputeNodeDimensions(visibleNodes, {
      dataDrivenSizing: graphConfig.dataDrivenSizing,
      fixWidth: graphConfig.fixWidth,
      fixHeight: graphConfig.fixHeight,
    });

    // Override with DOM-measured dimensions
    const nodesWithDims = precomputed.map((node) => {
      const dims = nodeDimensionsRef.current.get(node.id);
      if (dims) {
        return { ...node, width: dims.width, height: dims.height };
      }
      return node;
    });

    // Run dagre on applied-visible nodes only
    const { nodes: layoutedNodes } = applyDagreLayout(nodesWithDims, layoutEdges, layoutOptions);

    // Build a position lookup from dagre results
    const positionMap = new Map<string, { x: number; y: number }>();
    for (const n of layoutedNodes) {
      positionMap.set(n.id, n.position);
    }

    // Resolve positions for applied-hidden nodes (nearest visible ancestor)
    const appliedHidden = appliedHiddenRef.current;
    const hiddenPositions = resolveHiddenNodePositions(
      appliedHidden,
      collapseParentChildMap,
      positionMap,
    );

    // Place hidden nodes at their ancestor positions
    const hiddenNodes = rawNodes
      .filter((n) => appliedHidden.has(n.id))
      .map((n) => ({
        ...n,
        position: hiddenPositions.get(n.id) ?? { x: 0, y: 0 },
      }));

    // Merge: dagre-positioned visible nodes + ancestor-positioned hidden nodes
    const allPositioned = [...layoutedNodes, ...hiddenNodes];

    // Apply pending visibility so hidden nodes never flash on screen
    const pendingHidden = pendingHiddenRef.current;
    const nodesWithVisibility = allPositioned.map((n) => ({
      ...n,
      hidden: pendingHidden.has(n.id),
    }));
    const edgesWithVisibility = rawEdges.map((e) => ({
      ...e,
      hidden: pendingHidden.has(e.source) || pendingHidden.has(e.target),
    }));

    setNodes(nodesWithVisibility);
    setEdges(edgesWithVisibility);
    setIsLayouting(false);

    requestAnimationFrame(() => {
      layoutPhaseRef.current = 'RENDERED';
      fitView({ padding: 0.1 });
    });
  }, [visibleNodes, rawNodes, rawEdges, layoutEdges, layoutOptions, collapseParentChildMap, graphConfig.dataDrivenSizing, graphConfig.fixWidth, graphConfig.fixHeight, setNodes, setEdges, fitView]);

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

  // Start measurement — only measures applied-visible nodes
  const startMeasurement = useCallback(() => {
    if (layoutRafRef.current !== undefined) {
      cancelAnimationFrame(layoutRafRef.current);
      layoutRafRef.current = undefined;
    }

    if (visibleNodes.length === 0) {
      // No visible nodes — still set hidden nodes so they exist for potential expand
      const pendingHidden = pendingHiddenRef.current;
      const hiddenOnly = rawNodes.map((n) => ({
        ...n,
        position: { x: 0, y: 0 },
        hidden: pendingHidden.has(n.id),
      }));
      setNodes(hiddenOnly);
      setEdges(rawEdges.map((e) => ({
        ...e,
        hidden: pendingHidden.has(e.source) || pendingHidden.has(e.target),
      })));
      layoutPhaseRef.current = 'RENDERED';
      setIsLayouting(false);
      return;
    }

    layoutPhaseRef.current = 'MEASURING';
    setIsLayouting(true);
    nodeDimensionsRef.current.clear();
    expectedNodeCountRef.current = visibleNodes.length;

    // Place visible nodes at staggered positions for measurement;
    // hide applied-hidden nodes so they don't interfere with measurement count
    const measureNodes = rawNodes.map((node, i) => {
      if (appliedHiddenRef.current.has(node.id)) {
        return { ...node, position: { x: 0, y: 0 }, hidden: true };
      }
      return {
        ...node,
        position: { x: 0, y: i * 200 },
        width: undefined,
        height: undefined,
      };
    });

    setNodes(measureNodes);
    setEdges(rawEdges);

    clearTimeout(measureTimeoutRef.current);
    measureTimeoutRef.current = setTimeout(() => {
      if (layoutPhaseRef.current === 'MEASURING') {
        runDagreLayout();
      }
    }, 2000);
  }, [visibleNodes, rawNodes, rawEdges, setNodes, setEdges, runDagreLayout]);

  // Effect: detect when the applied-visible node set changes → trigger measurement
  useEffect(() => {
    const changed = visibleNodes !== prevRawNodesRef.current;
    prevRawNodesRef.current = visibleNodes;

    if (changed) {
      startMeasurement();
    }
  }, [visibleNodes, startMeasurement]);

  // Effect: detect layout-only config changes → re-layout without re-measuring
  useEffect(() => {
    const currentKey = JSON.stringify({
      rankdir: layoutOptions.rankdir,
      nodesep: layoutOptions.nodesep,
      ranksep: layoutOptions.ranksep,
      excludedEdgeSources: graphConfig.excludedEdgeSources,
    });

    if (prevLayoutOptionsRef.current && prevLayoutOptionsRef.current !== currentKey) {
      if (nodeDimensionsRef.current.size > 0 && layoutPhaseRef.current === 'RENDERED') {
        setIsLayouting(true);
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
    if (layoutPhaseRef.current === 'RENDERED' && visibleNodes.length > 0) {
      startMeasurement();
    }
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
  const appliedGraphConfig = useAppStore((state) => state.uiState.appliedGraphConfig);
  const pendingGraphConfig = useAppStore((state) => state.uiState.pendingGraphConfig);
  const applyGraphConfig = useAppStore((state) => state.applyGraphConfig);
  const setColorCodingPanelOpen = useAppStore((state) => state.setColorCodingPanelOpen);
  const setGraphConfigPanelOpen = useAppStore((state) => state.setGraphConfigPanelOpen);

  // Build raw graph from database (no layout yet)
  const rawGraph = useMemo(() => {
    if (!database) return null;
    return buildGraphFromDatabase(database);
  }, [database]);

  // Dirty check: pending config differs from applied
  const isGraphConfigDirty = useMemo(
    () => JSON.stringify(pendingGraphConfig) !== JSON.stringify(appliedGraphConfig),
    [pendingGraphConfig, appliedGraphConfig],
  );

  // ── Collapse: parent-child map (from pending relationship) ───

  const pendingCollapseJT = useMemo(() => {
    if (!database) return null;
    return resolveCollapseRelationship(database, pendingGraphConfig.collapseRelationship);
  }, [database, pendingGraphConfig.collapseRelationship]);

  const collapseParentChildMap = useMemo(() => {
    if (!rawGraph || !pendingCollapseJT) return new Map<string, Set<string>>();
    return buildParentChildMap(rawGraph.edges, pendingCollapseJT);
  }, [rawGraph, pendingCollapseJT]);

  // ── Collapse: applied-hidden set (drives dagre filtering) ────

  const appliedCollapseJT = useMemo(() => {
    if (!database) return null;
    return resolveCollapseRelationship(database, appliedGraphConfig.collapseRelationship);
  }, [database, appliedGraphConfig.collapseRelationship]);

  const appliedHiddenNodeIds = useMemo(() => {
    if (!rawGraph || !appliedCollapseJT) return new Set<string>();
    const map = buildParentChildMap(rawGraph.edges, appliedCollapseJT);
    const validNodeIds = new Set(rawGraph.nodes.map((n) => n.id));
    const validCollapsedIds = appliedGraphConfig.collapsedNodeIds.filter(
      (id) => validNodeIds.has(id),
    );
    return computeHiddenNodeIds(validCollapsedIds, map);
  }, [rawGraph, appliedCollapseJT, appliedGraphConfig.collapsedNodeIds]);

  // ── Enrich nodes with _hasChildren (stable per-database) ─────

  const enrichedNodes = useMemo(() => {
    if (!rawGraph) return [];
    if (collapseParentChildMap.size === 0) return rawGraph.nodes;

    const nodesWithChildren = computeNodesWithChildren(collapseParentChildMap);
    return rawGraph.nodes.map((n) => {
      if (!nodesWithChildren.has(n.id)) return n;
      return { ...n, data: { ...n.data, _hasChildren: true } };
    });
  }, [rawGraph, collapseParentChildMap]);

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

        {isGraphConfigDirty && (
          <div className={styles.applyLayoutInset}>
            <Button
              size="compact-sm"
              leftSection={<IconLayoutDashboard size={16} />}
              onClick={applyGraphConfig}
            >
              Apply Layout
            </Button>
          </div>
        )}

        <ReactFlowProvider>
          <DiagramFlow
            rawNodes={enrichedNodes}
            rawEdges={rawGraph.edges}
            appliedHiddenNodeIds={appliedHiddenNodeIds}
            collapseParentChildMap={collapseParentChildMap}
          />
        </ReactFlowProvider>
      </Paper>

      <ColorCodingPanel />
      <GraphConfigPanel />
      <NodePopover />
    </>
  );
}
