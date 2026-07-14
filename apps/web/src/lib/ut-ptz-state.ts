import { UT_CAMERA_FEEDS } from './video-config';

export type PtzAction = 'up' | 'down' | 'left' | 'right' | 'zoom-in' | 'zoom-out';

type CropRect = { x: number; y: number; w: number; h: number };

const crops = new Map<string, CropRect>();

const PTZ_ACTIONS: PtzAction[] = ['up', 'down', 'left', 'right', 'zoom-in', 'zoom-out'];

export function isPtzAction(value: string): value is PtzAction {
  return PTZ_ACTIONS.includes(value as PtzAction);
}

export function initUtPtzCrops() {
  for (const feed of UT_CAMERA_FEEDS) {
    if (!crops.has(feed.id)) {
      crops.set(feed.id, { ...(feed.crop ?? { x: 0, y: 0, w: 1, h: 1 }) });
    }
  }
}

export function getUtCrop(feedId: string): CropRect {
  return crops.get(feedId) ?? { x: 0, y: 0, w: 1, h: 1 };
}

export function applyUtPtzAction(action: PtzAction, feedId = 'close') {
  initUtPtzCrops();
  const crop = crops.get(feedId);
  if (!crop) return;

  const step = 0.04;
  const minSize = 0.15;

  switch (action) {
    case 'up':
      crop.y = Math.max(0, crop.y - step);
      break;
    case 'down':
      crop.y = Math.min(1 - crop.h, crop.y + step);
      break;
    case 'left':
      crop.x = Math.max(0, crop.x - step);
      break;
    case 'right':
      crop.x = Math.min(1 - crop.w, crop.x + step);
      break;
    case 'zoom-in': {
      const dw = crop.w * 0.08;
      const dh = crop.h * 0.08;
      crop.x = Math.min(Math.max(0, crop.x + dw / 2), 1 - minSize);
      crop.y = Math.min(Math.max(0, crop.y + dh / 2), 1 - minSize);
      crop.w = Math.max(minSize, crop.w - dw);
      crop.h = Math.max(minSize, crop.h - dh);
      break;
    }
    case 'zoom-out': {
      const dw = crop.w * 0.08;
      const dh = crop.h * 0.08;
      crop.x = Math.max(0, crop.x - dw / 2);
      crop.y = Math.max(0, crop.y - dh / 2);
      crop.w = Math.min(1 - crop.x, crop.w + dw);
      crop.h = Math.min(1 - crop.y, crop.h + dh);
      break;
    }
    default:
      break;
  }

  crops.set(feedId, crop);
}
