import { ConfigService } from '@nestjs/config';

export type DeviceMode = 'simulator' | 'real';

export interface DeviceDefinition {
  name: string;
  type: string;
  connected: boolean;
  status: string;
  source: DeviceMode;
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
      { name: 'Video kamera 1 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 2 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 3 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Video kamera 4 (sim)', type: 'camera', connected: true, status: 'good', source: 'simulator' },
      { name: 'Mikrofon (sim)', type: 'audio', connected: true, status: 'good', source: 'simulator' },
      { name: 'Karnay (sim)', type: 'audio', connected: true, status: 'good', source: 'simulator' },
      { name: 'Internet (sim)', type: 'network', connected: true, status: 'good', source: 'simulator' },
    ];
  }
}

/** Haqiqiy qurilmalar ISO/IEEE 11073 gateway orqali ulanadi — hozircha bo'sh ro'yxat */
export class RealDeviceAdapter implements DeviceAdapter {
  readonly mode: DeviceMode = 'real';

  isSimulated() {
    return false;
  }

  getDefaultDevices(): DeviceDefinition[] {
    return [];
  }
}

export function createDeviceAdapter(config: ConfigService): DeviceAdapter {
  const mode = (config.get('DEVICE_MODE') || 'simulator') as DeviceMode;
  return mode === 'real' ? new RealDeviceAdapter() : new SimulatorDeviceAdapter();
}
