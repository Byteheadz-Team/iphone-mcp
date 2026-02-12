import { execFile as execFileCb } from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type MirroringClient, SwipeEasing } from '@lib/mirroring';
import config from '~/config';

import { MirroringService } from '../mirroring.service';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

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
    postLongPress: vi.fn().mockReturnValue(resolved),
    postDrag: vi.fn().mockReturnValue(resolved),
    typeText: vi.fn().mockReturnValue(resolved),
    sendShortcut: vi.fn().mockReturnValue(resolved),
    checkAccessibilityPermission: vi.fn().mockResolvedValue(true),
    checkScreenRecordingPermission: vi.fn().mockResolvedValue(true),
    getHostAppName: vi.fn().mockResolvedValue('TestApp'),
  };
}

describe('MirroringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('start', () => {
    it('initializes window info', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);

      await service.start();

      expect(mock.checkAccessibilityPermission).toHaveBeenCalled();
      expect(mock.checkScreenRecordingPermission).toHaveBeenCalled();
      expect(mock.ensureRunning).toHaveBeenCalled();
      expect(mock.getWindowInfo).toHaveBeenCalled();
      expect(service.started).toBe(true);
    });

    it('warns when accessibility permission is missing', async () => {
      const mock = createMockClient();
      mock.checkAccessibilityPermission.mockResolvedValue(false);
      const service = new MirroringService(mock as unknown as MirroringClient);

      await service.start();

      expect(service.started).toBe(true);
      expect(service.permissionWarnings.accessibility).toContain('TestApp');
      expect(service.permissionWarnings.accessibility).toContain(
        'Accessibility',
      );
    });

    it('warns when screen recording permission is missing', async () => {
      const mock = createMockClient();
      mock.checkScreenRecordingPermission.mockResolvedValue(false);
      const service = new MirroringService(mock as unknown as MirroringClient);

      await service.start();

      expect(service.started).toBe(true);
      expect(service.permissionWarnings.screenRecording).toContain('TestApp');
      expect(service.permissionWarnings.screenRecording).toContain(
        'Screen Recording',
      );
    });

    it('sets no warnings when all permissions are granted', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);

      await service.start();

      expect(service.permissionWarnings.accessibility).toBeNull();
      expect(service.permissionWarnings.screenRecording).toBeNull();
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

      expect(mock.captureWindow).toHaveBeenCalledWith(
        42,
        800,
        config.mirroring.overlayGridSpacing,
        config.mirroring.overlayGridPadding,
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('tap', () => {
    it('maps screenshot pixels to screen coordinates', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const p = config.mirroring.overlayGridPadding;
      // Screenshot pixel (200, 400) at 2x with window at (100, 200), grid padding offset
      // -> screen coords: (100 + (200-p)/2, 200 + (400-p)/2) = (180, 380)
      await service.tap(200, 400);

      expect(mock.postClick).toHaveBeenCalledWith(
        100 + (200 - p) / 2,
        200 + (400 - p) / 2,
      );
    });
  });

  describe('swipe', () => {
    it('maps both endpoints to screen coordinates', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const p = config.mirroring.overlayGridPadding;
      await service.swipe(100, 200, 100, 600, 500, SwipeEasing.Linear);

      expect(mock.postDrag).toHaveBeenCalledWith(
        100 + (100 - p) / 2,
        200 + (200 - p) / 2,
        100 + (100 - p) / 2,
        200 + (600 - p) / 2,
        500,
        SwipeEasing.Linear,
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
  });

  describe('getScreenInfo', () => {
    it('returns content bounds at 2x resolution', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const info = await service.getScreenInfo();

      expect(info).toEqual({
        width: 800,
        height: 1600,
        scale: 2,
        gridPadding: config.mirroring.overlayGridPadding,
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

  describe('longPress', () => {
    it('maps coordinates and delegates to client', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const p = config.mirroring.overlayGridPadding;
      await service.longPress(200, 400, 1500);

      expect(mock.postLongPress).toHaveBeenCalledWith(
        100 + (200 - p) / 2,
        200 + (400 - p) / 2,
        1500,
      );
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

  describe('getClipboard', () => {
    it('returns stdout from pbpaste', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const execMock = execFileCb as unknown as ReturnType<typeof vi.fn>;
      execMock.mockImplementation(
        (
          _cmd: string,
          cb: (err: Error | null, result: { stdout: string }) => void,
        ) => {
          cb(null, { stdout: 'clipboard content' });
        },
      );

      const result = await service.getClipboard();

      expect(result).toBe('clipboard content');
    });
  });

  describe('setClipboard', () => {
    it('writes content to pbcopy stdin', async () => {
      const mock = createMockClient();
      const service = new MirroringService(mock as unknown as MirroringClient);
      await service.start();

      const writtenChunks: string[] = [];
      let ended = false;
      const execMock = execFileCb as unknown as ReturnType<typeof vi.fn>;
      execMock.mockImplementation(
        (_cmd: string, cb: (err: Error | null) => void) => {
          cb(null);
          return {
            stdin: {
              write(chunk: string) {
                writtenChunks.push(chunk);
              },
              end() {
                ended = true;
              },
            },
          };
        },
      );

      await service.setClipboard('hello clipboard');

      expect(writtenChunks).toContain('hello clipboard');
      expect(ended).toBe(true);
    });
  });
});
