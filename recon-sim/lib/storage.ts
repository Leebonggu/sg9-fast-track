import { ProjectData } from './types';
import { SG9_DEFAULT } from './defaults';

const KEY = 'recon-sim-project-v1';

export function saveProject(data: ProjectData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
}

export function loadProject(): ProjectData {
  if (typeof window === 'undefined') return SG9_DEFAULT;
  const raw = localStorage.getItem(KEY);
  if (!raw) return SG9_DEFAULT;
  try {
    return JSON.parse(raw) as ProjectData;
  } catch {
    return SG9_DEFAULT;
  }
}

export function clearProject(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
