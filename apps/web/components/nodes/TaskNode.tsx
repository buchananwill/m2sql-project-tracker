/**
 * Custom TaskNode component for ReactFlow
 * Displays task data with filter-based color coding,
 * configurable sizing mode, and per-table column visibility.
 */

'use client';

import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
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

export const TaskNode = memo(function TaskNode({ data }: NodeProps) {
  // Get config from store
  const colorCodingConfig = useAppStore((state) => state.uiState.colorCodingConfig);
  const graphConfig = useAppStore((state) => state.uiState.graphConfig);

  // Evaluate filters to get colors
  const backgroundColor = evaluateFilters(data, colorCodingConfig.background) || '#ffffff';
  const borderColor = evaluateFilters(data, colorCodingConfig.border) || '#d1d5db';
  const textColor = evaluateFilters(data, colorCodingConfig.text) || '#1f2937';

  // Extract label and other fields
  const { label, name, tableName, ...otherFields } = data;

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
      >
        <div className={`${styles.nodeHeader}${truncateClass}`} style={{ color: textColor }}>
          {label || 'Unnamed Task'}
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
