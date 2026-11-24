import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACHMENT_LIMITS, checkAttachments, formatBytes } from './attachments';

const MB = 1024 * 1024;
const f = (name: string, size: number) => ({ name, size });

test('checkAttachments accepts normal files', () => {
  const r = checkAttachments([], [f('deck.pdf', 2 * MB), f('notes.docx', 40_000)]);
  assert.equal(r.accepted.length, 2);
  assert.deepEqual(r.errors, []);
});

test('checkAttachments rejects blocked types, empty and oversized files', () => {
  const r = checkAttachments([], [f('setup.exe', 1000), f('empty.txt', 0), f('video.mov', 11 * MB)]);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.errors.length, 3);
  assert.match(r.errors[0], /blocked/);
  assert.match(r.errors[1], /empty/);
  assert.match(r.errors[2], /per file/);
});

test('checkAttachments enforces the total size and file count across existing files', () => {
  const existing = [f('a.pdf', 9 * MB), f('b.pdf', 9 * MB)];
  const r = checkAttachments(existing, [f('c.pdf', 3 * MB), f('d.pdf', 1 * MB)]);
  assert.deepEqual(r.accepted.map((x) => x.name), ['d.pdf']);
  assert.match(r.errors[0], /total/);

  const many = Array.from({ length: ATTACHMENT_LIMITS.maxFiles }, (_, i) => f(`f${i}.txt`, 10));
  assert.match(checkAttachments(many, [f('extra.txt', 10)]).errors[0], /up to/);
});

test('checkAttachments skips duplicates, including within one batch', () => {
  const r = checkAttachments([f('deck.pdf', 100)], [f('deck.pdf', 100), f('x.pdf', 5), f('x.pdf', 5)]);
  assert.deepEqual(r.accepted.map((x) => x.name), ['x.pdf']);
  assert.equal(r.errors.length, 2);
});

test('formatBytes uses B, KB and MB', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1.5 * MB), '1.5 MB');
});
