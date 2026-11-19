import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WordSpace, UnknownWordError, parseVocab } from '../src/wordmath.js';

// A tiny hand-made space: dims are [royal, male, female, place].
const toy = new WordSpace(
  ['king', 'queen', 'man', 'woman', 'paris'],
  [
    1, 1, 0, 0,
    1, 0, 1, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ],
  4,
);

test('king - man + woman finds queen', () => {
  const [best] = toy.solve([
    { word: 'king', sign: 1 },
    { word: 'man', sign: -1 },
    { word: 'woman', sign: 1 },
  ]);
  assert.equal(best.word, 'queen');
  assert.ok(best.score > 0.9);
});

test('input words never appear in the answers', () => {
  const words = toy.solve([{ word: 'king', sign: 1 }], { top: 10 }).map((m) => m.word);
  assert.ok(!words.includes('king'));
  assert.equal(words.length, 4);
});

test('answers are sorted best first and limited to top', () => {
  const matches = toy.solve([{ word: 'king', sign: 1 }], { top: 2 });
  assert.equal(matches.length, 2);
  assert.ok(matches[0].score >= matches[1].score);
});

test('words that cancel out give no answer', () => {
  assert.deepEqual(toy.solve([{ word: 'king', sign: 1 }, { word: 'king', sign: -1 }]), []);
});

test('unknown words throw UnknownWordError', () => {
  assert.throws(() => toy.solve([{ word: 'flurb', sign: 1 }]), UnknownWordError);
  assert.equal(toy.has('flurb'), false);
});

test('lookups ignore case and surrounding spaces', () => {
  assert.equal(toy.has('  KING '), true);
});

test('a values array of the wrong length is rejected', () => {
  assert.throws(() => new WordSpace(['a', 'b'], [1, 2, 3], 2));
});

test('parseVocab drops blank lines', () => {
  assert.deepEqual(parseVocab('a\nb\n\nc\n'), ['a', 'b', 'c']);
});

test('the shipped GloVe data solves the classic analogies', () => {
  const meta = JSON.parse(readFileSync(new URL('../data/meta.json', import.meta.url), 'utf8'));
  const vocab = readFileSync(new URL('../data/vocab.txt', import.meta.url), 'utf8');
  const bin = readFileSync(new URL('../data/vectors.bin', import.meta.url));
  const space = WordSpace.fromFiles(vocab, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), meta.dims);
  assert.equal(space.size, meta.words);

  const solve = (pos1, neg, pos2) =>
    space.solve([
      { word: pos1, sign: 1 },
      { word: neg, sign: -1 },
      { word: pos2, sign: 1 },
    ])[0].word;

  assert.equal(solve('king', 'man', 'woman'), 'queen');
  assert.equal(solve('paris', 'france', 'italy'), 'rome');
  assert.equal(solve('berlin', 'germany', 'france'), 'paris');
  assert.equal(solve('uncle', 'man', 'woman'), 'aunt');
});
