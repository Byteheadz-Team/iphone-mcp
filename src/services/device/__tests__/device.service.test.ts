import { describe, expect, it } from 'vitest';

import { DeviceService } from '../device.service.js';

describe('DeviceService', () => {
  it('can be instantiated', () => {
    const service = new DeviceService('/nonexistent');
    expect(service).toBeDefined();
    expect(service.started).toBe(false);
  });

  it('starts and stops correctly', async () => {
    const service = new DeviceService('/nonexistent');
    await service.start();
    expect(service.started).toBe(true);
    await service.stop();
    expect(service.started).toBe(false);
  });

  it('throws when stopping before starting', () => {
    const service = new DeviceService('/nonexistent');
    expect(() => service.stop()).toThrow('cannot stop a module that is not started');
  });
});
