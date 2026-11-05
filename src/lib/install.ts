import { useEffect, useState } from 'react';

/** Zdarzenie Chrome/Androida pozwalające pokazać własny przycisk "Zainstaluj". */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function useInstallPrompt(): { canPrompt: boolean; prompt: () => Promise<boolean> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    canPrompt: deferred !== null,
    prompt: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const choice = await deferred.userChoice;
      deferred = null;
      listeners.forEach((l) => l());
      return choice.outcome === 'accepted';
    },
  };
}

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export const INSTALL_STEPS: Record<Platform, string[]> = {
  ios: [
    'Otwórz tę stronę w Safari.',
    'Stuknij ikonę Udostępnij (kwadrat ze strzałką w górę).',
    'Wybierz „Do ekranu początkowego”, potem „Dodaj”.',
    'Od teraz otwieraj dziennik tylko z ikony na ekranie początkowym.',
  ],
  android: [
    'Otwórz tę stronę w Chrome.',
    'Stuknij menu (trzy kropki) w prawym górnym rogu.',
    'Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.',
    'Od teraz otwieraj dziennik z ikony na ekranie głównym.',
  ],
  desktop: [
    'W Chrome lub Edge kliknij ikonę instalacji na końcu paska adresu.',
    'Na telefonie otwórz ten sam adres i dodaj stronę do ekranu głównego.',
  ],
};
