import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { type MirroringService } from '../../services/mirroring/mirroring.service.js';

export function registerScreenshotTools(
  server: McpServer,
  mirroringService: MirroringService,
): void {
  server.tool(
    'screenshot',
    'Take a screenshot of the connected iOS device',
    {},
    async () => {
      const data = await mirroringService.takeScreenshot();
      return {
        content: [
          {
            type: 'image',
            data: data.toString('base64'),
            mimeType: 'image/png',
          },
        ],
      };
    },
  );
}
