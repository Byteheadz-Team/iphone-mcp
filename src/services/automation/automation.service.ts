import { Module } from '../../types.js';
import { type WdaClient } from '../wda/wda-client.js';
import { type FindStrategy } from '../wda/wda.types.js';

import { type ButtonName, type ElementInfo, type SwipeDirection } from './automation.types.js';

const SWIPE_OFFSET = 200;

export class AutomationService extends Module {
  constructor(private wdaClient: WdaClient) {
    super();
  }

  async tapCoordinates(x: number, y: number): Promise<void> {
    this.log.debug(`Tapping at (${x}, ${y})`);
    await this.wdaClient.tap(x, y);
  }

  async tapElement(accessibilityId: string): Promise<void> {
    this.log.debug(`Tapping element: ${accessibilityId}`);
    const element = await this.wdaClient.findElement(
      'accessibility id',
      accessibilityId,
    );
    const elementId =
      element['element-6066-11e4-a52e-4f735466cecf'] ?? element.ELEMENT;
    await this.wdaClient.tapElement(elementId);
  }

  async swipeDirection(
    direction: SwipeDirection,
    startX?: number,
    startY?: number,
  ): Promise<void> {
    this.log.debug(`Swiping ${direction}`);

    const screen = await this.wdaClient.getScreenInfo();
    const centerX = startX ?? screen.width / 2;
    const centerY = startY ?? screen.height / 2;

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

    await this.wdaClient.swipe(centerX, centerY, endX, endY);
  }

  async swipeCoordinates(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration?: number,
  ): Promise<void> {
    this.log.debug(`Swiping from (${startX}, ${startY}) to (${endX}, ${endY})`);
    await this.wdaClient.swipe(startX, startY, endX, endY, duration);
  }

  async typeText(text: string): Promise<void> {
    this.log.debug('Typing text');
    await this.wdaClient.typeText(text);
  }

  async pressButton(button: ButtonName): Promise<void> {
    this.log.debug(`Pressing button: ${button}`);
    await this.wdaClient.pressButton(button);
  }

  async findElement(
    strategy: FindStrategy,
    value: string,
  ): Promise<ElementInfo> {
    this.log.debug(`Finding element: ${strategy} = ${value}`);
    const element = await this.wdaClient.findElement(strategy, value);
    const elementId =
      element['element-6066-11e4-a52e-4f735466cecf'] ?? element.ELEMENT;

    const attrs = await this.wdaClient.getElementAttributes(elementId);

    return {
      elementId,
      type: attrs.type,
      label: attrs.label,
      name: attrs.name,
      value: attrs.value,
      rect: attrs.rect,
      enabled: attrs.enabled,
      visible: attrs.visible,
    };
  }

  async getPageSource(): Promise<string> {
    this.log.debug('Getting page source');
    return this.wdaClient.getPageSource();
  }
}
