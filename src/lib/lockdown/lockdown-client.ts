import * as tls from 'node:tls';

import {
  type PlistDict,
  type PlistValue,
  parsePlist,
  serializePlist,
} from '../plist/index.js';

import {
  type DeviceValues,
  type LockdownResponse,
  type PairRecord,
  LockdownRequestType,
} from './types.js';

export class LockdownClient {
  private socket: NodeJS.ReadWriteStream;
  private buffer = Buffer.alloc(0);
  private responseQueue: Array<{
    resolve: (value: LockdownResponse) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(socket: NodeJS.ReadWriteStream) {
    this.socket = socket;
    this.setupDataHandler();
  }

  private setupDataHandler(): void {
    this.socket.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.processBuffer();
    });
  }

  private processBuffer(): void {
    while (this.buffer.length >= 4) {
      const messageLength = this.buffer.readUInt32BE(0);

      if (this.buffer.length < 4 + messageLength) {
        break;
      }

      const payload = this.buffer.subarray(4, 4 + messageLength);
      this.buffer = this.buffer.subarray(4 + messageLength);

      const response = parsePlist(payload.toString('utf8')) as PlistDict;
      const callback = this.responseQueue.shift();
      if (callback) {
        callback.resolve(response as unknown as LockdownResponse);
      }
    }
  }

  private sendRequest(
    request: Record<string, PlistValue>,
  ): Promise<LockdownResponse> {
    return new Promise((resolve, reject) => {
      this.responseQueue.push({ resolve, reject });

      const plistXml = serializePlist(request);
      const plistBuffer = Buffer.from(plistXml, 'utf8');

      const header = Buffer.alloc(4);
      header.writeUInt32BE(plistBuffer.length, 0);

      this.socket.write(header);
      this.socket.write(plistBuffer);
    });
  }

  async queryType(): Promise<string> {
    const response = await this.sendRequest({
      Request: LockdownRequestType.QueryType,
    });

    if (response.Error) {
      throw new Error(`QueryType failed: ${response.Error}`);
    }

    return (response.Type as string | undefined) ?? 'com.apple.mobile.lockdown';
  }

  async getValue(domain?: string, key?: string): Promise<unknown> {
    const request: Record<string, PlistValue> = {
      Request: LockdownRequestType.GetValue,
    };
    if (domain) {
      request.Domain = domain;
    }
    if (key) {
      request.Key = key;
    }

    const response = await this.sendRequest(request);

    if (response.Error) {
      throw new Error(`GetValue failed: ${response.Error}`);
    }

    return response.Value;
  }

  async getDeviceInfo(): Promise<DeviceValues> {
    const value = await this.getValue();
    return value as DeviceValues;
  }

  async validatePair(pairRecord: PairRecord): Promise<void> {
    const response = await this.sendRequest({
      Request: LockdownRequestType.ValidatePair,
      PairRecord: pairRecord as unknown as PlistValue,
    });

    if (response.Error) {
      throw new Error(`ValidatePair failed: ${response.Error}`);
    }
  }

  async startSession(
    hostId: string,
    pairRecord: PairRecord,
  ): Promise<{ sessionId: string; enableSSL: boolean }> {
    const response = await this.sendRequest({
      Request: LockdownRequestType.StartSession,
      HostID: hostId,
      SystemBUID: pairRecord.SystemBUID,
    });

    if (response.Error) {
      throw new Error(`StartSession failed: ${response.Error}`);
    }

    const sessionId = response.SessionID ?? '';
    const enableSSL = response.EnableSessionSSL ?? false;

    if (enableSSL) {
      await this.upgradeToSSL(pairRecord);
    }

    return { sessionId, enableSSL };
  }

  private async upgradeToSSL(pairRecord: PairRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const tlsSocket = tls.connect(
        {
          socket: this.socket as never,
          key: pairRecord.HostPrivateKey,
          cert: pairRecord.HostCertificate,
          ca: [pairRecord.RootCertificate],
          rejectUnauthorized: false,
        },
        () => {
          this.socket = tlsSocket;
          this.buffer = Buffer.alloc(0);
          this.setupDataHandler();
          resolve();
        },
      );

      tlsSocket.on('error', (error: Error) => {
        reject(new Error(`TLS upgrade failed: ${error.message}`));
      });
    });
  }

  async startService(
    serviceName: string,
  ): Promise<{ port: number; enableServiceSSL: boolean }> {
    const response = await this.sendRequest({
      Request: LockdownRequestType.StartService,
      Service: serviceName,
    });

    if (response.Error) {
      throw new Error(
        `StartService "${serviceName}" failed: ${response.Error}`,
      );
    }

    return {
      port: response.Port as number,
      enableServiceSSL:
        (response.EnableServiceSSL as boolean | undefined) ?? false,
    };
  }

  async stopSession(sessionId: string): Promise<void> {
    const response = await this.sendRequest({
      Request: LockdownRequestType.StopSession,
      SessionID: sessionId,
    });

    if (response.Error) {
      throw new Error(`StopSession failed: ${response.Error}`);
    }
  }

  close(): void {
    if ('destroy' in this.socket && typeof this.socket.destroy === 'function') {
      (this.socket as { destroy: () => void }).destroy();
    }
  }
}
