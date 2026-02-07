import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type AppService } from '../../services/app/app.service.js';

export function registerAppTools(
  server: McpServer,
  appService: AppService,
): void {
  server.tool(
    'launch_app',
    'Launch an app on the connected iOS device',
    {
      bundleId: z.string().describe('Bundle identifier of the app to launch (e.g. com.apple.mobilesafari)'),
    },
    async ({ bundleId }) => {
      await appService.launch(bundleId);
      return {
        content: [{ type: 'text', text: `Launched app: ${bundleId}` }],
      };
    },
  );

  server.tool(
    'terminate_app',
    'Terminate a running app on the connected iOS device',
    {
      bundleId: z.string().describe('Bundle identifier of the app to terminate'),
    },
    async ({ bundleId }) => {
      const terminated = await appService.terminate(bundleId);
      return {
        content: [
          {
            type: 'text',
            text: terminated
              ? `Terminated app: ${bundleId}`
              : `App was not running: ${bundleId}`,
          },
        ],
      };
    },
  );

  server.tool(
    'list_apps',
    'List installed apps on the connected iOS device',
    {},
    async () => {
      const apps = await appService.listInstalled();
      return {
        content: [{ type: 'text', text: JSON.stringify(apps, null, 2) }],
      };
    },
  );

  server.tool(
    'open_url',
    'Open a URL on the connected iOS device',
    {
      url: z.string().describe('URL to open'),
    },
    async ({ url }) => {
      await appService.openUrl(url);
      return {
        content: [{ type: 'text', text: `Opened URL: ${url}` }],
      };
    },
  );

  server.tool(
    'get_app_state',
    'Get the current state of an app (not running, foreground, background, etc.)',
    {
      bundleId: z.string().describe('Bundle identifier of the app to check'),
    },
    async ({ bundleId }) => {
      const state = await appService.getAppState(bundleId);
      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
      };
    },
  );
}
