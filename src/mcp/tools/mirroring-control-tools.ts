import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type DeviceService } from '@services/device/device.service';
import { type MirroringService } from '@services/mirroring/mirroring.service';

import { screenshotDelaySchema, withScreenshotAfter } from './screenshot-after';

export function registerMirroringControlTools(
  server: McpServer,
  mirroringService: MirroringService,
  deviceService: DeviceService,
): void {
  server.registerTool(
    'get_clipboard',
    {
      description:
        'Get the current clipboard content (uses Universal Clipboard)',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const content = await mirroringService.getClipboard();
      return {
        content: [{ type: 'text', text: content }],
      };
    },
  );

  server.registerTool(
    'set_clipboard',
    {
      description: 'Set the clipboard content (uses Universal Clipboard)',
      inputSchema: {
        content: z.string().describe('Text to set in the clipboard'),
        screenshotDelay: screenshotDelaySchema,
      },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ content, screenshotDelay }) => {
      await mirroringService.setClipboard(content);
      return withScreenshotAfter(mirroringService, screenshotDelay, [
        { type: 'text', text: 'Clipboard content set' },
      ]);
    },
  );

  server.registerTool(
    'get_battery_info',
    {
      description:
        'Get the battery level and charging state of the connected device',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const battery = await deviceService.getBatteryInfo();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(battery, null, 2),
          },
        ],
      };
    },
  );
}
