import { IconPhone } from './Icons';

/** Numery wsparcia w Polsce (sprawdzone w listopadzie 2026). */
export function SupportNumbers() {
  return (
    <ul className="phone-list">
      <li>
        <IconPhone size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        <a href="tel:800702222">800 70 2222</a> Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym (całodobowo, bezpłatnie)
      </li>
      <li>
        <IconPhone size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        <a href="tel:116123">116 123</a> Kryzysowy Telefon Zaufania dla dorosłych
      </li>
      <li>
        <IconPhone size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        <a href="tel:112">112</a> w nagłym zagrożeniu życia
      </li>
    </ul>
  );
}
