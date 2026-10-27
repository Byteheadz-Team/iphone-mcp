import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildGridInstructions, type WindowInfo } from '@lib/mirroring';
import { Module } from '@lib/utils';
import { type MirroringService } from '@services/mirroring/mirroring.service';
import config from '~/config';

import { registerAutomationTools } from './tools/automation-tools';
import { registerCoordinateTools } from './tools/coordinate-tools';
import { registerPokemonGoTools } from './tools/pokemon-go-tools';
import { registerScreenshotTools } from './tools/screenshot-tools';

export interface McpServerDependencies {
  mirroringService: MirroringService;
}

export class McpServerModule extends Module {
  private server: McpServer | null = null;
  private transport: StdioServerTransport | null = null;

  constructor(private deps: McpServerDependencies) {
    super();
  }

  override async start(): Promise<void> {
    const layout = this.deps.mirroringService.getGridLayout();
    const windowInfo = this.deps.mirroringService.getWindowInfo();
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        instructions: [
          'This hardened build is intentionally limited to visual inspection, bounded tap/swipe, and a constrained Pokémon GO inventory-search helper inside the iPhone Mirroring window.',
          'Always take a screenshot immediately before performing any action so the current screen state is known.',
          'ALWAYS use the get_coordinates tool to convert grid positions to screenshot pixel coordinates before tap or swipe.',
          'All tap and swipe coordinates are bounds-checked and must stay inside the mirrored iPhone screen.',
          'For Pokémon GO inventory filtering, prefer pokemon_search over repeated swiping. Only call pokemon_search when a fresh screenshot visibly shows the Pokémon storage screen.',
          'For Pokémon GO lists, use swipe rather than scroll-wheel events. We verified Pokémon GO accepts injected swipes while scroll-wheel events may be ignored.',
          'Do not attempt purchases, transfers, deletions, account changes, messaging, or other irreversible actions without explicit user confirmation.',
          buildGridInstructions(layout),
        ].join('\n'),
      },
    );
    this.registerTools(windowInfo);
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    await super.start();
  }

  private registerTools(windowInfo: WindowInfo): void {
    if (!this.server) {
      throw new Error('registerTools() called before server was created');
    }
    const server = this.server;
    registerScreenshotTools(server, this.deps.mirroringService);
    registerPokemonGoTools(server, this.deps.mirroringService);
    registerAutomationTools({
      server,
      mirroringService: this.deps.mirroringService,
      screenSize: {
        width: windowInfo.width,
        height: windowInfo.height,
      },
    });
    registerCoordinateTools({
      server,
      getGridLayout: () => this.deps.mirroringService.getGridLayout(),
    });
  }

  override async stop(): Promise<void> {
    if (this.server && this.transport) {
      await this.server.close();
      this.server = null;
      this.transport = null;
    }
    await super.stop();
  }
}
