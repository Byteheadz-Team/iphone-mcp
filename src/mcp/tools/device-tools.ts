import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type DeviceService } from '@services/device/device.service';
import { type MirroringService } from '@services/mirroring/mirroring.service';

export function registerDeviceTools(
  server: McpServer,
  deviceService: DeviceService,
  mirroringService: MirroringService,
): void {
  server.registerTool(
    'list_devices',
    {
      description: 'List all connected iOS devices',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const devices = await deviceService.listDevices();
      return {
        content: [{ type: 'text', text: JSON.stringify(devices, null, 2) }],
      };
    },
  );

  server.registerTool(
    'device_info',
    {
      description: 'Get detailed information about a connected iOS device',
      inputSchema: {
        udid: z
          .string()
          .optional()
          .describe('Device UDID (uses first device if not specified)'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
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

  server.registerTool(
    'get_screen_info',
    {
      description:
        'Get screen dimensions and scale factor of the iPhone Mirroring window',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const screenInfo = await mirroringService.getScreenInfo();
      return {
        content: [{ type: 'text', text: JSON.stringify(screenInfo, null, 2) }],
      };
    },
  );
}
