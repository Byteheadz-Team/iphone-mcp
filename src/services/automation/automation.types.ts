export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export type ButtonName = 'home' | 'volumeUp' | 'volumeDown';

export interface ElementInfo {
  elementId: string;
  type: string;
  label: string | null;
  name: string | null;
  value: string | null;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  enabled: boolean;
  visible: boolean;
}
