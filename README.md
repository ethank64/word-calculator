# Word Calculator

A pocket calculator for words. Type words, add and subtract them, and it tells you which word the result is closest to.

```
king − man + woman   ≈ queen
paris − france + italy ≈ rome
```

It runs entirely in your browser: a static page, no server, no build step, no dependencies.

## How it works

Each word is a list of 100 numbers (a *word vector*) learned from how the word is used in billions of words of text. Words used in similar ways get similar vectors, and some relationships, like male to female or country to capital, end up as fairly consistent directions.

When you press `=`, the calculator:

1. Adds the vectors of the `+` words and subtracts the `−` words.
2. Compares the result with every word in its dictionary using cosine similarity.
3. Shows the closest word, plus two runners-up, with how close each one is.

The words you typed are left out of the answers. The raw sum is usually still closest to one of them (king − man + woman is closest to *king*), so every analogy tool does this.

Expect some odd answers. Gender and capital-city analogies work well; many others don't, and the vectors carry biases from the text they were trained on.

## Using it

- Type a word, then press `+` or `−` (the keyboard keys work too). Pasting a whole sum like `king - man + woman` works as well.
- Press `=` or Enter to solve.
- After an answer, `+` or `−` carries on from it, like a normal calculator.
- The six dark keys hold your most recent words.
- `C` or Escape clears; backspace steps back one word at a time.

## Run it locally

It's a static site, but browsers won't load the data files from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tests

```bash
npm test
```

Uses Node's built-in test runner (Node 18 or later), with no packages to install. The tests cover the math on a tiny hand-made space and check that the shipped data solves a few classic analogies.

## The data

`data/` holds the 50,000 most common plain lowercase words from **GloVe 6B, 100 dimensions** (Wikipedia 2014 + Gigaword 5), stored as one byte per number, about 5 MB in all.

- `vocab.txt`: one word per line
- `vectors.bin`: 100 signed bytes per word, in the same order
- `meta.json`: counts and source

To rebuild it, or to use a different size:

```bash
curl -LO https://downloads.cs.stanford.edu/nlp/data/glove.6B.zip
unzip glove.6B.zip glove.6B.100d.txt
python3 scripts/build_vectors.py glove.6B.100d.txt --words 50000 --out data
```

The script needs Python 3 and NumPy. It works with any GloVe-format text file, so `glove.6B.300d.txt` gives better answers for a bigger download.

## Project layout

```
index.html              the calculator page
src/app.js              keys, display and loading
src/wordmath.js         the vector math (works in the browser and Node)
src/styles.css          the retro LCD look
scripts/build_vectors.py  turns GloVe into the files in data/
tests/                  node --test suite
```

## Credits and licenses

- Code: [MIT](LICENSE).
- Word vectors: [GloVe](https://nlp.stanford.edu/projects/glove/) by Jeffrey Pennington, Richard Socher and Christopher D. Manning, released under the [Public Domain Dedication and License v1.0](https://opendatacommons.org/licenses/pddl/1-0/). If you use them in research, cite: Pennington, Socher and Manning, *GloVe: Global Vectors for Word Representation*, EMNLP 2014.
- Fonts: [VT323](https://fonts.google.com/specimen/VT323) and [Space Mono](https://fonts.google.com/specimen/Space+Mono), both under the SIL Open Font License, loaded from Google Fonts.
