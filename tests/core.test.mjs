import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWordCommand,
  createWordDocument,
  getSelectedText,
  redoWord,
  undoWord,
} from '../dist/esm/index.js';

const doc = () =>
  createWordDocument([{ id: 'p', type: 'paragraph', runs: [{ text: 'hello', marks: [] }] }]);
test('selection replacement and undo/redo preserve immutable snapshots', () => {
  const original = doc();
  original.selection = { blockId: 'p', anchor: 1, focus: 4 };
  const changed = applyWordCommand(original, { type: 'insertText', text: 'i' });
  assert.equal(changed.blocks[0].runs.map((run) => run.text).join(''), 'hio');
  assert.equal(getSelectedText(changed), '');
  assert.equal(undoWord(changed).blocks[0].runs[0].text, 'hello');
  assert.equal(
    redoWord(undoWord(changed))
      .blocks[0].runs.map((run) => run.text)
      .join(''),
    'hio',
  );
  assert.equal(original.blocks[0].runs[0].text, 'hello');
});
test('marks apply only to the selected run and toggle off', () => {
  let document = doc();
  document.selection = { blockId: 'p', anchor: 1, focus: 4 };
  document = applyWordCommand(document, { type: 'toggleMark', mark: 'bold' });
  assert.deepEqual(
    document.blocks[0].runs.map((run) => [run.text, run.marks]),
    [
      ['h', []],
      ['ell', ['bold']],
      ['o', []],
    ],
  );
  document.selection = { blockId: 'p', anchor: 1, focus: 4 };
  assert.deepEqual(
    applyWordCommand(document, { type: 'toggleMark', mark: 'bold' }).blocks[0].runs[1].marks,
    [],
  );
});
test('selection and block validation reject malformed state', () => {
  const document = doc();
  document.selection.anchor = 99;
  assert.throws(() => applyWordCommand(document, { type: 'deleteSelection' }), RangeError);
  assert.throws(
    () => createWordDocument([{ id: 'x', type: 'heading', level: 8, runs: [] }]),
    RangeError,
  );
});
