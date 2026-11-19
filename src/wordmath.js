// Word vector arithmetic: add and subtract word vectors, then find the
// closest words to the result by cosine similarity.
//
// Works in the browser and in Node. No dependencies.

/**
 * Split a newline-separated vocabulary file into words.
 * @param {string} text
 * @returns {string[]}
 */
export function parseVocab(text) {
  return text.split('\n').map((w) => w.trim()).filter(Boolean);
}

export class WordSpace {
  /**
   * @param {string[]} words  one entry per vector, in file order
   * @param {ArrayLike<number>} values  words.length * dims numbers, row-major
   * @param {number} dims
   */
  constructor(words, values, dims) {
    if (values.length !== words.length * dims) {
      throw new Error(
        `Expected ${words.length * dims} values for ${words.length} words of ${dims} dims, got ${values.length}`,
      );
    }
    this.words = words;
    this.dims = dims;
    this.index = new Map();
    words.forEach((w, i) => {
      if (!this.index.has(w)) this.index.set(w, i);
    });

    // Store every vector at unit length so cosine similarity is a dot product.
    // This also undoes any per-word scaling from quantization.
    this.vectors = new Float32Array(values.length);
    for (let i = 0; i < words.length; i++) {
      const start = i * dims;
      let norm = 0;
      for (let d = 0; d < dims; d++) norm += values[start + d] * values[start + d];
      norm = Math.sqrt(norm) || 1;
      for (let d = 0; d < dims; d++) this.vectors[start + d] = values[start + d] / norm;
    }
  }

  /**
   * Build a space from the files in data/: vocab.txt and vectors.bin (int8).
   * @param {string} vocabText
   * @param {ArrayBuffer} vectorBuffer
   * @param {number} dims
   */
  static fromFiles(vocabText, vectorBuffer, dims) {
    return new WordSpace(parseVocab(vocabText), new Int8Array(vectorBuffer), dims);
  }

  get size() {
    return this.words.length;
  }

  /** @param {string} word */
  has(word) {
    return this.index.has(normalizeWord(word));
  }

  /**
   * Solve an expression like king - man + woman.
   * Input words never appear in the answers: the raw sum is usually still
   * closest to one of them, which is why every analogy tool leaves them out.
   *
   * @param {{word: string, sign: 1 | -1}[]} terms
   * @param {{top?: number}} [options]
   * @returns {{word: string, score: number}[]} best match first; score is cosine similarity
   */
  solve(terms, { top = 3 } = {}) {
    if (!terms.length) return [];
    const dims = this.dims;
    const target = new Float32Array(dims);
    const used = new Set();

    for (const { word, sign } of terms) {
      const w = normalizeWord(word);
      const i = this.index.get(w);
      if (i === undefined) throw new UnknownWordError(w);
      used.add(i);
      const start = i * dims;
      for (let d = 0; d < dims; d++) target[d] += sign * this.vectors[start + d];
    }

    let norm = 0;
    for (let d = 0; d < dims; d++) norm += target[d] * target[d];
    norm = Math.sqrt(norm);
    if (norm < 1e-6) return []; // for example king - king: nothing to point at
    for (let d = 0; d < dims; d++) target[d] /= norm;

    // Keep a small sorted list of the best matches while scanning every word.
    const best = [];
    for (let i = 0; i < this.words.length; i++) {
      if (used.has(i)) continue;
      const start = i * dims;
      let score = 0;
      for (let d = 0; d < dims; d++) score += target[d] * this.vectors[start + d];
      if (best.length < top || score > best[best.length - 1].score) {
        best.push({ word: this.words[i], score });
        best.sort((a, b) => b.score - a.score);
        if (best.length > top) best.pop();
      }
    }
    return best;
  }
}

export class UnknownWordError extends Error {
  constructor(word) {
    super(`Not in dictionary: ${word}`);
    this.name = 'UnknownWordError';
    this.word = word;
  }
}

/** @param {string} word */
export function normalizeWord(word) {
  return String(word).trim().toLowerCase();
}
