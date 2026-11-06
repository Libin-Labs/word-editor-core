# @lp-labs/word-editor-core

Transactional rich-text blocks, run selections, commands, and bounded undo history.

## Install

```sh
npm install @lp-labs/word-editor-core
```

## Quick start

```js
import { createWordDocument, applyWordCommand } from '@lp-labs/word-editor-core';

const doc = createWordDocument([
  { id: 'p', type: 'paragraph', runs: [{ text: 'Hello', marks: [] }] },
]);
doc.selection = { blockId: 'p', anchor: 5, focus: 5 };
const command = { type: 'insertText', text: ' world' };
const next = applyWordCommand(doc, command);
console.log(next.blocks[0].runs.map((run) => run.text).join(''));
```

## API and type contract

- `createWordDocument(blocks: WordBlock[]): WordDocument` validates unique safe ids (1–128 characters) and clones the input. A block is a paragraph or level-1–6 heading with ordered `{ text, marks }` runs. Supported marks are `bold`, `italic`, `underline`, and `strike`.
- `WordDocument.selection` is one block-local `{ blockId, anchor, focus }` range. Offsets use JavaScript UTF-16 string indices; cross-block selection and cursor affinity are not modeled.
- `applyWordCommand(document, command)` accepts `{ type: 'insertText', text }`, `{ type: 'deleteSelection' }`, or `{ type: 'toggleMark', mark }`; it returns a new document and clears redo history.
- `getSelectedText(document)` returns the selected text from that one block. `undoWord` and `redoWord` return immutable snapshots; history is capped at 100 commands.

## Bounds, errors, and supported subset

The document has 1–100,000 blocks, at most 200,000 runs and 1,000,000 combined text characters. A single block text/run is also capped at 1,000,000 characters. Invalid objects/marks throw `TypeError`; invalid ids, offsets, heading levels, or capacities throw `RangeError`. There are no tables, pagination, collaboration, layout, or implicit DOM operations.

## Customization and limitations

Map your application's blocks and inline marks at the boundary. Commands are pure document transformations; customize command policy and selection mapping in your application rather than mutating returned history snapshots.

## Module formats

ESM, CommonJS, and TypeScript declarations are included. CommonJS: `const api = require('@lp-labs/word-editor-core')`. There are no runtime or peer dependencies; TypeScript and Prettier are development-only.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
