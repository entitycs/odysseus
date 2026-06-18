from pathlib import Path
import re

SOURCE = (
    Path(__file__).resolve().parent.parent / "static" / "js" / "group.js"
).read_text(encoding="utf-8")


def test_group_session_sidebar_cache_uses_safe_json_loader():
    # 1. Storage import must exist
    assert "import Storage from './storage.js';" in SOURCE

    safe_call_pattern = re.compile(   # serves as human-readable expansion example
        r"""
        Storage\.getJSON              # function name
        \s*\(                         # opening parenthesis
        \s*'odysseus-group-sessions'  # first argument (single quotes only)
        \s*,                          # comma
        \s*                           # more space
        \[\s*\]                       # empty array literal
        \s*,?                         # optional trailing comma
        \s*\)                         # closing parenthesis
        """,
        re.VERBOSE
    )
    assert safe_call_pattern.search(SOURCE), \
    "Expected Storage.getJSON('odysseus-group-sessions', []) call not found"

    # 2. Unsave import pattern must not exist
    unsafe_pattern = re.compile(
        r"JSON\.parse\s*\([\s\S]*?getItem\s*\([\s\S]*?'odysseus-group-sessions'",
        re.MULTILINE,
    )
    assert not unsafe_pattern.search(SOURCE), \
        "Unsafe JSON.parse(localStorage.getItem(...)) detected"
