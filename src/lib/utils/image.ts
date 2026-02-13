import sharp from 'sharp';

/**
 * Clamp an image so its longest dimension does not exceed `maxDimension`.
 * Returns the original buffer unchanged if already within limits.
 */
export const clampImageDimension = async ({
  imageBuffer,
  maxDimension,
  compressPngPalette,
  pngCompressionLevel,
}: {
  imageBuffer: Buffer;
  maxDimension: number;
  compressPngPalette?: boolean;
  pngCompressionLevel?: number;
}): Promise<Buffer> => {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width ?? 0;
  const h = metadata.height ?? 0;

  if (w === 0 || h === 0 || Math.max(w, h) <= maxDimension) {
    return imageBuffer;
  }

  return sharp(imageBuffer)
    .resize(maxDimension, maxDimension, { fit: 'inside' })
    .png({
      compressionLevel: pngCompressionLevel,
      ...(compressPngPalette ? { palette: true } : {}),
    })
    .toBuffer();
};
