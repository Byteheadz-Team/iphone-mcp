import * as net from 'node:net';

import {
  type PlistDict,
  type PlistValue,
  parsePlist,
  serializePlist,
} from '../plist/index.js';

import {
  type UsbmuxDevice,
  type UsbmuxResponse,
  USBMUX_HEADER_SIZE,
  USBMUX_VERSION,
  UsbmuxMessageType,
} from './types.js';

const PROG_NAME = 'iphone-mcp';
const CLIENT_VERSION = '0.1.0';

export class UsbmuxClient {
  private socket: net.Socket | null = null;
  private tag = 0;
  private buffer = Buffer.alloc(0);
  private pendingCallbacks = new Map<
    number,
    {
      resolve: (value: UsbmuxResponse) => void;
      reject: (error: Error) => void;
    }
  >();
  private listenCallback:
    | ((event: 'attached' | 'detached', device: UsbmuxDevice) => void)
    | null = null;
  private socketPath: string;

  constructor(socketPath = '/var/run/usbmuxd') {
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath, () => {
        resolve();
      });
      this.socket.on('error', (error) => {
        reject(error);
      });
      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });
      this.socket.on('close', () => {
        for (const [, callback] of this.pendingCallbacks) {
          callback.reject(new Error('Connection closed'));
        }
        this.pendingCallbacks.clear();
      });
    });
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= USBMUX_HEADER_SIZE) {
      const messageLength = this.buffer.readUInt32LE(0);

      if (this.buffer.length < messageLength) {
        break;
      }

      const _version = this.buffer.readUInt32LE(4);
      const _type = this.buffer.readUInt32LE(8);
      const tag = this.buffer.readUInt32LE(12);

      const payload = this.buffer.subarray(USBMUX_HEADER_SIZE, messageLength);
      this.buffer = this.buffer.subarray(messageLength);

      const response = parsePlist(payload.toString('utf8')) as PlistDict;

      const messageType = response.MessageType as string | undefined;
      if (
        messageType === UsbmuxMessageType.Attached ||
        messageType === UsbmuxMessageType.Detached
      ) {
        this.listenCallback?.(
          messageType === UsbmuxMessageType.Attached ? 'attached' : 'detached',
          response as unknown as UsbmuxDevice,
        );
        continue;
      }

      const callback = this.pendingCallbacks.get(tag);
      if (callback) {
        this.pendingCallbacks.delete(tag);
        callback.resolve(response as UsbmuxResponse);
      }
    }
  }

  private sendMessage(message: Record<string, PlistValue>): number {
    if (!this.socket) {
      throw new Error('Not connected to usbmuxd');
    }

    const currentTag = ++this.tag;
    const fullMessage: Record<string, PlistValue> = {
      ...message,
      ClientVersionString: CLIENT_VERSION,
      ProgName: PROG_NAME,
    };

    const plistXml = serializePlist(fullMessage);
    const plistBuffer = Buffer.from(plistXml, 'utf8');

    const header = Buffer.alloc(USBMUX_HEADER_SIZE);
    header.writeUInt32LE(USBMUX_HEADER_SIZE + plistBuffer.length, 0);
    header.writeUInt32LE(USBMUX_VERSION, 4);
    header.writeUInt32LE(8, 8); // type = plist
    header.writeUInt32LE(currentTag, 12);

    this.socket.write(Buffer.concat([header, plistBuffer]));
    return currentTag;
  }

  private sendAndReceive(
    message: Record<string, PlistValue>,
  ): Promise<UsbmuxResponse> {
    const tag = this.sendMessage(message);
    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(tag, { resolve, reject });
    });
  }

  async listDevices(): Promise<UsbmuxDevice[]> {
    const response = await this.sendAndReceive({
      MessageType: UsbmuxMessageType.ListDevices,
    });
    return response.DeviceList ?? [];
  }

  async listen(
    callback: (event: 'attached' | 'detached', device: UsbmuxDevice) => void,
  ): Promise<void> {
    this.listenCallback = callback;
    const response = await this.sendAndReceive({
      MessageType: UsbmuxMessageType.Listen,
    });
    if (response.Number !== 0) {
      throw new Error(`Listen failed with error: ${response.Number}`);
    }
  }

  async connectToDevice(deviceId: number, port: number): Promise<net.Socket> {
    // usbmuxd expects port in network byte order (big-endian)
    const portBE = ((port & 0xff) << 8) | ((port >> 8) & 0xff);

    const response = await this.sendAndReceive({
      MessageType: UsbmuxMessageType.Connect,
      DeviceID: deviceId,
      PortNumber: portBE,
    });

    if (response.Number !== 0) {
      throw new Error(
        `Connect to device ${deviceId} port ${port} failed with error: ${response.Number}`,
      );
    }

    // After a successful Connect, the socket is now a raw TCP tunnel to the device.
    // Return the socket and clear our references so the caller owns it.
    const socket = this.socket;
    if (!socket) {
      throw new Error('Socket unexpectedly null after connect');
    }
    // Remove our data handler — the caller will set up their own
    socket.removeAllListeners('data');
    socket.removeAllListeners('close');
    this.socket = null;
    return socket;
  }

  async readPairRecord(udid: string): Promise<PlistDict | null> {
    const response = await this.sendAndReceive({
      MessageType: UsbmuxMessageType.ReadPairRecord,
      PairRecordID: udid,
    });

    if (response.Number !== 0) {
      return null;
    }

    const data = response.PairRecordData;
    if (!data || !Buffer.isBuffer(data)) {
      return null;
    }

    return parsePlist(data.toString('utf8')) as PlistDict;
  }

  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.pendingCallbacks.clear();
    this.listenCallback = null;
  }
}
