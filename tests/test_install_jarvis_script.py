"""scripts/install-jarvis.sh picks the release asset that matches the platform.

Runs the real script in ``--dry-run`` against a recorded release payload, so the
selection logic is exercised end to end without network or disk changes.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "install-jarvis.sh"

ASSETS = [
    "AI-Evolution-Jarvis-1.0.0-win-x64.exe",
    "AI-Evolution-Jarvis-1.0.0-linux-amd64.deb",
    "AI-Evolution-Jarvis-1.0.0-linux-x86_64.AppImage",
    "AI-Evolution-Jarvis-1.0.0-mac-arm64.dmg",
]


def _run(tmp_path: Path, os_name: str, arch: str) -> subprocess.CompletedProcess:
    release = tmp_path / "release.json"
    release.write_text(
        json.dumps(
            {
                "tag_name": "v1.0.0",
                "assets": [
                    {"name": name, "browser_download_url": f"https://example.invalid/{name}"} for name in ASSETS
                ],
            }
        )
    )
    env = {
        **os.environ,
        "HOME": str(tmp_path),
        "JARVIS_ARCH": arch,
        "JARVIS_OS": os_name,
        "JARVIS_RELEASE_JSON": str(release),
    }
    return subprocess.run(["bash", str(SCRIPT), "--dry-run"], capture_output=True, env=env, text=True)


@pytest.mark.parametrize(
    ("os_name", "arch", "expected"),
    [
        ("linux", "x64", "linux-x86_64.AppImage"),
        ("mac", "arm64", "mac-arm64.dmg"),
    ],
)
def test_dry_run_selects_the_platform_asset(tmp_path, os_name, arch, expected):
    result = _run(tmp_path, os_name, arch)

    assert result.returncode == 0, result.stderr
    downloads = [line for line in result.stdout.splitlines() if "https://example.invalid/" in line]
    assert len(downloads) == 1 and downloads[0].endswith(expected)
    # Dry run means dry: nothing was installed under the fake home.
    assert not (tmp_path / ".local").exists()


def test_missing_platform_asset_fails_instead_of_guessing(tmp_path):
    result = _run(tmp_path, "linux", "arm64")

    assert result.returncode != 0
    assert "https://example.invalid/" not in result.stdout
