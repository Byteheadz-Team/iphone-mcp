import sharp from 'sharp';

export interface GridLayout {
  spacing: number;
  padding: number;
  fontSize: number;
  strokeWidth: number;
  tick: number;
}

export const computeGridLayout = ({
  shortSide,
  targetDivisions,
}: {
  shortSide: number;
  targetDivisions: number;
}): GridLayout => {
  const spacing = Math.round(shortSide / targetDivisions);
  const padding = Math.round(spacing * 0.7);
  const fontSize = Math.round(padding * 0.65);
  const strokeWidth = Math.max(2, Math.round(shortSide / 200));
  const tick = Math.round(padding * 0.35);
  return { spacing, padding, fontSize, strokeWidth, tick };
};

/** Convert a 0-based index to a grid label: 0→'A', 1→'B', … */
export const gridLabel = (index: number): string =>
  String.fromCharCode(65 + index);

/** Convert a grid label back to a 0-based index: 'A'→0, 'B'→1, … */
export const labelToIndex = (label: string): number => {
  if (label.length !== 1) {
    throw new Error(
      `Grid label must be a single letter A–Z, got ${JSON.stringify(label)}`,
    );
  }
  const code = label.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) {
    throw new Error(
      `Grid label must be a letter A–Z, got ${JSON.stringify(label)}`,
    );
  }
  return code - 65;
};

const buildGridSvg = ({
  totalWidth,
  totalHeight,
  layout,
}: {
  totalWidth: number;
  totalHeight: number;
  layout: GridLayout;
}): string => {
  const { spacing, padding, fontSize, strokeWidth, tick } = layout;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">`,
  );

  // Grid lines — solid, semi-transparent gray
  const lineAttrs = `stroke="rgba(255,0,255,0.45)" stroke-width="${strokeWidth}"`;

  // Vertical lines — tick into top margin, extend to bottom edge
  for (let i = 0; padding + i * spacing <= totalWidth; i++) {
    const x = padding + i * spacing;
    parts.push(
      `<line x1="${x}" y1="${padding - tick}" x2="${x}" y2="${totalHeight}" ${lineAttrs}/>`,
    );
  }

  // Horizontal lines — tick into left margin, extend to right edge
  for (let i = 0; padding + i * spacing <= totalHeight; i++) {
    const y = padding + i * spacing;
    parts.push(
      `<line x1="${padding - tick}" y1="${y}" x2="${totalWidth}" y2="${y}" ${lineAttrs}/>`,
    );
  }

  // Label styling — bold white on the black margin for maximum contrast
  const font = `font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="900" font-size="${fontSize}"`;
  const fill = 'fill="rgba(255,255,255,1)"';

  // Column labels — in the top margin, centered on each vertical grid line
  for (let i = 0; padding + i * spacing <= totalWidth && i <= 26; i++) {
    const x = padding + i * spacing;
    parts.push(
      `<text x="${x}" y="${padding * 0.7}" text-anchor="middle" ${font} ${fill}>${gridLabel(i)}</text>`,
    );
  }

  // Row labels — in the left margin, vertically centered on each horizontal grid line
  for (let i = 0; padding + i * spacing <= totalHeight && i <= 26; i++) {
    const y = padding + i * spacing;
    parts.push(
      `<text x="${padding * 0.45}" y="${y}" text-anchor="middle" dominant-baseline="central" ${font} ${fill}>${gridLabel(i)}</text>`,
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
};

export const overlayGrid = async ({
  imageBuffer,
  targetDivisions,
  compressPngPalette,
  pngCompressionLevel,
}: {
  imageBuffer: Buffer;
  targetDivisions: number;
  compressPngPalette?: boolean;
  pngCompressionLevel?: number;
}): Promise<Buffer> => {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    return imageBuffer;
  }

  const layout = computeGridLayout({
    shortSide: Math.min(width, height),
    targetDivisions,
  });
  const totalWidth = width + 2 * layout.padding;
  const totalHeight = height + 2 * layout.padding;

  const svg = buildGridSvg({ totalWidth, totalHeight, layout });

  return sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 30, g: 30, b: 30, alpha: 255 },
    },
  })
    .composite([
      { input: imageBuffer, top: layout.padding, left: layout.padding },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .png({
      compressionLevel: pngCompressionLevel,
      ...(compressPngPalette ? { palette: true } : {}),
    })
    .toBuffer();
};

export const buildGridInstructions = (layout: GridLayout): string => {
  const { spacing, padding } = layout;
  const labels: string[] = [];
  for (let i = 1; i <= 26; i++) {
    labels.push(`${gridLabel(i)}=${padding + i * spacing}`);
  }
  return [
    `Screenshots include a grid overlay with labeled reference lines every ${spacing}px.`,
    `The phone screen is offset by ${padding}px from the top-left corner of the image.`,
    `Grid labels (in image pixels): ${labels.join(', ')}.`,
    'Column labels run along the top (X axis), row labels along the left (Y axis).',
    'ALWAYS use the get_coordinates tool with these grid labels to determine exact pixel coordinates for any actions like tap, swipe, and long_press.',
  ].join(' ');
};
