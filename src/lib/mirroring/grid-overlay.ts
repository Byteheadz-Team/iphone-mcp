import sharp from 'sharp';

function gridLabel(index: number): string {
  return String.fromCharCode(64 + index);
}

function buildGridSvg(
  totalWidth: number,
  totalHeight: number,
  padding: number,
  spacing: number,
): string {
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">`,
  );

  // Grid lines — solid, semi-transparent gray
  const lineAttrs = 'stroke="rgba(180,180,180,0.5)" stroke-width="1.5"';

  // Vertical lines — start below the top margin so they don't overlap column labels
  for (let i = 1; padding + i * spacing < totalWidth; i++) {
    const x = padding + i * spacing;
    parts.push(
      `<line x1="${x}" y1="${padding}" x2="${x}" y2="${totalHeight}" ${lineAttrs}/>`,
    );
  }

  // Horizontal lines — start past the left margin so they don't overlap row labels
  for (let i = 1; padding + i * spacing < totalHeight; i++) {
    const y = padding + i * spacing;
    parts.push(
      `<line x1="${padding}" y1="${y}" x2="${totalWidth}" y2="${y}" ${lineAttrs}/>`,
    );
  }

  // Label styling — bold white on the black margin for maximum contrast
  const font =
    'font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="bold" font-size="28"';
  const fill = 'fill="rgba(255,255,255,0.9)"';

  // Column labels — in the top margin, centered on each vertical grid line
  for (let i = 1; padding + i * spacing < totalWidth && i <= 26; i++) {
    const x = padding + i * spacing;
    parts.push(
      `<text x="${x}" y="${padding * 0.7}" text-anchor="middle" ${font} ${fill}>${gridLabel(i)}</text>`,
    );
  }

  // Row labels — in the left margin, vertically centered on each horizontal grid line
  for (let i = 1; padding + i * spacing < totalHeight && i <= 26; i++) {
    const y = padding + i * spacing;
    parts.push(
      `<text x="${padding * 0.45}" y="${y}" text-anchor="middle" dominant-baseline="central" ${font} ${fill}>${gridLabel(i)}</text>`,
    );
  }

  parts.push('</svg>');
  return parts.join('\n');
}

export async function overlayGrid(
  imageBuffer: Buffer,
  spacing: number,
  padding: number,
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    return imageBuffer;
  }

  const totalWidth = width + padding;
  const totalHeight = height + padding;
  const svg = buildGridSvg(totalWidth, totalHeight, padding, spacing);

  return sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 255 },
    },
  })
    .composite([
      { input: imageBuffer, top: padding, left: padding },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

export function buildGridInstructions(
  spacing: number,
  padding: number,
): string {
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
}
