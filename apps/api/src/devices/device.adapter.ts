import { ConfigService } from '@nestjs/config';

export type DeviceMode = 'simulator' | 'real';

export interface DeviceDefinition {
  name: string;
  type: string;
  connected: boolean;
  status: string;
  source: DeviceMode;
  gatewayId?: string;
}

export interface DeviceAdapter {
  readonly mode: DeviceMode;
  getDefaultDevices(): DeviceDefinition[];
  isSimulated(): boolean;
}

export class SimulatorDeviceAdapter implements DeviceAdapter {
  readonly mode: DeviceMode = 'simulator';

  isSimulated() {
    return true;
  }

  getDefaultDevices(): DeviceDefinition[] {
    return [
      { name: 'EKG monitor (sim)', type: 'ekg', connected: true, status: 'good', source: 'simulator' },
      { name: 'Puls oksimetr (sim)', type: 'spo2', connected: true, status: 'good', source: 'simulator' },
      { name: 'Tonometr (sim)', type: 'bp', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 1 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 2 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 3 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 4 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Mikrofon (sim)', type: 'audio', connected: true, status: 'good', source: 'simulator' },
      { name: 'Internet (sim)', type: 'network', connected: true, status: 'good', source: 'simulator' },
    ];
  }
}

export class RealDeviceAdapter implements DeviceAdapter {
  readonly mode: DeviceMode = 'real';
  private readonly devices: DeviceDefinition[];

  constructor(config: ConfigService) {
    this.devices = RealDeviceAdapter.parseDevices(config);
  }

  isSimulated() {
    return false;
  }

  getDefaultDevices(): DeviceDefinition[] {
    return this.devices;
  }

  static parseDevices(config: ConfigService): DeviceDefinition[] {
    const raw = config.get('REAL_DEVICES_JSON');
    if (!raw?.trim()) {
      return RealDeviceAdapter.fallbackDevices();
    }
    try {
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return RealDeviceAdapter.fallbackDevices();
      }
      return parsed.map((item, index) => ({
        name: String(item.name || `Qurilma ${index + 1}`),
        type: String(item.type || 'sensor'),
        connected: item.connected !== false,
        status: String(item.status || 'good'),
        source: 'real' as DeviceMode,
        gatewayId: item.gatewayId ? String(item.gatewayId) : undefined,
      }));
    } catch {
      return RealDeviceAdapter.fallbackDevices();
    }
  }

  private static fallbackDevices(): DeviceDefinition[] {
    return [
      { name: 'EKG monitor', type: 'ekg', connected: false, status: 'offline', source: 'real' },
      { name: 'Puls oksimetr', type: 'spo2', connected: false, status: 'offline', source: 'real' },
      { name: 'Tonometr', type: 'bp', connected: false, status: 'offline', source: 'real' },
      { name: 'Termometr', type: 'temperature', connected: false, status: 'offline', source: 'real' },
      { name: 'Video kamera 1', type: 'camera', connected: false, status: 'offline', source: 'real' },
      { name: 'Video kamera 2', type: 'camera', connected: false, status: 'offline', source: 'real' },
      { name: 'Video kamera 3', type: 'camera', connected: false, status: 'offline', source: 'real' },
      { name: 'Video kamera 4', type: 'camera', connected: false, status: 'offline', source: 'real' },
    ];
  }
}

export function createDeviceAdapter(config: ConfigService): DeviceAdapter {
  const mode = (config.get('DEVICE_MODE') || 'simulator') as DeviceMode;
  return mode === 'real' ? new RealDeviceAdapter(config) : new SimulatorDeviceAdapter();
}
