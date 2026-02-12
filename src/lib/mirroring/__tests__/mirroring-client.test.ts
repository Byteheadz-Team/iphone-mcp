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

function findCallback(args: unknown[]): ExecFileCallback {
  const cb = args.at(-1);
  if (typeof cb !== 'function') {
    throw new Error('No callback argument found in execFile call');
  }
  return cb as ExecFileCallback;
}

function mockExecFile(stdout: string) {
  const mock = execFileCb as unknown as ExecFileMock;
  mock.mockImplementation((...args: unknown[]) => {
    findCallback(args)(null, { stdout, stderr: '' });
  });
  return mock;
}

function mockExecFileSequence(results: string[]) {
  const mock = execFileCb as unknown as ExecFileMock;
  let callIndex = 0;
  mock.mockImplementation((...args: unknown[]) => {
    const stdout = results[callIndex] ?? '';
    callIndex++;
    findCallback(args)(null, { stdout, stderr: '' });
  });
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
      mock.mockImplementation((...args: unknown[]) => {
        findCallback(args)(null, { stdout: '', stderr: '' });
      });

      const readMock = readFile as unknown as ExecFileMock;
      readMock.mockResolvedValue(fakeImage);

      const unlinkMock = unlink as unknown as ExecFileMock;
      unlinkMock.mockReturnValue(Promise.resolve());

      const client = new MirroringClient();
      const result = await client.captureWindow({ windowId: 42, targetWidth: 400 });

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
      await client.postClick({ x: 150, y: 300 });

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
      await client.postDrag({ startX: 100, startY: 200, endX: 100, endY: 400, durationMs: 500 });

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
      await client.postDrag({ startX: 0, startY: 0, endX: 0, endY: 100, durationMs: 500 });

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain("const easing = 'linear'");
      expect(dragScript).toContain('function ease(t)');
    });

    it('includes initial dwell delay after mouse-down', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag({ startX: 0, startY: 0, endX: 0, endY: 100, durationMs: 500 });

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain('delay(0.03)');
    });

    it('uses the specified easing in the JXA script', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag({ startX: 0, startY: 0, endX: 0, endY: 100, durationMs: 500, easing: SwipeEasing.EaseIn });

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

    it('does not escape single quotes (valid inside AppleScript double-quoted strings)', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText("that's great");

      const keystrokeScript = getCallScript(mock, 1);
      expect(keystrokeScript).toContain("keystroke \"that's great\"");
    });
  });

  describe('postLongPress', () => {
    it('activates window then generates mouse-down, delay, mouse-up', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postLongPress({ x: 120, y: 250, durationMs: 1500 });

      expect(mock).toHaveBeenCalledTimes(2);

      const activateScript = getCallScript(mock, 0);
      expect(activateScript).toContain('iPhone Mirroring');

      const pressScript = getCallScript(mock, 1);
      expect(pressScript).toContain('CGPointMake(120, 250)');
      expect(pressScript).toContain('kCGEventLeftMouseDown');
      expect(pressScript).toContain('kCGEventLeftMouseUp');
      expect(pressScript).toContain('delay(1.5)');
    });

    it('passes extended timeout for long durations', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postLongPress({ x: 0, y: 0, durationMs: 3000 });

      // The long-press call (second) should include an options object with timeout
      const longPressCall = mock.mock.calls[1] as unknown[];
      const opts = longPressCall[2] as { timeout: number };
      expect(opts.timeout).toBe(8000); // durationMs + 5000
    });
  });

  describe('sendShortcut', () => {
    it('activates window then sends keystroke with command down', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.sendShortcut('1');

      expect(mock).toHaveBeenCalledTimes(2);

      const activateScript = getCallScript(mock, 0);
      expect(activateScript).toContain('iPhone Mirroring');

      const keystrokeScript = getCallScript(mock, 1);
      expect(keystrokeScript).toContain('keystroke "1" using command down');
    });

    it('throws for multi-character input', async () => {
      const client = new MirroringClient();

      await expect(client.sendShortcut('abc')).rejects.toThrow(
        'sendShortcut expects a single character',
      );
    });

    it('throws for empty string', async () => {
      const client = new MirroringClient();

      await expect(client.sendShortcut('')).rejects.toThrow(
        'sendShortcut expects a single character',
      );
    });
  });

  describe('ensureRunning', () => {
    it('opens the app and resolves when window appears', async () => {
      const mock = mockExecFileSequence([
        '', // open -a
        JSON.stringify({
          x: 0,
          y: 0,
          width: 400,
          height: 800,
          windowId: 42,
        }),
      ]);

      const client = new MirroringClient();
      await client.ensureRunning();

      const firstCall = mock.mock.calls[0] as string[];
      expect(firstCall[0]).toBe('open');
      expect(firstCall[1]).toContain('-a');
    });

    it('retries getWindowInfo when the window is not ready', async () => {
      const mock = execFileCb as unknown as ExecFileMock;
      let callIndex = 0;
      const results = [
        '', // open -a
        '', // first getWindowInfo → parse fails → retry
        JSON.stringify({
          x: 0,
          y: 0,
          width: 400,
          height: 800,
          windowId: 42,
        }), // second getWindowInfo → success
      ];
      mock.mockImplementation((...args: unknown[]) => {
        const stdout = results[callIndex] ?? '';
        callIndex++;
        findCallback(args)(null, { stdout, stderr: '' });
      });

      const client = new MirroringClient();
      await client.ensureRunning();

      // 1 open + 2 getWindowInfo (1 failed parse + 1 success)
      expect(mock).toHaveBeenCalledTimes(3);
    });
  });

  describe('checkAccessibilityPermission', () => {
    it('returns true when AXIsProcessTrustedWithOptions returns true', async () => {
      mockExecFile('true\n');

      const client = new MirroringClient();
      const result = await client.checkAccessibilityPermission();

      expect(result).toBe(true);
    });

    it('returns false when AXIsProcessTrustedWithOptions returns false', async () => {
      mockExecFile('false\n');

      const client = new MirroringClient();
      const result = await client.checkAccessibilityPermission();

      expect(result).toBe(false);
    });

    it('uses the prompt option to trigger system dialog', async () => {
      const mock = mockExecFile('true\n');

      const client = new MirroringClient();
      await client.checkAccessibilityPermission();

      const script = getCallScript(mock, 0);
      expect(script).toContain('AXIsProcessTrustedWithOptions');
      expect(script).toContain('AXTrustedCheckOptionPrompt');
    });
  });

  describe('getHostAppName', () => {
    it('extracts app name from process tree', async () => {
      mockExecFileSequence([
        '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
        '1',
      ]);

      const client = new MirroringClient();
      const result = await client.getHostAppName();

      expect(result).toBe('Visual Studio Code');
    });

    it('returns fallback when no .app is found', async () => {
      mockExecFileSequence(['/usr/bin/node', '1']);

      const client = new MirroringClient();
      const result = await client.getHostAppName();

      expect(result).toBe('your terminal app');
    });
  });

  describe('checkScreenRecordingPermission', () => {
    it('returns true when screencapture produces a non-empty file', async () => {
      mockExecFile('');
      const readMock = readFile as unknown as ExecFileMock;
      readMock.mockResolvedValue(Buffer.from('png-data'));
      const unlinkMock = unlink as unknown as ExecFileMock;
      unlinkMock.mockReturnValue(Promise.resolve());

      const client = new MirroringClient();
      const result = await client.checkScreenRecordingPermission();

      expect(result).toBe(true);
    });

    it('returns false when screencapture produces an empty file', async () => {
      mockExecFile('');
      const readMock = readFile as unknown as ExecFileMock;
      readMock.mockResolvedValue(Buffer.alloc(0));
      const unlinkMock = unlink as unknown as ExecFileMock;
      unlinkMock.mockReturnValue(Promise.resolve());

      const client = new MirroringClient();
      const result = await client.checkScreenRecordingPermission();

      expect(result).toBe(false);
    });

    it('returns false when screencapture fails', async () => {
      const mock = execFileCb as unknown as ExecFileMock;
      mock.mockImplementation((...args: unknown[]) => {
        findCallback(args)(new Error('screencapture failed'), {
          stdout: '',
          stderr: '',
        });
      });
      const unlinkMock = unlink as unknown as ExecFileMock;
      unlinkMock.mockReturnValue(Promise.resolve());

      const client = new MirroringClient();
      const result = await client.checkScreenRecordingPermission();

      expect(result).toBe(false);
    });

    it('cleans up the probe file after checking', async () => {
      mockExecFile('');
      const readMock = readFile as unknown as ExecFileMock;
      readMock.mockResolvedValue(Buffer.from('png-data'));
      const unlinkMock = unlink as unknown as ExecFileMock;
      unlinkMock.mockReturnValue(Promise.resolve());

      const client = new MirroringClient();
      await client.checkScreenRecordingPermission();

      expect(unlinkMock).toHaveBeenCalled();
    });
  });
});
