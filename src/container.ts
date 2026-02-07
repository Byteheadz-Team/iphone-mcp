import config from './config.js';
import { createLogger } from './log.js';
import { McpServerModule } from './mcp/server.js';
import { AppService } from './services/app/app.service.js';
import { AutomationService } from './services/automation/automation.service.js';
import { DeviceService } from './services/device/device.service.js';
import { ScreenshotService } from './services/screenshot/screenshot.service.js';
import { WdaClient } from './services/wda/wda-client.js';
import { type Module } from './types.js';

export class AppContainer {
  private log = createLogger('AppContainer');
  private modules: Module[] = [];

  readonly deviceService: DeviceService;
  readonly wdaClient: WdaClient;
  readonly screenshotService: ScreenshotService;
  readonly automationService: AutomationService;
  readonly appService: AppService;
  readonly mcpServer: McpServerModule;

  constructor() {
    this.log.info('Initializing container');

    this.deviceService = new DeviceService(config.usbmux.socketPath);
    this.wdaClient = new WdaClient({
      socketPath: config.usbmux.socketPath,
      wdaPort: config.wda.port,
    });
    this.screenshotService = new ScreenshotService(this.wdaClient);
    this.automationService = new AutomationService(this.wdaClient);
    this.appService = new AppService(this.wdaClient);
    this.mcpServer = new McpServerModule({
      deviceService: this.deviceService,
      wdaClient: this.wdaClient,
      screenshotService: this.screenshotService,
      automationService: this.automationService,
      appService: this.appService,
    });

    this.modules = [
      this.deviceService,
      this.screenshotService,
      this.automationService,
      this.appService,
      this.mcpServer,
    ];
  }

  async start(): Promise<void> {
    this.log.info('Starting all modules');
    for (const mod of this.modules) {
      await mod.start();
    }
    this.log.info('All modules started');
  }

  async stop(): Promise<void> {
    this.log.info('Stopping all modules');
    for (const mod of [...this.modules].reverse()) {
      if (mod.started) {
        await mod.stop();
      }
    }
    this.wdaClient.close();
    this.log.info('All modules stopped');
  }
}
