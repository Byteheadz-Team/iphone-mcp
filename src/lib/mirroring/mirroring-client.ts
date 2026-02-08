import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { execFile } from '@lib/utils';

import { overlayGrid } from './grid-overlay';
import { SwipeEasing, type WindowInfo } from './mirroring.types';

const APP_NAME = 'iPhone Mirroring';
const LAUNCH_TIMEOUT_MS = 10_000;
const LAUNCH_POLL_INTERVAL_MS = 500;

function escapeJxaString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export class MirroringClient {
  async ensureRunning(): Promise<void> {
    await execFile('open', ['-a', APP_NAME]);

    const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await this.getWindowInfo();
        return;
      } catch {
        await new Promise((resolve) =>
          setTimeout(resolve, LAUNCH_POLL_INTERVAL_MS),
        );
      }
    }

    throw new Error(
      `iPhone Mirroring window did not appear within ${LAUNCH_TIMEOUT_MS}ms`,
    );
  }

  private async activate(): Promise<void> {
    await execFile('osascript', [
      '-e',
      `tell application "${APP_NAME}" to activate\ndelay 0.3`,
    ]);
  }

  async getWindowInfo(): Promise<WindowInfo> {
    const script = `
ObjC.import('CoreGraphics');
ObjC.import('Foundation');
const app = Application('System Events').processes['${APP_NAME}'];
const win = app.windows[0];
const pos = win.position();
const sz = win.size();
const x = pos[0];
const y = pos[1];
const width = sz[0];
const height = sz[1];

const raw = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly, $.kCGNullWindowID);
const arr = ObjC.castRefToObject(raw);
const count = arr.count;
let windowId = 0;
for (let i = 0; i < count; i++) {
  const w = ObjC.deepUnwrap(arr.objectAtIndex(i));
  if (w.kCGWindowOwnerName === '${APP_NAME}' && w.kCGWindowLayer === 0) {
    windowId = w.kCGWindowNumber;
    break;
  }
}

JSON.stringify({ x, y, width, height, windowId });
`;

    const { stdout } = await execFile('osascript', [
      '-l',
      'JavaScript',
      '-e',
      script,
    ]);
    const info = JSON.parse(stdout.trim()) as WindowInfo;

    if (info.windowId === 0) {
      throw new Error('Could not find iPhone Mirroring window ID');
    }

    return info;
  }

  async captureWindow(
    windowId: number,
    targetWidth?: number,
    overlayGridSpacing?: number,
    overlayGridPadding?: number,
  ): Promise<Buffer> {
    const tmpPath = join(tmpdir(), `iphone-mcp-screenshot-${Date.now()}.png`);

    try {
      await execFile('screencapture', [
        '-l',
        String(windowId),
        '-o',
        '-x',
        '-t',
        'png',
        tmpPath,
      ]);

      // Resample to the caller's target width (e.g. 2x for Retina screenshots).
      if (targetWidth) {
        await execFile('sips', [
          '--resampleWidth',
          String(targetWidth),
          tmpPath,
          '--out',
          tmpPath,
        ]);
      }

      const buffer = await readFile(tmpPath);

      // Overlay grid lines and labels for coordinate reference.
      if (overlayGridSpacing && overlayGridPadding) {
        return overlayGrid(buffer, overlayGridSpacing, overlayGridPadding);
      }

      return buffer;
    } finally {
      await unlink(tmpPath).catch(() => {
        // cleanup best-effort
      });
    }
  }

  async postClick(x: number, y: number): Promise<void> {
    await this.activate();

    const script = `
ObjC.import('CoreGraphics');
const point = $.CGPointMake(${x}, ${y});
const mouseDown = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, $.kCGMouseButtonLeft);
const mouseUp = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, mouseDown);
delay(0.05);
$.CGEventPost($.kCGHIDEventTap, mouseUp);
`;

    await execFile('osascript', ['-l', 'JavaScript', '-e', script]);
  }

  async postLongPress(x: number, y: number, durationMs: number): Promise<void> {
    await this.activate();

    const delaySec = durationMs / 1000;
    const script = `
ObjC.import('CoreGraphics');
const point = $.CGPointMake(${x}, ${y});
const mouseDown = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, $.kCGMouseButtonLeft);
const mouseUp = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, mouseDown);
delay(${delaySec});
$.CGEventPost($.kCGHIDEventTap, mouseUp);
`;

    await execFile('osascript', ['-l', 'JavaScript', '-e', script], {
      timeout: durationMs + 5000,
    });
  }

  async postDrag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    durationMs: number,
    easing: SwipeEasing = SwipeEasing.EaseOut,
  ): Promise<void> {
    await this.activate();

    const steps = Math.max(Math.round(durationMs / 16), 5);
    const delayPerStep = durationMs / 1000 / steps;

    const script = `
ObjC.import('CoreGraphics');
ObjC.import('Cocoa');

const startX = ${startX};
const startY = ${startY};
const endX = ${endX};
const endY = ${endY};
const steps = ${steps};
const delayPerStep = ${delayPerStep};
const easing = '${easing}';

function ease(t) {
  switch (easing) {
    case 'ease-in': return t * t * t;
    case 'ease-out': return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    default: return t;
  }
}

const startPoint = $.CGPointMake(startX, startY);
const mouseDown = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, startPoint, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, mouseDown);

for (let i = 1; i <= steps; i++) {
  const t = ease(i / steps);
  const cx = startX + (endX - startX) * t;
  const cy = startY + (endY - startY) * t;
  const dragPoint = $.CGPointMake(cx, cy);
  const dragEvent = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDragged, dragPoint, $.kCGMouseButtonLeft);
  $.CGEventPost($.kCGHIDEventTap, dragEvent);
  delay(delayPerStep);
}

const endPoint = $.CGPointMake(endX, endY);
const mouseUp = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, endPoint, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, mouseUp);
`;

    await execFile('osascript', ['-l', 'JavaScript', '-e', script]);
  }

  async sendShortcut(key: string): Promise<void> {
    await this.activate();

    const script = `
tell application "System Events"
  keystroke "${key}" using command down
end tell
`;

    await execFile('osascript', ['-e', script]);
  }

  async typeText(text: string): Promise<void> {
    await this.activate();

    // Handle special characters and regular text
    const escaped = escapeJxaString(text);
    const keystrokeScript = `
tell application "System Events"
  keystroke "${escaped}"
end tell
`;

    await execFile('osascript', ['-e', keystrokeScript]);
  }

  async checkAccessibilityPermission(): Promise<boolean> {
    const script = `
ObjC.import('Cocoa');
$.AXIsProcessTrusted();
`;

    const { stdout } = await execFile('osascript', [
      '-l',
      'JavaScript',
      '-e',
      script,
    ]);
    return stdout.trim() === 'true';
  }
}
