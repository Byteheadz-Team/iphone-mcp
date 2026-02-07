import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type WdaClient } from '../../services/wda/wda-client.js';

export function registerDeviceControlTools(
  server: McpServer,
  wdaClient: WdaClient,
): void {
  server.tool(
    'lock_device',
    'Lock the device screen',
    {},
    async () => {
      await wdaClient.lock();
      return {
        content: [{ type: 'text', text: 'Device locked' }],
      };
    },
  );

  server.tool(
    'unlock_device',
    'Unlock the device screen',
    {},
    async () => {
      await wdaClient.unlock();
      return {
        content: [{ type: 'text', text: 'Device unlocked' }],
      };
    },
  );

  server.tool(
    'get_clipboard',
    'Get the current clipboard content from the device',
    {},
    async () => {
      const content = await wdaClient.getClipboard();
      return {
        content: [{ type: 'text', text: content }],
      };
    },
  );

  server.tool(
    'set_clipboard',
    'Set the clipboard content on the device',
    {
      content: z.string().describe('Text to set in the clipboard'),
    },
    async ({ content }) => {
      await wdaClient.setClipboard(content);
      return {
        content: [{ type: 'text', text: 'Clipboard content set' }],
      };
    },
  );

  server.tool(
    'get_battery_info',
    'Get the battery level and charging state of the device',
    {},
    async () => {
      const battery = await wdaClient.getBatteryInfo();
      const stateNames: Record<number, string> = {
        0: 'unknown',
        1: 'unplugged',
        2: 'charging',
        3: 'full',
      };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                level: Math.round(battery.level * 100),
                state: stateNames[battery.state] ?? 'unknown',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'device_is_locked',
    'Check if the device screen is locked',
    {},
    async () => {
      const locked = await wdaClient.isLocked();
      return {
        content: [
          {
            type: 'text',
            text: locked ? 'Device is locked' : 'Device is unlocked',
          },
        ],
      };
    },
  );
}
