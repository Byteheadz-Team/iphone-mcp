import { Module } from '../../types.js';
import { type MirroringService } from '../mirroring/mirroring.service.js';

export interface ScreenshotResult {
  data: Buffer;
  format: 'png';
}

export class ScreenshotService extends Module {
  constructor(private mirroringService: MirroringService) {
    super();
  }

  async capture(): Promise<ScreenshotResult> {
    this.log.debug('Taking screenshot');
    const data = await this.mirroringService.takeScreenshot();
    return { data, format: 'png' };
  }
}
