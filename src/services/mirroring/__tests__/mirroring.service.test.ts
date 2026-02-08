import { describe, expect, it, vi } from 'vitest';

import { type MirroringClient } from '../../../lib/mirroring/index.js';
import { MirroringService } from '../mirroring.service.js';

const resolved = Promise.resolve();

function createMockClient() {
  return {
    ensureRunning: vi.fn().mockReturnValue(resolved),
    getWindowInfo: vi.fn().mockResolvedValue({
      x: 100,
      y: 200,
      width: 400,
      height: 800,
      windowId: 42,
    }),
    captureWindow: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    postClick: vi.fn().mockReturnValue(resolved),
    postDrag: vi.fn().mockReturnValue(resolved),
    typeText: vi.fn().mockReturnValue(resolved),
    typeSpecialKey: vi.fn().mockReturnValue(resolved),
    sendShortcut: vi.fn().mockReturnValue(resolved),
    checkAccessibilityPermission: vi.fn().mockResolvedValue(true),
  };
}

describe('MirroringService', () => {
  describe('start', () => {
    it('initializes window info', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);

      await service.start();

      expect(mock.checkAccessibilityPermission).toHaveBeenCalled();
      expect(mock.ensureRunning).toHaveBeenCalled();
      expect(mock.getWindowInfo).toHaveBeenCalled();
      expect(service.started).toBe(true);
    });

    it('warns when accessibility permission is missing', async () => {
      const mock = createMockClient();
      mock.checkAccessibilityPermission.mockResolvedValue(false);
      const service = new MirroringService(mock as unknown as MirroringClient);

      await service.start();

      // Should still start successfully
      expect(service.started).toBe(true);
    });
  });

  describe('stop', () => {
    it('clears cached state', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      await service.stop();

      expect(service.started).toBe(false);
    });
  });

  describe('takeScreenshot', () => {
    it('captures the window', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const result = await service.takeScreenshot();

      expect(mock.captureWindow).toHaveBeenCalledWith(42, 400);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('tap', () => {
    it('maps screenshot pixels to screen coordinates', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      // Screenshot pixel (200, 400) at 1x with window at (100, 200)
      // -> screen coords: (100 + 200, 200 + 400) = (300, 600)
      await service.tap(200, 400);

      expect(mock.postClick).toHaveBeenCalledWith(300, 600);
    });
  });

  describe('swipe', () => {
    it('maps both endpoints to screen coordinates', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      await service.swipe(100, 200, 100, 600, 500);

      expect(mock.postDrag).toHaveBeenCalledWith(
        200, // 100 + 100
        400, // 200 + 200
        200, // 100 + 100
        800, // 200 + 600
        500,
      );
    });
  });

  describe('pressButton', () => {
    it('simulates home via ⌘1 shortcut', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      await service.pressButton('home');

      expect(mock.sendShortcut).toHaveBeenCalledWith('1');
    });

    it('throws for unsupported buttons', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      await expect(service.pressButton('volumeUp')).rejects.toThrow(
        'not supported via iPhone Mirroring',
      );
    });
  });

  describe('getScreenInfo', () => {
    it('returns content bounds at 1x resolution', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const info = await service.getScreenInfo();

      expect(info).toEqual({
        width: 400,
        height: 800,
        scale: 1,
      });
    });

    it('throws when window is not available', async () => {
      const mock = createMockClient();
      mock.ensureRunning.mockRejectedValue(
        new Error('iPhone Mirroring window did not appear'),
      );
      const service = new MirroringService(mock as unknown as MirroringClient);

      await expect(service.getScreenInfo()).rejects.toThrow('did not appear');
    });
  });

  describe('typeText', () => {
    it('delegates to client', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      await service.typeText('hello');

      expect(mock.typeText).toHaveBeenCalledWith('hello');
    });
  });
});
