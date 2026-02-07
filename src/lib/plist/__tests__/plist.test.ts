import { describe, expect, it } from 'vitest';

import { parsePlist } from '../xml-parser.js';
import { serializePlist } from '../xml-serializer.js';

describe('plist parser', () => {
  it('parses an empty dict', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>`;
    expect(parsePlist(xml)).toEqual({});
  });

  it('parses string values', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Name</key>
  <string>iPhone</string>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Name: 'iPhone' });
  });

  it('parses integer and real values', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Count</key>
  <integer>42</integer>
  <key>Ratio</key>
  <real>3.14</real>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Count: 42, Ratio: 3.14 });
  });

  it('parses boolean values', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Enabled</key>
  <true/>
  <key>Hidden</key>
  <false/>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Enabled: true, Hidden: false });
  });

  it('parses data (base64) values', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Payload</key>
  <data>aGVsbG8=</data>
</dict></plist>`;
    const result = parsePlist(xml) as Record<string, Buffer>;
    expect(Buffer.isBuffer(result.Payload)).toBe(true);
    expect(result.Payload?.toString()).toBe('hello');
  });

  it('parses date values', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Created</key>
  <date>2024-01-15T10:30:00Z</date>
</dict></plist>`;
    const result = parsePlist(xml) as Record<string, Date>;
    expect(result.Created).toBeInstanceOf(Date);
    expect(result.Created?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('parses arrays', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Items</key>
  <array>
    <string>a</string>
    <string>b</string>
    <integer>3</integer>
  </array>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Items: ['a', 'b', 3] });
  });

  it('parses nested dicts', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Outer</key>
  <dict>
    <key>Inner</key>
    <string>value</string>
  </dict>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Outer: { Inner: 'value' } });
  });

  it('handles XML entities', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Text</key>
  <string>a &amp; b &lt; c &gt; d</string>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Text: 'a & b < c > d' });
  });

  it('parses an empty array', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Empty</key>
  <array/>
</dict></plist>`;
    expect(parsePlist(xml)).toEqual({ Empty: [] });
  });

  it('handles multiline base64 data', () => {
    const xml = `<plist version="1.0"><dict>
  <key>Data</key>
  <data>
    aGVs
    bG8=
  </data>
</dict></plist>`;
    const result = parsePlist(xml) as Record<string, Buffer>;
    expect(result.Data?.toString()).toBe('hello');
  });
});

describe('plist serializer', () => {
  it('serializes a simple dict', () => {
    const result = serializePlist({ Name: 'iPhone', Count: 42 });
    expect(result).toContain('<key>Name</key>');
    expect(result).toContain('<string>iPhone</string>');
    expect(result).toContain('<key>Count</key>');
    expect(result).toContain('<integer>42</integer>');
  });

  it('serializes booleans', () => {
    const result = serializePlist({ Enabled: true, Hidden: false });
    expect(result).toContain('<true/>');
    expect(result).toContain('<false/>');
  });

  it('serializes arrays', () => {
    const result = serializePlist({ Items: ['a', 'b'] });
    expect(result).toContain('<array>');
    expect(result).toContain('<string>a</string>');
    expect(result).toContain('<string>b</string>');
    expect(result).toContain('</array>');
  });

  it('serializes Buffer as data', () => {
    const result = serializePlist({ Payload: Buffer.from('hello') });
    expect(result).toContain('<data>aGVsbG8=</data>');
  });

  it('serializes dates', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const result = serializePlist({ Created: date });
    expect(result).toContain('<date>2024-01-15T10:30:00.000Z</date>');
  });

  it('encodes XML entities in strings', () => {
    const result = serializePlist({ Text: 'a & b < c' });
    expect(result).toContain('<string>a &amp; b &lt; c</string>');
  });
});

describe('plist round-trip', () => {
  it('round-trips a complex structure', () => {
    const original = {
      Name: 'Test',
      Count: 42,
      Ratio: 3.14,
      Enabled: true,
      Items: ['a', 'b', 'c'],
      Nested: {
        Key: 'Value',
        Number: 99,
      },
    };
    const serialized = serializePlist(original);
    const parsed = parsePlist(serialized);
    expect(parsed).toEqual(original);
  });
});
