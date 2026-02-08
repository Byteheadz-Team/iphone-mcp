import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type MirroringService } from '../../services/mirroring/mirroring.service.js';

import {
  screenshotDelaySchema,
  withScreenshotAfter,
} from './screenshot-after.js';

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
      screenshotDelay: screenshotDelaySchema,
    },
    async ({ x, y, screenshotDelay }) => {
      await mirroringService.tap(x, y);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: `Tapped at (${x}, ${y})` },
      ]);
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
      screenshotDelay: screenshotDelaySchema,
    },
    async ({ x, y, duration, screenshotDelay }) => {
      const durationMs = Math.round(duration * 1000);
      await mirroringService.longPress(x, y, durationMs);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        {
          type: 'text',
          text: `Long pressed at (${x}, ${y}) for ${duration}s`,
        },
      ]);
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
      screenshotDelay: screenshotDelaySchema,
    },
    async ({
      direction,
      startX,
      startY,
      endX,
      endY,
      duration,
      screenshotDelay,
    }) => {
      if (direction) {
        await mirroringService.swipeDirection(direction, startX, startY);
        return withScreenshotAfter(mirroringService, screenshotDelay, [
          { type: 'text', text: `Swiped ${direction}` },
        ]);
      }

      if (
        startX !== undefined &&
        startY !== undefined &&
        endX !== undefined &&
        endY !== undefined
      ) {
        await mirroringService.swipe(startX, startY, endX, endY, duration);
        return withScreenshotAfter(mirroringService, screenshotDelay, [
          {
            type: 'text',
            text: `Swiped from (${startX}, ${startY}) to (${endX}, ${endY})`,
          },
        ]);
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
      screenshotDelay: screenshotDelaySchema,
    },
    async ({ text, screenshotDelay }) => {
      await mirroringService.typeText(text);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: `Typed: "${text}"` },
      ]);
    },
  );

  server.tool(
    'press_button',
    'Press a button on the device. Only "home" is supported (simulated via swipe-up gesture). Volume buttons are not available via iPhone Mirroring.',
    {
      button: z
        .enum(['home', 'volumeUp', 'volumeDown'])
        .describe('Button to press'),
      screenshotDelay: screenshotDelaySchema,
    },
    async ({ button, screenshotDelay }) => {
      await mirroringService.pressButton(button);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: `Pressed button: ${button}` },
      ]);
    },
  );
}
