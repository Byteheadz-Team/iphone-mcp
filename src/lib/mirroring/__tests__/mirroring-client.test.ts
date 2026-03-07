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

const findCallback = (args: unknown[]): ExecFileCallback => {
  const cb = args.at(-1);
  if (typeof cb !== 'function') {
    throw new Error('No callback argument found in execFile call');
  }
  return cb as ExecFileCallback;
};

const mockExecFile = (stdout: string) => {
  const mock = execFileCb as unknown as ExecFileMock;
  mock.mockImplementation((...args: unknown[]) => {
    findCallback(args)(null, { stdout, stderr: '' });
  });
  return mock;
};

const mockExecFileSequence = (results: string[]) => {
  const mock = execFileCb as unknown as ExecFileMock;
  let callIndex = 0;
  mock.mockImplementation((...args: unknown[]) => {
    const stdout = results[callIndex] ?? '';
    callIndex++;
    findCallback(args)(null, { stdout, stderr: '' });
  });
  return mock;
};

const getCallScript = (mock: ExecFileMock, callIdx: number): string => {
  const calls = mock.mock.calls as string[][][];
  const call = calls[callIdx];
  const args = call[1];
  const script = args.at(-1);
  if (!script) throw new Error('No script argument found');
  return script;
};

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
    it('captures window without spawning sips', async () => {
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
      const result = await client.captureWindow({
        windowId: 42,
        targetWidth: 400,
      });

      expect(result).toEqual(fakeImage);
      // Only call: screencapture (no sips)
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledWith(
        'screencapture',
        expect.arrayContaining(['-l', '42']),
        expect.any(Function),
      );
      expect(mock).not.toHaveBeenCalledWith(
        'sips',
        expect.anything(),
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
      expect(clickScript).toContain('const taps = 1');
    });

    it('generates multi-tap loop for numTaps > 1', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postClick({ x: 150, y: 300, numTaps: 3 });

      expect(mock).toHaveBeenCalledTimes(2);

      const clickScript = getCallScript(mock, 1);
      expect(clickScript).toContain('const taps = 3');
      expect(clickScript).toContain('for (let i = 0; i < taps; i++)');
      expect(clickScript).toContain('if (i > 0) delay(0.1)');
    });
  });

  describe('postDrag', () => {
    it('activates window then generates drag events with interpolation', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag({
        startX: 100,
        startY: 200,
        endX: 100,
        endY: 400,
        durationMs: 500,
      });

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
      await client.postDrag({
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 100,
        durationMs: 500,
      });

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain("const easing = 'linear'");
      expect(dragScript).toContain('function ease(t)');
    });

    it('includes initial dwell delay after mouse-down', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag({
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 100,
        durationMs: 500,
      });

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain('delay(0.03)');
    });

    it('uses the specified easing in the JXA script', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.postDrag({
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 100,
        durationMs: 500,
        easing: SwipeEasing.EaseIn,
      });

      const dragScript = getCallScript(mock, 1);
      expect(dragScript).toContain("const easing = 'ease-in'");
    });
  });

  describe('typeText', () => {
    it('activates the app then types via JXA keystroke', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('hello');

      expect(mock).toHaveBeenCalledTimes(2);

      const activateScript = getCallScript(mock, 0);
      expect(activateScript).toContain('iPhone Mirroring');

      const typeCall = mock.mock.calls[1] as string[][];
      expect(typeCall[1]).toContain('-l');
      expect(typeCall[1]).toContain('JavaScript');

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('hello')");
    });

    it('escapes backslashes and single quotes in JXA strings', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText("say 'hi' \\ there");

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('say \\'hi\\' \\\\ there')");
    });

    it('sends backspace via CGEvent key code 51', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('ab\bc');

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('ab')");
      expect(script).toContain(
        'CGEventCreateKeyboardEvent(null, 51, true)',
      );
      expect(script).toContain("se.keystroke('c')");
    });

    it('sends forward delete via CGEvent key code 117', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('\x7f');

      const script = getCallScript(mock, 1);
      expect(script).toContain(
        'CGEventCreateKeyboardEvent(null, 117, true)',
      );
      expect(script).not.toContain('se.keystroke');
    });

    it('sends tab via CGEvent key code 48', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('a\tb');

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('a')");
      expect(script).toContain(
        'CGEventCreateKeyboardEvent(null, 48, true)',
      );
      expect(script).toContain("se.keystroke('b')");
    });

    it('sends escape via CGEvent key code 53', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('\x1b');

      const script = getCallScript(mock, 1);
      expect(script).toContain(
        'CGEventCreateKeyboardEvent(null, 53, true)',
      );
    });

    it('sends return via CGEvent key code 36', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('a\nb');

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('a')");
      expect(script).toContain(
        'CGEventCreateKeyboardEvent(null, 36, true)',
      );
      expect(script).toContain("se.keystroke('b')");
    });

    it('handles multiple consecutive special keys', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('\b\b\b');

      const script = getCallScript(mock, 1);
      const matches = script.match(/CGEventCreateKeyboardEvent\(null, 51, true\)/g);
      expect(matches).toHaveLength(3);
    });

    it('pastes emoji via clipboard and Cmd+V', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('hello 😀');

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('hello ')");
      expect(script).toContain('app.setTheClipboardTo');
      expect(script).toContain("se.keystroke('v', { using: 'command down' })");
    });

    it('handles mixed ASCII, emoji, and special keys', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('hi 🎉\b');

      const script = getCallScript(mock, 1);
      expect(script).toContain("se.keystroke('hi ')");
      expect(script).toContain('app.setTheClipboardTo');
      expect(script).toContain(
        'CGEventCreateKeyboardEvent(null, 51, true)',
      );
    });

    it('only imports CoreGraphics when key codes are needed', async () => {
      const mock = mockExecFileSequence(['', '']);

      const client = new MirroringClient();
      await client.typeText('hello');

      const script = getCallScript(mock, 1);
      expect(script).not.toContain('CoreGraphics');
      expect(script).not.toContain('includeStandardAdditions');
    });

    it('skips osascript for empty text', async () => {
      const mock = mockExecFileSequence([]);

      const client = new MirroringClient();
      await client.typeText('');

      expect(mock).not.toHaveBeenCalled();
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
