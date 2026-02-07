import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type AutomationService } from '../../services/automation/automation.service.js';

export function registerAutomationTools(
  server: McpServer,
  automationService: AutomationService,
): void {
  server.tool(
    'tap',
    'Tap on the screen at coordinates or on an element by accessibility ID',
    {
      x: z.number().optional().describe('X coordinate to tap'),
      y: z.number().optional().describe('Y coordinate to tap'),
      element: z
        .string()
        .optional()
        .describe('Accessibility ID of the element to tap'),
    },
    async ({ x, y, element }) => {
      if (element) {
        await automationService.tapElement(element);
        return {
          content: [
            { type: 'text', text: `Tapped element: ${element}` },
          ],
        };
      }

      if (x !== undefined && y !== undefined) {
        await automationService.tapCoordinates(x, y);
        return {
          content: [{ type: 'text', text: `Tapped at (${x}, ${y})` }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: 'Error: provide either (x, y) coordinates or an element accessibility ID',
          },
        ],
        isError: true,
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
        .describe('Swipe duration in seconds (default: 0.5)'),
    },
    async ({ direction, startX, startY, endX, endY, duration }) => {
      if (direction) {
        await automationService.swipeDirection(direction, startX, startY);
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
        await automationService.swipeCoordinates(
          startX,
          startY,
          endX,
          endY,
          duration,
        );
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
            text: 'Error: provide either a direction or start/end coordinates',
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
      await automationService.typeText(text);
      return {
        content: [
          { type: 'text', text: `Typed: "${text}"` },
        ],
      };
    },
  );

  server.tool(
    'press_button',
    'Press a physical button on the device',
    {
      button: z
        .enum(['home', 'volumeUp', 'volumeDown'])
        .describe('Button to press'),
    },
    async ({ button }) => {
      await automationService.pressButton(button);
      return {
        content: [
          { type: 'text', text: `Pressed button: ${button}` },
        ],
      };
    },
  );

  server.tool(
    'find_element',
    'Find a UI element on screen using a search strategy',
    {
      using: z
        .enum([
          'accessibility id',
          'class name',
          'xpath',
          'predicate string',
          'class chain',
          '-ios predicate string',
          '-ios class chain',
        ])
        .describe('Search strategy'),
      value: z.string().describe('Value to search for'),
    },
    async ({ using, value }) => {
      const element = await automationService.findElement(using, value);
      return {
        content: [{ type: 'text', text: JSON.stringify(element, null, 2) }],
      };
    },
  );

  server.tool(
    'get_page_source',
    'Get the current UI element tree (accessibility hierarchy)',
    {},
    async () => {
      const source = await automationService.getPageSource();
      return {
        content: [{ type: 'text', text: source }],
      };
    },
  );
}
