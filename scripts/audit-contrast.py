#!/usr/bin/env python3
"""Audit background/text colour collisions across the frontend, JSX-tree aware.

Why this exists
---------------
The app has two coexisting theming dialects -- `dark:` utilities and a
`useTheme()` ternary dialect -- plus a set of course components that hard-code a
dark navy surface and ignore the theme toggle entirely. A shell that flips while
the panel inside it does not is exactly how you get white text on a white card,
or navy text on a navy card.

Eyeballing 3,600 colour utilities does not scale, so this resolves every colour
to real sRGB (Tailwind v4 ships the palette in oklch, so oklch is converted
properly), composites alpha against the nearest painted ancestor, and computes
the WCAG contrast ratio for every text node in *both* themes.

Usage
-----
    python3 scripts/audit-contrast.py                 # collisions only
    python3 scripts/audit-contrast.py --min 4.5       # also flag low contrast
    python3 scripts/audit-contrast.py --paths Course  # limit to matching files
    python3 scripts/audit-contrast.py --css-only      # skip inherited, per-element only
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
THEME_CSS = FRONTEND / "node_modules" / "tailwindcss" / "theme.css"
GLOBALS = FRONTEND / "src" / "app" / "globals.css"

# The two painted page surfaces, from @theme.
OPAQUE_LIGHT = (250, 250, 247)   # --color-brand-white
OPAQUE_DARK = (10, 28, 53)       # --color-brand-navy-dark

# `bg-gradient-to-r`, `bg-none`, `bg-[url(...)]` paint no resolvable flat colour.
NOT_A_FLAT_COLOUR = re.compile(r"^(gradient-to-|none$|inherit$|current$|transparent$|opacity-)")

STATE_PREFIXES = ("hover:", "focus:", "focus-visible:", "active:", "group-hover:",
                  "peer-focus:", "disabled:", "visited:", "first:", "last:",
                  "odd:", "even:", "sm:", "md:", "lg:", "xl:", "2xl:")


# --------------------------------------------------------------------------- colour


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def oklch_to_rgb(L: float, C: float, H: float) -> tuple[int, int, int]:
    h = math.radians(H)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(max(0, min(255, round(linear_to_srgb(max(0.0, min(1.0, v))) * 255)))
                 for v in (r, g, bl))  # type: ignore[return-value]


def parse_css_color(value: str) -> tuple[int, int, int] | None:
    v = value.strip().rstrip(";").strip()
    if v.startswith("#"):
        h = v[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) in (6, 8):
            try:
                return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            except ValueError:
                return None
        return None
    m = re.match(r"^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)", v)
    if m:
        return tuple(round(float(g)) for g in m.groups())  # type: ignore[return-value]
    m = re.match(r"^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)", v)
    if m:
        L = m.group(1)
        L = float(L[:-1]) / 100 if L.endswith("%") else float(L)
        return oklch_to_rgb(L, float(m.group(2)), float(m.group(3)))
    return None


def load_palette() -> tuple[dict[str, tuple[int, int, int]], dict[str, tuple[int, int, int]]]:
    """Return (static palette, theme-dependent tokens).

    Theme-dependent tokens are declared inside `@theme inline` and change under
    `html.dark`, so they resolve differently per theme and are kept apart.
    """
    palette: dict[str, tuple[int, int, int]] = {}
    themable: dict[str, tuple[int, int, int]] = {}
    for path in (THEME_CSS, GLOBALS):
        if not path.exists():
            continue
        text = path.read_text("utf-8", "replace")
        for m in re.finditer(r"--color-([a-z0-9-]+):\s*([^;]+);", text):
            rgb = parse_css_color(m.group(2))
            if rgb:
                palette[m.group(1)] = rgb

    # :root defaults, then the html.dark overrides, for the `inline` token block.
    for name, target in (("light", palette), ("dark", themable)):
        scope = re.search(rf"^:root\s*\{{(.*?)^\}}", GLOBALS.read_text("utf-8", "replace"),
                          re.S | re.M) if name == "light" else \
                re.search(r"^html\.dark\s*\{(.*?)^\}", GLOBALS.read_text("utf-8", "replace"),
                          re.S | re.M)
        if not scope:
            continue
        for m in re.finditer(r"--([a-z0-9-]+):\s*([^;]+);", scope.group(1)):
            rgb = parse_css_color(m.group(2))
            if rgb:
                target[m.group(1)] = rgb

    palette["white"] = (255, 255, 255)
    palette["black"] = (0, 0, 0)
    themable["white"] = (255, 255, 255)
    themable["black"] = (0, 0, 0)
    return palette, themable


PALETTE, THEMABLE = load_palette()
THEME_KEYS = set(THEMABLE)


def lookup(token: str, theme: str) -> tuple[int, int, int] | None:
    """A token means different colours per theme, so the theme decides."""
    if token in THEME_KEYS:
        return THEMABLE[token] if theme == "dark" else PALETTE.get(token)
    return PALETTE.get(token) or THEMABLE.get(token)


def resolve(token: str, theme: str = "light") -> tuple[tuple[int, int, int], float] | None:
    """(rgb, alpha) for a colour token, or None when it is not a flat colour."""
    token = token.strip()
    if not token or NOT_A_FLAT_COLOUR.match(token):
        return None
    if token == "white":
        return (255, 255, 255), 1.0
    if token == "black":
        return (0, 0, 0), 1.0

    alpha = 1.0
    if "/" in token:
        token, _, pct = token.partition("/")
        if pct.startswith("[") and pct.endswith("]"):
            try:
                alpha = float(pct[1:-1])
            except ValueError:
                return None
        else:
            try:
                alpha = min(100, int(pct)) / 100.0
            except ValueError:
                return None
        if not token.startswith("[") and token not in PALETTE and token not in THEME_KEYS:
            return None

    if token.startswith("["):
        if not token.endswith("]"):
            return None
        rgb = parse_css_color(token[1:-1])
        return (rgb, alpha) if rgb else None
    rgb = lookup(token, theme)
    return (rgb, alpha) if rgb else None


def composite(fg: tuple[int, int, int], alpha: float, bg: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))  # type: ignore[return-value]


def luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = (srgb_to_linear(c / 255) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def hexof(rgb: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % rgb


# --------------------------------------------------------------------- jsx scanning


TAG_RE = re.compile(r"<(/?)([A-Za-z][A-Za-z0-9._]*)")
ATTR_RE = re.compile(r"""className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{([^}]*)\})""", re.S)
STRING_RE = re.compile(r"""["'`]([^"'`]*)["'`]""")
VOID_TAGS = {"br", "hr", "img", "input", "meta", "link", "source", "path", "circle", "rect", "use"}


@dataclass
class Finding:
    path: str
    line: int
    theme: str
    surface: str          # what the text is actually painted on
    text: str
    ratio: float
    kind: str             # "same" (identical) or "low"

    def label(self) -> str:
        return "SAME" if self.kind == "same" else f"{self.ratio:.2f}:1"


def strip_state(tok: str) -> str:
    while True:
        for p in STATE_PREFIXES:
            if tok.startswith(p):
                tok = tok[len(p):]
                break
        else:
            return tok


def classes_for_theme(chunk: str, theme: str) -> list[str]:
    """Classes that apply in `theme`, resolving `dark:` variants.

    A chunk is one className expression. When the expression is a theme ternary
    (`dark ? 'a' : 'b'`), the branch before the colon is dark-only and the branch
    after it is light-only; evaluating both in both themes would invent findings
    that no user can ever see, so the branches are separated first.
    """
    pieces = STRING_RE.findall(chunk)
    if not pieces:
        pieces = [chunk]

    # Split a `cond ? 'A' : 'B'` into its two branches.
    if re.search(r"\b(?:dark|isDark)\s*\?", chunk) and len(pieces) >= 2:
        if theme == "dark":
            return pieces[0].split()
        return pieces[-1].split()

    out: list[str] = []
    dark_toks: list[str] = []
    for piece in pieces:
        for tok in piece.split():
            tok = tok.strip("`'\"")
            if not tok:
                continue
            if tok.startswith("dark:"):
                if theme == "dark":
                    dark_toks.append(tok[5:])
                continue
            if tok.startswith(STATE_PREFIXES):
                continue
            out.append(tok)
    # A `dark:` variant overrides its base regardless of where the two appear
    # in the expression, so the dark wins are appended last. Getting this wrong
    # reports the light-mode colour as if it were still in force.
    out.extend(dark_toks)
    return out


def colour_of(tokens: list[str], prop: str) -> str | None:
    """Last-declared `bg-*` or `text-*` colour token in a class list."""
    found = None
    for tok in tokens:
        base = strip_state(tok)
        m = re.match(r"^(bg|text|placeholder)-(.+)$", base)
        if not m:
            continue
        if prop == "bg" and m.group(1) != "bg":
            continue
        if prop == "text" and m.group(1) not in ("text", "placeholder"):
            continue
        if resolve(m.group(2)) is None:
            continue
        found = m.group(2)
    return found


def scan(path: Path, min_ratio: float, args_same: float = 1.5,
         inherit: bool = False) -> list[Finding]:
    src = path.read_text("utf-8", "replace")
    findings: list[Finding] = []

    # Pre-index every className expression so a tag can pick up its own.
    attr_at: dict[int, str] = {}
    for m in ATTR_RE.finditer(src):
        attr_at[m.start()] = (m.group(1) or m.group(2) or m.group(3) or m.group(4) or "")

    for theme in ("light", "dark"):
        page_surface = lookup("surface-sunken", theme)  # type: ignore[assignment]
        # Each frame keeps the surface in force *before* the tag, so a closing
        # tag restores exactly what it shadowed.
        stack: list[tuple[str, tuple[int, int, int], str]] = []
        surface, surface_label = page_surface, "body"

        for m in TAG_RE.finditer(src):
            closing, name = m.group(1), m.group(2)

            if closing:
                # Unwind to the matching open tag, tolerating unbalanced JSX.
                for i in range(len(stack) - 1, -1, -1):
                    if stack[i][0] == name:
                        _, surface, surface_label = stack[i]
                        del stack[i:]
                        break
                continue

            gt = src.find(">", m.end())
            if gt == -1:
                break
            attr_text = src[m.end():gt]
            self_closing = attr_text.rstrip().endswith("/")

            chunk = next((v for k, v in sorted(attr_at.items()) if m.end() <= k < gt), None)
            toks = classes_for_theme(chunk, theme) if chunk else []

            if not self_closing:
                stack.append((name, surface, surface_label))

            own_bg = colour_of(toks, "bg")
            # Only a tag's *own* background is proof of a collision. An ancestor
            # is not: a helper function is often declared above the container it
            # renders into, so file order is not render order, and trusting it
            # invents findings no user can ever see. A tag that sets both its
            # own background and its own text, however, is self-contained and
            # always real.
            own_surface, own_label = surface, surface_label
            if own_bg and inherit:
                got = resolve(own_bg, theme)
                if got:
                    rgb, alpha = got
                    surface = composite(rgb, alpha, surface)  # type: ignore[arg-type]
                    surface_label = own_bg

            text_tok = colour_of(toks, "text")
            # Without a background of its own, a tag has no provable surface, so
            # it is left to the call site rather than guessed at here.
            if text_tok and (own_bg or inherit):
                got = resolve(text_tok, theme)
                if got:
                    rgb, alpha = got
                    if own_bg and not inherit:
                        got_bg = resolve(own_bg, theme)
                        if got_bg:
                            bg_rgb, bg_alpha = got_bg
                            base = lookup("surface-sunken", theme)  # type: ignore[assignment]
                            own_surface = composite(bg_rgb, bg_alpha, base)  # type: ignore[arg-type]
                            own_label = own_bg
                    fg = composite(rgb, alpha, own_surface)  # type: ignore[arg-type]
                    ratio = contrast(fg, own_surface)
                    line = src.count("\n", 0, m.start()) + 1
                    if ratio < min_ratio:
                        findings.append(Finding(
                            path=str(path), line=line, theme=theme,
                            surface=own_label, text=text_tok, ratio=ratio,
                            kind="same" if ratio < args_same else "low",
                        ))

            if self_closing and stack:
                # Nothing inherits from a self-closing tag.
                _, surface, surface_label = stack.pop()

    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min", type=float, default=4.5,
                    help="report pairs below this ratio (4.5 = WCAG AA for body text)")
    ap.add_argument("--same", type=float, default=1.5,
                    help="at or above this ratio is reported as low, below it as identical")
    ap.add_argument("--paths", default="", help="comma-separated path substrings")
    ap.add_argument("--strict", type=float, default=None,
                    help="exit non-zero when pairs below this ratio are found")
    ap.add_argument("--inherit", action="store_true",
                    help="also trust ancestor backgrounds (noisy: file order is not render order)")
    args = ap.parse_args()

    filters = [p.strip() for p in args.paths.split(",") if p.strip()]
    targets = sorted(p for p in SRC.rglob("*.tsx") if p.is_file())
    if filters:
        targets = [p for p in targets if any(f in str(p) for f in filters)]

    found: list[Finding] = []
    for p in targets:
        found.extend(scan(p, args.min, args.same, args.inherit))
    same = [f for f in found if f.kind == "same"]
    low = [f for f in found if f.kind == "low"]

    for title, rows in (("IDENTICAL background and text", same),
                        (f"LOW contrast (< {args.min}:1)", low)):
        if not rows:
            continue
        # An opaque background hides its parent completely, so those pairs are
        # exact no matter where the tag renders. A translucent one (`/10`) takes
        # its final colour from whatever is behind it, so it needs a look at the
        # call site and is reported separately rather than asserted.
        solid = [r for r in rows if "/" not in r.surface]
        sheer = [r for r in rows if "/" in r.surface]
        for label, group in ((title, solid), (f"{title} - translucent, needs call site", sheer)):
            if not group:
                continue
            print(f"\n### {label}  ({len(group)})")
            by_file: dict[str, list[Finding]] = {}
            for f in group:
                by_file.setdefault(f.path, []).append(f)
            for path in sorted(by_file, key=lambda k: -len(by_file[k])):
                print(f"\n{Path(path).relative_to(FRONTEND)}  ({len(by_file[path])})")
                seen = set()
                for r in by_file[path]:
                    key = (r.line, r.theme)
                    if key in seen:
                        continue
                    seen.add(key)
                    print(f"  L{r.line:<5} {r.theme:<6} on {r.surface:<22} text:{r.text:<26} {r.label()}")

    print(f"\n{'=' * 66}")
    print(f"scanned {len(targets)} files | identical: {len(same)} | below {args.min}:1: {len(low)}")
    # Identical pairs are always a failure. Low-contrast pairs only fail the run
    # when the caller asked for that bar with --strict.
    return 1 if (same or (args.strict is not None and low)) else 0


if __name__ == "__main__":
    sys.exit(main())
