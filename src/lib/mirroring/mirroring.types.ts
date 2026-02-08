export enum SwipeEasing {
  Linear = 'linear',
  EaseIn = 'ease-in',
  EaseOut = 'ease-out',
  EaseInOut = 'ease-in-out',
}

export interface WindowInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  windowId: number;
}
