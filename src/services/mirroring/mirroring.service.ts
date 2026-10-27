import { z } from 'zod';

import {
  type GridLayout,
  MirroringClient,
  type WindowInfo,
  computeGridLayout,
} from '@lib/mirroring';
import { Module } from '@lib/utils';
import config from '~/config';

import { SwipeEasing } from './mirroring.types';

const coordinateSchema = z.number().finite();

const SCALE = config.mirroring.screenshotScale;
const TARGET_DIVISIONS = config.mirroring.overlayGridDivisions;
const SWIPE_SPEED = config.mirroring.swipeSpeed;
const MAX_DIMENSION = config.mirroring.maxPxSingleDimension;
const COMPRESS_PNG_PALETTE = config.mirroring.compressPngPalette;
const PNG_COMPRESSION_LEVEL = config.mirroring.pngCompressionLevel;
const MOTION_STEP_INTERVAL_MS = config.mirroring.motionStepIntervalMs;

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
        'Tap and swipe actions may not work. ' +
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
    return this.client.captureWindow({
      windowId: info.windowId,
      targetWidth: info.width * SCALE,
      maxDimension: MAX_DIMENSION,
      gridDivisions: TARGET_DIVISIONS,
      compressPngPalette: COMPRESS_PNG_PALETTE,
      pngCompressionLevel: PNG_COMPRESSION_LEVEL,
    });
  }

  async tap({
    x,
    y,
    numTaps,
  }: {
    x: number;
    y: number;
    numTaps?: number;
  }): Promise<void> {
    const info = await this.refreshWindowInfo();
    const screen = this.toScreenCoords({ info, pixelX: x, pixelY: y });
    await this.client.postClick({ ...screen, numTaps });
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
      stepIntervalMs: MOTION_STEP_INTERVAL_MS,
    });
  }

  getGridLayout(): GridLayout {
    if (!this.gridLayout) {
      throw new Error(
        'Grid layout not available — MirroringService has not started',
      );
    }
    return this.gridLayout;
  }

  getWindowInfo(): WindowInfo {
    if (!this.windowInfo) {
      throw new Error(
        'Window info not available — MirroringService has not started',
      );
    }
    return this.windowInfo;
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
    const minX = offset;
    const minY = offset;
    const maxX = offset + info.width * SCALE;
    const maxY = offset + info.height * SCALE;

    if (pixelX < minX || pixelX > maxX || pixelY < minY || pixelY > maxY) {
      throw new Error(
        `Coordinate (${pixelX}, ${pixelY}) is outside the mirrored iPhone screen. ` +
          `Allowed screenshot bounds are x=${minX}..${maxX}, y=${minY}..${maxY}.`,
      );
    }

    return {
      x: info.x + (pixelX - offset) / SCALE,
      y: info.y + (pixelY - offset) / SCALE,
    };
  }
}
