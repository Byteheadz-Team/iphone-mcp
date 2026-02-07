import * as net from 'node:net';

import config from '../../config.js';
import { UsbmuxClient } from '../../lib/usbmux/usbmux-client.js';
import { type Logger, createLogger } from '../../log.js';

import {
  type AppState,
  type BatteryInfo,
  type ElementAttributes,
  type ElementRect,
  type FindStrategy,
  type ScreenInfo,
  type WdaElement,
  type WdaErrorValue,
  type WdaResponse,
  type WdaSession,
} from './wda.types.js';

export class WdaClient {
  private baseUrl: string;
  private sessionId: string | null = null;
  private proxyServer: net.Server | null = null;
  private proxyPort: number | null = null;
  private log: Logger;
  private deviceId: number | null = null;
  private socketPath: string;
  private wdaPort: number;

  constructor(options?: {
    deviceId?: number;
    socketPath?: string;
    wdaPort?: number;
    baseUrl?: string;
  }) {
    this.log = createLogger('WdaClient');
    this.socketPath = options?.socketPath ?? config.usbmux.socketPath;
    this.wdaPort = options?.wdaPort ?? config.wda.port;
    this.deviceId = options?.deviceId ?? null;
    this.baseUrl = options?.baseUrl ?? `http://localhost:${this.wdaPort}`;
  }

  async startProxy(deviceId: number): Promise<number> {
    this.deviceId = deviceId;

    return new Promise((resolve, reject) => {
      this.proxyServer = net.createServer((clientSocket) => {
        const usbmux = new UsbmuxClient(this.socketPath);
        void (async () => {
          try {
            await usbmux.connect();
            const deviceSocket = await usbmux.connectToDevice(
              deviceId,
              this.wdaPort,
            );
            clientSocket.pipe(deviceSocket);
            deviceSocket.pipe(clientSocket);
            clientSocket.on('close', () => deviceSocket.destroy());
            deviceSocket.on('close', () => clientSocket.destroy());
            clientSocket.on('error', () => deviceSocket.destroy());
            deviceSocket.on('error', () => clientSocket.destroy());
          } catch (error) {
            clientSocket.destroy();
            this.log.error('Proxy connection failed:', error);
          }
        })();
      });

      this.proxyServer.on('error', reject);

      this.proxyServer.listen(0, '127.0.0.1', () => {
        const address = this.proxyServer?.address();
        if (address && typeof address === 'object') {
          this.proxyPort = address.port;
          this.baseUrl = `http://127.0.0.1:${this.proxyPort}`;
          this.log.info(`Proxy started on port ${this.proxyPort}`);
          resolve(this.proxyPort);
        } else {
          reject(new Error('Failed to get proxy port'));
        }
      });
    });
  }

  stopProxy(): void {
    if (this.proxyServer) {
      this.proxyServer.close();
      this.proxyServer = null;
      this.proxyPort = null;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<WdaResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const json = (await response.json()) as WdaResponse<T>;

    if (!response.ok) {
      const errorValue = json.value as unknown as WdaErrorValue;
      throw new Error(
        `WDA error: ${errorValue?.error ?? 'unknown'}: ${errorValue?.message ?? response.statusText}`,
      );
    }

    return json;
  }

  private sessionPath(subpath = ''): string {
    if (!this.sessionId) {
      throw new Error('No active WDA session. Call createSession() first.');
    }
    return `/session/${this.sessionId}${subpath}`;
  }

  // ── Session ──

  async getStatus(): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>('GET', '/status');
    return response.value;
  }

  async createSession(bundleId?: string): Promise<WdaSession> {
    const capabilities: Record<string, unknown> = {};
    if (bundleId) {
      capabilities.bundleId = bundleId;
      capabilities.shouldWaitForQuiescence = false;
    }

    const response = await this.request<WdaSession>('POST', '/session', {
      capabilities: {
        alwaysMatch: capabilities,
      },
    });

    this.sessionId = response.sessionId ?? response.value.sessionId;
    return response.value;
  }

  async deleteSession(): Promise<void> {
    if (this.sessionId) {
      await this.request('DELETE', this.sessionPath());
      this.sessionId = null;
    }
  }

  // ── Screenshot ──

  async takeScreenshot(): Promise<Buffer> {
    const response = await this.request<string>(
      'GET',
      this.sessionId ? this.sessionPath('/screenshot') : '/screenshot',
    );
    return Buffer.from(response.value, 'base64');
  }

  // ── Elements ──

  async findElement(
    strategy: FindStrategy,
    value: string,
  ): Promise<WdaElement> {
    const response = await this.request<WdaElement>(
      'POST',
      this.sessionPath('/element'),
      { using: strategy, value },
    );
    return response.value;
  }

  async findElements(
    strategy: FindStrategy,
    value: string,
  ): Promise<WdaElement[]> {
    const response = await this.request<WdaElement[]>(
      'POST',
      this.sessionPath('/elements'),
      { using: strategy, value },
    );
    return response.value;
  }

  async getElementAttribute(
    elementId: string,
    attribute: string,
  ): Promise<string | null> {
    const response = await this.request<string | null>(
      'GET',
      this.sessionPath(`/element/${elementId}/attribute/${attribute}`),
    );
    return response.value;
  }

  async getElementText(elementId: string): Promise<string> {
    const response = await this.request<string>(
      'GET',
      this.sessionPath(`/element/${elementId}/text`),
    );
    return response.value;
  }

  async getElementRect(elementId: string): Promise<ElementRect> {
    const response = await this.request<ElementRect>(
      'GET',
      this.sessionPath(`/element/${elementId}/rect`),
    );
    return response.value;
  }

  async getElementAttributes(elementId: string): Promise<ElementAttributes> {
    const [rect, enabled, visible, type, label, name, value] =
      await Promise.all([
        this.getElementRect(elementId),
        this.getElementAttribute(elementId, 'enabled'),
        this.getElementAttribute(elementId, 'visible'),
        this.getElementAttribute(elementId, 'type'),
        this.getElementAttribute(elementId, 'label'),
        this.getElementAttribute(elementId, 'name'),
        this.getElementAttribute(elementId, 'value'),
      ]);

    return {
      type: type ?? 'Unknown',
      label,
      name,
      value,
      rect,
      enabled: enabled === 'true',
      visible: visible === 'true',
      accessible: true,
    };
  }

  // ── Actions ──

  async tap(x: number, y: number): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/tap/0'), {
      x,
      y,
    });
  }

  async tapElement(elementId: string): Promise<void> {
    await this.request(
      'POST',
      this.sessionPath(`/element/${elementId}/click`),
    );
  }

  async swipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration?: number,
  ): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/dragfromtoforduration'), {
      fromX: startX,
      fromY: startY,
      toX: endX,
      toY: endY,
      duration: duration ?? 0.5,
    });
  }

  async typeText(text: string): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/keys'), {
      value: [...text],
    });
  }

  async clearElement(elementId: string): Promise<void> {
    await this.request(
      'POST',
      this.sessionPath(`/element/${elementId}/clear`),
    );
  }

  // ── App Management ──

  async launchApp(bundleId: string): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/apps/launch'), {
      bundleId,
    });
  }

  async terminateApp(bundleId: string): Promise<boolean> {
    const response = await this.request<boolean>(
      'POST',
      this.sessionPath('/wda/apps/terminate'),
      { bundleId },
    );
    return response.value;
  }

  async activateApp(bundleId: string): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/apps/activate'), {
      bundleId,
    });
  }

  async getAppState(bundleId: string): Promise<AppState> {
    const response = await this.request<number>(
      'POST',
      this.sessionPath('/wda/apps/state'),
      { bundleId },
    );
    return { state: response.value };
  }

  async listApps(
    appType: 'user' | 'system' = 'user',
  ): Promise<Array<Record<string, unknown>>> {
    const response = await this.request<Array<Record<string, unknown>>>(
      'POST',
      this.sessionPath('/wda/apps/list'),
      { applicationType: appType },
    );
    return response.value;
  }

  // ── Device Control ──

  async pressButton(name: string): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/pressButton'), {
      name,
    });
  }

  async lock(): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/lock'));
  }

  async unlock(): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/unlock'));
  }

  async isLocked(): Promise<boolean> {
    const response = await this.request<boolean>(
      'GET',
      this.sessionPath('/wda/locked'),
    );
    return response.value;
  }

  async getClipboard(): Promise<string> {
    const response = await this.request<string>(
      'POST',
      this.sessionPath('/wda/getPasteboard'),
      { contentType: 'plaintext' },
    );
    return Buffer.from(response.value, 'base64').toString('utf8');
  }

  async setClipboard(content: string): Promise<void> {
    await this.request('POST', this.sessionPath('/wda/setPasteboard'), {
      content: Buffer.from(content).toString('base64'),
      contentType: 'plaintext',
    });
  }

  async openUrl(url: string): Promise<void> {
    await this.request('POST', this.sessionPath('/url'), { url });
  }

  async getScreenInfo(): Promise<ScreenInfo> {
    const response = await this.request<ScreenInfo>(
      'GET',
      this.sessionPath('/wda/screen'),
    );
    return response.value;
  }

  async getDeviceInfo(): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>(
      'GET',
      this.sessionPath('/wda/device/info'),
    );
    return response.value;
  }

  async getBatteryInfo(): Promise<BatteryInfo> {
    const response = await this.request<BatteryInfo>(
      'GET',
      this.sessionPath('/wda/batteryInfo'),
    );
    return response.value;
  }

  async getPageSource(): Promise<string> {
    const response = await this.request<string>(
      'GET',
      this.sessionPath('/source'),
    );
    return response.value;
  }

  getDeviceId(): number | null {
    return this.deviceId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  close(): void {
    this.stopProxy();
    this.sessionId = null;
  }
}
