#!/usr/bin/env python3
"""Turn a GloVe text file into the small files the web app loads.

GloVe lists words from most to least frequent, so this keeps the first
--words entries that are plain lowercase words, scales each vector to unit
length, and stores it as signed bytes.

Writes, into --out:
  vocab.txt    one word per line
  vectors.bin  int8, one row of --dims bytes per word, same order as vocab.txt
  meta.json    counts and where the vectors came from

Usage:
  curl -LO https://downloads.cs.stanford.edu/nlp/data/glove.6B.zip
  unzip glove.6B.zip glove.6B.100d.txt
  python3 scripts/build_vectors.py glove.6B.100d.txt --words 50000 --out data
"""

import argparse
import json
import re
from pathlib import Path

import numpy as np

WORD = re.compile(r"^[a-z]+$")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("glove", type=Path, help="GloVe .txt file, for example glove.6B.100d.txt")
    parser.add_argument("--words", type=int, default=50000, help="how many words to keep (default 50000)")
    parser.add_argument("--out", type=Path, default=Path("data"), help="output folder (default data)")
    args = parser.parse_args()

    words, rows = [], []
    dims = None
    with args.glove.open(encoding="utf8") as f:
        for line in f:
            parts = line.rstrip("\n").split(" ")
            word = parts[0]
            if not WORD.match(word):
                continue
            vec = np.asarray(parts[1:], dtype=np.float32)
            if dims is None:
                dims = vec.size
            if vec.size != dims:
                continue
            words.append(word)
            rows.append(vec)
            if len(words) >= args.words:
                break

    matrix = np.stack(rows)
    matrix /= np.linalg.norm(matrix, axis=1, keepdims=True)
    # Scale each row so its largest component uses the full int8 range. The app
    # rescales every vector to unit length on load, so the scale is not stored.
    peak = np.abs(matrix).max(axis=1, keepdims=True)
    quantized = np.round(matrix / peak * 127).astype(np.int8)

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "vocab.txt").write_text("\n".join(words) + "\n", encoding="utf8")
    quantized.tofile(args.out / "vectors.bin")
    meta = {
        "words": len(words),
        "dims": int(dims),
        "format": "int8",
        "source": args.glove.name,
        "sourceUrl": "https://nlp.stanford.edu/projects/glove/",
        "license": "Public Domain Dedication and License v1.0 (PDDL)",
    }
    (args.out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf8")
    print(f"Wrote {len(words)} words x {dims} dims to {args.out}/ "
          f"({quantized.nbytes / 1e6:.1f} MB of vectors)")


if __name__ == "__main__":
    main()
