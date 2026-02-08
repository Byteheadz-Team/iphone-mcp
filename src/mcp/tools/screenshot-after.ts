import { z } from 'zod';

import { type MirroringService } from '../../services/mirroring/mirroring.service.js';

export const screenshotDelaySchema = z
  .number()
  .optional()
  .describe(
    'Take a screenshot after this many seconds (e.g. 2). If omitted, no screenshot is taken.',
  );

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export async function withScreenshotAfter(
  mirroringService: MirroringService,
  screenshotDelay: number | undefined,
  textContent: ContentBlock[],
): Promise<{ content: ContentBlock[] }> {
  if (screenshotDelay === undefined) {
    return { content: textContent };
  }

  const delayMs = Math.round(screenshotDelay * 1000);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const data = await mirroringService.takeScreenshot();
  return {
    content: [
      ...textContent,
      { type: 'image', data: data.toString('base64'), mimeType: 'image/png' },
    ],
  };
}
