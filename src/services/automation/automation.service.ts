import { Module } from '../../types.js';
import { type MirroringService } from '../mirroring/mirroring.service.js';

import { type ButtonName, type SwipeDirection } from './automation.types.js';

export class AutomationService extends Module {
  constructor(private mirroringService: MirroringService) {
    super();
  }

  async tapCoordinates(x: number, y: number): Promise<void> {
    this.log.debug(`Tapping at (${x}, ${y})`);
    await this.mirroringService.tap(x, y);
  }

  async longPress(x: number, y: number, durationMs: number): Promise<void> {
    this.log.debug(`Long pressing at (${x}, ${y}) for ${durationMs}ms`);
    await this.mirroringService.longPress(x, y, durationMs);
  }

  async swipeDirection(
    direction: SwipeDirection,
    startX?: number,
    startY?: number,
  ): Promise<void> {
    this.log.debug(`Swiping ${direction}`);
    await this.mirroringService.swipeDirection(direction, startX, startY);
  }

  async swipeCoordinates(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration?: number,
  ): Promise<void> {
    this.log.debug(`Swiping from (${startX}, ${startY}) to (${endX}, ${endY})`);
    await this.mirroringService.swipe(startX, startY, endX, endY, duration);
  }

  async typeText(text: string): Promise<void> {
    this.log.debug('Typing text');
    await this.mirroringService.typeText(text);
  }

  async pressButton(button: ButtonName): Promise<void> {
    this.log.debug(`Pressing button: ${button}`);
    await this.mirroringService.pressButton(button);
  }
}
