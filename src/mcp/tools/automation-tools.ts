import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type MirroringService } from '@services/mirroring/mirroring.service';
import { SwipeEasing } from '@services/mirroring/mirroring.types';

import { screenshotDelaySchema, withScreenshotAfter } from './screenshot-after';

export function registerAutomationTools(
  server: McpServer,
  mirroringService: MirroringService,
): void {
  server.registerTool(
    'tap',
    {
      description:
        'Tap on the screen at the given coordinates. Take a screenshot first to confirm the current screen state.',
      inputSchema: {
        x: z.number().describe('X coordinate to tap (in screenshot pixels)'),
        y: z.number().describe('Y coordinate to tap (in screenshot pixels)'),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ x, y, screenshotDelay }) => {
      await mirroringService.tap(x, y);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: `Tapped at (${x}, ${y})` },
      ]);
    },
  );

  server.registerTool(
    'long_press',
    {
      description:
        'Press and hold at the given coordinates for a duration. Take a screenshot first to confirm the current screen state.',
      inputSchema: {
        x: z.number().describe('X coordinate (in screenshot pixels)'),
        y: z.number().describe('Y coordinate (in screenshot pixels)'),
        duration: z
          .number()
          .describe('Hold duration in seconds (e.g. 2 for two seconds)'),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
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

  server.registerTool(
    'swipe',
    {
      description:
        'Swipe on the screen between two points. Take a screenshot first to confirm the current screen state. Swiping up from the bottom edge will NOT go to the home screen — use the press_button tool with button "home" instead. IMPORTANT: Start and end swipes in empty areas between UI elements, not directly on icons or buttons (to avoid triggering edit/jiggle mode or unintended taps). For home screen page swiping, start from empty space between icon rows. For list scrolling, use the center of the content area.',
      inputSchema: {
        startX: z
          .number()
          .describe('Start X coordinate (in screenshot pixels)'),
        startY: z
          .number()
          .describe('Start Y coordinate (in screenshot pixels)'),
        endX: z.number().describe('End X coordinate (in screenshot pixels)'),
        endY: z.number().describe('End Y coordinate (in screenshot pixels)'),
        duration: z
          .number()
          .optional()
          .describe('Swipe duration in milliseconds (default: 500)'),
        easing: z
          .nativeEnum(SwipeEasing)
          .optional()
          .describe(
            'Speed curve. linear (default): constant speed — best for scrolling, page swipes, and most gestures. Maintains velocity through release so iOS applies natural momentum after finger lift. ease-in: accelerating — best for dismissing cards, fling-to-delete, or any gesture wanting maximum momentum. Velocity at release is 3× average velocity. ease-out: decelerating to a stop — for precise drag-and-drop where you need to place something at an exact position. Kills momentum (velocity → 0 at release). Do NOT use for scrolling. ease-in-out: slow start and end — for precise repositioning like reordering lists or adjusting sliders. Also kills momentum at release.',
          ),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
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
      await mirroringService.swipe(
        startX,
        startY,
        endX,
        endY,
        duration,
        easing,
      );
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        {
          type: 'text',
          text: `Swiped from (${startX}, ${startY}) to (${endX}, ${endY})`,
        },
      ]);
    },
  );

  server.registerTool(
    'type_text',
    {
      description:
        'Type text into the currently focused input field. Always use this tool for text input — do not wait for the on-screen keyboard to appear, it will not be visible in screenshots but this tool will still work. Take a screenshot first to confirm the current screen state.',
      inputSchema: {
        text: z.string().describe('Text to type'),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ text, screenshotDelay }) => {
      await mirroringService.typeText(text);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: `Typed: "${text}"` },
      ]);
    },
  );

  server.registerTool(
    'press_button',
    {
      description:
        'Press a device button (simulated via keyboard shortcut). Use "home" instead of swiping up from the bottom edge, which will not work via iPhone Mirroring.',
      inputSchema: {
        button: z
          .enum(['home', 'app_switcher', 'spotlight'])
          .describe(
            'Button to press. "home" = go to home screen, "app_switcher" = open app switcher, "spotlight" = open Spotlight search.',
          ),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ button, screenshotDelay }) => {
      await mirroringService.pressButton(button);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: `Pressed button: ${button}` },
      ]);
    },
  );
}
