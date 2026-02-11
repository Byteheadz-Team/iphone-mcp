import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildGridInstructions } from '@lib/mirroring';
import { Module } from '@lib/utils';
import { type MirroringService } from '@services/mirroring/mirroring.service';
import config from '~/config';

import { registerAutomationTools } from './tools/automation-tools';
import { registerCoordinateTools } from './tools/coordinate-tools';
import { registerMathTools } from './tools/math-tools';
import { registerMirroringControlTools } from './tools/mirroring-control-tools';
import { registerScreenshotTools } from './tools/screenshot-tools';

export interface McpServerDependencies {
  mirroringService: MirroringService;
}

export class McpServerModule extends Module {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;

  constructor(private deps: McpServerDependencies) {
    super();
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        instructions: [
          'Always take a screenshot before performing any action to ensure you have an up-to-date view of the screen.',
          'Always use the type_text tool to enter text. Do not wait for the on-screen keyboard to appear — it will not be visible in screenshots, but type_text will still work.',
          'ALWAYS use the get_coordinates tool to convert grid positions to pixel coordinates for tap/swipe/long_press. Use the calculate tool only for non-coordinate arithmetic.',
          buildGridInstructions(
            config.mirroring.overlayGridSpacing,
            config.mirroring.overlayGridPadding,
          ),
        ].join('\n'),
      },
    );
    this.registerTools();
  }

  private registerTools(): void {
    registerScreenshotTools(this.server, this.deps.mirroringService);
    registerAutomationTools(this.server, this.deps.mirroringService);
    registerMirroringControlTools(this.server, this.deps.mirroringService);
    registerMathTools(this.server);
    registerCoordinateTools(this.server);
  }

  override async start(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    await super.start();
  }

  override async stop(): Promise<void> {
    if (this.transport) {
      await this.server.close();
      this.transport = null;
    }
    await super.stop();
  }
}
