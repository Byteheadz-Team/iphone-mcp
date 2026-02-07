import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type DeviceService } from '../../services/device/device.service.js';
import { type WdaClient } from '../../services/wda/wda-client.js';

export function registerDeviceTools(
  server: McpServer,
  deviceService: DeviceService,
  wdaClient: WdaClient,
): void {
  server.tool('list_devices', 'List all connected iOS devices', {}, async () => {
    const devices = await deviceService.listDevices();
    return {
      content: [{ type: 'text', text: JSON.stringify(devices, null, 2) }],
    };
  });

  server.tool(
    'device_info',
    'Get detailed information about a connected iOS device',
    { udid: z.string().optional().describe('Device UDID (uses first device if not specified)') },
    async ({ udid }) => {
      let targetUdid = udid;
      if (!targetUdid) {
        const device = await deviceService.getActiveDevice();
        targetUdid = device.udid;
      }
      const info = await deviceService.getDeviceInfo(targetUdid);
      return {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
      };
    },
  );

  server.tool(
    'get_screen_info',
    'Get screen dimensions and scale factor of the connected device',
    {},
    async () => {
      const screenInfo = await wdaClient.getScreenInfo();
      return {
        content: [{ type: 'text', text: JSON.stringify(screenInfo, null, 2) }],
      };
    },
  );
}
