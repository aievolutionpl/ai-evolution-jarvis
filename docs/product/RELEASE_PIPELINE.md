# AI Evolution Jarvis — pion E2E, instalatory i podpisywanie wydań

Dokument opisuje, jak build staje się wydaniem: co musi przejść, zanim
instalator trafi do użytkownika, i gdzie dokładnie ten proces się zatrzymuje,
jeżeli coś jest niekompletne.

Realizuje §12 (*Pakowanie i aktualizacje*) oraz kryteria odbioru §13 i §14.11
z `AI_EVOLUTION_JARVIS_DESIGN.md`.

## 1. Zasada

Wszystko przed bramką jest **best effort**. Podpisywanie pomija się, gdy nie ma
certyfikatu; noga platformy może zostać pominięta; build może wyprodukować mniej
targetów, niż zakładamy. To celowe — dzięki temu `npm run dist` działa lokalnie i
na forku bez sekretów.

Dokładnie ta elastyczność pozwoliłaby jednak wypuścić niepodpisany instalator.
Dlatego na końcu stoi jedna bramka, która nie jest best effort:
`verify-release-gate.mjs`. Przechodzi albo nie przechodzi.

## 2. Pion E2E

| Zakres | Gdzie działa | Blokuje |
| --- | --- | --- |
| `e2e/jarvis-shell-vertical.spec.ts` — powłoka produktu, nawigacja, Core, kontrakt layoutu §14.11 | każdy PR (`ci.yaml` → lane `e2e-jarvis`) | tak, przez `all-checks-pass` |
| pełny pakiet Playwright (`e2e/`) | wydanie (`release-desktop.yml` → job `e2e`) | tak, bramka nie rusza bez niego |
| pełny pakiet Playwright — regeneracja baseline'ów | `main` | nie |
| `install-e2e.yml` — realna ścieżka instalacji i aktualizacji | po opublikowaniu tagu, oraz co 12 h | osobny raport |

Pełny pakiet wizualny pozostaje wyłączony na PR-ach (`e2e-desktop: if: false`) —
jest zbyt niestabilny, żeby blokować każdy merge. Lane `e2e-jarvis` to ta jego
część, która nie może cicho się zepsuć: jeden spec, jeden baseline, bez
odziedziczonej flaky-ności.

Spec produktowy sprawdza w realnym oknie Electrona to, czego testy jsdom
zobaczyć nie mogą:

- powłoka **opakowuje** runtime Hermesa, a nie zastępuje go;
- każdy przycisk nawigacji zmienia zarówno stan powłoki, jak i trasę runtime'u;
- focus jest widoczny (policzony `outline`, nie zrzut ekranu);
- cele dotykowe mają ≥ 44 px;
- brak poziomego overflow przy 390, 768, 1150, 1440 i 2560 px.

## 3. Instalatory

`release-desktop.yml` buduje trzy nogi równolegle, z jawnie podanymi
architekturami — `macos-latest` jest arm64, więc samo `--mac` wyprodukowałoby
wyłącznie arm64, a bramka (słusznie) odrzuciłaby wydanie bez x64.

| Platforma | Runner | Targety |
| --- | --- | --- |
| Windows | `windows-latest` | `.exe` (NSIS), `.msi` |
| macOS | `macos-latest` | `.dmg` + `.zip` dla arm64 i x64 |
| Linux | `ubuntu-latest` | `.AppImage`, `.deb`, `.rpm` |

## 4. Podpisywanie

### Windows

`build.win.signAndEditExecutable = false` jest **load-bearing** — włączenie go
uruchamia ponownie ścieżkę signtool electron-buildera, która pobiera
`winCodeSign-2.6.0.7z`, a jego macOS-owe symlinki wywracają 7-Zip na Windows bez
uprawnień administratora. Tego nie odwracamy.

Dlatego podpisywanie jest osobnym krokiem **po** buildzie
(`scripts/sign-windows.mjs`), korzystającym z `signtool.exe` z Windows SDK, który
jest już na runnerze. Tryby, w kolejności pierwszeństwa:

| Tryb | Zmienne |
| --- | --- |
| Azure Trusted Signing | `AZURE_TRUSTED_SIGNING_ENDPOINT`, `_ACCOUNT`, `_CERT_PROFILE` + `AZURE_CLIENT_ID` / `_TENANT_ID` / `_CLIENT_SECRET` |
| plik `.pfx` | `WINDOWS_CERT_BASE64` + `WINDOWS_CERT_PASSWORD` |
| certyfikat ze store'a | `WINDOWS_CERT_SUBJECT` lub `WINDOWS_CERT_SHA1` |

Niekompletna konfiguracja Azure jest **błędem**, nie przejściem do kolejnego
trybu: wydanie, które po literówce w nazwie zmiennej po cichu zeszło z Trusted
Signing na „niepodpisane", to dokładnie ta awaria, której bramka ma zapobiegać.

Każdy podpis dostaje kontrasygnatę RFC 3161 (`/tr` + `/td sha256`). Bez niej
podpis wygasa razem z certyfikatem i każdy wcześniej wydany instalator zaczyna
pokazywać ostrzeżenie o nieznanym wydawcy.

### macOS

`afterSign` (`scripts/notarize.mjs`) notaryzuje pakiet `.app`. To jednak `.dmg`
użytkownik pobiera — a niestaplowany `.dmg` na maszynie offline nadal pokazuje
„nie można otworzyć, deweloper nie został zweryfikowany". `.dmg` powstaje *po*
`afterSign`, więc `scripts/notarize-release.mjs` notaryzuje i stapluje gotowe
artefakty, a następnie potwierdza to `stapler validate` — czyli sprawdzeniem
offline, że bilet naprawdę siedzi w pliku, który publikujemy.

| Zmienne | Tryb |
| --- | --- |
| `APPLE_NOTARY_PROFILE` | profil keychaina (lokalna maszyna wydaniowa) |
| `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER` | App Store Connect (CI) |
| `MACOS_CERT_BASE64` + `MACOS_CERT_PASSWORD` | certyfikat Developer ID do podpisu |

Certyfikat importowany jest do dedykowanego keychaina z losowym hasłem, który
umiera razem z runnerem — nigdy do keychaina logowania.

### Kiedy podpis jest wymagany

`HERMES_REQUIRE_SIGNING=1` ustawiane jest **wyłącznie** dla buildów z tagu. Dry
run (`workflow_dispatch`) na forku bez sekretów nadal produkuje instalatory —
niepodpisane, a bramka dostaje `--allow-unsigned`. Prawdziwe wydanie z źle
skonfigurowanym sekretem pada głośno.

## 5. Bramka wydania

`scripts/verify-release-gate.mjs` odrzuca wydanie, gdy:

- wersja w manifeście nie zgadza się z tagiem (build 0.17.2 otagowany jako
  0.18.0 jest dziś całkowicie cichy);
- brakuje wymaganego artefaktu `{platforma, typ}` — np. `.dmg` dla arm64;
- artefakt podlegający podpisowi nie jest podpisany;
- suma kontrolna nie zgadza się z plikiem na dysku;
- artefakt jest podejrzanie mały (ucięty upload ma poprawną sumę kontrolną
  samego siebie — suma tego nie wykryje, rozmiar tak).

Raportuje **wszystkie** problemy naraz, nie pierwszy z brzegu.

Stan podpisu nie jest zgadywany z nazwy pliku. Pochodzi z raportów, które
zapisały kroki podpisujące (`.signing-report.json`, `.notarization-report.json`)
i które `release-manifest.mjs` wkłada do manifestu. Brak raportu = artefakt
niepodpisany = wydanie nie przechodzi.

Bramka biegnie dwa razy: raz per noga (na runnerze, który ma log builda
tłumaczący *dlaczego*), i raz zbiorczo na pobranych artefaktach — bo przejście
per noga mówi, że build był dobry, a dopiero przebieg zbiorczy mówi, że
**wydanie** jest kompletne.

## 6. Publikacja

Release powstaje jako **draft**. Publikacja to decyzja człowieka — i to ona
odpala `install-e2e.yml` (`push: tags`), czyli test, czy użytkownicy starszych
wersji potrafią się na tę zaktualizować.

Do releasu trafiają `SHA256SUMS.txt` (zgodny z `sha256sum -c`) oraz
`release-manifest.json` z platformą, architekturą i stanem podpisu każdego
zasobu. Raporty podpisywania nie są publikowane — to buchalteria builda, już
zwinięta do manifestu.

## 7. Lokalnie

```bash
cd apps/desktop

npm run dist:linux          # zbuduj
npm run release:gate:dry    # manifest + bramka, bez wymogu podpisu

npm run sign:win            # Windows, jeżeli masz certyfikat
npm run sign:mac            # macOS, jeżeli masz poświadczenia Apple
npm run release:manifest
npm run release:gate
```

## 8. Do dorobienia

- **Attestacja SLSA.** `actions/attest-build-provenance` odpowiada na pytanie
  „czy ten instalator naprawdę powstał z tego repo, z tego commita?", czego suma
  kontrolna nie potrafi. Krok nie został dodany, bo wymaga przypięcia akcji do
  zweryfikowanego SHA — do zrobienia przy najbliższej aktualizacji pinów.
- **Środowisko `release-signing`.** Sekrety podpisywania powinny leżeć w
  chronionym środowisku z wymaganymi recenzentami. Job `build` celowo go jeszcze
  nie wskazuje: job przypięty do nieistniejącego chronionego środowiska blokuje
  każdy dry run. Po utworzeniu środowiska wystarczy dodać
  `environment: release-signing`.
