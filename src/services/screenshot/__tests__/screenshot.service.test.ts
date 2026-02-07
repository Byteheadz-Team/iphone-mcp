import { describe, expect, it, vi } from 'vitest';

import { type WdaClient } from '../../wda/wda-client.js';
import { ScreenshotService } from '../screenshot.service.js';

function createMockWdaClient() {
  return {
    takeScreenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  };
}

describe('ScreenshotService', () => {
  it('captures a screenshot', async () => {
    const mock = createMockWdaClient();
    const service = new ScreenshotService(mock as unknown as WdaClient);

    const result = await service.capture();

    expect(result.format).toBe('png');
    expect(Buffer.isBuffer(result.data)).toBe(true);
    expect(mock.takeScreenshot).toHaveBeenCalled();
  });
});
