import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import { registerCoordinateTools } from '../coordinate-tools';

// Default config: overlayGridSpacing=50, overlayGridPadding=50
// labelPixel(i) = 50 + i * 50  →  A=100, B=150, C=200, ...

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

  registerCoordinateTools(fakeServer);

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
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it('interpolates between grid marks at 50%', () => {
    // B=150, C=200 → 150 + 0.5*50 = 175, 200 + 0.5*50 = 225
    const result = call(handler, 'B', 'C', 50, 50);
    expect(result).toEqual({ x: 175, y: 225 });
  });

  it('at 100% offset equals the next grid mark', () => {
    // A=100, 100% → 100 + 1.0*50 = 150 (same as B at 0%)
    const result = call(handler, 'A', 'A', 100, 100);
    expect(result).toEqual({ x: 150, y: 150 });
  });

  it('handles string with "%" sign', () => {
    const result = call(handler, 'A', 'A', '40%', '60%');
    // 100 + 0.4*50 = 120, 100 + 0.6*50 = 130
    expect(result).toEqual({ x: 120, y: 130 });
  });

  it('handles string numeric without "%" sign', () => {
    const result = call(handler, 'A', 'A', '40', '60');
    expect(result).toEqual({ x: 120, y: 130 });
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
