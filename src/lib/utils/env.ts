export const parseIntFromEnvVar = ({
  envVar,
  fallback,
  min,
  max,
}: {
  envVar: string;
  fallback: number;
  min?: number;
  max?: number;
}): number => {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (
    Number.isNaN(parsed) ||
    !Number.isInteger(parsed) ||
    (min !== undefined && parsed < min) ||
    (max !== undefined && parsed > max)
  ) {
    // stderr directly — createLogger depends on config, so we can't use it here
    console.error(
      `[config] Invalid value for ${envVar}="${raw}", using default ${fallback}`,
    );
    return fallback;
  }
  return parsed;
};

export const parseFloatFromEnvVar = ({
  envVar,
  fallback,
  min,
  max,
}: {
  envVar: string;
  fallback: number;
  min?: number;
  max?: number;
}): number => {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (
    Number.isNaN(parsed) ||
    !Number.isFinite(parsed) ||
    (min !== undefined && parsed < min) ||
    (max !== undefined && parsed > max)
  ) {
    console.error(
      `[config] Invalid value for ${envVar}="${raw}", using default ${fallback}`,
    );
    return fallback;
  }
  return parsed;
};

export const parseBoolFromEnvVar = ({
  envVar,
  fallback,
}: {
  envVar: string;
  fallback: boolean;
}): boolean => {
  const raw = process.env[envVar];
  if (raw === undefined) return fallback;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  console.error(
    `[config] Invalid value for ${envVar}="${raw}", using default ${String(fallback)}`,
  );
  return fallback;
};
