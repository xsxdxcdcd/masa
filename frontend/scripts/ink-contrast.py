#!/usr/bin/env python3
"""Audit the ink scale against BOTH page themes and against surfaces whose
polarity does not change with the theme (navy panels, gold)."""
import re, sys

CSS = "/home/mohammed/laxalab/frontend/src/app/globals.css"
text = open(CSS, encoding="utf-8").read()

def block(selector):
    i = text.index(selector)
    j = text.index("}", i)
    return dict(re.findall(r"(--[a-z-]+):\s*(#[0-9a-fA-F]{3,8});", text[i:j]))

light = block(":root {")
dark = dict(light)
dark.update(block("html.dark {"))

# Surfaces that keep the same polarity in both themes.
FIXED_NAVY = "#0a1c35"   # --brand-navy-dark / --surface-inverse-deep
FIXED_GOLD = "#c6a15b"   # --brand-gold

def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(x * 2 for x in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def need(fg):
    # 3:1 is the AA floor for large text and for UI shapes (WCAG 1.4.11).
    return 4.5

fails = []
print("--- theme-tracking ink, on its own page surfaces ---")
for name, surf in (("light", ("--surface", "--surface-sunken")),
                   ("dark", ("--surface", "--surface-sunken", "--surface-raised"))):
    t = light if name == "light" else dark
    for ink in ("--ink", "--ink-muted", "--ink-subtle"):
        for s in surf:
            r = ratio(t[ink], t[s])
            if r < need(ink):
                fails.append((name, ink, t[s], r))
            print(f"  {'FAIL' if r < 4.5 else 'ok  '} {name:5} {ink[2:]:12} on {s[2:]:16} {r:5.2f}")

print("\n--- fixed-dark navy panel: the ink scale must NOT be the theme one ---")
for ink in ("--ink-on-navy", "--ink-on-navy-muted", "--ink-on-navy-subtle"):
    for name, t in (("light", light), ("dark", dark)):
        v = t.get(ink)
        if not v:
            fails.append((name, ink, "MISSING", 0))
            print(f"  FAIL {name:5} {ink[2:]:22} MISSING")
            continue
        r = ratio(v, FIXED_NAVY)
        if r < need(ink):
            fails.append((name, ink, FIXED_NAVY, r))
        print(f"  {'FAIL' if r < 4.5 else 'ok  '} {name:5} {ink[2:]:22} {v} on navy {r:5.2f}")

print("\n--- sanity: theme ink would FAIL on that navy panel (why the tokens exist) ---")
for name, t in (("light", light), ("dark", dark)):
    for ink in ("--ink", "--ink-muted", "--ink-subtle"):
        r = ratio(t[ink], FIXED_NAVY)
        print(f"  {'ok  ' if r >= 4.5 else 'FAIL'} {name:5} {ink[2:]:12} {t[ink]} on navy {r:5.2f}")

print("\n" + "=" * 70)
if fails:
    print(f"{len(fails)} FAILURES")
    for f in fails:
        print("  ", f)
    sys.exit(1)
print("all ink pairs pass AA")
