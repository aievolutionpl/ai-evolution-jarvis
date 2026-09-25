<div align="center">

# AI Evolution Jarvis

### Prywatny asystent AI, który rozmawia, pamięta i wykonuje zadania

[![Status](https://img.shields.io/badge/status-P0%20preview-00E7FF?style=for-the-badge)](https://github.com/aievolutionpl/ai-evolution-jarvis/tree/feature/ai-evolution-jarvis-p0-ui)
[![Desktop](https://img.shields.io/badge/desktop-Electron-7CFF1E?style=for-the-badge&logo=electron&logoColor=111111)](apps/desktop)
[![License](https://img.shields.io/badge/licencja-MIT-white?style=for-the-badge)](LICENSE)
[![Powered by Hermes](https://img.shields.io/badge/powered%20by-Hermes%20Agent-7C3AED?style=for-the-badge)](https://github.com/NousResearch/hermes-agent)

**Jeden interfejs do rozmowy głosowej, automatyzacji, narzędzi, pamięci i codziennej pracy z AI.**

[Zakres wersji P0](docs/product/AI_EVOLUTION_JARVIS_P0_UI_IMPLEMENTATION_PLAN.md) · [Architektura produktu](docs/product/AI_EVOLUTION_JARVIS_DESIGN.md) · [Aplikacja desktopowa](apps/desktop)

</div>

---

## Czym jest AI Evolution Jarvis?

AI Evolution Jarvis to prywatny, instalowalny asystent AI z natywnym interfejsem desktopowym. Łączy wygodę rozmowy tekstowej i głosowej z pełnymi możliwościami agenta: wykonywaniem narzędzi, pamięcią, zadaniami cyklicznymi, pracą na plikach oraz obsługą wielu modeli AI.

Sercem produktu jest **Hermes Agent**. Jarvis nie tworzy drugiego backendu ani alternatywnej pętli agenta — rozbudowuje istniejący silnik Hermesa o dopracowane doświadczenie produktowe AI Evolution.

## Najważniejsze możliwości

- 🎙️ **Rozmowa głosowa** — słuchanie, odtwarzanie odpowiedzi i osobne sterowanie zadaniem oraz dźwiękiem.
- ⚡ **Głos Live (OpenAI Realtime)** — opcjonalnie naturalna rozmowa z najnowszym głosem GPT Realtime, w którą można wejść w słowo; każde polecenie i tak wykonuje Jarvis w tej samej sesji.
- 🧠 **Pamięć między sesjami** — Jarvis korzysta z pamięci, profili i umiejętności Hermesa.
- 🛠️ **Realne wykonywanie zadań** — narzędzia, terminal, pliki, przeglądarka, research i automatyzacje.
- 📊 **Dashboard aktywności** — czytelny stan planowania, wykonywania, oczekiwania na zgodę i wyników.
- 🔮 **Pulpit z żywym rdzeniem** — orb Jarvisa (sieć cząsteczek z połączeniami i „elektronami” w trakcie pracy) reaguje na mikrofon i stan zadania, obok powitanie, trzy szybkie polecenia, AI News Live i lista agentów.
- 🌐 **OpenRouter w jednym kroku** — wklejasz klucz i od razu pracujesz na **DeepSeek V4.1 Flash**; gotowe zestawy GPT, Claude, Gemini, Hermes i darmowy model oraz tryby pracy Szybki / Zrównoważony / Głęboki.
- 🔐 **Bezpieczny onboarding** — konfiguracja profilu, modelu, głosu i poziomu zatwierdzania bez zapisywania kluczy API w stanie UI.
- 🔄 **Profile i połączenia** — obsługa lokalnego runtime oraz zdalnych instancji Hermesa z izolacją danych.
- 🌍 **Interfejs PL / EN / ZH** — polski jest pełnoprawnym językiem produktu.
- ♿ **Dostępność i responsive UI** — obsługa klawiatury, reduced motion i interfejs od telefonu po szeroki ekran.

## Jak wygląda architektura?

```text
┌─────────────────────────────────────────────┐
│            AI Evolution Jarvis              │
│  dashboard · głos · onboarding · ustawienia │
└──────────────────────┬──────────────────────┘
                       │ istniejący Gateway API
┌──────────────────────▼──────────────────────┐
│                Hermes Agent                 │
│ agent loop · pamięć · skills · tools · cron │
└──────────────────────┬──────────────────────┘
                       │
            modele i usługi użytkownika
```

**Granice są celowe:**

- Electron odpowiada za okno, system operacyjny, instalację i bezpieczne możliwości natywne.
- React odpowiada za interfejs i stan prezentacji.
- Hermes Agent pozostaje jedynym źródłem prawdy dla sesji, narzędzi, modeli i wykonywanej pracy.

## Status projektu

Aktualna gałąź produktu:

```text
feature/ai-evolution-jarvis-p0-ui
```

Zaimplementowane i zweryfikowane elementy P0:

- reaktywny Jarvis Core i motyw AI Evolution,
- projekcja prawdziwych eventów Hermesa,
- nawigacja i shell produktu,
- dashboard rozmowy oraz aktywności,
- rozdzielone sterowanie mikrofonem, odtwarzaniem i anulowaniem zadania,
- bezpieczny, resumowalny onboarding,
- branding, About, własny protokół aplikacji i nazewnictwo artefaktów,
- produkcyjny build oraz pakiet Linux x64.

> **Uwaga:** to wersja rozwojowa P0. Instalatory dla Windows, macOS i Linux publikujemy w sekcji [Releases](https://github.com/aievolutionpl/ai-evolution-jarvis/releases) — sposób instalacji opisuje sekcja niżej.

## Prosta instalacja

### Jednym poleceniem (zalecane)

Skrypt sam wybiera plik dla Twojego systemu z najnowszego wydania, instaluje aplikację bez uprawnień administratora i ją uruchamia.

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/aievolutionpl/ai-evolution-jarvis/main/scripts/install-jarvis.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/aievolutionpl/ai-evolution-jarvis/main/scripts/install-jarvis.ps1 | iex
```

Dodaj `--dry-run` (Linux/macOS) lub `-DryRun` (Windows), żeby tylko zobaczyć, co zostanie pobrane. `--version v0.17.2` / `-Version v0.17.2` instaluje konkretne wydanie.

### Pierwsze uruchomienie w 2 minuty

1. **Silnik** — w kroku „Silnik” wklej klucz z [openrouter.ai/keys](https://openrouter.ai/keys) i kliknij **Połącz**. Jarvis zapisze klucz na tym komputerze i od razu wybierze **DeepSeek V4.1 Flash** jako model do pracy.
2. **Model** — kliknij „Sprawdź konfigurację”. Model zmienisz później jednym kliknięciem w karcie **Model i tryb** (GPT, Claude, Gemini, Hermes, darmowy) albo w menu modelu przy polu wiadomości.
3. **Głos** — wybierz *Cichy*, *Mówiony* albo **Live (OpenAI Realtime)**. Tryb Live potrzebuje klucza OpenAI (`OPENAI_API_KEY`) — możesz go wkleić od razu w tym kroku.
4. **Dostępy, Komputer, Zgody** — zatwierdź i gotowe.

Klucz OpenRouter wkleisz też później w prawym panelu pulpitu (karta **Model i tryb**), jeśli pominiesz go w kreatorze.

Ustawienia głosu Live w `config.yaml`:

```yaml
voice:
  engine: realtime          # classic = STT → agent → TTS
  realtime:
    model: gpt-realtime     # albo przypięta wersja, np. gpt-realtime-2.1 / gpt-realtime-2.1-mini
    voice: marin
    language: pl
```

Klucz OpenAI zostaje w backendzie — aplikacja dostaje tylko krótkotrwały klucz sesji.

### Ręcznie z Releases

Trzy drogi, wszystkie kończą się tak samo: ikona na pulpicie i działająca aplikacja.

| System | Co pobrać | Co się dzieje |
| --- | --- | --- |
| **Windows** | `AI-Evolution-Jarvis-<wersja>-win-x64.exe` | Instalator po polsku, bez uprawnień administratora (instalacja dla użytkownika). Tworzy ikonę na pulpicie i wpis w menu Start, a po zakończeniu od razu uruchamia aplikację. |
| **macOS** | `AI-Evolution-Jarvis-<wersja>-mac-<arch>.dmg` | Przeciągnij aplikację do folderu `Programy`. Na macOS ikony na pulpicie nie tworzą się automatycznie — jeśli jej chcesz, użyj przycisku w ustawieniach (niżej). |
| **Linux** | `.AppImage`, `.deb` lub `.rpm` | AppImage wystarczy oznaczyć jako wykonywalny i uruchomić; `.deb`/`.rpm` instalują też wpis w menu aplikacji. Ikona na pulpicie pojawia się przy pierwszym uruchomieniu. |

Wydania: [Releases](https://github.com/aievolutionpl/ai-evolution-jarvis/releases).

### Ikona na pulpicie

Aplikacja sama zakłada ikonę **przy pierwszym uruchomieniu** — raz na instalację, na Windowsie i Linuksie. Robi to sama aplikacja, a nie instalator, więc ikonę dostaniesz też z AppImage, z archiwum ZIP i z lokalnego builda.

Jeśli ikony nie ma (usunąłeś ją, aplikacja zmieniła miejsce, macOS): **Ustawienia → Zaawansowane → Ikona na pulpicie → Utwórz ikonę**. Ten sam ekran pokazuje dokładną ścieżkę, pod którą ikona została zapisana.

Jeśli usuniesz ikonę, aplikacja jej nie przywróci sama — jedno automatyczne utworzenie na instalację i tyle.

## Uruchomienie deweloperskie

### Wymagania

- Node.js i npm,
- Python 3.11+,
- działający runtime Hermes Agent.

### Instalacja zależności

```bash
git clone https://github.com/aievolutionpl/ai-evolution-jarvis.git
cd ai-evolution-jarvis
npm install
```

### Start aplikacji desktopowej

```bash
cd apps/desktop
npm run dev
```

### Build produkcyjny

```bash
cd apps/desktop
npm run build
npm run pack
```

Rozpakowana aplikacja trafia do:

```text
apps/desktop/release/<platform>-unpacked/
```

## Weryfikacja

Najważniejsze komendy jakościowe dla aplikacji desktopowej:

```bash
cd apps/desktop
npm run typecheck
npm run lint
npm run test:ui
npm run test:desktop:platforms
npm run test:desktop:all
```

Pełny gate obejmuje TypeScript, lint, testy UI, testy Electron, build produkcyjny oraz walidację spakowanej aplikacji.

## Roadmapa

### P0 — produktowy interfejs Jarvisa

- [x] Jarvis Core i system stanów
- [x] Dashboard oraz aktywność narzędzi
- [x] Sterowanie głosem i zadaniami
- [x] Bezpieczny onboarding
- [x] Branding i packaging
- [ ] Pełny pion E2E i release gate
- [ ] Instalatory i podpisywanie wydań

### Kolejny etap

- routing Economy / Balanced / Premium,
- OpenRouter oraz TypeSafe JEV jako szybka warstwa decyzyjna,
- personalizacja głosu, wyglądu, modeli i zachowania,
- dalsze usprawnienia mobilne i tabletowe.

## Bezpieczeństwo

- Klucze API nie są przechowywane w stanie onboardingu ani w localStorage.
- Zmiana profilu lub połączenia nie może przenosić stanu do innego scope.
- Operacje wymagające zgody przechodzą przez istniejący approval engine Hermesa.
- Jarvis nie dodaje drugiego agenta ani niezależnego WebSocket runtime. Opcjonalny głos Live to tylko warstwa mowy: każde polecenie trafia do tej samej sesji Hermesa.

## Licencja i atrybucja

AI Evolution Jarvis jest rozwijany przez **AI Evolution** jako produkt oparty na projekcie open source **Hermes Agent** od [Nous Research](https://nousresearch.com).

Projekt zachowuje licencję [MIT](LICENSE), informacje o prawach autorskich oraz atrybucję upstream. Szczegóły implementacji desktopowej znajdują się w [apps/desktop/README.md](apps/desktop/README.md).

---

<div align="center">

**AI Evolution Jarvis**

*Twój prywatny agent. Jedno miejsce. Realna praca.*

[GitHub](https://github.com/aievolutionpl/ai-evolution-jarvis) · [Issues](https://github.com/aievolutionpl/ai-evolution-jarvis/issues) · [Hermes Agent](https://github.com/NousResearch/hermes-agent)

</div>
