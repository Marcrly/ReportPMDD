import { formatShort, plural } from '../lib/dates';
import { hasDataBesidesFlow, planEndPeriod, planExtendPeriod, planFlowChange, type ActivePeriod, type FlowChange } from '../lib/periods';
import type { Flow, ISODate } from '../lib/types';
import { useToast } from '../components/ui';
import { useApp } from './AppContext';

/** Zaznaczanie, skracanie i przedłużanie okresu (z automatycznym dopisywaniem dni). */
export function usePeriodActions() {
  const { entries, updateEntry, deleteEntry, info, cycleSettings } = useApp();
  const toast = useToast();
  /** Standardowa długość okresu: ta sama, którą pokazuje karta "Twój cykl". */
  const periodLength = info.prediction?.periodLength ?? cycleSettings.periodLength;

  const apply = (changes: FlowChange[]) => {
    for (const c of changes) {
      const e = entries.get(c.date);
      // Dzień, w którym poza krwawieniem nic nie ma, po odznaczeniu znika całkiem.
      if (c.flow === undefined && !hasDataBesidesFlow(e)) {
        if (e) void deleteEntry(c.date);
        continue;
      }
      updateEntry(c.date, (cur) => {
        const next = { ...cur, flow: c.flow };
        if (c.flow === undefined) delete next.flow;
        if (c.periodAuto) next.periodAuto = true;
        else delete next.periodAuto;
        return next;
      });
    }
  };

  /** Ustawia krwawienie w danym dniu i automatycznie uzupełnia lub kończy okres. */
  const setFlow = (date: ISODate, flow: Flow | undefined, lengthOverride?: number) => {
    const changes = planFlowChange(entries, date, flow, lengthOverride ?? periodLength);
    apply(changes);
    const added = changes.filter((c) => c.periodAuto);
    const removed = changes.filter((c) => c.date !== date);
    if (added.length) {
      const last = added[added.length - 1].date;
      toast(
        `Zaznaczono okres: ${added.length + 1} ${plural(added.length + 1, ['dzień', 'dni', 'dni'])}, do ${formatShort(last)}. Możesz go skrócić lub przedłużyć.`,
        { label: 'Cofnij', run: () => apply(added.map((c) => ({ date: c.date, flow: undefined, periodAuto: false }))) },
        7000,
      );
    } else if (removed.length) {
      const n = removed.length;
      toast(
        `Okres zakończony. Usunięto ${n} ${plural(n, ['dzień', 'dni', 'dni'])} ${plural(n, ['zaznaczony', 'zaznaczone', 'zaznaczonych'])} automatycznie.`,
      );
    }
  };

  const endPeriod = (period: ActivePeriod, lastDay: ISODate) => {
    const changes = planEndPeriod(entries, period, lastDay);
    apply(changes);
    toast(`Okres zakończony ${formatShort(lastDay)}.`);
  };

  const extendPeriod = (period: ActivePeriod) => {
    const changes = planExtendPeriod(period);
    apply(changes);
    toast(`Okres przedłużony do ${formatShort(changes[0].date)}.`);
  };

  return { periodLength, setFlow, endPeriod, extendPeriod };
}
