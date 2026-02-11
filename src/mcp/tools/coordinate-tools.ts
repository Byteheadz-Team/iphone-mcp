import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import config from '~/config';

const percentSchema = z
  .union([z.number(), z.string()])
  .describe(
    'Percentage offset (0–100). Accepts a number or a string (trailing "%" is stripped).',
  );

function parsePercent(value: number | string): number {
  const str = String(value).replace(/%$/, '').trim();
  const num = Number(str);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid percentage value: ${JSON.stringify(value)}`);
  }
  if (num < 0 || num > 100) {
    throw new Error(`Percentage must be between 0 and 100, got ${num}`);
  }
  return num;
}

function labelToIndex(label: string): number {
  if (label.length !== 1) {
    throw new Error(
      `Grid label must be a single letter A–Z, got ${JSON.stringify(label)}`,
    );
  }
  const code = label.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) {
    throw new Error(
      `Grid label must be a letter A–Z, got ${JSON.stringify(label)}`,
    );
  }
  return code - 64; // A=1, B=2, ...
}

function labelPixel(index: number, padding: number, spacing: number): number {
  return padding + index * spacing;
}

export function registerCoordinateTools(server: McpServer): void {
  const { overlayGridSpacing: spacing, overlayGridPadding: padding } =
    config.mirroring;

  server.registerTool(
    'get_coordinates',
    {
      description:
        'Convert grid labels to exact pixel coordinates. ALWAYS use this tool to determine coordinates for tap, swipe, and long_press — never estimate coordinates manually or use the calculate tool for coordinate math. Provide the grid column (X axis) and row (Y axis) labels nearest to the target, plus a percentage offset (0–100) toward the next grid line.',
      inputSchema: {
        column: z
          .string()
          .describe(
            'Grid column letter nearest to the LEFT of the target (e.g. "B")',
          ),
        row: z
          .string()
          .describe('Grid row letter nearest ABOVE the target (e.g. "D")'),
        xPercent: percentSchema.describe(
          'How far right between this column and the next, 0–100 (e.g. 50 = halfway)',
        ),
        yPercent: percentSchema.describe(
          'How far down between this row and the next, 0–100 (e.g. 50 = halfway)',
        ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    ({ column, row, xPercent, yPercent }) => {
      try {
        const colIndex = labelToIndex(column);
        const rowIndex = labelToIndex(row);
        const xPct = parsePercent(xPercent);
        const yPct = parsePercent(yPercent);

        const x = Math.round(
          labelPixel(colIndex, padding, spacing) + (xPct / 100) * spacing,
        );
        const y = Math.round(
          labelPixel(rowIndex, padding, spacing) + (yPct / 100) * spacing,
        );

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ x, y }) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
