#!/usr/bin/env bash
# AI Evolution Jarvis — instalacja jednym poleceniem (Linux i macOS).
#
#   curl -fsSL https://raw.githubusercontent.com/aievolutionpl/ai-evolution-jarvis/main/scripts/install-jarvis.sh | bash
#
# Pobiera najnowsze wydanie z GitHub Releases dla tego systemu i architektury,
# instaluje aplikację bez uprawnień administratora i ją uruchamia. Ikonę na
# pulpicie aplikacja zakłada sama przy pierwszym starcie (docs/product/
# AI_EVOLUTION_JARVIS_DESIGN.md §12), więc skrypt jej nie dubluje.
#
# Opcje:
#   --version TAG   konkretne wydanie zamiast najnowszego (np. v0.17.2)
#   --no-launch     nie uruchamiaj aplikacji po instalacji
#   --dry-run       pokaż, co zostałoby pobrane i gdzie, bez zmian na dysku
#
# Zmienne (dla testów i luster):
#   JARVIS_REPO           właściciel/repozytorium (domyślnie aievolutionpl/ai-evolution-jarvis)
#   JARVIS_RELEASE_JSON   ścieżka do zapisanej odpowiedzi API wydania zamiast zapytania sieciowego
#   JARVIS_OS / JARVIS_ARCH  wymuszenie platformy (linux|mac, x64|arm64)

set -euo pipefail

REPO="${JARVIS_REPO:-aievolutionpl/ai-evolution-jarvis}"
VERSION="latest"
LAUNCH=1
DRY_RUN=0
APP_NAME="AI Evolution Jarvis"
APP_ID="pl.aievolution.jarvis"

say() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --version) VERSION="${2:?--version wymaga wartości}"; shift 2 ;;
        --no-launch) LAUNCH=0; shift ;;
        --dry-run) DRY_RUN=1; shift ;;
        -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) fail "Nieznana opcja: $1" ;;
    esac
done

detect_os() {
    if [ -n "${JARVIS_OS:-}" ]; then printf '%s' "$JARVIS_OS"; return; fi
    case "$(uname -s)" in
        Linux) printf 'linux' ;;
        Darwin) printf 'mac' ;;
        *) fail "Ten skrypt obsługuje Linux i macOS. Na Windowsie użyj install-jarvis.ps1." ;;
    esac
}

detect_arch() {
    if [ -n "${JARVIS_ARCH:-}" ]; then printf '%s' "$JARVIS_ARCH"; return; fi
    case "$(uname -m)" in
        x86_64|amd64) printf 'x64' ;;
        arm64|aarch64) printf 'arm64' ;;
        *) fail "Nieobsługiwana architektura: $(uname -m)" ;;
    esac
}

release_json() {
    if [ -n "${JARVIS_RELEASE_JSON:-}" ]; then
        cat "$JARVIS_RELEASE_JSON"
        return
    fi

    local url
    if [ "$VERSION" = "latest" ]; then
        url="https://api.github.com/repos/$REPO/releases/latest"
    else
        url="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
    fi

    curl -fsSL -H 'Accept: application/vnd.github+json' "$url" \
        || fail "Nie udało się pobrać informacji o wydaniu ($url)."
}

# Every download URL in the release, one per line. The API answers with
# compact JSON (many assets on one line), so match each field on its own.
# grep + sed only: the script needs nothing beyond curl and coreutils.
asset_urls() {
    grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*"' \
        | sed 's/.*:[[:space:]]*"\([^"]*\)"$/\1/' || true
}

# The first URL matching an extended regex, or nothing.
pick_asset() {
    grep -E -e "$1" | head -1 || true
}

OS="$(detect_os)"
ARCH="$(detect_arch)"
URLS="$(release_json | asset_urls)"
[ -n "$URLS" ] || fail "Wydanie nie zawiera plików do pobrania."

if [ "$OS" = "linux" ]; then
    # AppImage works on every distribution without root; x86_64 is
    # electron-builder's other spelling of x64.
    if [ "$ARCH" = "x64" ]; then arch_re='(x64|x86_64|amd64)'; else arch_re='(arm64|aarch64)'; fi
    ASSET="$(printf '%s\n' "$URLS" | pick_asset "-linux-${arch_re}\\.AppImage$")"
    [ -n "$ASSET" ] || fail "Brak pliku AppImage dla linux-$ARCH w tym wydaniu."
    TARGET="${XDG_DATA_HOME:-$HOME/.local/share}/ai-evolution-jarvis/AI-Evolution-Jarvis.AppImage"
    MENU_ENTRY="${XDG_DATA_HOME:-$HOME/.local/share}/applications/$APP_ID.desktop"
else
    ASSET="$(printf '%s\n' "$URLS" | pick_asset "-mac-${ARCH}\\.dmg$")"
    # One universal/x64 build still runs on Apple silicon through Rosetta.
    [ -n "$ASSET" ] || ASSET="$(printf '%s\n' "$URLS" | pick_asset '-mac-(universal|x64)\.dmg$')"
    [ -n "$ASSET" ] || fail "Brak pliku DMG dla macOS w tym wydaniu."
    if [ -w /Applications ]; then TARGET="/Applications/$APP_NAME.app"; else TARGET="$HOME/Applications/$APP_NAME.app"; fi
    MENU_ENTRY=""
fi

say "System: $OS-$ARCH"
say "Pobieram: $ASSET"
say "Instaluję do: $TARGET"

if [ "$DRY_RUN" = 1 ]; then
    [ -n "$MENU_ENTRY" ] && say "Wpis w menu: $MENU_ENTRY"
    say "Tryb próbny — nic nie zostało zmienione."
    exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FILE="$TMP/$(basename "$ASSET")"
curl -fL --progress-bar -o "$FILE" "$ASSET" || fail "Pobieranie nie powiodło się."

if [ "$OS" = "linux" ]; then
    mkdir -p "$(dirname "$TARGET")" "$(dirname "$MENU_ENTRY")"
    mv "$FILE" "$TARGET"
    chmod +x "$TARGET"
    cat > "$MENU_ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=AI Evolution Jarvis — asystent AI
Exec="$TARGET" %U
Icon=ai-evolution-jarvis
Terminal=false
Categories=Utility;Office;
Keywords=ai;asystent;assistant;jarvis;hermes;agent;
StartupWMClass=$APP_NAME
EOF
    chmod +x "$MENU_ENTRY"
    command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$(dirname "$MENU_ENTRY")" >/dev/null 2>&1 || true
    say "Gotowe. Jarvis jest w menu aplikacji."
    if [ "$LAUNCH" = 1 ]; then
        nohup "$TARGET" >/dev/null 2>&1 &
        say "Uruchamiam $APP_NAME…"
    fi
else
    MOUNT="$TMP/mount"
    mkdir -p "$MOUNT" "$(dirname "$TARGET")"
    hdiutil attach -nobrowse -quiet -mountpoint "$MOUNT" "$FILE" || fail "Nie udało się zamontować obrazu DMG."
    SOURCE="$(find "$MOUNT" -maxdepth 1 -name '*.app' -print -quit)"
    [ -n "$SOURCE" ] || { hdiutil detach -quiet "$MOUNT" || true; fail "Obraz DMG nie zawiera aplikacji."; }
    rm -rf "$TARGET"
    cp -R "$SOURCE" "$TARGET"
    hdiutil detach -quiet "$MOUNT" || true
    say "Gotowe. Jarvis jest w $(dirname "$TARGET")."
    if [ "$LAUNCH" = 1 ]; then
        open "$TARGET"
        say "Uruchamiam $APP_NAME…"
    fi
fi
