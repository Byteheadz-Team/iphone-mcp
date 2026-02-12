import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type MirroringService } from '@services/mirroring/mirroring.service';

import { screenshotDelaySchema, withScreenshotAfter } from './screenshot-after';

export function registerMirroringControlTools(
  server: McpServer,
  mirroringService: MirroringService,
): void {
  server.registerTool(
    'get_clipboard',
    {
      description:
        'Get the current clipboard content (uses Universal Clipboard)',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const content = await mirroringService.getClipboard();
        return {
          content: [{ type: 'text' as const, text: content }],
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
      try {
        await mirroringService.setClipboard(content);
        return withScreenshotAfter(mirroringService, screenshotDelay, [
          { type: 'text', text: 'Clipboard content set' },
        ]);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
