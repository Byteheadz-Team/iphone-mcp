import { describe, expect, it, vi } from 'vitest';

import { type MirroringService } from '../../mirroring/mirroring.service.js';
import { ScreenshotService } from '../screenshot.service.js';

function createMockMirroringService() {
  return {
    takeScreenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  };
}

describe('ScreenshotService', () => {
  it('captures a screenshot', async () => {
    const mock = createMockMirroringService();
    const service = new ScreenshotService(mock as unknown as MirroringService);

    const result = await service.capture();

    expect(result.format).toBe('png');
    expect(Buffer.isBuffer(result.data)).toBe(true);
    expect(mock.takeScreenshot).toHaveBeenCalled();
  });
});
