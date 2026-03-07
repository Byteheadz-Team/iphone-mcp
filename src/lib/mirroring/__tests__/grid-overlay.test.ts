import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { overlayGrid } from '../grid-overlay';

const createTestImage = async ({
  width,
  height,
}: {
  width: number;
  height: number;
}): Promise<Buffer> =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

describe('overlayGrid', () => {
  it('throws on empty buffer input', async () => {
    await expect(
      overlayGrid({ imageBuffer: Buffer.alloc(0), targetDivisions: 9 }),
    ).rejects.toThrow();
  });

  it('adds grid padding to the image dimensions', async () => {
    const img = await createTestImage({ width: 400, height: 800 });
    const result = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
    });

    const meta = await sharp(result).metadata();
    // Grid adds padding on all four sides based on shortSide / divisions * 0.7
    // shortSide = 400, spacing = round(400/9) = 44, padding = round(44*0.7) = 31
    expect(meta.width).toBe(400 + 2 * 31);
    expect(meta.height).toBe(800 + 2 * 31);
  });

  it('resizes the image when resizeWidth is provided', async () => {
    const img = await createTestImage({ width: 800, height: 1600 });
    const result = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
      resizeWidth: 400,
    });

    const meta = await sharp(result).metadata();
    // After resize to width=400, height=800. shortSide=400, spacing=44, padding=31
    expect(meta.width).toBe(400 + 2 * 31);
    expect(meta.height).toBe(800 + 2 * 31);
  });

  it('does not resize when resizeWidth equals original width', async () => {
    const img = await createTestImage({ width: 400, height: 800 });

    const withResize = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
      resizeWidth: 400,
    });
    const without = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
    });

    const metaWith = await sharp(withResize).metadata();
    const metaWithout = await sharp(without).metadata();
    expect(metaWith.width).toBe(metaWithout.width);
    expect(metaWith.height).toBe(metaWithout.height);
  });

  it('clamps the output when maxDimension is exceeded', async () => {
    const img = await createTestImage({ width: 400, height: 800 });
    const result = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
      maxDimension: 500,
    });

    const meta = await sharp(result).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      500,
    );
  });

  it('does not clamp when output is within maxDimension', async () => {
    const img = await createTestImage({ width: 100, height: 200 });
    const result = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
      maxDimension: 5000,
    });

    const meta = await sharp(result).metadata();
    // shortSide=100, spacing=round(100/9)=11, padding=round(11*0.7)=8
    expect(meta.width).toBe(100 + 2 * 8);
    expect(meta.height).toBe(200 + 2 * 8);
  });

  it('applies resize and maxDimension together', async () => {
    const img = await createTestImage({ width: 1000, height: 2000 });
    const result = await overlayGrid({
      imageBuffer: img,
      targetDivisions: 9,
      resizeWidth: 500,
      maxDimension: 600,
    });

    const meta = await sharp(result).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      600,
    );
  });
});
