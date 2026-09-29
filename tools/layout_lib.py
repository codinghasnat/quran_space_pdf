"""Shared helpers for detecting line/word geometry on Karya Bestari mushaf page scans."""
import numpy as np
from PIL import Image

LINES_PER_PAGE = 15
PDF_PAGE_OFFSET = 7  # PDF page = mushaf page + 7


def text_column(page: int, width: int) -> tuple[int, int]:
    """Odd pages have the Quran text on the left, even pages on the right."""
    return (18, 1082) if page % 2 else (width - 1082, width - 18)


def dottedness(gray: np.ndarray, x0: int, x1: int) -> np.ndarray:
    """Per-row score that is high for thin dotted rules: many on/off transitions, blank rows just above and below."""
    d = gray[:, x0:x1] < 190
    trans = np.abs(np.diff(d.astype(np.int16), axis=1)).sum(axis=1).astype(float)
    ink = d.sum(axis=1)
    trans = np.where(ink < 0.45 * (x1 - x0), trans, 0)
    around = np.maximum(np.roll(trans, 5), np.roll(trans, -5))
    return np.clip(trans - around, 0, None)


def fit_grid(score: np.ndarray) -> tuple[float, float, float]:
    """Find (top, pitch) so rules at top + k*pitch (k=1..14) land on dotted rows. Returns (top, pitch, fit)."""
    best = (0.0, 0.0, -1.0)
    win = np.array([score[max(0, y - 3): y + 4].max() for y in range(len(score))])
    for pitch in np.arange(136.0, 141.01, 0.25):
        for top in range(118, 150):
            ys = (top + pitch * np.arange(1, LINES_PER_PAGE)).astype(int)
            if ys[-1] >= len(win):
                continue
            s = win[ys].mean()
            if s > best[2]:
                best = (float(top), float(pitch), float(s))
    return best


def colour_classes(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Masks of black-ink and gold-ink pixels (the mushaf alternates word colours black/gold)."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    gray = (r + g + b) / 3
    gold = (r - b > 45) & (r >= g) & (g > b) & (r - g < 70) & (gray < 200)
    black = (gray < 140) & (np.abs(r - b) < 30) & (np.abs(r - g) < 25)
    return black, gold


def _runs(labels: np.ndarray) -> list[list[int]]:
    """[label, start, end) runs of a 1-D label array, skipping label 0."""
    runs, x = [], 0
    while x < len(labels):
        s = x
        while x < len(labels) and labels[x] == labels[s]:
            x += 1
        if labels[s]:
            runs.append([int(labels[s]), s, x])
    return runs


def split_words_colour(rgb_band: np.ndarray, n: int) -> tuple[list[tuple[int, int]], int]:
    """Split a line band into n word spans (right-to-left) using the alternating black/gold word colours.

    Also returns how many colour runs were found before reconciling with n (a measure of confidence)."""
    black, gold = colour_classes(rgb_band)
    bc, gc = black.sum(axis=0), gold.sum(axis=0)
    labels = np.where((gc > bc) & (gc >= 2), 2, np.where((bc > gc) & (bc >= 2), 1, 0))
    runs = _runs(labels)
    # Drop specks, then merge neighbouring runs of the same colour (a word's letters are split by blank columns)
    runs = [r for r in runs if r[2] - r[1] >= 4]
    merged = []
    for r in runs:
        if merged and merged[-1][0] == r[0]:
            merged[-1][2] = r[2]
        else:
            merged.append(r)
    spans = [[r[1], r[2]] for r in merged]
    raw = len(spans)
    if not spans or n <= 0:
        return [], raw
    # Reconcile with the known word count: merge narrowest runs, or split widest runs at their biggest blank gap
    while len(spans) > n:
        i = min(range(len(spans)), key=lambda k: spans[k][1] - spans[k][0])
        if i == 0:
            j = 1
        elif i == len(spans) - 1:
            j = i - 1
        else:
            j = i - 1 if spans[i][0] - spans[i - 1][1] < spans[i + 1][0] - spans[i][1] else i + 1
        a, b = sorted((i, j))
        spans[a:b + 1] = [[spans[a][0], spans[b][1]]]
    ink = (black | gold).sum(axis=0)
    while len(spans) < n:
        i = max(range(len(spans)), key=lambda k: spans[k][1] - spans[k][0])
        s, e = spans[i]
        seg = ink[s:e]
        best, bx, x = 0, (s + e) // 2, 0
        while x < len(seg):
            if seg[x] <= 1:
                st = x
                while x < len(seg) and seg[x] <= 1:
                    x += 1
                if x - st > best and st > 0 and x < len(seg):
                    best, bx = x - st, s + (st + x) // 2
            else:
                x += 1
        spans[i:i + 1] = [[s, bx], [bx, e]]
    # Widen spans to meet halfway across gaps so the covers tile the line
    for k in range(len(spans) - 1):
        mid = (spans[k][1] + spans[k + 1][0]) // 2
        spans[k][1], spans[k + 1][0] = mid, mid
    return [tuple(s) for s in spans[::-1]], raw
