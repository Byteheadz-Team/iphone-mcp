export interface WdaSessionCapabilities {
  bundleId?: string;
  arguments?: string[];
  environment?: Record<string, string>;
  shouldWaitForQuiescence?: boolean;
}

export interface WdaSession {
  sessionId: string;
  capabilities: Record<string, unknown>;
}

export interface WdaElement {
  ELEMENT: string;
  'element-6066-11e4-a52e-4f735466cecf'?: string;
}

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementAttributes {
  type: string;
  label: string | null;
  name: string | null;
  value: string | null;
  rect: ElementRect;
  enabled: boolean;
  visible: boolean;
  accessible: boolean;
}

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
  statusBarSize: { width: number; height: number };
}

export interface AppState {
  state: number;
  // 0 = unknown, 1 = not running, 2 = running (background/suspended),
  // 3 = running (background), 4 = running (foreground)
}

export interface BatteryInfo {
  level: number;
  state: number;
  // 0 = unknown, 1 = unplugged, 2 = charging, 3 = full
}

export type FindStrategy =
  | 'accessibility id'
  | 'class name'
  | 'xpath'
  | 'predicate string'
  | 'class chain'
  | '-ios predicate string'
  | '-ios class chain';

export interface WdaResponse<T = unknown> {
  value: T;
  sessionId?: string;
  status?: number;
}

export interface WdaErrorValue {
  error: string;
  message: string;
  traceback?: string;
}
