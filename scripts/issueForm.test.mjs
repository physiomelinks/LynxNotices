import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { APPLICATIONS, validateFeed } from './lib/feed.mjs'
import { ALL_APPLICATIONS_OPTION, FORM_LABELS, noticeFromIssue, parseIssueForm } from './lib/issueForm.mjs'

const TODAY = '2026-11-12'

/** An issue's body as GitHub writes a submitted form: empty fields as `_No response_`. */
function formBody(answers = {}) {
  const fields = {
    Title: 'Support for pre-0.5 workspace files ends in v0.8',
    Description: '',
    Severity: 'info',
    Applications: 'PhLynx',
    Link: '',
    'Publish on': '',
    Expires: '',
    'PhLynx versions': '',
    'CUFLynx versions': '',
    ...answers,
  }
  return Object.entries(fields)
    .map(([label, answer]) => `### ${label}\n\n${answer || '_No response_'}`)
    .join('\n\n')
}

const draft = (answers, takenIds = []) => noticeFromIssue(formBody(answers), { takenIds, today: TODAY })

test('reads the answers by heading, with nothing for a field left empty', () => {
  const answers = parseIssueForm(formBody({ Description: 'Line one.\n\nLine two.' }).replace(/\n/g, '\r\n'))
  assert.equal(answers.get('Title'), 'Support for pre-0.5 workspace files ends in v0.8')
  assert.equal(answers.get('Description'), 'Line one.\n\nLine two.')
  assert.equal(answers.get('Link'), '')
})

test('fills in the id and the publication date', () => {
  const { notice, problems } = draft()
  assert.deepEqual(problems, [])
  assert.deepEqual(notice, {
    id: '2026-11-12-support-for-pre-0-5-workspace-files-ends-in-v0-8',
    title: 'Support for pre-0.5 workspace files ends in v0.8',
    severity: 'info',
    published: '2026-11-12',
    targets: ['phlynx'],
  })
  assert.deepEqual(validateFeed({ schema: 1, notices: [notice] }), [])
})

test('keeps every field that is filled in', () => {
  const { notice, problems } = draft({
    Description: 'Re-save older workspaces.\nNewer ones are not affected.',
    Severity: 'warning',
    Applications: 'PhLynx, CUFLynx',
    Link: 'https://github.com/physiomelinks/phlynx/issues/1234',
    'Publish on': '2026-12-01',
    Expires: '2027-03-01',
    'PhLynx versions': '<0.8.0',
    'CUFLynx versions': '>=1.2.0',
  })
  assert.deepEqual(problems, [])
  assert.deepEqual(notice, {
    id: '2026-12-01-support-for-pre-0-5-workspace-files-ends-in-v0-8',
    title: 'Support for pre-0.5 workspace files ends in v0.8',
    description: 'Re-save older workspaces.\nNewer ones are not affected.',
    link: 'https://github.com/physiomelinks/phlynx/issues/1234',
    severity: 'warning',
    published: '2026-12-01',
    expires: '2027-03-01',
    targets: ['phlynx', 'cuflynx'],
    versions: { phlynx: '<0.8.0', cuflynx: '>=1.2.0' },
  })
  assert.deepEqual(validateFeed({ schema: 1, notices: [notice] }), [])
})

test('targets all when every application is chosen, alone or with others', () => {
  assert.deepEqual(draft({ Applications: 'All applications' }).notice.targets, ['all'])
  assert.deepEqual(draft({ Applications: 'All applications, PhLynx' }).notice.targets, ['all'])
})

test('numbers an id the feed already has', () => {
  const first = draft({ Title: 'Maintenance' }).notice.id
  assert.equal(first, '2026-11-12-maintenance')
  assert.equal(draft({ Title: 'Maintenance' }, [first]).notice.id, '2026-11-12-maintenance-2')
  assert.equal(draft({ Title: 'Maintenance' }, [first, `${first}-2`]).notice.id, '2026-11-12-maintenance-3')
})

test('makes an id of plain words, cut at a word', () => {
  assert.equal(draft({ Title: 'Café – “new” módules!' }).notice.id, '2026-11-12-cafe-new-modules')
  const long = draft({ Title: 'An extraordinarily long title that goes on and on about nothing in particular' })
  assert.equal(long.notice.id, '2026-11-12-an-extraordinarily-long-title-that-goes-on-and')
  assert.equal(draft({ Title: '!!!' }).notice.id, '2026-11-12-notice')
})

test('reports what it cannot understand', () => {
  assert.match(draft({ Title: '' }).problems.join(), /Title/)
  assert.match(draft({ Applications: '' }).problems.join(), /Applications/)
  assert.deepEqual(draft({ Applications: 'NotLynx' }).problems, ['**Applications**: "NotLynx" is not an application.'])
  assert.match(noticeFromIssue('not a form at all', { takenIds: [], today: TODAY }).problems.join(), /Title/)
})

test('leaves what is written but wrong for the feed check to report', () => {
  const { notice, problems } = draft({ Link: 'example.org', Expires: 'next year', 'PhLynx versions': 'old ones' })
  assert.deepEqual(problems, [])
  const unsound = validateFeed({ schema: 1, notices: [notice] }).join('\n')
  assert.match(unsound, /link/)
  assert.match(unsound, /expires/)
})

test('the issue form asks for what the script reads, and for each application', () => {
  const template = readFileSync(new URL('../.github/ISSUE_TEMPLATE/notice.yml', import.meta.url), 'utf8')
  const labels = [...template.matchAll(/^ +label: (.+)$/gm)].map((match) => match[1])
  const options = [...template.matchAll(/^ +- (.+)$/gm)].map((match) => match[1])

  for (const label of Object.values(FORM_LABELS)) assert.ok(labels.includes(label), `no "${label}" field`)
  assert.ok(options.includes(ALL_APPLICATIONS_OPTION))

  const offered = options.map((option) => option.toLowerCase())
  const versioned = labels.filter((label) => label.endsWith(' versions')).map((label) => label.slice(0, -9).toLowerCase())
  for (const application of APPLICATIONS) {
    assert.ok(offered.includes(application), `${application} cannot be chosen`)
    assert.ok(versioned.includes(application), `${application} has no versions field`)
  }
  assert.deepEqual(versioned.sort(), [...APPLICATIONS].sort())
})
