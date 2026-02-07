import { describe, expect, it, vi } from 'vitest';

import { type WdaClient } from '../../wda/wda-client.js';
import { AutomationService } from '../automation.service.js';

const resolved = Promise.resolve();

function createMockWdaClient() {
  return {
    tap: vi.fn().mockReturnValue(resolved),
    swipe: vi.fn().mockReturnValue(resolved),
    typeText: vi.fn().mockReturnValue(resolved),
    pressButton: vi.fn().mockReturnValue(resolved),
    findElement: vi.fn().mockResolvedValue({
      ELEMENT: 'elem-1',
      'element-6066-11e4-a52e-4f735466cecf': 'elem-1',
    }),
    tapElement: vi.fn().mockReturnValue(resolved),
    getElementAttributes: vi.fn().mockResolvedValue({
      type: 'XCUIElementTypeButton',
      label: 'Submit',
      name: 'submitButton',
      value: null,
      rect: { x: 100, y: 200, width: 80, height: 40 },
      enabled: true,
      visible: true,
      accessible: true,
    }),
    getScreenInfo: vi.fn().mockResolvedValue({
      width: 390,
      height: 844,
      scale: 3,
      statusBarSize: { width: 390, height: 47 },
    }),
    getPageSource: vi.fn().mockResolvedValue('<xml>source</xml>'),
  };
}

describe('AutomationService', () => {
  it('taps at coordinates', async () => {
    const mock = createMockWdaClient();
    const service = new AutomationService(mock as unknown as WdaClient);

    await service.tapCoordinates(100, 200);

    expect(mock.tap).toHaveBeenCalledWith(100, 200);
  });

  it('taps an element by accessibility id', async () => {
    const mock = createMockWdaClient();
    const service = new AutomationService(mock as unknown as WdaClient);

    await service.tapElement('submitButton');

    expect(mock.findElement).toHaveBeenCalledWith(
      'accessibility id',
      'submitButton',
    );
    expect(mock.tapElement).toHaveBeenCalledWith('elem-1');
  });

  it('swipes in a direction', async () => {
    const mock = createMockWdaClient();
    const service = new AutomationService(mock as unknown as WdaClient);

    await service.swipeDirection('up');

    expect(mock.getScreenInfo).toHaveBeenCalled();
    expect(mock.swipe).toHaveBeenCalled();
  });

  it('types text', async () => {
    const mock = createMockWdaClient();
    const service = new AutomationService(mock as unknown as WdaClient);

    await service.typeText('hello');

    expect(mock.typeText).toHaveBeenCalledWith('hello');
  });

  it('presses a button', async () => {
    const mock = createMockWdaClient();
    const service = new AutomationService(mock as unknown as WdaClient);

    await service.pressButton('home');

    expect(mock.pressButton).toHaveBeenCalledWith('home');
  });

  it('finds an element and returns attributes', async () => {
    const mock = createMockWdaClient();
    const service = new AutomationService(mock as unknown as WdaClient);

    const result = await service.findElement('accessibility id', 'submitButton');

    expect(result.elementId).toBe('elem-1');
    expect(result.type).toBe('XCUIElementTypeButton');
    expect(result.label).toBe('Submit');
    expect(result.enabled).toBe(true);
  });
});
