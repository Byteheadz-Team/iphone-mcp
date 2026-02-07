import { type PlistValue } from './types.js';

const XML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">`;

const XML_FOOTER = '\n</plist>';

function encodeXmlEntities(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function serializeValue(value: PlistValue, indent: string): string {
  if (typeof value === 'string') {
    return `${indent}<string>${encodeXmlEntities(value)}</string>`;
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? `${indent}<integer>${value}</integer>`
      : `${indent}<real>${value}</real>`;
  }

  if (typeof value === 'boolean') {
    return `${indent}<${value}/>`;
  }

  if (value instanceof Date) {
    return `${indent}<date>${value.toISOString()}</date>`;
  }

  if (Buffer.isBuffer(value)) {
    const base64 = value.toString('base64');
    return `${indent}<data>${base64}</data>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${indent}<array/>`;
    }
    const items = value
      .map((item) => serializeValue(item, `${indent}  `))
      .join('\n');
    return `${indent}<array>\n${items}\n${indent}</array>`;
  }

  // Dict
  const dict = value as Record<string, PlistValue>;
  const keys = Object.keys(dict);
  if (keys.length === 0) {
    return `${indent}<dict/>`;
  }
  const entries = keys
    .map(
      (key) =>
        `${indent}  <key>${encodeXmlEntities(key)}</key>\n${serializeValue(dict[key], `${indent}  `)}`,
    )
    .join('\n');
  return `${indent}<dict>\n${entries}\n${indent}</dict>`;
}

export function serializePlist(value: PlistValue): string {
  return `${XML_HEADER}\n${serializeValue(value, '')}\n${XML_FOOTER}`;
}
