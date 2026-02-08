import { McpServerModule } from '@mcp/server';
import { DeviceService } from '@services/device/device.service';
import { MirroringService } from '@services/mirroring/mirroring.service';

import config from './config';
import { createLogger } from './log';
import { type Module } from './types';

export class AppContainer {
  private log = createLogger('AppContainer');
  private modules: Module[] = [];

  readonly deviceService: DeviceService;
  readonly mirroringService: MirroringService;
  readonly mcpServer: McpServerModule;

  constructor() {
    this.log.info('Initializing container');

    this.deviceService = new DeviceService(config.usbmux.socketPath);
    this.mirroringService = new MirroringService();
    this.mcpServer = new McpServerModule({
      deviceService: this.deviceService,
      mirroringService: this.mirroringService,
    });

    this.modules = [this.deviceService, this.mirroringService, this.mcpServer];
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
