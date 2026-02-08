import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { type DeviceService } from '../services/device/device.service.js';
import { type MirroringService } from '../services/mirroring/mirroring.service.js';
import { Module } from '../types.js';

import { registerAutomationTools } from './tools/automation-tools.js';
import { registerDeviceTools } from './tools/device-tools.js';
import { registerMirroringControlTools } from './tools/mirroring-control-tools.js';
import { registerScreenshotTools } from './tools/screenshot-tools.js';

export interface McpServerDependencies {
  deviceService: DeviceService;
  mirroringService: MirroringService;
}

export class McpServerModule extends Module {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;

  constructor(private deps: McpServerDependencies) {
    super();
    this.server = new McpServer({
      name: 'iphone-mcp',
      version: '0.1.0',
    });
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
