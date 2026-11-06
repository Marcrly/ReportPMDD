# ReportPMDD: dziennik objawów PMDD i PMS

Prywatna aplikacja na telefon do codziennego zapisywania objawów PMDD i PMS, śledzenia cyklu i przygotowania danych na wizytę u lekarza.

- **Kalendarz** jak w aplikacjach do śledzenia okresu: kolor dnia pokazuje nasilenie objawów, kropla to okres, kwiat to szacowana owulacja, przerywana ramka to prognoza okresu.
- **Wpis dnia** (najlepiej wieczorem): sen, aktywność fizyczna, krwawienie, potem pytania o PMDD (ciemna zieleń) i PMS (jasna zieleń).
- **Skala 1-5 + „ponad skalę”**: 1 = nie czułam, 5 = silnie, „ponad skalę” = nie do opisania. To dokładnie 6-stopniowa skala kwestionariusza DRSP, więc lekarz może od razu korzystać z Twoich danych.
- **Zdarzenie powiązane** przy każdym ocenionym objawie (także ocenionym na 1): zaznaczasz, że objaw mógł mieć przyczynę w wydarzeniu z życia, i dopisujesz, co to było.
- **Twój cykl**: wpisujesz średnią długość cyklu i okresu, a aplikacja podpowiada te wartości na podstawie ostatnich 4 cykli.
- **Automatyczny okres**: gdy zaznaczysz pierwszy dzień okresu (w kalendarzu przyciskiem „Zaznacz okres” albo we wpisie dnia), aplikacja sama zaznaczy kolejne dni według ustawionej długości okresu. Okres skrócisz przyciskiem „Skończył się wcześniej” (albo wybierając „Brak” we wpisie dnia) i przedłużysz przyciskiem „Przedłuż o 1 dzień”.
- **Analiza**: przebieg objawów dzień po dniu, porównanie „tydzień przed okresem a po okresie”, mapa objawów w cyklu, sen i aktywność, lista zdarzeń powiązanych.
- **Eksport do Excela** (.xlsx, 4 arkusze) i **kopia zapasowa** (.json) z przywracaniem.

## Skąd są pytania

| Sekcja | Zawartość | Źródło |
| --- | --- | --- |
| PMDD (ciemna zieleń) | 21 objawów + 3 pytania o wpływ na codzienność | DRSP, Daily Record of Severity of Problems (Endicott, Nee, Harrison, 2006). To kwestionariusz zalecany do codziennej oceny PMDD przez co najmniej 2 cykle. |
| PMS (jasna zieleń) | 10 częstych objawów fizycznych cyklu, których nie ma w DRSP (skurcze, ból pleców, nudności, skóra, obrzęki i inne) | Typowe listy objawów PMS |

Tłumaczenie DRSP na polski jest robocze (przygotowane dla tej aplikacji). W ustawieniach („Dane”, „Moje objawy”) możesz dodać własne objawy do dowolnej sekcji.

Analiza „przed okresem a po okresie” to uproszczona wersja metody C-PASS (Eisenlohr-Moul i in., 2017): porównuje dni -7 do -1 przed okresem z dniami 4 do 10 cyklu. **Aplikacja nie stawia diagnozy.** Pomaga zebrać dane i pokazać je lekarzowi.

## Dlaczego aplikacja webowa (PWA), a nie zwykła strona albo aplikacja ze sklepu

- Instaluje się z przeglądarki na ekran początkowy i działa jak zwykła aplikacja, także bez internetu.
- Nie wymaga konta, serwera ani publikacji w App Store czy Google Play.
- **Dane zdrowotne zostają tylko na Twoim telefonie.** Aplikacja nie wysyła ich nigdzie, a nagłówek bezpieczeństwa (Content-Security-Policy w `netlify.toml`) blokuje połączenia z innymi serwerami.
- Każdy wpis zapisuje się automatycznie w dwóch niezależnych miejscach przeglądarki (IndexedDB i kopia lustrzana). Przy starcie aplikacja porównuje oba i sama uzupełnia braki. Aplikacja nigdy sama nie usuwa danych, więc przechowuje je dowolnie długo, nie tylko 4 miesiące.

Jedyne realne ryzyka to: usunięcie ikony aplikacji z telefonu, wyczyszczenie danych przeglądarki albo utrata telefonu. Na to jest kopia zapasowa (aplikacja przypomina o niej co 7 dni).

## Wdrożenie na Netlify (jednorazowo, ok. 5 minut)

1. Wejdź na [app.netlify.com](https://app.netlify.com) i zaloguj się przez GitHub.
2. Wybierz **Add new project** (w starszym widoku: Add new site), potem **Import an existing project** i **GitHub**.
3. Wskaż repozytorium **Marcrly/ReportPMDD**. Ustawienia budowania Netlify odczyta sam z pliku `netlify.toml` (polecenie `npm run build`, folder `dist`), nic nie musisz wpisywać.
4. Kliknij **Deploy**. Po około minucie dostaniesz adres w stylu `https://nazwa.netlify.app`.
5. **Zanim zaczniesz robić wpisy**, ustal docelowy adres (Project configuration, Change project name, np. `moj-dziennik-pmdd`). Dane w telefonie są przypisane do adresu strony, więc po zmianie adresu aplikacja startowałaby od zera. Gdyby kiedyś trzeba było zmienić adres: zrób kopię zapasową, zainstaluj aplikację spod nowego adresu i przywróć kopię.

Koszty: według [cennika Netlify](https://www.netlify.com/pricing/) darmowy plan ma 300 kredytów miesięcznie, a jedno wdrożenie produkcyjne kosztuje 15 kredytów. Wdrożenie potrzebne jest tylko przy aktualizacji aplikacji, więc darmowy plan w zupełności wystarcza. Gdyby Netlify kiedyś wstrzymał stronę, zainstalowana aplikacja i tak działa z pamięci telefonu, a dane są bezpieczne.

## Instalacja na telefonie

Zrób to **przed pierwszym wpisem** i od tej pory otwieraj dziennik tylko ikoną z ekranu początkowego.

**iPhone (Safari):** otwórz adres aplikacji w Safari, stuknij Udostępnij (kwadrat ze strzałką), wybierz „Do ekranu początkowego”, potem „Dodaj”.

**Android (Chrome):** otwórz adres w Chrome, stuknij menu (trzy kropki) i wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”. Często Chrome sam pokaże przycisk instalacji.

> Na iPhonie aplikacja z ekranu początkowego ma osobny schowek danych niż Safari. Jeśli zrobisz wpisy w Safari, nie będzie ich w zainstalowanej aplikacji (i odwrotnie). Dlatego: najpierw instalacja, potem wpisy.

## Codzienne korzystanie

- Wypełniaj wpis wieczorem. Do 4:00 rano aplikacja nadal traktuje wpis jako dotyczący poprzedniego dnia.
- Przycisk „Pozostałe w tej sekcji: nie czułam (1)” uzupełnia jednym stuknięciem objawy, których nie było.
- Zapis jest automatyczny, przycisk „Gotowe” tylko wraca do kalendarza.
- Przypomnienie: ustaw codzienny alarm lub przypomnienie w telefonie (np. 21:00) i otwieraj dziennik ikoną z ekranu początkowego. Aplikacja bez serwera nie może sama wysyłać powiadomień.
- Raz w tygodniu: „Dane”, „Zrób kopię” i zapisz plik w iCloud Drive lub na Dysku Google.

## Co jest w pliku Excel

| Arkusz | Zawartość |
| --- | --- |
| Dziennik | Jeden wiersz na dzień: data, dzień cyklu, dni do okresu, faza cyklu, krwawienie, sen, aktywność, wszystkie oceny (pokolorowane według nasilenia), średnie PMDD i PMS, notatka |
| Zdarzenia powiązane | Data, objaw, ocena i opis zdarzenia |
| Cykle | Każdy okres: długość okresu i cyklu, szacowana owulacja, średnie przed i po okresie, liczba obszarów objawów wyraźnie silniejszych przed okresem |
| Legenda | Skala, sposób liczenia, źródła i pełna treść pytań |

## Ważne

- To narzędzie do samoobserwacji, nie do diagnozy. Do oceny PMDD zaleca się codzienne wpisy przez co najmniej 2 cykle i konsultację z lekarzem (psychiatrą lub ginekologiem).
- Owulacja jest szacowana kalendarzowo (14 dni przed kolejnym okresem). To przybliżenie, które nie nadaje się do antykoncepcji.

## Dla osoby technicznej

Stos: React 19, TypeScript, Vite 8, vite-plugin-pwa (Workbox), IndexedDB (`idb`) z kopią lustrzaną w localStorage, własny generator XLSX (`fflate`), wykresy w SVG bez bibliotek.

```bash
npm install
npm run dev        # serwer deweloperski
npm test           # testy jednostkowe (logika cyklu, analizy, zapisu, eksportu)
npm run build      # wersja produkcyjna w dist/
npm run icons      # ponowne wygenerowanie ikon (wymaga Playwright)
```

Test w prawdziwej przeglądarce (zapis, odświeżenie, utrata jednego magazynu, eksport, kopia, tryb offline):

```bash
npm run build && npx vite preview --port 4173
npm run smoke      # w drugim terminalu, wymaga Playwright z Chromium
```

Struktura:

```
src/lib/questionnaire.ts   pytania DRSP i PMS, skala
src/lib/cycles.ts          wykrywanie okresów, długość cyklu, prognoza, owulacja
src/lib/analysis.ts        średnie, porównanie przed/po okresie (C-PASS), sen i aktywność
src/lib/storage.ts         podwójny zapis (IndexedDB + localStorage) z samonaprawą
src/lib/backup.ts          kopia zapasowa: zapis, walidacja, scalanie
src/lib/exporter.ts        arkusze Excela, src/lib/xlsx.ts generator pliku .xlsx
src/styles/tokens.css      kolory, typografia, zaokrąglenia (szałwia i beż)
```

## Źródła

- Endicott J., Nee J., Harrison W. Daily Record of Severity of Problems (DRSP): reliability and validity. Archives of Women's Mental Health, 2006; 9(1): 41-49.
- Eisenlohr-Moul T.A. i in. Toward the Reliable Diagnosis of DSM-5 Premenstrual Dysphoric Disorder: The Carolina Premenstrual Assessment Scoring System (C-PASS). American Journal of Psychiatry, 2017; 174(1): 51-59.
- WebKit: Updates to Storage Policy (trwałe przechowywanie danych w Safari i aplikacjach z ekranu początkowego).
