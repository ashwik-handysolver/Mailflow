import { useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'mailflow-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let current: ThemePreference = readThemePreference();

function apply() {
  const dark = current === 'dark' || (current === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141413' : '#f5f4f0');
}

// Applied once at load (index.html also sets it before first paint) and whenever the OS theme flips.
apply();
media.addEventListener('change', apply);

/** Theme preference for this device; "system" follows the OS. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>(current);
  const set = (next: ThemePreference) => {
    current = next;
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* storage blocked: still applies for this session */
    }
    apply();
    setPref(next);
  };
  return [pref, set] as const;
}
