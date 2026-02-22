'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import styles from './NodePopover.module.css';

const SHOW_DELAY = 250;
const HIDE_GRACE = 500;

interface VisibleState {
  label: string;
  screenX: number;
  screenY: number;
}

export function NodePopover() {
  const hoveredNode = useAppStore((state) => state.uiState.hoveredNode);
  const [visible, setVisible] = useState<VisibleState | null>(null);

  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (hoveredNode) {
      // Cancel any pending hide
      clearTimeout(hideTimerRef.current);

      if (wasVisibleRef.current) {
        // Already showing — immediate transition (node A → node B)
        setVisible({
          label: hoveredNode.label,
          screenX: hoveredNode.screenX,
          screenY: hoveredNode.screenY,
        });
      } else {
        // First hover — delayed show
        clearTimeout(showTimerRef.current);
        showTimerRef.current = setTimeout(() => {
          setVisible({
            label: hoveredNode.label,
            screenX: hoveredNode.screenX,
            screenY: hoveredNode.screenY,
          });
          wasVisibleRef.current = true;
        }, SHOW_DELAY);
      }
    } else {
      // Mouse left node — grace period before hiding
      clearTimeout(showTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setVisible(null);
        wasVisibleRef.current = false;
      }, HIDE_GRACE);
    }

    return () => {
      clearTimeout(showTimerRef.current);
      clearTimeout(hideTimerRef.current);
    };
  }, [hoveredNode]);

  if (!visible) return null;

  return (
    <div
      className={styles.popover}
      style={{
        left: visible.screenX,
        top: visible.screenY,
      }}
    >
      {visible.label}
    </div>
  );
}
