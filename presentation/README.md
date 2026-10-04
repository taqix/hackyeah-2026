# Movo — prezentacja HTML

8 slajdów w języku polskim, w motywie aplikacji Movo. Bez zależności i bez procesu budowania.

## Otwieranie

Otwórz `index.html` w przeglądarce lub uruchom z katalogu repozytorium:

```sh
python3 -m http.server 8080 --directory presentation
```

Następnie otwórz http://localhost:8080.

## Sterowanie

- Strzałki / Page Up / Page Down: poprzedni lub następny slajd.
- Home / End: pierwszy lub ostatni slajd.
- F: pełny ekran; N: notatki prowadzącego; O: spis slajdów.
- Na ekranie dotykowym: przesunięcie w poziomie.
- Adres z `#7` otwiera bezpośrednio slajd o odkrywaniu aktywności.
- Żaden slajd nie wymaga klikania.

## Edycja

Treść: `index.html`. Wygląd: `styles.css`. Nawigacja: `presentation.js`.

Motyw powtarza system projektowy aplikacji: kolory i skala typografii pochodzą z `apps/mobile/src/theme/tokens.ts`, a kroje (Bricolage Grotesque i Hanken Grotesk) leżą w `assets/fonts/` — te same pliki, których używa strona produktu.

Slajdy 4, 5 i 7 pokazują zrzuty ekranu z działającej aplikacji Movo (`assets/screens/`), zrobione na koncie demo z danymi testowymi. Interfejs aplikacji jest po angielsku; polska wersja jest wymieniona na slajdzie 8 jako dalszy krok. Żeby je odświeżyć, zrób nowe zrzuty w rozdzielczości 430 × 932 (gęstość 2× lub 3×) i zapisz pod tymi samymi nazwami: `home.png`, `calendar.png`, `coach.png`, `activities.png`.

Prezentacja nie zawiera slajdu o monetyzacji — model subskrypcyjny i poziom cen są założeniami do walidacji i zostały w notatkach prezentera, jako odpowiedź na ewentualne pytanie jury. Slajd 8 rozdziela to, co działa w prototypie, od zaplanowanych kroków. Statystyki na slajdzie 2 pochodzą z Eurobarometru Komisji Europejskiej (2022) oraz przeglądu Kidman i in. (2024); szczegółowe odniesienia są w notatkach prezentera.


## Eksport do PDF

W przeglądarce wybierz Drukuj → Zapisz jako PDF. CSS definiuje format 16:9 (1600 × 900 px), bez marginesów. Włącz grafikę tła, wyłącz nagłówki i stopki przeglądarki, zachowaj skalę 100%. Użyj rozmiaru strony z CSS, jeśli eksporter oferuje taką opcję. Eksport powinien zawierać dokładnie 8 stron, niezależnie od slajdu otwartego w podglądzie. Przyciski nawigacji i notatki nie są drukowane. Slajdy nie mają interaktywnych elementów ani linków.

Źródła porównania konkurencji (poza slajdami):
- https://www.hevyapp.com/features/workout-plan-generator/
- https://www.runna.com/features
- https://www.trainingpeaks.com/athlete-features/
- https://www.garmin.com/en-GB/garmin-technology/garmin-coach/


Pierwszy etap oceny odbywa się bez wystąpienia: slajdy opisują funkcje bez odwoływania się do narracji prowadzącego. Notatki w `notatki-prezentera.md` służą do ewentualnej prezentacji w finale.

Porównanie na slajdzie 6 ograniczono do Runna i Hevy. Runna synchronizuje treningi z kalendarzem, ale nie odczytuje zajętości użytkownika; godziny i przenoszenie sesji wymagają działania użytkownika. Hevy opisuje kalendarz historii treningów, bez synchronizacji z osobistym kalendarzem w sprawdzonych funkcjach. Runna ma czat wsparcia, lecz zmiany planu dokumentuje przez ustawienia i gotowe opcje.

Dodatkowe źródła:
- https://support.runna.com/en/articles/8601606-syncing-runna-to-your-calendar-scheduling-your-workouts
- https://support.runna.com/en/articles/10137793-how-to-use-your-training-calendar
- https://support.runna.com/en/articles/10393191-how-to-use-training-preferences
- https://www.hevyapp.com/features/gym-progress/
- https://help.hevyapp.com/hc/en-us/articles/43652076665239-What-is-the-Hevy-App-on-ChatGPT
- https://support.strava.com/hc/en-us/articles/15401576-strava-and-runna-subscription-faqs
