import { createBackup } from '../lib/backup';
import { calendarToday } from '../lib/dates';
import { buildWorkbook } from '../lib/exporter';
import { deliverFile, type DeliveryResult } from '../lib/share';
import { XLSX_MIME } from '../lib/xlsx';
import { useToast } from '../components/ui';
import { useApp } from './AppContext';

/**
 * Eksport i kopia zapasowa. Plik powstaje synchronicznie w obsłudze kliknięcia,
 * bo iPhone pozwala otworzyć arkusz udostępniania tylko zaraz po geście użytkowniczki.
 */
export function useFileActions() {
  const { entries, meta, today, updateMeta } = useApp();
  const toast = useToast();

  const backup = (): Promise<DeliveryResult> => {
    const json = createBackup([...entries.values()], meta.customSymptoms, meta.cycleSettings);
    const file = new File([json], `reportpmdd-kopia-${calendarToday()}.json`, { type: 'application/json' });
    return deliverFile(file).then(async (res) => {
      if (res !== 'cancelled') {
        await updateMeta({ lastBackupAt: new Date().toISOString() });
        toast(res === 'shared' ? 'Kopia zapasowa gotowa' : 'Kopia zapisana w folderze Pobrane');
      }
      return res;
    });
  };

  const exportExcel = (): Promise<DeliveryResult> => {
    const bytes = buildWorkbook([...entries.values()], meta.customSymptoms, today, meta.cycleSettings);
    const file = new File([bytes as BlobPart], `reportpmdd-dziennik-${calendarToday()}.xlsx`, { type: XLSX_MIME });
    return deliverFile(file).then((res) => {
      if (res !== 'cancelled') toast(res === 'shared' ? 'Plik Excel gotowy' : 'Plik Excel zapisany w folderze Pobrane');
      return res;
    });
  };

  return { backup, exportExcel };
}
