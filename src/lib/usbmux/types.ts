export interface UsbmuxHeader {
  length: number;
  version: number;
  type: number;
  tag: number;
}

export interface UsbmuxDeviceProperties {
  ConnectionSpeed: number;
  ConnectionType: string;
  DeviceID: number;
  LocationID: number;
  ProductID: number;
  SerialNumber: string;
  UDID?: string;
  USBSerialNumber?: string;
}

export interface UsbmuxDevice {
  DeviceID: number;
  MessageType: string;
  Properties: UsbmuxDeviceProperties;
}

export interface UsbmuxMessage {
  MessageType: string;
  ClientVersionString?: string;
  ProgName?: string;
  [key: string]: unknown;
}

export interface UsbmuxResponse {
  MessageType: string;
  Number?: number;
  DeviceList?: UsbmuxDevice[];
  [key: string]: unknown;
}

export const USBMUX_VERSION = 1;
export const USBMUX_HEADER_SIZE = 16;

export const UsbmuxMessageType = {
  Result: 'Result',
  Attached: 'Attached',
  Detached: 'Detached',
  ListDevices: 'ListDevices',
  Listen: 'Listen',
  Connect: 'Connect',
  ReadPairRecord: 'ReadPairRecord',
} as const;
