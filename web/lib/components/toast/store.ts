import { writable } from 'svelte/store';

export const toast = writable<{
  message: string;
  duration: number;
} | null>(null);

export function showToast(message: string, duration = 1200) {
  toast.set({ message, duration });
}
