"""The install scripts must find (and name) the desktop app the way electron-builder does.

electron-builder names its output after ``productName`` / ``executableName`` in
``apps/desktop/package.json``. Both installers used to hardcode "Hermes", so
after the product was renamed a perfectly good build ended in "no app was
found" on macOS/Linux, and Windows created a ``Hermes.lnk`` pointing at an exe
that no longer existed. These tests pin the resolution to the package file.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "scripts" / "install.sh"
INSTALL_PS1 = REPO_ROOT / "scripts" / "install.ps1"
DESKTOP_PACKAGE = REPO_ROOT / "apps" / "desktop" / "package.json"


def _name_helpers() -> str:
    """The three product-name helpers, lifted out of install.sh."""
    source = INSTALL_SH.read_text(encoding="utf-8")
    functions = []
    for name in ("_desktop_pkg_string", "desktop_product_name", "desktop_executable_name"):
        match = re.search(rf"^{re.escape(name)}\(\) \{{\n.*?^}}\n", source, re.MULTILINE | re.DOTALL)
        assert match is not None, f"{name} not found in scripts/install.sh"
        functions.append(match.group(0))
    return "\n".join(functions)


def _run_helpers(root: Path) -> tuple[str, str]:
    script = f'{_name_helpers()}\nprintf "%s\\n%s\\n" "$(desktop_product_name "$1")" "$(desktop_executable_name "$1")"\n'
    result = subprocess.run(
        ["bash", "-c", script, "bash", str(root)],
        capture_output=True,
        text=True,
        check=True,
    )
    product, executable = result.stdout.splitlines()[:2]
    return product, executable


def test_install_sh_reads_the_product_name_from_the_desktop_package() -> None:
    package = json.loads(DESKTOP_PACKAGE.read_text(encoding="utf-8"))
    product, executable = _run_helpers(REPO_ROOT)

    assert product == package["productName"]
    assert executable == package["build"]["executableName"]


def test_install_sh_falls_back_to_hermes_without_a_desktop_package(tmp_path: Path) -> None:
    """A checkout predating the field must still resolve to the historical name."""
    product, executable = _run_helpers(tmp_path)

    assert product == "Hermes"
    assert executable == "Hermes"


def test_install_sh_looks_for_the_built_app_under_its_real_name() -> None:
    source = INSTALL_SH.read_text(encoding="utf-8")

    assert '"$desktop_dir/release/linux-unpacked/$exe_name"' in source
    assert '"$desktop_dir/release/mac-arm64/$product_name.app"' in source
    # The legacy names stay as fallbacks, never as the only candidates.
    assert '"$desktop_dir/release/linux-unpacked/Hermes"' in source


def test_install_ps1_names_the_shortcuts_after_the_product() -> None:
    source = INSTALL_PS1.read_text(encoding="utf-8")

    assert "function Get-DesktopProductName" in source
    assert "function Get-DesktopExecutableName" in source
    # The desktop/Start Menu shortcut carries the product's name, not a
    # hardcoded one, and the exe probe follows the same source of truth.
    assert '$shortcutName = "$ProductName.lnk"' in source
    assert "'Hermes.lnk'" not in source
    assert "$exeNames = @(\"$executableName.exe\"" in source
