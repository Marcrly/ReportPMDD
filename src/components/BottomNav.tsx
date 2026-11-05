import { hrefFor, navigate, type Route } from '../lib/router';
import { IconCalendar, IconChart, IconFolder } from './Icons';

const ITEMS = [
  { key: 'calendar', label: 'Kalendarz', href: hrefFor.calendar(), Icon: IconCalendar },
  { key: 'analysis', label: 'Analiza', href: hrefFor.analysis(), Icon: IconChart },
  { key: 'data', label: 'Dane', href: hrefFor.data(), Icon: IconFolder },
] as const;

export function BottomNav({ route }: { route: Route }) {
  return (
    <nav className="bottom-nav" aria-label="Główna nawigacja">
      <div className="bottom-nav-inner">
        {ITEMS.map(({ key, label, href, Icon }) => {
          const active = route.name === key;
          return (
            <a
              key={key}
              href={href}
              className="nav-item"
              aria-current={active ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(href, true);
              }}
            >
              <span className="nav-icon">
                <Icon size={22} />
              </span>
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
