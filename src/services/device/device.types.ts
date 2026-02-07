export interface DeviceInfo {
  udid: string;
  name: string;
  model: string;
  productVersion: string;
  buildVersion: string;
  deviceClass: string;
  productType: string;
  serialNumber: string;
  cpuArchitecture?: string;
  wifiAddress?: string;
  bluetoothAddress?: string;
}

export interface AttachedDevice {
  deviceId: number;
  udid: string;
  connectionType: string;
}
