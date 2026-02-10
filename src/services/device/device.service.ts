import { type Socket } from 'node:net';

import { LockdownClient } from '@lib/lockdown/lockdown-client';
import { LOCKDOWN_PORT } from '@lib/lockdown/types';
import { UsbmuxClient } from '@lib/usbmux/usbmux-client';
import { Module } from '@lib/utils';
import config from '~/config';

import {
  type AttachedDevice,
  type BatteryInfo,
  type DeviceInfo,
} from './device.types';

export class DeviceService extends Module {
  private socketPath: string;

  constructor(socketPath?: string) {
    super();
    this.socketPath = socketPath ?? config.usbmux.socketPath;
  }

  async listDevices(): Promise<AttachedDevice[]> {
    const client = new UsbmuxClient(this.socketPath);
    try {
      await client.connect();
      const devices = await client.listDevices();
      return devices.map((device) => ({
        deviceId: device.Properties.DeviceID,
        udid: device.Properties.SerialNumber,
        connectionType: device.Properties.ConnectionType,
      }));
    } finally {
      client.close();
    }
  }

  async getDeviceInfo(udid: string): Promise<DeviceInfo> {
    return this.withLockdownClient(udid, async (lockdown) => {
      const values = await lockdown.getDeviceInfo();

      return {
        udid,
        name: values.DeviceName ?? 'Unknown',
        model: values.ModelNumber ?? 'Unknown',
        productVersion: values.ProductVersion ?? 'Unknown',
        buildVersion: values.BuildVersion ?? 'Unknown',
        deviceClass: values.DeviceClass ?? 'Unknown',
        productType: values.ProductType ?? 'Unknown',
        serialNumber: values.SerialNumber ?? 'Unknown',
        cpuArchitecture: values.CPUArchitecture,
        wifiAddress: values.WiFiAddress,
        bluetoothAddress: values.BluetoothAddress,
      };
    });
  }

  async getActiveDevice(): Promise<AttachedDevice> {
    const devices = await this.listDevices();
    const first = devices[0];
    if (!first) {
      throw new Error('No devices connected');
    }
    return first;
  }

  async getBatteryInfo(udid?: string): Promise<BatteryInfo> {
    let targetUdid = udid;
    if (!targetUdid) {
      const device = await this.getActiveDevice();
      targetUdid = device.udid;
    }

    return this.withLockdownClient(targetUdid, async (lockdown) => {
      const value = await lockdown.getValue('com.apple.mobile.battery');

      const battery = value as Record<string, unknown>;
      return {
        level: Math.round(
          (battery.BatteryCurrentCapacity as number | undefined) ?? 0,
        ),
        state: (battery.BatteryIsCharging as boolean | undefined)
          ? 'charging'
          : 'unplugged',
      };
    });
  }

  private async withLockdownClient<T>(
    udid: string,
    fn: (client: LockdownClient) => Promise<T>,
  ): Promise<T> {
    const devices = await this.listDevices();
    const device = devices.find((d) => d.udid === udid);
    if (!device) {
      throw new Error(`Device not found: ${udid}`);
    }

    const usbmuxClient = new UsbmuxClient(this.socketPath);
    try {
      await usbmuxClient.connect();
      const socket: Socket = await usbmuxClient.connectToDevice(
        device.deviceId,
        LOCKDOWN_PORT,
      );

      const lockdown = new LockdownClient(socket);
      try {
        return await fn(lockdown);
      } finally {
        lockdown.close();
      }
    } finally {
      usbmuxClient.close();
    }
  }
}
