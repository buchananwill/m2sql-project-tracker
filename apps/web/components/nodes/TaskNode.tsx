/**
 * Custom TaskNode component for ReactFlow
 * Displays task data with filter-based color coding,
 * configurable sizing mode, and per-table column visibility.
 */

'use client';

import { memo, useMemo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { ActionIcon } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useAppStore } from '@/stores/useAppStore';
import { evaluateFilters } from '@/lib/color-filter-engine';
import { computeNodeInlineStyle } from '@/lib/data-driven-sizing';
import type { RankDir } from '@/stores/slices/uiSlice';
import styles from './TaskNode.module.css';

function getHandlePositions(rankdir: RankDir): { target: Position; source: Position } {
  switch (rankdir) {
    case 'TB': return { target: Position.Top, source: Position.Bottom };
    case 'BT': return { target: Position.Bottom, source: Position.Top };
    case 'LR': return { target: Position.Left, source: Position.Right };
    case 'RL': return { target: Position.Right, source: Position.Left };
  }
}

export const TaskNode = memo(function TaskNode({ id, data }: NodeProps) {
  // Get config from store
  const colorCodingConfig = useAppStore((state) => state.uiState.colorCodingConfig);
  const graphConfig = useAppStore((state) => state.uiState.appliedGraphConfig);
  const setHoveredNode = useAppStore((state) => state.setHoveredNode);
  const updatePendingGraphConfig = useAppStore((state) => state.updatePendingGraphConfig);
  const pendingCollapsedNodeIds = useAppStore((state) => state.uiState.pendingGraphConfig.collapsedNodeIds);

  // Evaluate filters to get colors
  const backgroundColor = evaluateFilters(data, colorCodingConfig.background) || '#ffffff';
  const borderColor = evaluateFilters(data, colorCodingConfig.border) || '#d1d5db';
  const textColor = evaluateFilters(data, colorCodingConfig.text) || '#1f2937';

  // Extract label and other fields
  const { label, name, tableName, ...otherFields } = data;

  // Collapse state: _hasChildren comes from enriched node data (stable),
  // isCollapsed is read from the store so chevron clicks don't create
  // new node object references (which would trigger re-measurement).
  const hasChildren = otherFields._hasChildren as boolean | undefined;
  const isCollapsed = useAppStore(
    (state) => state.uiState.pendingGraphConfig.collapsedNodeIds.includes(id),
  );

  // Determine hidden columns for this node's table
  const hiddenCols = graphConfig.hiddenColumns[tableName] || [];

  // Filter out internal fields, metadata, and hidden columns
  const displayFields = Object.entries(otherFields).filter(
    ([key]) => !key.startsWith('_') && key !== 'pk' && !hiddenCols.includes(key)
  );

  // Determine sizing CSS class
  const sizingClass = graphConfig.fixWidth && graphConfig.fixHeight
    ? styles.fixedBoth
    : graphConfig.fixWidth
      ? styles.fixedWidth
      : graphConfig.fixHeight
        ? styles.fixedHeight
        : styles.autoSize;

  const hasConstrainedWidth = graphConfig.fixWidth
    || (graphConfig.dataDrivenSizing.enabled && graphConfig.dataDrivenSizing.axis === 'width');
  const truncateClass = hasConstrainedWidth ? ` ${styles.truncate}` : '';

  // Dynamic handle positions based on layout direction
  const handlePositions = getHandlePositions(graphConfig.rankdir);

  // Data-driven sizing (with cross-axis fix support)
  const { dataDrivenSizing } = graphConfig;
  const dataDrivenStyle = useMemo(() => {
    return computeNodeInlineStyle(data, {
      dataDrivenSizing,
      fixWidth: graphConfig.fixWidth,
      fixHeight: graphConfig.fixHeight,
    });
  }, [dataDrivenSizing, graphConfig.fixWidth, graphConfig.fixHeight, data]);

  // When data-driven sizing is active, use a class that doesn't constrain the driven axis
  const effectiveSizingClass = dataDrivenStyle
    ? (dataDrivenSizing.axis === 'width' ? styles.dataDrivenWidth : styles.dataDrivenHeight)
    : sizingClass;

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredNode({
      nodeId: id,
      label: (data.label as string) || 'Unnamed Task',
      screenX: rect.left + rect.width / 2,
      screenY: rect.top,
    });
  }, [id, data.label, setHoveredNode]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  const handleCollapseToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const current = pendingCollapsedNodeIds;
    const updated = current.includes(id)
      ? current.filter((nid) => nid !== id)
      : [...current, id];
    updatePendingGraphConfig({ collapsedNodeIds: updated });
  }, [id, pendingCollapsedNodeIds, updatePendingGraphConfig]);

  return (
    <>
      <Handle type="target" position={handlePositions.target} />
      <div
        className={`${styles.node} ${effectiveSizingClass}`}
        style={{
          backgroundColor,
          borderColor,
          color: textColor,
          ...dataDrivenStyle,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={styles.nodeHeader} style={{ color: textColor }}>
          <span className={`${styles.headerLabel}${truncateClass}`}>
            {label || 'Unnamed Task'}
          </span>
          {hasChildren && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleCollapseToggle}
              className={styles.collapseButton}
            >
              {isCollapsed
                ? <IconChevronRight size={14} />
                : <IconChevronDown size={14} />}
            </ActionIcon>
          )}
        </div>
        <div className={styles.nodeContent}>
          {displayFields.map(([key, value]) => (
            <div key={key} className={styles.field}>
              <span className={`${styles.fieldLabel}${truncateClass}`}>{key}:</span>
              <span className={`${styles.fieldValue}${truncateClass}`}>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={handlePositions.source} />
    </>
  );
});
