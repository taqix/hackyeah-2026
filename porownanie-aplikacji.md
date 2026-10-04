# Nasza aplikacja a Hevy, Runna, TrainingPeaks i Garmin Connect

Porównanie z perspektywy osoby, która dopiero zaczyna ćwiczyć.

## Główna idea

Proponowane pozycjonowanie naszej aplikacji:

> Pomagamy ci zacząć ćwiczyć i utrzymać regularność. Wiesz, co zrobić dzisiaj, nawet gdy masz mało czasu albo wypadniesz z rytmu.

Opis naszej aplikacji nie jest jeszcze zapisany w repozytorium. Dlatego jej zachowania opisane poniżej są **propozycją kierunku produktu**, a nie listą potwierdzonych, wdrożonych funkcji. Informacje o konkurencji sprawdzono 4 października 2026 r.

## Porównanie

| Aplikacja | Co oferuje | Co to oznacza dla początkującego | Proponowany kierunek naszej aplikacji |
|---|---|---|---|
| **Hevy** | Dziennik treningu siłowego i śledzenie postępów. Hevy Trainer generuje program według celu, doświadczenia, sprzętu i dostępnego czasu oraz dostosowuje ciężary do wyników. | Pomaga rozpocząć trening siłowy i śledzić postępy. Nie można sprowadzać jej do samego zapisywania serii. | Pomoc w wyborze prostego ruchu na dziś: spaceru, ćwiczeń w domu lub treningu siłowego, zależnie od możliwości użytkownika. |
| **Runna** | Personalizowane plany biegowe, adaptacja do wyników i możliwość ograniczenia treningu przy gorszym samopoczuciu lub napiętym grafiku. | Daje strukturę osobie, która chce zacząć lub rozwijać bieganie. Elastyczność planu już jest częścią oferty. | Pomoc osobie, która nie wybrała jeszcze konkretnego sportu i chce zbudować zwyczaj regularnego ruchu. |
| **TrainingPeaks** | Planowanie wielu sportów, analiza danych i obciążeń, integracje z urządzeniami oraz współpraca z trenerem. | Pozwala realizować plan i obserwować postępy w rozbudowanym środowisku treningowym. | Krótkie, zrozumiałe wskazówki: co zrobić dzisiaj i jak wrócić po przerwie, bez konieczności interpretowania wykresów. |
| **Garmin Connect** | Dane o zdrowiu i aktywności z urządzeń Garmin, plany Garmin Coach, a w Connect+ także interpretacja danych przez Active Intelligence. | Łączy obserwację aktywności z pomocą w treningu w ekosystemie Garmin. | Prosty start także dla osoby bez zegarka: deklarowany czas, możliwości i informacja, jak poszły ostatnie ćwiczenia. |

Ostatnia kolumna opisuje zamierzony sposób działania naszego produktu. **Nie oznacza, że konkurenci nie mają żadnych podobnych funkcji.**

Źródła: [Hevy Trainer](https://www.hevyapp.com/features/workout-plan-generator/), [Runna — funkcje](https://www.runna.com/features), [Runna — Not Feeling 100%](https://support.runna.com/en/articles/13531498-how-to-use-not-feeling-100), [TrainingPeaks — funkcje dla sportowców](https://www.trainingpeaks.com/athlete-features/), [Garmin Coach](https://www.garmin.com/en-GB/garmin-technology/garmin-coach/), [Garmin Connect+](https://www.garmin.com/en-CA/p/1565777/).

## Przykłady dla początkujących

### 1. „Chcę zacząć się ruszać, ale nie wiem od czego”

Proponowane zachowanie: aplikacja pyta o dostępny czas, doświadczenie i preferencje, a następnie proponuje prosty pierwszy tydzień, np. spacery i krótkie ćwiczenia w domu z dniami odpoczynku.

Wartość dla użytkownika: dostaje konkretny pierwszy krok, bez samodzielnego układania programu.

### 2. „Dzisiaj mam tylko 15 minut i nie mam sprzętu”

Proponowane zachowanie: aplikacja skraca zaplanowaną sesję i wybiera ćwiczenia możliwe do wykonania w domu.

Wartość dla użytkownika: może kontynuować plan mimo ograniczonego czasu.

### 3. „Opuściłem dwa treningi. Co teraz?”

Proponowane zachowanie: aplikacja dostosowuje dalszy tydzień, bez dokładania wszystkich opuszczonych sesji do najbliższego dnia.

Wartość dla użytkownika: wie, jak wrócić do regularności i od czego zacząć.

### 4. „Wczorajsze ćwiczenia były za trudne”

Proponowane zachowanie: po informacji od użytkownika aplikacja zmniejsza trudność kolejnej sesji, np. liczbę powtórzeń lub czas ćwiczeń, i wyjaśnia zmianę prostym językiem.

Wartość dla użytkownika: plan uwzględnia jego rzeczywiste możliwości.

## Scenariusz na demo

> „Chcę zacząć ćwiczyć dwa razy w tygodniu. Nie mam siłowni, a po pracy mam mało czasu. Aplikacja układa prosty plan. Kiedy opuszczę trening albo okaże się za trudny, pomaga mi zrobić kolejny krok”.

1. Użytkownik wybiera cel: „Chcę więcej się ruszać”.
2. Deklaruje dwa dni w tygodniu, po 20 minut, bez sprzętu.
3. Dostaje prosty plan i jasną instrukcję na dziś.
4. Zgłasza: „Dzisiaj mam tylko 10 minut”.
5. Aplikacja zmienia sesję i wyjaśnia, co dostosowała.
6. Po opuszczonym dniu użytkownik dostaje zaktualizowany kolejny krok.

## Co może nas wyróżnić

Hipoteza do sprawdzenia: **łatwiejszy start i podtrzymywanie regularnego ruchu u osób, które nie mają jeszcze sportowego celu, sprzętu ani nawyku ćwiczeń**.

Żeby tę różnicę udowodnić, demo powinno pokazać cały ciąg: prosty start → wykonalna aktywność → informacja od użytkownika → konkretna zmiana planu → łatwy powrót po przerwie. Trzeba też sprawdzić, czy początkujący rozumie instrukcje i potrafi przejść ten proces samodzielnie.

## Czego nie przedstawiać jako wyjątkowej przewagi

- **„Mamy personalizowane plany”** — konkurencja już je oferuje.
- **„Plan dostosowuje się do samopoczucia”** — Runna ma taką funkcję.
- **„Łączymy wiele sportów i dane w jednym miejscu”** — TrainingPeaks już to robi.
- **„Używamy AI do interpretacji danych”** — Garmin Connect+ oferuje Active Intelligence.
- **„Jesteśmy prostsi dla początkujących”** — to wymaga potwierdzenia w testach z użytkownikami.

## Propozycja krótkiego pitchu

> Budujemy aplikację dla osób, które chcą zacząć się ruszać, ale nie wiedzą, jak wpleść ćwiczenia w codzienność. Daje prosty plan na dziś i pomaga go dostosować, gdy brakuje czasu, ćwiczenia są za trudne albo pojawia się przerwa. Skupiamy się na pierwszych krokach i regularności.

Pitch opisuje zamierzony produkt. Przed prezentacją należy dopasować go do funkcji rzeczywiście działających w prototypie.
