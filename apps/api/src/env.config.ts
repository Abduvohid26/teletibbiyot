import { existsSync } from 'fs';
import { join } from 'path';

/** Monorepo root `.env` — yagona manba */
export function resolveRootEnvPath(): string | undefined {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '../../.env'),
    join(__dirname, '../../../.env'),
    join(__dirname, '../../../../.env'),
  ];
  return candidates.find((p) => existsSync(p));
}
