import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type MirroringService } from '@services/mirroring/mirroring.service';
import { SwipeEasing } from '@services/mirroring/mirroring.types';

import { screenshotDelaySchema, withScreenshotAfter } from './screenshot-after';

const toolError = (
  error: unknown,
): {
  content: [{ type: 'text'; text: string }];
  isError: true;
} => {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
};

export const registerAutomationTools = ({
  server,
  mirroringService,
}: {
  server: McpServer;
  mirroringService: MirroringService;
  screenSize: { width: number; height: number };
}): void => {
  const actionContent = (
    text: string,
  ): Array<{ type: 'text'; text: string }> => {
    const warning = mirroringService.permissionWarnings.accessibility;
    const blocks: Array<{ type: 'text'; text: string }> = [];
    if (warning) blocks.push({ type: 'text', text: warning });
    blocks.push({ type: 'text', text });
    return blocks;
  };

  server.registerTool(
    'tap',
    {
      description:
        'Tap inside the mirrored iPhone screen at screenshot pixel coordinates. Coordinates outside the iPhone screen are rejected. Take a screenshot first.',
      inputSchema: {
        x: z.number().describe('X coordinate to tap (in screenshot pixels)'),
        y: z.number().describe('Y coordinate to tap (in screenshot pixels)'),
        numTaps: z
          .number()
          .int()
          .min(1)
          .max(3)
          .optional()
          .describe('Number of taps. Default 1; maximum 3.'),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ x, y, numTaps, screenshotDelay }) => {
      try {
        await mirroringService.tap({ x, y, numTaps });
        const label =
          numTaps && numTaps > 1
            ? `Tapped ${String(numTaps)}x at (${x}, ${y})`
            : `Tapped at (${x}, ${y})`;
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(label),
        );
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'swipe',
    {
      description:
        'Swipe inside the mirrored iPhone screen between two screenshot pixel coordinates. Both endpoints are bounds-checked. For Pokémon GO lists, prefer swipe over scroll-wheel events. Take a screenshot first and verify the result afterward.',
      inputSchema: {
        startX: z.number().describe('Start X coordinate (screenshot pixels)'),
        startY: z.number().describe('Start Y coordinate (screenshot pixels)'),
        endX: z.number().describe('End X coordinate (screenshot pixels)'),
        endY: z.number().describe('End Y coordinate (screenshot pixels)'),
        duration: z
          .number()
          .positive()
          .max(3000)
          .optional()
          .describe('Swipe duration in milliseconds (default: 500; max: 3000)'),
        easing: z.nativeEnum(SwipeEasing).optional(),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({
      startX,
      startY,
      endX,
      endY,
      duration,
      easing,
      screenshotDelay,
    }) => {
      try {
        await mirroringService.swipe({
          startX,
          startY,
          endX,
          endY,
          duration,
          easing,
        });
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(
            `Swiped from (${startX}, ${startY}) to (${endX}, ${endY})`,
          ),
        );
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );
};
