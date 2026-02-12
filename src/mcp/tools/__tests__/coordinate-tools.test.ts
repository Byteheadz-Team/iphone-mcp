import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import { type GridLayout } from '@lib/mirroring';

import { registerCoordinateTools } from '../coordinate-tools';

// Mock layout: spacing=170, padding=120
// labelPixel(i) = 120 + i * 170  →  A=120, B=290, C=460, ...
const MOCK_LAYOUT: GridLayout = {
  spacing: 170,
  padding: 120,
  fontSize: 64,
  strokeWidth: 4,
  tick: 42,
};

type ToolHandler = (params: Record<string, unknown>) => {
  content: { type: string; text: string }[];
  isError?: boolean;
};

function setup(): ToolHandler {
  let handler: ToolHandler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _config: unknown, h: ToolHandler) => {
      handler = h;
    },
  } as unknown as McpServer;

  registerCoordinateTools({ server: fakeServer, getGridLayout: () => MOCK_LAYOUT });

  if (!handler) {
    throw new Error('registerCoordinateTools did not register a tool');
  }
  return handler;
}

function call(
  handler: ToolHandler,
  column: string,
  row: string,
  xPercent: number | string,
  yPercent: number | string,
): { x: number; y: number } | { error: string } {
  const result = handler({ column, row, xPercent, yPercent });
  const text = result.content[0].text;
  if (result.isError) {
    return { error: text };
  }
  return JSON.parse(text) as { x: number; y: number };
}

describe('get_coordinates', () => {
  const handler = setup();

  it('converts A/A at 0% to the first grid intersection', () => {
    const result = call(handler, 'A', 'A', 0, 0);
    // A=0: 120 + 0*170 = 120
    expect(result).toEqual({ x: 120, y: 120 });
  });

  it('interpolates between grid marks at 50%', () => {
    // B=1: 120+1*170=290, C=2: 120+2*170=460
    // 290 + 0.5*170 = 375, 460 + 0.5*170 = 545
    const result = call(handler, 'B', 'C', 50, 50);
    expect(result).toEqual({ x: 375, y: 545 });
  });

  it('at 100% offset equals the next grid mark', () => {
    // A=120, 100% → 120 + 1.0*170 = 290 (same as B at 0%)
    const result = call(handler, 'A', 'A', 100, 100);
    expect(result).toEqual({ x: 290, y: 290 });
  });

  it('handles string with "%" sign', () => {
    // A=120: 120 + 0.4*170 = 188, 120 + 0.6*170 = 222
    const result = call(handler, 'A', 'A', '40%', '60%');
    expect(result).toEqual({ x: 188, y: 222 });
  });

  it('handles string numeric without "%" sign', () => {
    const result = call(handler, 'A', 'A', '40', '60');
    expect(result).toEqual({ x: 188, y: 222 });
  });

  it('is case-insensitive for grid labels', () => {
    const lower = call(handler, 'b', 'c', 0, 0);
    const upper = call(handler, 'B', 'C', 0, 0);
    expect(lower).toEqual(upper);
  });

  it('returns error for invalid label (digit)', () => {
    const result = call(handler, '1', 'A', 0, 0);
    expect(result).toHaveProperty('error');
  });

  it('returns error for invalid label (multi-char)', () => {
    const result = call(handler, 'AB', 'A', 0, 0);
    expect(result).toHaveProperty('error');
  });

  it('returns error for invalid label (empty string)', () => {
    const result = call(handler, '', 'A', 0, 0);
    expect(result).toHaveProperty('error');
  });

  it('returns error for percentage out of range (negative)', () => {
    const result = call(handler, 'A', 'A', -1, 0);
    expect(result).toHaveProperty('error');
  });

  it('returns error for percentage out of range (> 100)', () => {
    const result = call(handler, 'A', 'A', 101, 0);
    expect(result).toHaveProperty('error');
  });

  it('returns error for non-finite percentage (NaN)', () => {
    const result = call(handler, 'A', 'A', 'abc', 0);
    expect(result).toHaveProperty('error');
  });
});
