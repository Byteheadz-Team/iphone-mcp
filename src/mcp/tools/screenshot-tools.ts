import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { type MirroringService } from '@services/mirroring/mirroring.service';

export function registerScreenshotTools(
  server: McpServer,
  mirroringService: MirroringService,
): void {
  server.registerTool(
    'screenshot',
    {
      description: 'Take a screenshot of the connected iOS device',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
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
