import { describe, expect, it } from 'vitest';

import { WdaClient } from '../wda-client.js';

describe('WdaClient', () => {
  it('can be instantiated with default options', () => {
    const client = new WdaClient({ baseUrl: 'http://localhost:8100' });
    expect(client).toBeDefined();
    expect(client.getSessionId()).toBeNull();
  });

  it('throws when accessing session path without session', async () => {
    const client = new WdaClient({ baseUrl: 'http://localhost:8100' });
    await expect(() => client.getPageSource()).rejects.toThrow(
      'No active WDA session',
    );
  });

  it('can be closed without error', () => {
    const client = new WdaClient({ baseUrl: 'http://localhost:8100' });
    client.close();
    expect(client.getSessionId()).toBeNull();
  });
});
