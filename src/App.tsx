import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { calendarToday } from './lib/dates';
import { useRoute } from './lib/router';
import { AppProvider, useApp } from './state/AppContext';
import { BottomNav } from './components/BottomNav';
import { LeafMark } from './components/Botanical';
import { ToastProvider, useToast } from './components/ui';
import { AnalysisView } from './views/AnalysisView';
import { CalendarView, type MonthState } from './views/CalendarView';
import { DataView } from './views/DataView';
import { DayView } from './views/DayView';
import { Onboarding } from './views/Onboarding';

export function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}

function Shell() {
  const { ready, meta } = useApp();
  const route = useRoute();
  const toast = useToast();
  const [intro, setIntro] = useState(false);
  const [month, setMonth] = useState<MonthState>(() => {
    const t = calendarToday();
    return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 };
  });

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Sprawdzaj aktualizacje co godzinę, gdy aplikacja jest otwarta.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast('Jest nowa wersja aplikacji. Twoje dane zostaną.', { label: 'Odśwież', run: () => void updateServiceWorker(true) }, 0);
    }
  }, [needRefresh, toast, updateServiceWorker]);

  if (!ready) {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }} aria-busy="true">
        <LeafMark size={48} />
      </div>
    );
  }

  const showOnboarding = !meta.onboardingDone || intro;

  return (
    <div className="app">
      {route.name === 'calendar' && <CalendarView month={month} setMonth={setMonth} />}
      {route.name === 'day' && <DayView key={route.date} date={route.date} />}
      {route.name === 'analysis' && <AnalysisView />}
      {route.name === 'data' && <DataView onShowIntro={() => setIntro(true)} />}
      {route.name !== 'day' && <BottomNav route={route} />}
      {showOnboarding && <Onboarding onDone={() => setIntro(false)} />}
    </div>
  );
}
