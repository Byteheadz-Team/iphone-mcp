import config from './config.js';
import { createLogger } from './log.js';
import { McpServerModule } from './mcp/server.js';
import { AutomationService } from './services/automation/automation.service.js';
import { DeviceService } from './services/device/device.service.js';
import { MirroringService } from './services/mirroring/mirroring.service.js';
import { ScreenshotService } from './services/screenshot/screenshot.service.js';
import { type Module } from './types.js';

export class AppContainer {
  private log = createLogger('AppContainer');
  private modules: Module[] = [];

  readonly deviceService: DeviceService;
  readonly mirroringService: MirroringService;
  readonly screenshotService: ScreenshotService;
  readonly automationService: AutomationService;
  readonly mcpServer: McpServerModule;

  constructor() {
    this.log.info('Initializing container');

    this.deviceService = new DeviceService(config.usbmux.socketPath);
    this.mirroringService = new MirroringService();
    this.screenshotService = new ScreenshotService(this.mirroringService);
    this.automationService = new AutomationService(this.mirroringService);
    this.mcpServer = new McpServerModule({
      deviceService: this.deviceService,
      mirroringService: this.mirroringService,
      screenshotService: this.screenshotService,
      automationService: this.automationService,
    });

    this.modules = [
      this.deviceService,
      this.mirroringService,
      this.screenshotService,
      this.automationService,
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
    this.log.info('All modules stopped');
  }
}
