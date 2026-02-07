/**
 * Custom TaskNode component for ReactFlow
 * Displays task data with filter-based color coding
 */

'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useAppStore } from '@/stores/useAppStore';
import { evaluateFilters } from '@/lib/color-filter-engine';
import styles from './TaskNode.module.css';

export const TaskNode = memo(function TaskNode({ data }: NodeProps) {
  // Get color coding config from store
  const colorCodingConfig = useAppStore((state) => state.uiState.colorCodingConfig);

  // Evaluate filters to get colors
  const backgroundColor = evaluateFilters(data, colorCodingConfig.background) || '#ffffff';
  const borderColor = evaluateFilters(data, colorCodingConfig.border) || '#d1d5db';
  const textColor = evaluateFilters(data, colorCodingConfig.text) || '#1f2937';

  // Extract label and other fields
  const { label, tableName, ...otherFields } = data;

  // Filter out internal ReactFlow fields and metadata
  const displayFields = Object.entries(otherFields).filter(
    ([key]) => !key.startsWith('_') && key !== 'pk'
  );

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`${styles.node} ${styles.autoSize}`}
        style={{
          backgroundColor,
          borderColor,
          color: textColor,
        }}
      >
        <div className={styles.nodeHeader} style={{ color: textColor }}>
          {label || 'Unnamed Task'}
        </div>
        <div className={styles.nodeContent}>
          {displayFields.map(([key, value]) => (
            <div key={key} className={styles.field}>
              <span className={styles.fieldLabel}>{key}:</span>
              <span className={styles.fieldValue}>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
});
