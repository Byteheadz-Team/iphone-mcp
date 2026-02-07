import { describe, expect, it, vi } from 'vitest';

import { type WdaClient } from '../../wda/wda-client.js';
import { AppService } from '../app.service.js';

const resolved = Promise.resolve();

function createMockWdaClient() {
  return {
    launchApp: vi.fn().mockReturnValue(resolved),
    terminateApp: vi.fn().mockResolvedValue(true),
    listApps: vi.fn().mockResolvedValue([
      { CFBundleIdentifier: 'com.example.app', CFBundleDisplayName: 'Example' },
    ]),
    openUrl: vi.fn().mockReturnValue(resolved),
    getAppState: vi.fn().mockResolvedValue({ state: 4 }),
  };
}

describe('AppService', () => {
  it('launches an app', async () => {
    const mock = createMockWdaClient();
    const service = new AppService(mock as unknown as WdaClient);

    await service.launch('com.example.app');

    expect(mock.launchApp).toHaveBeenCalledWith('com.example.app');
  });

  it('terminates an app', async () => {
    const mock = createMockWdaClient();
    const service = new AppService(mock as unknown as WdaClient);

    const result = await service.terminate('com.example.app');

    expect(result).toBe(true);
    expect(mock.terminateApp).toHaveBeenCalledWith('com.example.app');
  });

  it('lists installed apps', async () => {
    const mock = createMockWdaClient();
    const service = new AppService(mock as unknown as WdaClient);

    const apps = await service.listInstalled();

    expect(apps).toHaveLength(1);
    expect(apps[0]).toHaveProperty('CFBundleIdentifier', 'com.example.app');
  });

  it('opens a URL', async () => {
    const mock = createMockWdaClient();
    const service = new AppService(mock as unknown as WdaClient);

    await service.openUrl('https://example.com');

    expect(mock.openUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('gets app state with description', async () => {
    const mock = createMockWdaClient();
    const service = new AppService(mock as unknown as WdaClient);

    const state = await service.getAppState('com.example.app');

    expect(state.state).toBe(4);
    expect(state.stateDescription).toBe('running (foreground)');
  });
});
