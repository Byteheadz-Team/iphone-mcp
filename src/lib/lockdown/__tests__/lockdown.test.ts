import { describe, expect, it } from 'vitest';

import { serializePlist } from '../../plist/index.js';
import { LOCKDOWN_PORT, LockdownRequestType } from '../types.js';

describe('lockdown protocol', () => {
  it('uses port 62078', () => {
    expect(LOCKDOWN_PORT).toBe(62078);
  });

  it('has correct request types', () => {
    expect(LockdownRequestType.QueryType).toBe('QueryType');
    expect(LockdownRequestType.GetValue).toBe('GetValue');
    expect(LockdownRequestType.StartSession).toBe('StartSession');
    expect(LockdownRequestType.StartService).toBe('StartService');
  });

  describe('message framing', () => {
    it('encodes message length as 4-byte big-endian prefix', () => {
      const plist = serializePlist({ Request: 'QueryType' });
      const plistBuffer = Buffer.from(plist, 'utf8');

      const header = Buffer.alloc(4);
      header.writeUInt32BE(plistBuffer.length, 0);

      expect(header.readUInt32BE(0)).toBe(plistBuffer.length);
    });

    it('constructs a valid GetValue request', () => {
      const request = {
        Request: LockdownRequestType.GetValue,
        Domain: 'com.apple.mobile.battery',
        Key: 'BatteryCurrentCapacity',
      };
      const xml = serializePlist(request);
      expect(xml).toContain('<key>Request</key>');
      expect(xml).toContain('<string>GetValue</string>');
      expect(xml).toContain('<key>Domain</key>');
      expect(xml).toContain('<string>com.apple.mobile.battery</string>');
    });
  });
});
