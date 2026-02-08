/**
 * Custom TaskNode component for ReactFlow
 * Displays task data with filter-based color coding,
 * configurable sizing mode, and per-table column visibility.
 */

'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useAppStore } from '@/stores/useAppStore';
import { evaluateFilters } from '@/lib/color-filter-engine';
import styles from './TaskNode.module.css';

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

  const truncateClass = graphConfig.fixWidth ? ` ${styles.truncate}` : '';

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`${styles.node} ${sizingClass}`}
        style={{
          backgroundColor,
          borderColor,
          color: textColor,
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
      <Handle type="source" position={Position.Bottom} />
    </>
  );
});
