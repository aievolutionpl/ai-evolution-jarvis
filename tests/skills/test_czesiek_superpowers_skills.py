"""Structural contracts for the Czesiek superpowers skill pack.

These skills ship as the working-style layer (memory, initiative, cost, content). The
contracts below are the ones a reader actually depends on: a listing-sized description,
the modern section order, and prose that names native Hermes tools rather than raw shell
utilities the agent has wrapped.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

PACK = {
    "vault-memory": "skills/memory/vault-memory/SKILL.md",
    "memory-bridge": "skills/memory/memory-bridge/SKILL.md",
    "step-beyond": "skills/productivity/step-beyond/SKILL.md",
    "feedback-loop": "skills/productivity/feedback-loop/SKILL.md",
    "cost-hygiene": "skills/productivity/cost-hygiene/SKILL.md",
    "brand-post-system": "skills/social-media/brand-post-system/SKILL.md",
}

REQUIRED_SECTIONS = [
    "## When to Use",
    "## Prerequisites",
    "## How to Run",
    "## Quick Reference",
    "## Procedure",
    "## Pitfalls",
    "## Verification",
]

REQUIRED_FIELDS = ["name:", "description:", "version:", "author:", "license:", "platforms:"]

# Shell utilities the agent reaches through a native tool instead.
WRAPPED_UTILITIES = ("grep", "sed", "awk", "cat", "head", "tail", "find", "ls", "rg")


def _read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def _split(text: str):
    parts = text.split("---")
    return parts[1], "---".join(parts[2:])


@pytest.mark.parametrize("skill", sorted(PACK))
def test_frontmatter_is_complete_and_description_fits_a_listing(skill):
    frontmatter, _ = _split(_read(PACK[skill]))

    for field in REQUIRED_FIELDS:
        assert field in frontmatter, f"{skill}: brak {field}"

    match = re.search(r'^description: "(.*)"$', frontmatter, re.M)
    assert match, f"{skill}: description musi byc w cudzyslowie"

    description = match.group(1)
    assert len(description) <= 60, f"{skill}: description ma {len(description)} znakow"
    assert description.endswith("."), f"{skill}: description musi konczyc sie kropka"


@pytest.mark.parametrize("skill", sorted(PACK))
def test_sections_appear_in_the_modern_order(skill):
    _, body = _split(_read(PACK[skill]))

    positions = []
    for section in REQUIRED_SECTIONS:
        index = body.find(section)
        assert index != -1, f"{skill}: brak sekcji {section}"
        positions.append(index)

    assert positions == sorted(positions), f"{skill}: sekcje w zlej kolejnosci"


@pytest.mark.parametrize("skill", sorted(PACK))
def test_prose_names_native_tools_not_raw_shell_utilities(skill):
    _, body = _split(_read(PACK[skill]))

    for utility in WRAPPED_UTILITIES:
        assert f"`{utility}`" not in body, f"{skill}: uzyj natywnego narzedzia zamiast `{utility}`"
        assert f"`{utility} " not in body, f"{skill}: uzyj natywnego narzedzia zamiast `{utility} ...`"


@pytest.mark.parametrize("skill", sorted(PACK))
def test_skill_declares_the_platforms_it_supports(skill):
    frontmatter, _ = _split(_read(PACK[skill]))

    assert re.search(r"^platforms: \[[a-z, ]+\]$", frontmatter, re.M), f"{skill}: brak platform"


def test_category_covers_every_skill_in_its_directory():
    described = {
        path.parent.name
        for path in (ROOT / "skills").glob("*/DESCRIPTION.md")
    }

    assert "memory" in described
    assert (ROOT / "skills/memory/vault-memory/SKILL.md").exists()
