#!/usr/bin/env python3
"""Contrast audit for the light-mode semantic tokens in globals.css."""
import re, sys

CSS = "/home/mohammed/laxalab/frontend/src/app/globals.css"
text = open(CSS, encoding="utf-8").read()

# The light block is the first ":root {" that sets --surface.
start = text.index(":root {")
end = text.index("}", start)
light = {}
for name, val in re.findall(r"(--[a-z-]+):\s*(#[0-9a-fA-F]{3,8});", text[start:end]):
    light[name] = val

BRAND = {
    "--brand-gold": "#c6a15b",
    "--brand-gold-light": "#d4b67a",
    "--brand-navy": "#12305a",
    "--brand-navy-light": "#1a4480",
    "--brand-white": "#fafaf7",
    "--brand-mist": "#e9eef4",
}

def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(hexv):
    h = hexv.lstrip("#")
    if len(h) == 3:
        h = "".join(x * 2 for x in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

T = dict(BRAND, **light)

# (foreground, background, minimum, what it is)
PAIRS = []
for ink in ("--ink", "--ink-muted", "--ink-subtle"):
    for bg in ("--surface", "--surface-sunken", "--surface-raised"):
        PAIRS.append((ink, bg, 4.5, f"body text on {bg[2:]}"))
for accent in ("--accent", "--danger", "--success", "--warning", "--gold-ink"):
    for bg in ("--surface", "--surface-sunken"):
        PAIRS.append((accent, bg, 4.5, f"{accent[2:]} on {bg[2:]}"))
    soft = {"--accent": "--accent-soft", "--danger": "--danger-soft",
            "--success": "--success-soft", "--warning": "--warning-soft"}.get(accent)
    if soft:
        PAIRS.append((accent, soft, 4.5, f"{accent[2:]} on {soft[2:]}"))
PAIRS += [
    ("--ink-on-accent", "--accent", 4.5, "white on accent (button)"),
    ("--ink-on-accent", "--brand-navy", 4.5, "white on navy (button)"),
    ("--ink-on-gold", "--brand-gold", 4.5, "dark on gold (button)"),
    ("--ink-on-gold", "--brand-gold-light", 4.5, "dark on gold-light"),
    ("--ink-inverse", "--surface-inverse", 4.5, "white on navy (sidebar)"),
]

# text-gold-ink only ever sits on bg-brand-gold/{10,15,20,30}, i.e. the gold at
# low alpha over whatever page surface it lands on -- never on solid gold-light.
# Flat --brand-gold-light as the backdrop reports 3.71:1 and reads as a real
# failure, so blend the way the browser actually composites it.
def blend(fg, alpha, bg):
    a, b = fg.lstrip("#"), bg.lstrip("#")
    out = []
    for i in (0, 2, 4):
        f = int(a[i:i + 2], 16)
        c = int(b[i:i + 2], 16)
        out.append(round(alpha * f + (1 - alpha) * c))
    return "#%02x%02x%02x" % tuple(out)

CHIPS = []
for alpha in (0.10, 0.15, 0.20, 0.30):
    for page, pname in ((light["--surface"], "surface"), (light["--surface-sunken"], "sunken")):
        CHIPS.append((blend(T["--brand-gold"], alpha, page),
                      f"gold/{int(alpha*100)} over {pname}"))
for bg, name in CHIPS:
    T[bg] = bg  # blended chip colour, so the lookup below can resolve it
    PAIRS.append(("--gold-ink", bg, 4.5, f"gold-ink on {name}"))

fails, warns = [], []
for fg, bg, need, label in PAIRS:
    if fg not in T or bg not in T:
        continue
    r = ratio(T[fg], T[bg])
    tag = "FAIL" if r < need else ("thin" if r < need + 0.6 else "ok")
    if r < need:
        fails.append((r, fg, bg, label))
    elif r < need + 0.6:
        warns.append((r, fg, bg, label))
    print(f"{tag:5} {r:5.2f}  {label:44} {T[fg]} on {T[bg]}")

print("\n" + "=" * 78)
if fails:
    print(f"{len(fails)} below AA ({'/'.join(str(f[3]) for f in fails)})")
if warns:
    print(f"{len(warns)} with almost no margin")
sys.exit(0)
