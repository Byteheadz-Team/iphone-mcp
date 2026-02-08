import { describe, expect, it, vi } from 'vitest';

import { type MirroringService } from '../../mirroring/mirroring.service.js';
import { AutomationService } from '../automation.service.js';

const resolved = Promise.resolve();

function createMockMirroringService() {
  return {
    tap: vi.fn().mockReturnValue(resolved),
    swipe: vi.fn().mockReturnValue(resolved),
    swipeDirection: vi.fn().mockReturnValue(resolved),
    typeText: vi.fn().mockReturnValue(resolved),
    pressButton: vi.fn().mockReturnValue(resolved),
  };
}

describe('AutomationService', () => {
  it('taps at coordinates', async () => {
    const mock = createMockMirroringService();
    const service = new AutomationService(mock as unknown as MirroringService);

    await service.tapCoordinates(100, 200);

    expect(mock.tap).toHaveBeenCalledWith(100, 200);
  });

  it('swipes in a direction', async () => {
    const mock = createMockMirroringService();
    const service = new AutomationService(mock as unknown as MirroringService);

    await service.swipeDirection('up');

    expect(mock.swipeDirection).toHaveBeenCalledWith(
      'up',
      undefined,
      undefined,
    );
  });

  it('swipes between coordinates', async () => {
    const mock = createMockMirroringService();
    const service = new AutomationService(mock as unknown as MirroringService);

    await service.swipeCoordinates(100, 200, 100, 600, 500);

    expect(mock.swipe).toHaveBeenCalledWith(100, 200, 100, 600, 500);
  });

  it('types text', async () => {
    const mock = createMockMirroringService();
    const service = new AutomationService(mock as unknown as MirroringService);

    await service.typeText('hello');

    expect(mock.typeText).toHaveBeenCalledWith('hello');
  });

  it('presses a button', async () => {
    const mock = createMockMirroringService();
    const service = new AutomationService(mock as unknown as MirroringService);

    await service.pressButton('home');

    expect(mock.pressButton).toHaveBeenCalledWith('home');
  });
});
