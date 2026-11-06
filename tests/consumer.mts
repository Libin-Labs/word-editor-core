import { createWordDocument, applyWordCommand, type WordCommand } from '@lp-labs/word-editor-core';
const doc = createWordDocument([
  { id: 'p', type: 'paragraph', runs: [{ text: 'Hello', marks: [] }] },
]);
doc.selection = { blockId: 'p', anchor: 5, focus: 5 };
const command: WordCommand = { type: 'insertText', text: ' world' };
const next = applyWordCommand(doc, command);
console.log(next.blocks[0].runs.map((run) => run.text).join(''));
