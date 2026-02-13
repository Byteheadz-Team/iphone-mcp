import { execFile as execFileCb } from 'node:child_process';

import { z } from 'zod';

import {
  type GridLayout,
  MirroringClient,
  type WindowInfo,
  computeGridLayout,
} from '@lib/mirroring';
import { Module, clampImageDimension, execFile } from '@lib/utils';
import config from '~/config';

import { type ButtonName, SwipeEasing } from './mirroring.types';

const coordinateSchema = z.number().finite();

const SCALE = config.mirroring.screenshotScale;
const TARGET_DIVISIONS = config.mirroring.overlayGridDivisions;
const SCROLL_SPEED = config.mirroring.scrollSpeed;
const SWIPE_SPEED = config.mirroring.swipeSpeed;
const MAX_DIMENSION = config.mirroring.maxPxSingleDimension;
const COMPRESS_PNG_PALETTE = config.mirroring.compressPngPalette;
const PNG_COMPRESSION_LEVEL = config.mirroring.pngCompressionLevel;

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
  gridPadding: number;
}

export class MirroringService extends Module {
  private client: MirroringClient;
  private windowInfo: WindowInfo | null = null;
  private gridLayout: GridLayout | null = null;
  private naturalScrolling = true;
  readonly permissionWarnings = {
    accessibility: null as string | null,
    screenRecording: null as string | null,
  };

  constructor(client?: MirroringClient) {
    super();
    this.client = client ?? new MirroringClient();
  }

  override async start(): Promise<void> {
    const hasAccessibility = await this.client.checkAccessibilityPermission();
    const hasScreenRecording =
      await this.client.checkScreenRecordingPermission();
    const appName = await this.client.getHostAppName();

    if (!hasAccessibility) {
      this.permissionWarnings.accessibility =
        `Accessibility permission is not granted for ${appName}. ` +
        'Tap, swipe, and type actions may not work. ' +
        'Enable it in System Settings > Privacy & Security > Accessibility.';
      this.log.warn(this.permissionWarnings.accessibility);
    }

    if (!hasScreenRecording) {
      this.permissionWarnings.screenRecording =
        `Screen Recording permission is not granted for ${appName}. ` +
        'Screenshots may be blank. ' +
        'Enable it in System Settings > Privacy & Security > Screen Recording.';
      this.log.warn(this.permissionWarnings.screenRecording);
    }

    this.naturalScrolling = await this.client.isNaturalScrolling();
    this.log.info(`Natural scrolling: ${this.naturalScrolling ? 'ON' : 'OFF'}`);

    try {
      await this.client.ensureRunning();
      this.windowInfo = await this.client.getWindowInfo();
      this.gridLayout = computeGridLayout({
        shortSide:
          Math.min(this.windowInfo.width, this.windowInfo.height) * SCALE,
        targetDivisions: TARGET_DIVISIONS,
      });
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
    this.gridLayout = null;
    await super.stop();
  }

  async takeScreenshot(): Promise<Buffer> {
    const info = await this.refreshWindowInfo();
    const buffer = await this.client.captureWindow({
      windowId: info.windowId,
      targetWidth: info.width * SCALE,
      gridDivisions: TARGET_DIVISIONS,
      compressPngPalette: COMPRESS_PNG_PALETTE,
      pngCompressionLevel: PNG_COMPRESSION_LEVEL,
    });

    return clampImageDimension({
      imageBuffer: buffer,
      maxDimension: MAX_DIMENSION,
      compressPngPalette: COMPRESS_PNG_PALETTE,
      pngCompressionLevel: PNG_COMPRESSION_LEVEL,
    });
  }

  async tap({ x, y }: { x: number; y: number }): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screen = this.toScreenCoords({ info, pixelX: x, pixelY: y });
    await this.client.postClick(screen);
  }

  async longPress({
    x,
    y,
    durationMs,
  }: {
    x: number;
    y: number;
    durationMs: number;
  }): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screen = this.toScreenCoords({ info, pixelX: x, pixelY: y });
    await this.client.postLongPress({ ...screen, durationMs });
  }

  async swipe({
    startX,
    startY,
    endX,
    endY,
    duration,
    easing,
  }: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration?: number;
    easing?: SwipeEasing;
  }): Promise<void> {
    const info = await this.refreshWindowInfo();
    const start = this.toScreenCoords({ info, pixelX: startX, pixelY: startY });
    const end = this.toScreenCoords({ info, pixelX: endX, pixelY: endY });
    await this.client.postDrag({
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      durationMs: (duration ?? 500) / SWIPE_SPEED,
      easing: easing ?? SwipeEasing.Linear,
    });
  }

  async scroll({
    x,
    y,
    deltaX = 0,
    deltaY = 0,
    speed,
  }: {
    x: number;
    y: number;
    deltaX?: number;
    deltaY?: number;
    speed?: number;
  }): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screen = this.toScreenCoords({ info, pixelX: x, pixelY: y });
    // CGEventCreateScrollWheelEvent posted at kCGHIDEventTap is subject to
    // the macOS "Natural scrolling" preference, which inverts the direction.
    // Negate the deltas when natural scrolling is ON so the tool contract
    // stays consistent: positive deltaY = scroll down (content moves up).
    const sign = this.naturalScrolling ? -1 : 1;
    await this.client.postScroll({
      ...screen,
      deltaX: deltaX * sign * SCROLL_SPEED,
      deltaY: deltaY * sign * SCROLL_SPEED,
      speed,
    });
  }

  async typeText(text: string): Promise<void> {
    await this.client.typeText(text);
  }

  async pressButton(button: ButtonName): Promise<void> {
    const shortcuts: Record<ButtonName, string> = {
      home: '1', // ⌘1
      app_switcher: '2', // ⌘2
      spotlight: '3', // ⌘3
    };
    await this.client.sendShortcut(shortcuts[button]);
  }

  getGridLayout(): GridLayout {
    if (!this.gridLayout) {
      throw new Error(
        'Grid layout not available — MirroringService has not started',
      );
    }
    return this.gridLayout;
  }

  async getScreenInfo(): Promise<ScreenInfo> {
    const info = await this.refreshWindowInfo();
    return {
      width: info.width * SCALE,
      height: info.height * SCALE,
      scale: SCALE,
      gridPadding: this.getGridLayout().padding,
    };
  }

  async getClipboard(): Promise<string> {
    const { stdout } = await execFile('pbpaste');
    return stdout;
  }

  async setClipboard(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = execFileCb('pbcopy', (err) => {
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
    this.gridLayout = computeGridLayout({
      shortSide:
        Math.min(this.windowInfo.width, this.windowInfo.height) * SCALE,
      targetDivisions: TARGET_DIVISIONS,
    });
    return this.windowInfo;
  }

  private toScreenCoords({
    info,
    pixelX,
    pixelY,
  }: {
    info: WindowInfo;
    pixelX: number;
    pixelY: number;
  }): { x: number; y: number } {
    coordinateSchema.parse(pixelX);
    coordinateSchema.parse(pixelY);

    const offset = this.getGridLayout().padding;
    return {
      x: info.x + (pixelX - offset) / SCALE,
      y: info.y + (pixelY - offset) / SCALE,
    };
  }
}
