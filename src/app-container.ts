import { Module } from '@lib/utils';
import { McpServerModule } from '@mcp/server';
import { DeviceService } from '@services/device/device.service';
import { MirroringService } from '@services/mirroring/mirroring.service';
import config from '~/config';

export class AppContainer extends Module {
  private modules: Module[] = [];

  readonly deviceService: DeviceService;
  readonly mirroringService: MirroringService;
  readonly mcpServer: McpServerModule;

  constructor() {
    super();
    this.log.info('Initializing container');

    this.deviceService = new DeviceService(config.usbmux.socketPath);
    this.mirroringService = new MirroringService();
    this.mcpServer = new McpServerModule({
      deviceService: this.deviceService,
      mirroringService: this.mirroringService,
    });

    this.modules = [this.deviceService, this.mirroringService, this.mcpServer];
  }

  override async start(): Promise<void> {
    this.log.info('Starting all modules');
    for (const mod of this.modules) {
      await mod.start();
    }
    await super.start();
  }

  override async stop(): Promise<void> {
    this.log.info('Stopping all modules');
    for (const mod of [...this.modules].reverse()) {
      if (mod.started) {
        await mod.stop();
      }
    }
    await super.stop();
  }
}
