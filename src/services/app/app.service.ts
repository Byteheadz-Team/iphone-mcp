import { Module } from '../../types.js';
import { type WdaClient } from '../wda/wda-client.js';

export class AppService extends Module {
  constructor(private wdaClient: WdaClient) {
    super();
  }

  async launch(bundleId: string): Promise<void> {
    this.log.debug(`Launching app: ${bundleId}`);
    await this.wdaClient.launchApp(bundleId);
  }

  async terminate(bundleId: string): Promise<boolean> {
    this.log.debug(`Terminating app: ${bundleId}`);
    return this.wdaClient.terminateApp(bundleId);
  }

  async listInstalled(): Promise<Array<Record<string, unknown>>> {
    this.log.debug('Listing installed apps');
    return this.wdaClient.listApps('user');
  }

  async openUrl(url: string): Promise<void> {
    this.log.debug(`Opening URL: ${url}`);
    await this.wdaClient.openUrl(url);
  }

  async getAppState(
    bundleId: string,
  ): Promise<{ state: number; stateDescription: string }> {
    const result = await this.wdaClient.getAppState(bundleId);
    const descriptions: Record<number, string> = {
      0: 'unknown',
      1: 'not running',
      2: 'running (background/suspended)',
      3: 'running (background)',
      4: 'running (foreground)',
    };
    return {
      state: result.state,
      stateDescription: descriptions[result.state] ?? 'unknown',
    };
  }
}
