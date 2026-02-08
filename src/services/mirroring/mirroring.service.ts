import { execFile as execFileCb, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

import { MirroringClient, type WindowInfo } from '@lib/mirroring';
import config from '@src/config';
import { Module } from '@src/types';

import { type ButtonName, type SwipeDirection } from './mirroring.types';

const execFile = promisify(execFileCb);

const SCALE = config.mirroring.screenshotScale;

// Distance in screenshot pixels for directional swipes (roughly half the screen on most iPhones).
const SWIPE_OFFSET = 200 * SCALE;

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
}

export class MirroringService extends Module {
  private client: MirroringClient;
  private windowInfo: WindowInfo | null = null;

  constructor(client?: MirroringClient) {
    super();
    this.client = client ?? new MirroringClient();
  }

  override async start(): Promise<void> {
    const hasPermission = await this.client.checkAccessibilityPermission();
    if (!hasPermission) {
      this.log.warn(
        'Accessibility permission not granted. Tap/swipe/type may not work. ' +
          'Go to System Settings > Privacy & Security > Accessibility and add this process.',
      );
    }

    try {
      await this.client.ensureRunning();
      this.windowInfo = await this.client.getWindowInfo();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.warn(
        `iPhone Mirroring not available at startup: ${message}. ` +
          'Mirroring-dependent tools will attempt to connect on first use.',
      );
    }

    await super.start();
  }

  private async ensureReady(): Promise<void> {
    if (this.windowInfo) {
      return;
    }

    await this.client.ensureRunning();
    this.windowInfo = await this.client.getWindowInfo();
  }

  override async stop(): Promise<void> {
    this.windowInfo = null;
    await super.stop();
  }

  async takeScreenshot(): Promise<Buffer> {
    const info = await this.refreshWindowInfo();
    return this.client.captureWindow(info.windowId, info.width * SCALE);
  }

  async tap(x: number, y: number): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screen = this.toScreenCoords(info, x, y);
    await this.client.postClick(screen.x, screen.y);
  }

  async longPress(x: number, y: number, durationMs: number): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screen = this.toScreenCoords(info, x, y);
    await this.client.postLongPress(screen.x, screen.y, durationMs);
  }

  async swipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration?: number,
  ): Promise<void> {
    const info = await this.refreshWindowInfo();
    const start = this.toScreenCoords(info, startX, startY);
    const end = this.toScreenCoords(info, endX, endY);
    await this.client.postDrag(start.x, start.y, end.x, end.y, duration ?? 500);
  }

  async swipeDirection(
    direction: SwipeDirection,
    startX?: number,
    startY?: number,
  ): Promise<void> {
    const info = await this.refreshWindowInfo();

    const centerX = startX ?? (info.width * SCALE) / 2;
    const centerY = startY ?? (info.height * SCALE) / 2;

    let endX = centerX;
    let endY = centerY;

    switch (direction) {
      case 'up':
        endY = centerY - SWIPE_OFFSET;
        break;
      case 'down':
        endY = centerY + SWIPE_OFFSET;
        break;
      case 'left':
        endX = centerX - SWIPE_OFFSET;
        break;
      case 'right':
        endX = centerX + SWIPE_OFFSET;
        break;
    }

    await this.swipe(centerX, centerY, endX, endY, 500);
  }

  async typeText(text: string): Promise<void> {
    await this.client.typeText(text);
  }

  async pressButton(button: ButtonName): Promise<void> {
    if (button === 'home') {
      await this.client.sendShortcut('1'); // ⌘1 = Home Screen
      return;
    }

    throw new Error(
      `Button "${button}" is not supported via iPhone Mirroring. Only "home" is available.`,
    );
  }

  async getScreenInfo(): Promise<ScreenInfo> {
    await this.ensureReady();
    if (!this.windowInfo) {
      throw new Error('iPhone Mirroring window not available');
    }
    return {
      width: this.windowInfo.width * SCALE,
      height: this.windowInfo.height * SCALE,
      scale: SCALE,
    };
  }

  async getClipboard(): Promise<string> {
    const { stdout } = await execFile('pbpaste');
    return stdout;
  }

  async setClipboard(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = execFileCb('pbcopy', (err) => {
        if (err) {
          reject(new Error(`pbcopy failed: ${err.message}`));
        } else {
          resolve();
        }
      });
      proc.stdin?.write(content);
      proc.stdin?.end();
    });
  }

  private async refreshWindowInfo(): Promise<WindowInfo> {
    await this.ensureReady();
    this.windowInfo = await this.client.getWindowInfo();
    return this.windowInfo;
  }

  private toScreenCoords(
    info: WindowInfo,
    pixelX: number,
    pixelY: number,
  ): { x: number; y: number } {
    return {
      x: info.x + pixelX / SCALE,
      y: info.y + pixelY / SCALE,
    };
  }
}
