import { type PlistValue } from '../plist/types';

export interface LockdownResponse {
  Request: string;
  Result?: string;
  Error?: string;
  Value?: unknown;
  SessionID?: string;
  EnableSessionSSL?: boolean;
  [key: string]: unknown;
}

export interface DeviceValues {
  DeviceName: string;
  ProductVersion: string;
  ProductType: string;
  ModelNumber: string;
  SerialNumber: string;
  UniqueDeviceID: string;
  BuildVersion: string;
  DeviceClass: string;
  HardwareModel: string;
  WiFiAddress?: string;
  BluetoothAddress?: string;
  CPUArchitecture?: string;
  [key: string]: unknown;
}

export interface PairRecord {
  HostID: string;
  SystemBUID: string;
  HostCertificate: Buffer;
  HostPrivateKey: Buffer;
  DeviceCertificate: Buffer;
  RootCertificate: Buffer;
  RootPrivateKey: Buffer;
  WiFiMACAddress?: string;
  EscrowBag?: Buffer;
  [key: string]: PlistValue | undefined;
}

export const LOCKDOWN_PORT = 62078;

export const LockdownRequestType = {
  QueryType: 'QueryType',
  GetValue: 'GetValue',
  Pair: 'Pair',
  ValidatePair: 'ValidatePair',
  StartSession: 'StartSession',
  StopSession: 'StopSession',
  StartService: 'StartService',
} as const;
