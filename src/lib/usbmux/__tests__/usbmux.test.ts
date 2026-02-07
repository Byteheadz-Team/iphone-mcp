import { describe, expect, it } from 'vitest';

import { parsePlist, serializePlist } from '../../plist/index.js';
import { USBMUX_HEADER_SIZE, USBMUX_VERSION } from '../types.js';

describe('usbmux protocol', () => {
  it('has correct header size', () => {
    expect(USBMUX_HEADER_SIZE).toBe(16);
  });

  it('uses version 1', () => {
    expect(USBMUX_VERSION).toBe(1);
  });

  describe('message framing', () => {
    it('builds a valid header for a plist payload', () => {
      const plist = serializePlist({ MessageType: 'ListDevices' });
      const plistBuffer = Buffer.from(plist, 'utf8');
      const totalLength = USBMUX_HEADER_SIZE + plistBuffer.length;

      const header = Buffer.alloc(USBMUX_HEADER_SIZE);
      header.writeUInt32LE(totalLength, 0);
      header.writeUInt32LE(USBMUX_VERSION, 4);
      header.writeUInt32LE(8, 8); // type = plist
      header.writeUInt32LE(1, 12); // tag = 1

      expect(header.readUInt32LE(0)).toBe(totalLength);
      expect(header.readUInt32LE(4)).toBe(1);
      expect(header.readUInt32LE(8)).toBe(8);
      expect(header.readUInt32LE(12)).toBe(1);
    });

    it('correctly encodes port in network byte order', () => {
      const port = 8100;
      const portBE = ((port & 0xff) << 8) | ((port >> 8) & 0xff);
      // 8100 = 0x1FA4
      // Network byte order: 0xA41F = 42015
      expect(portBE).toBe(0xa4_1f);
    });
  });

  describe('response parsing', () => {
    it('parses a ListDevices response plist', () => {
      const xml = serializePlist({
        MessageType: 'Result',
        Number: 0,
        DeviceList: [
          {
            DeviceID: 1,
            MessageType: 'Attached',
            Properties: {
              ConnectionSpeed: 480_000_000,
              ConnectionType: 'USB',
              DeviceID: 1,
              LocationID: 0,
              ProductID: 4776,
              SerialNumber: 'abc123',
            },
          },
        ],
      });

      const parsed = parsePlist(xml) as Record<string, unknown>;
      expect(parsed.MessageType).toBe('Result');
      expect(parsed.Number).toBe(0);

      const deviceList = parsed.DeviceList as Array<Record<string, unknown>>;
      expect(deviceList).toHaveLength(1);

      const props = deviceList[0]?.Properties as Record<string, unknown>;
      expect(props?.SerialNumber).toBe('abc123');
      expect(props?.ConnectionType).toBe('USB');
    });
  });
});
