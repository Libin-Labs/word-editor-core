export type WordMark = 'bold' | 'italic' | 'underline' | 'strike';
export interface WordRun {
  text: string;
  marks: WordMark[];
}
export interface WordBlock {
  id: string;
  type: 'paragraph' | 'heading';
  level?: number;
  runs: WordRun[];
}
export interface WordSelection {
  blockId: string;
  anchor: number;
  focus: number;
}
interface Snapshot {
  blocks: WordBlock[];
  selection: WordSelection;
}
export interface WordDocument extends Snapshot {
  past: Snapshot[];
  future: Snapshot[];
}
export type WordCommand =
  | { type: 'insertText'; text: string }
  | { type: 'deleteSelection' }
  | { type: 'toggleMark'; mark: WordMark };

function assertText(text: string): void {
  if (typeof text !== 'string') throw new TypeError('Expected text.');
  if (text.length > 1_000_000) throw new RangeError('Text exceeds 1,000,000 characters.');
}

function plain(block: WordBlock): string {
  return block.runs.map((run) => run.text).join('');
}

function snapshot(document: Snapshot): Snapshot {
  return {
    blocks: document.blocks.map((block) => ({
      ...block,
      runs: block.runs.map((run) => ({ text: run.text, marks: [...run.marks] })),
    })),
    selection: { ...document.selection },
  };
}

function checkedSelection(document: WordDocument): {
  block: WordBlock;
  start: number;
  end: number;
} {
  const block = document.blocks.find((candidate) => candidate.id === document.selection.blockId);
  if (!block) throw new RangeError('Selection references an unknown block.');
  const { anchor, focus } = document.selection;
  const length = plain(block).length;
  if (
    ![anchor, focus].every(Number.isSafeInteger) ||
    anchor < 0 ||
    focus < 0 ||
    anchor > length ||
    focus > length
  ) {
    throw new RangeError('Selection offsets must be safe offsets within the selected block.');
  }
  return { block, start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

export function createWordDocument(blocks: WordBlock[]): WordDocument {
  if (!Array.isArray(blocks) || blocks.length === 0 || blocks.length > 100_000) {
    throw new RangeError('A document requires 1–100,000 blocks.');
  }
  const ids = new Set<string>();
  let totalText = 0;
  let totalRuns = 0;
  const copy = blocks.map((block) => {
    if (
      !block ||
      typeof block.id !== 'string' ||
      !/^[\w.-]{1,128}$/.test(block.id) ||
      ids.has(block.id)
    ) {
      throw new TypeError('Block ids must be unique safe identifiers of at most 128 characters.');
    }
    ids.add(block.id);
    if (!['paragraph', 'heading'].includes(block.type) || !Array.isArray(block.runs)) {
      throw new TypeError('Unsupported word block.');
    }
    if (
      block.type === 'heading' &&
      (!Number.isInteger(block.level) || block.level! < 1 || block.level! > 6)
    ) {
      throw new RangeError('Heading level must be between 1 and 6.');
    }
    const runs = block.runs.map((run) => {
      assertText(run.text);
      totalText += run.text.length;
      if (totalText > 1_000_000)
        throw new RangeError('Document text exceeds 1,000,000 characters.');
      if (++totalRuns > 200_000) throw new RangeError('Document exceeds 200,000 runs.');
      if (
        !Array.isArray(run.marks) ||
        run.marks.some((mark) => !['bold', 'italic', 'underline', 'strike'].includes(mark))
      ) {
        throw new TypeError('Unsupported run mark.');
      }
      return { text: run.text, marks: [...new Set(run.marks)] };
    });
    return {
      id: block.id,
      type: block.type,
      ...(block.level === undefined ? {} : { level: block.level }),
      runs,
    };
  });
  const document: WordDocument = {
    blocks: copy,
    selection: { blockId: copy[0]!.id, anchor: 0, focus: 0 },
    past: [],
    future: [],
  };
  return document;
}

export function getSelectedText(document: WordDocument): string {
  const { block, start, end } = checkedSelection(document);
  return plain(block).slice(start, end);
}

export function applyWordCommand(document: WordDocument, command: WordCommand): WordDocument {
  const selected = checkedSelection(document);
  const before = snapshot(document);
  const next: WordDocument = { ...snapshot(document), past: [], future: [] };
  const block = next.blocks.find((item) => item.id === selected.block.id)!;
  const text = plain(block);
  if (command.type === 'insertText') {
    assertText(command.text);
    const documentLength = document.blocks.reduce((total, item) => total + plain(item).length, 0);
    if (documentLength - (selected.end - selected.start) + command.text.length > 1_000_000)
      throw new RangeError('Document text exceeds 1,000,000 characters.');
    const left = text.slice(0, selected.start);
    const right = text.slice(selected.end);
    block.runs = [];
    if (left) block.runs.push({ text: left, marks: [] });
    if (command.text) block.runs.push({ text: command.text, marks: [] });
    if (right) block.runs.push({ text: right, marks: [] });
    next.selection = {
      blockId: block.id,
      anchor: selected.start + command.text.length,
      focus: selected.start + command.text.length,
    };
  } else if (command.type === 'deleteSelection') {
    block.runs = [{ text: text.slice(0, selected.start) + text.slice(selected.end), marks: [] }];
    next.selection = { blockId: block.id, anchor: selected.start, focus: selected.start };
  } else if (command.type === 'toggleMark') {
    if (!['bold', 'italic', 'underline', 'strike'].includes(command.mark))
      throw new TypeError('Unsupported mark.');
    const togglingOff = block.runs.some((run) => run.marks.includes(command.mark));
    const marked = togglingOff ? [] : [command.mark];
    block.runs = [];
    if (selected.start > 0) block.runs.push({ text: text.slice(0, selected.start), marks: [] });
    if (selected.end > selected.start)
      block.runs.push({ text: text.slice(selected.start, selected.end), marks: marked });
    if (selected.end < text.length) block.runs.push({ text: text.slice(selected.end), marks: [] });
  } else {
    throw new TypeError('Unknown word command.');
  }
  next.past = [...document.past, before].slice(-100);
  return next;
}

export function undoWord(document: WordDocument): WordDocument {
  if (!document.past.length) return document;
  const previous = document.past.at(-1)!;
  const past = document.past.slice(0, -1);
  return {
    ...snapshot(previous),
    past,
    future: [snapshot(document), ...document.future].slice(0, 100),
  };
}

export function redoWord(document: WordDocument): WordDocument {
  if (!document.future.length) return document;
  const [next, ...future] = document.future;
  return { ...snapshot(next!), past: [...document.past, snapshot(document)].slice(-100), future };
}
