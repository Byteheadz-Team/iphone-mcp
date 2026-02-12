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

export const registerAutomationTools = (
  server: McpServer,
  mirroringService: MirroringService,
): void => {
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
        'Tap on the screen at the given coordinates. Take a screenshot first to confirm the current screen state.',
      inputSchema: {
        x: z.number().describe('X coordinate to tap (in screenshot pixels)'),
        y: z.number().describe('Y coordinate to tap (in screenshot pixels)'),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ x, y, screenshotDelay }) => {
      try {
        await mirroringService.tap({ x, y });
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(`Tapped at (${x}, ${y})`),
        );
      } catch (error: unknown) {
        return toolError(error);
      }
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
      try {
        const durationMs = Math.round(duration * 1000);
        await mirroringService.longPress({ x, y, durationMs });
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(`Long pressed at (${x}, ${y}) for ${duration}s`),
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
        'Swipe on the screen between two points. Best for directional gestures: switching pages, dismissing cards, pull-to-refresh, fling-to-delete, and drag-and-drop. For scrolling through content (lists, web pages, feeds), prefer the scroll tool instead — it uses trackpad-style scroll wheel events which are more reliable for content scrolling. Take a screenshot first to confirm the current screen state. Swiping up from the bottom edge will NOT go to the home screen — use the press_button tool with button "home" instead. IMPORTANT: Start and end swipes in empty areas between UI elements, not directly on icons or buttons (to avoid triggering edit/jiggle mode or unintended taps). For home screen page swiping, start from empty space between icon rows.',
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

  server.registerTool(
    'scroll',
    {
      description:
        'Scroll content at the given coordinates using trackpad-style scroll wheel events. Use this instead of swipe for scrolling through lists, web pages, feeds, and any scrollable content — it produces smoother, more reliable results. Only requires a single point (where to scroll) plus a delta amount, so no need to calculate start/end coordinates. Use swipe instead for directional gestures like switching pages, dismissing cards, pull-to-refresh, or drag-and-drop. Take a screenshot first to confirm the current screen state. The server auto-detects the macOS "Natural scrolling" setting at startup and compensates, so positive deltaY should consistently mean "scroll down" (content moves up). However, if the content moves the wrong way after scrolling, retry with the opposite sign (negate deltaY/deltaX).',
      inputSchema: {
        x: z
          .number()
          .describe('X coordinate to scroll at (in screenshot pixels)'),
        y: z
          .number()
          .describe('Y coordinate to scroll at (in screenshot pixels)'),
        deltaX: z
          .number()
          .optional()
          .describe(
            'Horizontal scroll amount in pixels. Positive = scroll right, negative = scroll left. Default 0. If the content moves the wrong way, negate the value and try again.',
          ),
        deltaY: z
          .number()
          .optional()
          .describe(
            'Vertical scroll amount in pixels. Positive = scroll down (content moves up), negative = scroll up (content moves down). Default 0. If the content moves the wrong way, negate the value and try again.',
          ),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ x, y, deltaX, deltaY, screenshotDelay }) => {
      try {
        await mirroringService.scroll({ x, y, deltaX, deltaY });
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(
            `Scrolled at (${x}, ${y}) by deltaX=${String(deltaX ?? 0)}, deltaY=${String(deltaY ?? 0)}`,
          ),
        );
      } catch (error: unknown) {
        return toolError(error);
      }
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
      try {
        await mirroringService.typeText(text);
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(`Typed: "${text}"`),
        );
      } catch (error: unknown) {
        return toolError(error);
      }
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
      try {
        await mirroringService.pressButton(button);
        return withScreenshotAfter(
          mirroringService,
          screenshotDelay,
          actionContent(`Pressed button: ${button}`),
        );
      } catch (error: unknown) {
        return toolError(error);
      }
    },
  );
};
