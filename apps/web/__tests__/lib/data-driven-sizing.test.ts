import { describe, it, expect } from 'vitest';
import {
  computeDataDrivenSize,
  computeNodeInlineStyle,
  computeEffectiveNodeDimensions,
  NODE_CSS_MIN_WIDTH,
  NODE_CSS_MIN_HEIGHT,
  FIXED_WIDTH,
  FIXED_HEIGHT,
} from '@/lib/data-driven-sizing';
import type { DataDrivenSizingConfig } from '@/stores/slices/uiSlice';

function sizingConfig(overrides: Partial<DataDrivenSizingConfig> = {}): DataDrivenSizingConfig {
  return {
    enabled: true,
    column: 'duration',
    axis: 'width',
    scaleFactor: 5,
    minSize: 80,
    ...overrides,
  };
}

describe('computeDataDrivenSize', () => {
  it('should return undefined when sizing is disabled', () => {
    const config = sizingConfig({ enabled: false });
    expect(computeDataDrivenSize({ duration: 24 }, config)).toBeUndefined();
  });

  it('should return undefined when no column is selected', () => {
    const config = sizingConfig({ column: '' });
    expect(computeDataDrivenSize({ duration: 24 }, config)).toBeUndefined();
  });

  it('should return undefined when the column value is not a number', () => {
    const config = sizingConfig({ column: 'status' });
    expect(computeDataDrivenSize({ status: 'active' }, config)).toBeUndefined();
  });

  it('should compute size from value * scaleFactor', () => {
    const config = sizingConfig({ scaleFactor: 10, minSize: 0 });
    expect(computeDataDrivenSize({ duration: 24 }, config)).toBe(240);
    expect(computeDataDrivenSize({ duration: 40 }, config)).toBe(400);
  });

  it('should enforce minSize as floor', () => {
    const config = sizingConfig({ scaleFactor: 1, minSize: 80 });
    // 24 * 1 = 24, below minSize → clamped to 80
    expect(computeDataDrivenSize({ duration: 24 }, config)).toBe(80);
    // 40 * 1 = 40, below minSize → clamped to 80
    expect(computeDataDrivenSize({ duration: 40 }, config)).toBe(80);
  });

  it('should return different sizes for different data values', () => {
    const config = sizingConfig({ scaleFactor: 5, minSize: 80 });
    const sizeA = computeDataDrivenSize({ duration: 24 }, config); // max(80, 120) = 120
    const sizeB = computeDataDrivenSize({ duration: 40 }, config); // max(80, 200) = 200
    expect(sizeA).not.toEqual(sizeB);
  });
});

describe('computeNodeInlineStyle', () => {
  it('should return undefined when data-driven sizing is disabled', () => {
    const style = computeNodeInlineStyle({ duration: 24 }, {
      dataDrivenSizing: sizingConfig({ enabled: false }),
      fixWidth: false,
      fixHeight: false,
    });
    expect(style).toBeUndefined();
  });

  it('should return data-driven width when sizing is on width axis', () => {
    const style = computeNodeInlineStyle({ duration: 24 }, {
      dataDrivenSizing: sizingConfig({ axis: 'width', scaleFactor: 10, minSize: 80 }),
      fixWidth: false,
      fixHeight: false,
    });
    // 24 * 10 = 240
    expect(style).toEqual({ width: '240px' });
  });

  /**
   * BUG: When data-driven sizing is on width, the .dataDrivenWidth CSS class
   * sets height: auto, overriding the fixedHeight constraint.
   * The inline style must include height: 100px to override the CSS auto.
   */
  it('should include fixed height when data-driven sizing is on width and fixHeight is true', () => {
    const style = computeNodeInlineStyle({ duration: 24 }, {
      dataDrivenSizing: sizingConfig({ axis: 'width', scaleFactor: 10, minSize: 80 }),
      fixWidth: false,
      fixHeight: true,
    });
    expect(style).toEqual({ width: '240px', height: `${FIXED_HEIGHT}px` });
  });

  it('should include fixed width when data-driven sizing is on height and fixWidth is true', () => {
    const style = computeNodeInlineStyle({ duration: 24 }, {
      dataDrivenSizing: sizingConfig({ axis: 'height', scaleFactor: 10, minSize: 80 }),
      fixWidth: true,
      fixHeight: false,
    });
    expect(style).toEqual({ height: '240px', width: `${FIXED_WIDTH}px` });
  });

  it('should not include fixed dimension on the same axis as data-driven sizing', () => {
    // fixWidth should NOT override data-driven width
    const style = computeNodeInlineStyle({ duration: 24 }, {
      dataDrivenSizing: sizingConfig({ axis: 'width', scaleFactor: 10, minSize: 80 }),
      fixWidth: true,
      fixHeight: false,
    });
    expect(style).toEqual({ width: '240px' });
  });
});

describe('computeEffectiveNodeDimensions', () => {
  /**
   * THIS TEST SHOULD FAIL with the current CSS.
   *
   * The .node class has min-width: 200px, and the .dataDrivenWidth class
   * does not override it. So when the computed data-driven width is below
   * 200px (e.g. 120px for value=24, scaleFactor=5), the browser renders
   * the node at 200px, making it indistinguishable from a node whose
   * computed width is also ≤ 200px.
   *
   * With scaleFactor=5:
   *   Node A (duration=24): max(80, 120) = 120px → CSS clamps to 200px
   *   Node B (duration=40): max(80, 200) = 200px → CSS clamps to 200px
   *   Both 200px → visually identical → BUG
   */
  it('should produce different effective widths for nodes with different data values', () => {
    const config = { dataDrivenSizing: sizingConfig({ axis: 'width', scaleFactor: 5, minSize: 80 }) };

    const dimsA = computeEffectiveNodeDimensions({ duration: 24 }, config);
    const dimsB = computeEffectiveNodeDimensions({ duration: 40 }, config);

    // Node A (120px computed) and Node B (200px computed) should be different
    expect(dimsA.width).not.toEqual(dimsB.width);
  });

  it('should produce different effective heights for nodes with different data values', () => {
    const config = { dataDrivenSizing: sizingConfig({ axis: 'height', scaleFactor: 3, minSize: 50 }) };

    // 24 * 3 = 72, max(50, 72) = 72 → CSS clamps to 100
    // 40 * 3 = 120, max(50, 120) = 120 → CSS clamps to 120... wait, 120 > 100, so this passes.
    // Use values that both fall below CSS min-height (100px):
    const dimsA = computeEffectiveNodeDimensions({ duration: 10 }, config);
    const dimsB = computeEffectiveNodeDimensions({ duration: 30 }, config);
    // 10 * 3 = 30, max(50, 30) = 50 → CSS clamps to 100
    // 30 * 3 = 90, max(50, 90) = 90 → CSS clamps to 100
    // Both 100 → BUG
    expect(dimsA.height).not.toEqual(dimsB.height);
  });

  it('should use the data-driven minSize as the effective floor, not the CSS minimum', () => {
    // The user-configured minSize should be the actual minimum, not the CSS hard-coded 200px.
    const config = { dataDrivenSizing: sizingConfig({ axis: 'width', scaleFactor: 1, minSize: 50 }) };

    const dims = computeEffectiveNodeDimensions({ duration: 30 }, config);
    // 30 * 1 = 30, max(50, 30) = 50. User expects 50px, but CSS gives 200px.
    expect(dims.width).toBe(50);
  });

  it('should fix height when data-driven sizing is on width and fixHeight is true', () => {
    const config = {
      dataDrivenSizing: sizingConfig({ axis: 'width', scaleFactor: 10, minSize: 80 }),
      fixHeight: true,
    };

    const dims = computeEffectiveNodeDimensions({ duration: 24 }, config);
    // Width from data: max(80, 240) = 240
    expect(dims.width).toBe(240);
    // Height fixed at CSS constant (100px) — not auto
    expect(dims.height).toBe(NODE_CSS_MIN_HEIGHT);
  });

  it('should fix width when data-driven sizing is on height and fixWidth is true', () => {
    const config = {
      dataDrivenSizing: sizingConfig({ axis: 'height', scaleFactor: 10, minSize: 80 }),
      fixWidth: true,
    };

    const dims = computeEffectiveNodeDimensions({ duration: 24 }, config);
    // Height from data: max(80, 240) = 240
    expect(dims.height).toBe(240);
    // Width fixed at CSS constant (200px) — not auto
    expect(dims.width).toBe(NODE_CSS_MIN_WIDTH);
  });
});
