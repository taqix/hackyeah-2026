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
- Na slajdzie 8 przyciski zmieniają przykładowy plan.

## Edycja

Treść: `index.html`. Wygląd: `styles.css`. Nawigacja i scenariusze demo: `presentation.js`.

Slajd 9 jest zarezerwowany na business plan. Statystyki na slajdzie 2 pochodzą z materiałów zespołu i wymagają źródeł przed finalną prezentacją. Ekrany aplikacji oraz odpowiedzi demo to mockupy, nie działające integracje ani generator planu. Opis stanu produktu na slajdzie 10 dotyczy tej koncepcji; uzupełnij go zgodnie z faktycznym stanem prototypu.
