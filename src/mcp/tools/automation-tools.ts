import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type MirroringService } from '../../services/mirroring/mirroring.service.js';

export function registerAutomationTools(
  server: McpServer,
  mirroringService: MirroringService,
): void {
  server.tool(
    'tap',
    'Tap on the screen at the given coordinates',
    {
      x: z.number().describe('X coordinate to tap (in screenshot pixels)'),
      y: z.number().describe('Y coordinate to tap (in screenshot pixels)'),
    },
    async ({ x, y }) => {
      await mirroringService.tap(x, y);
      return {
        content: [{ type: 'text', text: `Tapped at (${x}, ${y})` }],
      };
    },
  );

  server.tool(
    'long_press',
    'Press and hold at the given coordinates for a duration',
    {
      x: z.number().describe('X coordinate (in screenshot pixels)'),
      y: z.number().describe('Y coordinate (in screenshot pixels)'),
      duration: z
        .number()
        .describe('Hold duration in seconds (e.g. 2 for two seconds)'),
    },
    async ({ x, y, duration }) => {
      const durationMs = Math.round(duration * 1000);
      await mirroringService.longPress(x, y, durationMs);
      return {
        content: [
          {
            type: 'text',
            text: `Long pressed at (${x}, ${y}) for ${duration}s`,
          },
        ],
      };
    },
  );

  server.tool(
    'swipe',
    'Swipe on the screen in a direction or between two points',
    {
      direction: z
        .enum(['up', 'down', 'left', 'right'])
        .optional()
        .describe('Swipe direction'),
      startX: z.number().optional().describe('Start X coordinate'),
      startY: z.number().optional().describe('Start Y coordinate'),
      endX: z.number().optional().describe('End X coordinate'),
      endY: z.number().optional().describe('End Y coordinate'),
      duration: z
        .number()
        .optional()
        .describe('Swipe duration in milliseconds (default: 500)'),
    },
    async ({ direction, startX, startY, endX, endY, duration }) => {
      if (direction) {
        await mirroringService.swipeDirection(direction, startX, startY);
        return {
          content: [{ type: 'text', text: `Swiped ${direction}` }],
        };
      }

      if (
        startX !== undefined &&
        startY !== undefined &&
        endX !== undefined &&
        endY !== undefined
      ) {
        await mirroringService.swipe(startX, startY, endX, endY, duration);
        return {
          content: [
            {
              type: 'text',
              text: `Swiped from (${startX}, ${startY}) to (${endX}, ${endY})`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: 'Provide either a direction or start/end coordinates',
          },
        ],
        isError: true,
      };
    },
  );

  server.tool(
    'type_text',
    'Type text into the currently focused input field',
    {
      text: z.string().describe('Text to type'),
    },
    async ({ text }) => {
      await mirroringService.typeText(text);
      return {
        content: [{ type: 'text', text: `Typed: "${text}"` }],
      };
    },
  );

  server.tool(
    'press_button',
    'Press a button on the device. Only "home" is supported (simulated via swipe-up gesture). Volume buttons are not available via iPhone Mirroring.',
    {
      button: z
        .enum(['home', 'volumeUp', 'volumeDown'])
        .describe('Button to press'),
    },
    async ({ button }) => {
      await mirroringService.pressButton(button);
      return {
        content: [{ type: 'text', text: `Pressed button: ${button}` }],
      };
    },
  );
}
