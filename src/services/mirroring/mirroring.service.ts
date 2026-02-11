import { execFile as execFileCb, type ChildProcess } from 'node:child_process';

import { z } from 'zod';

import { MirroringClient, type WindowInfo } from '@lib/mirroring';
import { Module, execFile } from '@lib/utils';
import config from '~/config';

import { type ButtonName, SwipeEasing } from './mirroring.types';

const coordinateSchema = z.number().finite();

const SCALE = config.mirroring.screenshotScale;
const GRID_SPACING = config.mirroring.overlayGridSpacing;
const GRID_PADDING = config.mirroring.overlayGridPadding;
const COORD_OFFSET = GRID_SPACING ? GRID_PADDING : 0;

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
  gridPadding: number;
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
    return this.client.captureWindow(
      info.windowId,
      info.width * SCALE,
      GRID_SPACING,
      GRID_PADDING,
    );
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
    easing?: SwipeEasing,
  ): Promise<void> {
    const info = await this.refreshWindowInfo();
    const start = this.toScreenCoords(info, startX, startY);
    const end = this.toScreenCoords(info, endX, endY);
    await this.client.postDrag(
      start.x,
      start.y,
      end.x,
      end.y,
      duration ?? 500,
      easing ?? SwipeEasing.EaseOut,
    );
  }

  async typeText(text: string): Promise<void> {
    await this.client.typeText(text);
  }

  async pressButton(_button: ButtonName): Promise<void> {
    await this.client.sendShortcut('1'); // ⌘1 = Home Screen
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
      gridPadding: COORD_OFFSET,
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
    coordinateSchema.parse(pixelX);
    coordinateSchema.parse(pixelY);

    return {
      x: info.x + (pixelX - COORD_OFFSET) / SCALE,
      y: info.y + (pixelY - COORD_OFFSET) / SCALE,
    };
  }
}
