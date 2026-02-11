import { execFile as execFileCb } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MirroringClient } from '../mirroring-client';
import { SwipeEasing } from '../mirroring.types';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

type ExecFileMock = ReturnType<typeof vi.fn>;
type ExecFileCallback = (
  err: Error | null,
  result: { stdout: string; stderr: string },
) => void;

function mockExecFile(stdout: string) {
  const mock = execFileCb as unknown as ExecFileMock;
  mock.mockImplementation(
    (_cmd: string, _args: string[], cb: ExecFileCallback) => {
      cb(null, { stdout, stderr: '' });
    },
  );
  return mock;
}

function mockExecFileSequence(results: string[]) {
  const mock = execFileCb as unknown as ExecFileMock;
  let callIndex = 0;
  mock.mockImplementation(
    (_cmd: string, _args: string[], cb: ExecFileCallback) => {
      const stdout = results[callIndex] ?? '';
      callIndex++;
      cb(null, { stdout, stderr: '' });
    },
  );
  return mock;
}

function getCallScript(mock: ExecFileMock, callIdx: number): string {
  const calls = mock.mock.calls as string[][][];
  const call = calls[callIdx];
  const args = call[1];
  const script = args.at(-1);
  if (!script) throw new Error('No script argument found');
  return script;
}

describe('MirroringClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWindowInfo', () => {
    it('parses window info from JXA output', async () => {
      mockExecFile(
        JSON.stringify({
          x: 100,
          y: 200,
          width: 400,
          height: 800,
          windowId: 42,
        }),
      );

      const client = new MirroringClient();
      const info = await client.getWindowInfo();

      expect(info).toEqual({
        x: 100,
        y: 200,
        width: 400,
        height: 800,
        windowId: 42,
      });
    });

    it('throws when windowId is 0', async () => {
      mockExecFile(
        JSON.stringify({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          windowId: 0,
        }),
      );

      const client = new MirroringClient();
      await expect(client.getWindowInfo()).rejects.toThrow(
        'Could not find iPhone Mirroring window ID',
      );
    });
  });

  describe('captureWindow', () => {
    it('captures window and downscales to target width', async () => {
      const fakeImage = Buffer.from('fake-png');
      const mock = execFileCb as unknown as ExecFileMock;
      mock.mockImplementation(
        (_cmd: string, _args: string[], cb: ExecFileCallback) => {
          cb(null, { stdout: '', stderr: '' });
        },
      );

      const readMock = readFile as unknown as ExecFileMock;
      readMock.mockResolvedValue(fakeImage);

      const unlinkMock = unlink as unknown as ExecFileMock;
      unlinkMock.mockReturnValue(Promise.resolve());

      const client = new MirroringClient();
      const result = await client.captureWindow(42, 400);

      expect(result).toEqual(fakeImage);
      // First call: screencapture
      expect(mock).toHaveBeenCalledWith(
        'screencapture',
        expect.arrayContaining(['-l', '42']),
        expect.any(Function),
      );
      // Second call: sips downscale
      expect(mock).toHaveBeenCalledWith(
        'sips',
        expect.arrayContaining(['--resampleWidth', '400']),
        expect.any(Function),
      );
      expect(unlinkMock).toHaveBeenCalled();
    });
  });

  describe('postClick', () => {
    it('activates window then generates CGEvent JXA for mouse click', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postClick(150, 300);

      expect(mock).toHaveBeenCalledTimes(2);

      const activateScript = getCallScript(mock, 0);
      expect(activateScript).toContain('iPhone Mirroring');

      const clickScript = getCallScript(mock, 1);
      expect(clickScript).toContain('CGPointMake(150, 300)');
      expect(clickScript).toContain('kCGEventLeftMouseDown');
      expect(clickScript).toContain('kCGEventLeftMouseUp');
    });
  });

  describe('postDrag', () => {
    it('activates window then generates drag events with interpolation', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag(100, 200, 100, 400, 500);

      expect(mock).toHaveBeenCalledTimes(2);

      const activateScript = getCallScript(mock, 0);
      expect(activateScript).toContain('iPhone Mirroring');

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain('kCGEventLeftMouseDown');
      expect(dragScript).toContain('kCGEventLeftMouseDragged');
      expect(dragScript).toContain('kCGEventLeftMouseUp');
    });

    it('defaults to linear easing', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag(0, 0, 0, 100, 500);

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain("const easing = 'linear'");
      expect(dragScript).toContain('function ease(t)');
    });

    it('includes initial dwell delay after mouse-down', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag(0, 0, 0, 100, 500);

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain('delay(0.03)');
    });

    it('uses the specified easing in the JXA script', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag(0, 0, 0, 100, 500, SwipeEasing.EaseIn);

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain("const easing = 'ease-in'");
    });
  });

  describe('typeText', () => {
    it('activates the app then types via keystroke', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('hello');

      expect(mock).toHaveBeenCalledTimes(2);

      const activateScript = getCallScript(mock, 0);
      expect(activateScript).toContain('iPhone Mirroring');

      const keystrokeScript = getCallScript(mock, 1);
      expect(keystrokeScript).toContain('keystroke "hello"');
    });

    it('escapes special characters in text', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('say "hi" \\ there');

      const keystrokeScript = getCallScript(mock, 1);
      expect(keystrokeScript).toContain('say \\"hi\\" \\\\ there');
    });
  });

  describe('checkAccessibilityPermission', () => {
    it('returns true when AXIsProcessTrusted returns true', async () => {
      mockExecFile('true\n');

      const client = new MirroringClient();
      const result = await client.checkAccessibilityPermission();

      expect(result).toBe(true);
    });

    it('returns false when AXIsProcessTrusted returns false', async () => {
      mockExecFile('false\n');

      const client = new MirroringClient();
      const result = await client.checkAccessibilityPermission();

      expect(result).toBe(false);
    });
  });
});
