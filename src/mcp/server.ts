import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildGridInstructions, type WindowInfo } from '@lib/mirroring';
import { Module } from '@lib/utils';
import { type MirroringService } from '@services/mirroring/mirroring.service';
import config from '~/config';

import { registerAutomationTools } from './tools/automation-tools';
import { registerCoordinateTools } from './tools/coordinate-tools';
import { registerMirroringControlTools } from './tools/mirroring-control-tools';
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
          'Always take a screenshot before performing any action to ensure you have an up-to-date view of the screen.',
          'Always use the type_text tool to enter text. Do not wait for the on-screen keyboard to appear — it will not be visible in screenshots, but type_text will still work. Emoji and non-ASCII characters are fully supported. To send special keys, use their control character codes in the text: \\b for backspace, \\t for tab, \\x7f for forward delete, \\x1b for escape.',
          'ALWAYS use the get_coordinates tool to convert grid positions to pixel coordinates for tap/swipe/long_press/scroll.',
          `Use scroll for scrolling content (lists, web pages, feeds) — default distance is half the screen dimension in the scroll direction (${Math.round(windowInfo.height / 2)} for up/down, ${Math.round(windowInfo.width / 2)} for left/right). After every scroll, take a screenshot to verify, and adjust the distance parameter if the scroll amount was wrong (increase if too little movement, decrease if too much). Different apps may need different distance values — recalibrate when switching contexts. Use swipe for directional gestures (dismissing, pull-to-refresh, drag-and-drop). Scroll direction is auto-corrected for the macOS "Natural scrolling" setting — if content moves the wrong way, use the opposite direction.`,
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
    registerAutomationTools({
      server,
      mirroringService: this.deps.mirroringService,
      screenSize: {
        width: windowInfo.width,
        height: windowInfo.height,
      },
    });
    registerMirroringControlTools(server, this.deps.mirroringService);
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
