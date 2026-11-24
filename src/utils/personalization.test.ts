import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVariables, personalizeEmail } from './personalization';

test('personalizeEmail replaces all supported variables for a complete lead', () => {
  const result = personalizeEmail({
    subject: 'Opportunity with {{company}} for {{name}}',
    bodyHtml:
      '<p>Hi {{name}},</p><p>Reaching out to {{company}} via {{email}} or {{phone}}.</p>',
    lead: {
      fullName: 'John Smith',
      company: 'Acme Technologies',
      email: 'john@acmetech.io',
      phone: '+1 (415) 890-2311',
    },
  });

  assert.equal(result.subject, 'Opportunity with Acme Technologies for John Smith');
  assert.ok(result.bodyHtml.includes('Hi John Smith,'));
  assert.ok(result.bodyHtml.includes('Acme Technologies'));
  assert.ok(result.bodyHtml.includes('john@acmetech.io'));
  assert.ok(result.bodyHtml.includes('+1 (415) 890-2311'));
  assert.equal(result.hasMissingFields, false);
  assert.deepEqual(result.missingFields, []);
});

test('personalizeEmail never emits undefined or null when fields are missing and highlights them in preview', () => {
  const result = personalizeEmail({
    subject: 'Follow-up for {{company}}',
    bodyHtml: '<p>Hi {{name}}, call us back at {{phone}}.</p>',
    lead: {
      fullName: 'Sarah Johnson',
      company: '',
      email: 'sarah@technova.co',
      phone: undefined as unknown as string,
    },
  });

  assert.equal(result.hasMissingFields, true);
  assert.deepEqual(result.missingFields.sort(), ['company', 'phone']);
  assert.equal(result.subject.includes('undefined'), false);
  assert.equal(result.subject.includes('null'), false);
  assert.equal(result.bodyHtml.includes('undefined'), false);
  assert.equal(result.bodyHtml.includes('null'), false);
  assert.ok(result.previewSubjectHtml.includes('data-missing-var="company"'));
  assert.ok(result.previewBodyHtml.includes('data-missing-var="phone"'));
});

test('personalizeEmail escapes HTML injection in lead fields', () => {
  const result = personalizeEmail({
    subject: 'Hello {{name}}',
    bodyHtml: '<p>Hi {{name}}, Company: {{company}}</p>',
    lead: {
      fullName: '<script>alert(1)</script>',
      company: 'A & B <Corp>',
      email: 'a@b.com',
      phone: '',
    },
  });

  assert.equal(result.bodyHtml.includes('<script>'), false);
  assert.ok(result.bodyHtml.includes('&lt;script&gt;'));
  assert.ok(result.bodyHtml.includes('A &amp; B &lt;Corp&gt;'));
  assert.equal(result.previewSubjectHtml.includes('<script>'), false);
});

test('extractVariables returns unique variables present in text', () => {
  const vars = extractVariables(
    'Hi {{name}} from {{ company }}, email {{email}} and {{name}}'
  );
  assert.deepEqual(vars, ['name', 'company', 'email']);
});
