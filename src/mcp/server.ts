import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { type AppService } from '../services/app/app.service.js';
import { type AutomationService } from '../services/automation/automation.service.js';
import { type DeviceService } from '../services/device/device.service.js';
import { type ScreenshotService } from '../services/screenshot/screenshot.service.js';
import { type WdaClient } from '../services/wda/wda-client.js';
import { Module } from '../types.js';

import { registerAppTools } from './tools/app-tools.js';
import { registerAutomationTools } from './tools/automation-tools.js';
import { registerDeviceControlTools } from './tools/device-control-tools.js';
import { registerDeviceTools } from './tools/device-tools.js';
import { registerScreenshotTools } from './tools/screenshot-tools.js';

export interface McpServerDependencies {
  deviceService: DeviceService;
  wdaClient: WdaClient;
  screenshotService: ScreenshotService;
  automationService: AutomationService;
  appService: AppService;
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
      this.deps.wdaClient,
    );
    registerScreenshotTools(this.server, this.deps.screenshotService);
    registerAutomationTools(this.server, this.deps.automationService);
    registerAppTools(this.server, this.deps.appService);
    registerDeviceControlTools(this.server, this.deps.wdaClient);
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
