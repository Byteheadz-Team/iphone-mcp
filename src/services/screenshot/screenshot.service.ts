import { Module } from '../../types.js';
import { type WdaClient } from '../wda/wda-client.js';

export interface ScreenshotResult {
  data: Buffer;
  format: 'png';
}

export class ScreenshotService extends Module {
  constructor(private wdaClient: WdaClient) {
    super();
  }

  async capture(): Promise<ScreenshotResult> {
    this.log.debug('Taking screenshot');
    const data = await this.wdaClient.takeScreenshot();
    return { data, format: 'png' };
  }
}
