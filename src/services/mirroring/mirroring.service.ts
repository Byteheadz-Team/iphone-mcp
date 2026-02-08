import { execFile as execFileCb, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

import {
  MirroringClient,
  type ContentBounds,
  type WindowInfo,
} from '../../lib/mirroring/index.js';
import { Module } from '../../types.js';
import {
  type ButtonName,
  type SwipeDirection,
} from '../automation/automation.types.js';

const execFile = promisify(execFileCb);

const SWIPE_OFFSET = 200;

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
}

export class MirroringService extends Module {
  private client: MirroringClient;
  private windowInfo: WindowInfo | null = null;
  private contentBounds: ContentBounds | null = null;

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
      this.contentBounds = {
        x: 0,
        y: 0,
        width: this.windowInfo.width,
        height: this.windowInfo.height,
      };
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
    this.contentBounds = {
      x: 0,
      y: 0,
      width: this.windowInfo.width,
      height: this.windowInfo.height,
    };
  }

  override async stop(): Promise<void> {
    this.windowInfo = null;
    this.contentBounds = null;
    await super.stop();
  }

  async takeScreenshot(): Promise<Buffer> {
    const info = await this.refreshWindowInfo();
    return this.client.captureWindow(info.windowId, info.width);
  }

  async tap(x: number, y: number): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screenCoords = this.toScreenCoords(info, x, y);
    await this.client.postClick(screenCoords.x, screenCoords.y);
  }

  async longPress(x: number, y: number, durationMs: number): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screenCoords = this.toScreenCoords(info, x, y);
    await this.client.postLongPress(screenCoords.x, screenCoords.y, durationMs);
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
    const bounds = this.getContentBounds(info);

    const centerPixelX = startX ?? bounds.width / 2;
    const centerPixelY = startY ?? bounds.height / 2;

    let endPixelX = centerPixelX;
    let endPixelY = centerPixelY;

    switch (direction) {
      case 'up':
        endPixelY = centerPixelY - SWIPE_OFFSET;
        break;
      case 'down':
        endPixelY = centerPixelY + SWIPE_OFFSET;
        break;
      case 'left':
        endPixelX = centerPixelX - SWIPE_OFFSET;
        break;
      case 'right':
        endPixelX = centerPixelX + SWIPE_OFFSET;
        break;
    }

    await this.swipe(centerPixelX, centerPixelY, endPixelX, endPixelY, 500);
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
    if (!this.contentBounds) {
      throw new Error('iPhone Mirroring window not available');
    }
    return {
      width: this.contentBounds.width,
      height: this.contentBounds.height,
      scale: 1,
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
    this.contentBounds = {
      x: 0,
      y: 0,
      width: this.windowInfo.width,
      height: this.windowInfo.height,
    };
    return this.windowInfo;
  }

  private getContentBounds(info: WindowInfo): ContentBounds {
    return {
      x: 0,
      y: 0,
      width: info.width,
      height: info.height,
    };
  }

  private toScreenCoords(
    info: WindowInfo,
    pixelX: number,
    pixelY: number,
  ): { x: number; y: number } {
    return {
      x: info.x + pixelX,
      y: info.y + pixelY,
    };
  }
}
