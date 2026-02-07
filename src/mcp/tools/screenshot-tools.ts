import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { type ScreenshotService } from '../../services/screenshot/screenshot.service.js';

export function registerScreenshotTools(
  server: McpServer,
  screenshotService: ScreenshotService,
): void {
  server.tool(
    'screenshot',
    'Take a screenshot of the connected iOS device',
    {},
    async () => {
      const result = await screenshotService.capture();
      return {
        content: [
          {
            type: 'image',
            data: result.data.toString('base64'),
            mimeType: 'image/png',
          },
        ],
      };
    },
  );
}
