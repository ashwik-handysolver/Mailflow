import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportRows, guessColumnMapping, parseCsvTable } from './csvImport';

test('parseCsvTable detects header rows and semicolon delimiters', () => {
  const table = parseCsvTable('Name;Email\nAda Lovelace;ada@example.com');
  assert.equal(table.hasHeader, true);
  assert.deepEqual(table.headers, ['Name', 'Email']);
  assert.equal(table.rows.length, 1);
});

test('parseCsvTable treats a first row with an email as data', () => {
  const table = parseCsvTable('Ada,Analytical,ada@example.com');
  assert.equal(table.hasHeader, false);
  assert.equal(table.rows.length, 1);
});

test('guessColumnMapping does not confuse "Company Name" with the lead name', () => {
  const table = parseCsvTable('Company Name,Contact Name,Work Email,Phone Number\nAcme,Jo Doe,jo@acme.io,123');
  const mapping = guessColumnMapping(table);
  assert.equal(mapping.company, 0);
  assert.equal(mapping.fullName, 1);
  assert.equal(mapping.email, 2);
  assert.equal(mapping.phone, 3);
});

test('guessColumnMapping combines first and last name columns', () => {
  const table = parseCsvTable('First Name,Last Name,Email\nJo,Doe,jo@acme.io');
  const mapping = guessColumnMapping(table);
  const rows = buildImportRows(table, mapping, []);
  assert.equal(rows[0].lead.fullName, 'Jo Doe');
  assert.equal(rows[0].issue, null);
});

test('buildImportRows flags invalid, missing and duplicate rows', () => {
  const table = parseCsvTable(
    [
      'Name,Email',
      'Valid Person,valid@x.io',
      ',nameless@x.io',
      'Bad Email,not-an-email',
      'Existing,taken@x.io',
      'Repeat,valid@x.io',
    ].join('\n')
  );
  const rows = buildImportRows(table, guessColumnMapping(table), ['TAKEN@x.io']);
  assert.deepEqual(
    rows.map((r) => r.issue),
    [null, 'missing_name', 'invalid_email', 'duplicate_existing', 'duplicate_in_file']
  );
  assert.equal(rows[0].line, 2);
});
