import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { type MirroringService } from '@services/mirroring/mirroring.service';

export const registerScreenshotTools = (
  server: McpServer,
  mirroringService: MirroringService,
): void => {
  server.registerTool(
    'screenshot',
    {
      description: 'Take a screenshot of the connected iOS device',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const warning = mirroringService.permissionWarnings.screenRecording;
        const data = await mirroringService.takeScreenshot();
        return {
          content: [
            ...(warning ? [{ type: 'text' as const, text: warning }] : []),
            {
              type: 'image' as const,
              data: data.toString('base64'),
              mimeType: 'image/png',
            },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
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
      try {
        const screenInfo = await mirroringService.getScreenInfo();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(screenInfo, null, 2),
            },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
};
