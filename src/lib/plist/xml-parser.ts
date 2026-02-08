import { type PlistValue } from './types';

interface ParseContext {
  xml: string;
  pos: number;
}

function skipWhitespace(ctx: ParseContext): void {
  while (ctx.pos < ctx.xml.length && /\s/.test(ctx.xml[ctx.pos] ?? '')) {
    ctx.pos++;
  }
}

function skipXmlDeclarationAndDoctype(ctx: ParseContext): void {
  skipWhitespace(ctx);
  // Skip <?xml ... ?>
  while (ctx.xml.startsWith('<?', ctx.pos)) {
    const end = ctx.xml.indexOf('?>', ctx.pos);
    if (end === -1) {
      throw new Error('Unterminated XML declaration');
    }
    ctx.pos = end + 2;
    skipWhitespace(ctx);
  }
  // Skip <!DOCTYPE ... >
  while (ctx.xml.startsWith('<!DOCTYPE', ctx.pos)) {
    const end = ctx.xml.indexOf('>', ctx.pos);
    if (end === -1) {
      throw new Error('Unterminated DOCTYPE');
    }
    ctx.pos = end + 1;
    skipWhitespace(ctx);
  }
  // Skip <!-- comments -->
  while (ctx.xml.startsWith('<!--', ctx.pos)) {
    const end = ctx.xml.indexOf('-->', ctx.pos);
    if (end === -1) {
      throw new Error('Unterminated comment');
    }
    ctx.pos = end + 3;
    skipWhitespace(ctx);
  }
}

function readTagName(ctx: ParseContext): string {
  const start = ctx.pos;
  while (
    ctx.pos < ctx.xml.length &&
    ctx.xml[ctx.pos] !== '>' &&
    ctx.xml[ctx.pos] !== '/' &&
    ctx.xml[ctx.pos] !== ' '
  ) {
    ctx.pos++;
  }
  return ctx.xml.slice(start, ctx.pos);
}

function skipToTagClose(ctx: ParseContext): boolean {
  // Returns true if self-closing
  while (ctx.pos < ctx.xml.length && ctx.xml[ctx.pos] !== '>') {
    if (ctx.xml[ctx.pos] === '/') {
      ctx.pos++; // skip /
      if (ctx.xml[ctx.pos] === '>') {
        ctx.pos++; // skip >
        return true;
      }
    }
    ctx.pos++;
  }
  ctx.pos++; // skip >
  return false;
}

function readTextContent(ctx: ParseContext, endTag: string): string {
  const closeTag = `</${endTag}>`;
  const end = ctx.xml.indexOf(closeTag, ctx.pos);
  if (end === -1) {
    throw new Error(`Missing closing tag: ${endTag}`);
  }
  const text = ctx.xml.slice(ctx.pos, end);
  ctx.pos = end + closeTag.length;
  return decodeXmlEntities(text);
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function parseValue(ctx: ParseContext): PlistValue | undefined {
  skipWhitespace(ctx);
  skipXmlDeclarationAndDoctype(ctx);

  if (ctx.pos >= ctx.xml.length || ctx.xml[ctx.pos] !== '<') {
    return undefined;
  }

  // Check for closing tag
  if (ctx.xml[ctx.pos + 1] === '/') {
    return undefined;
  }

  ctx.pos++; // skip <
  const tagName = readTagName(ctx);
  const selfClosing = skipToTagClose(ctx);

  switch (tagName) {
    case 'plist': {
      const value = parseValue(ctx);
      // Skip closing </plist>
      skipWhitespace(ctx);
      if (ctx.xml.startsWith('</plist>', ctx.pos)) {
        ctx.pos += 8;
      }
      return value;
    }

    case 'dict':
      return selfClosing ? {} : parseDict(ctx);

    case 'array':
      return selfClosing ? [] : parseArray(ctx);

    case 'string':
      return selfClosing ? '' : readTextContent(ctx, 'string');

    case 'integer':
      return selfClosing
        ? 0
        : Number.parseInt(readTextContent(ctx, 'integer'), 10);

    case 'real':
      return selfClosing ? 0 : Number.parseFloat(readTextContent(ctx, 'real'));

    case 'true':
      return true;

    case 'false':
      return false;

    case 'data': {
      if (selfClosing) {
        return Buffer.alloc(0);
      }
      const base64 = readTextContent(ctx, 'data').replaceAll(/\s/g, '');
      return Buffer.from(base64, 'base64');
    }

    case 'date': {
      if (selfClosing) {
        return new Date(0);
      }
      return new Date(readTextContent(ctx, 'date'));
    }

    default:
      throw new Error(`Unknown plist tag: ${tagName}`);
  }
}

function parseDict(ctx: ParseContext): Record<string, PlistValue> {
  const dict: Record<string, PlistValue> = {};

  while (true) {
    skipWhitespace(ctx);

    if (ctx.pos >= ctx.xml.length) {
      break;
    }

    // Check for closing </dict>
    if (ctx.xml.startsWith('</dict>', ctx.pos)) {
      ctx.pos += 7;
      break;
    }

    // Read <key>...</key>
    if (ctx.xml[ctx.pos] !== '<') {
      throw new Error(`Expected '<' at position ${ctx.pos}`);
    }
    ctx.pos++; // skip <
    const keyTag = readTagName(ctx);
    if (keyTag !== 'key') {
      throw new Error(`Expected <key>, got <${keyTag}> at position ${ctx.pos}`);
    }
    skipToTagClose(ctx);
    const key = readTextContent(ctx, 'key');

    // Read value
    const value = parseValue(ctx);
    if (value === undefined) {
      throw new Error(`Missing value for key "${key}"`);
    }
    dict[key] = value;
  }

  return dict;
}

function parseArray(ctx: ParseContext): PlistValue[] {
  const arr: PlistValue[] = [];

  while (true) {
    skipWhitespace(ctx);

    if (ctx.pos >= ctx.xml.length) {
      break;
    }

    // Check for closing </array>
    if (ctx.xml.startsWith('</array>', ctx.pos)) {
      ctx.pos += 8;
      break;
    }

    const value = parseValue(ctx);
    if (value === undefined) {
      break;
    }
    arr.push(value);
  }

  return arr;
}

export function parsePlist(xml: string): PlistValue {
  const ctx: ParseContext = { xml, pos: 0 };
  const value = parseValue(ctx);
  if (value === undefined) {
    throw new Error('Empty or invalid plist');
  }
  return value;
}
