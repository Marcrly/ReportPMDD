export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled';

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari na iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function canShareFiles(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Przekazuje plik użytkowniczce.
 * Na iPhonie pobieranie w aplikacji z ekranu głównego bywa zawodne, więc używamy
 * arkusza udostępniania (tam jest "Zachowaj w Plikach"). Na Androidzie i komputerze
 * zwykłe pobieranie zapisuje plik w folderze Pobrane.
 * Uwaga: wywołuj synchronicznie w obsłudze kliknięcia (bez await przed tą funkcją).
 */
export async function deliverFile(file: File, preferShare = isIOS()): Promise<DeliveryResult> {
  if (preferShare && canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Inny błąd (np. brak gestu użytkownika): spróbuj zwykłego pobierania.
    }
  }
  downloadFile(file);
  return 'downloaded';
}
