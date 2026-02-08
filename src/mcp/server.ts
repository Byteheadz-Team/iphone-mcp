import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { type DeviceService } from '@services/device/device.service';
import { type MirroringService } from '@services/mirroring/mirroring.service';
import config from '@src/config';
import { Module } from '@src/types';

import { registerAutomationTools } from './tools/automation-tools';
import { registerDeviceTools } from './tools/device-tools';
import { registerMirroringControlTools } from './tools/mirroring-control-tools';
import { registerScreenshotTools } from './tools/screenshot-tools';

export interface McpServerDependencies {
  deviceService: DeviceService;
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
        ].join('\n'),
      },
    );
    this.registerTools();
  }

  private registerTools(): void {
    registerDeviceTools(
      this.server,
      this.deps.deviceService,
      this.deps.mirroringService,
    );
    registerScreenshotTools(this.server, this.deps.mirroringService);
    registerAutomationTools(this.server, this.deps.mirroringService);
    registerMirroringControlTools(
      this.server,
      this.deps.mirroringService,
      this.deps.deviceService,
    );
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
