# Movo — mockup prezentacji HTML

10 slajdów w języku polskim, z logo zespołu. Bez zależności i bez procesu budowania.

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
- Adres z `#8` otwiera bezpośrednio slajd demo.
- Slajd 8 przedstawia statyczny przykład dostosowania; żaden slajd nie wymaga klikania.

## Edycja

Treść: `index.html`. Wygląd: `styles.css`. Nawigacja: `presentation.js`.

Slajd 9 zawiera model subskrypcyjny z 14-dniowym trialem i proponowane ceny z planu biznesowego zespołu. Ceny są założeniami do walidacji. Statystyki na slajdzie 2 pochodzą z materiałów zespołu i wymagają źródeł przed finalną prezentacją. Ekrany aplikacji oraz przykład dostosowania to mockupy, nie działające integracje ani generator planu. Opis stanu produktu na slajdzie 10 dotyczy tej koncepcji; uzupełnij go zgodnie z faktycznym stanem prototypu.


## Eksport do PDF

W przeglądarce wybierz Drukuj → Zapisz jako PDF. CSS definiuje format 16:9 (1600 × 900 px), bez marginesów. Włącz grafikę tła, wyłącz nagłówki i stopki przeglądarki, zachowaj skalę 100%. Użyj rozmiaru strony z CSS, jeśli eksporter oferuje taką opcję. Eksport powinien zawierać dokładnie 10 stron, niezależnie od slajdu otwartego w podglądzie. Przyciski nawigacji i notatki nie są drukowane. Slajdy nie mają interaktywnych elementów ani linków.

Źródła porównania konkurencji (poza slajdami):
- https://www.hevyapp.com/features/workout-plan-generator/
- https://www.runna.com/features
- https://www.trainingpeaks.com/athlete-features/
- https://www.garmin.com/en-GB/garmin-technology/garmin-coach/
