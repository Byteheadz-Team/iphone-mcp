import { Module } from '@lib/utils';
import { McpServerModule } from '@mcp/server';
import { MirroringService } from '@services/mirroring/mirroring.service';

export class AppContainer extends Module {
  private modules: Module[] = [];

  readonly mirroringService: MirroringService;
  readonly mcpServer: McpServerModule;

  constructor() {
    super();
    this.log.info('Initializing container');

    this.mirroringService = new MirroringService();
    this.mcpServer = new McpServerModule({
      mirroringService: this.mirroringService,
    });

    this.modules = [this.mirroringService, this.mcpServer];
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
