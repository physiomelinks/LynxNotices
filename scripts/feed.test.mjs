import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readFeed, validateFeed } from './lib/feed.mjs'

const notice = (overrides = {}) => ({
  id: '2026-11-12-a-notice',
  title: 'A notice',
  targets: ['phlynx'],
  published: '2026-11-12',
  ...overrides,
})
const feedOf = (...notices) => ({ schema: 1, notices })
const problemsOf = (...notices) => validateFeed(feedOf(...notices))

test('the feed in the repository is sound', () => {
  assert.deepEqual(validateFeed(readFeed()), [])
})

test('accepts a notice with every field', () => {
  const full = notice({
    description: 'Re-save older workspaces.\nNewer ones are not affected.',
    link: 'https://github.com/physiomelinks/phlynx/issues/1',
    severity: 'warning',
    published: '2026-11-12T09:00:00Z',
    expires: '2027-03-01',
    targets: ['phlynx', 'cuflynx'],
    versions: { phlynx: '<0.8.0', cuflynx: '>=1.2.0 <2' },
  })
  assert.deepEqual(problemsOf(full), [])
  assert.deepEqual(problemsOf(notice({ targets: ['all'], versions: { phlynx: '<0.8.0' } })), [])
})

test('rejects a feed of another shape', () => {
  for (const feed of [null, [], {}, { schema: 2, notices: [] }, { schema: 1 }, { schema: 1, notices: [], extra: 1 }]) {
    assert.notDeepEqual(validateFeed(feed), [], JSON.stringify(feed))
  }
})

for (const [what, overrides, expected] of [
  ['a missing title', { title: undefined }, /title/],
  ['a missing publication date', { published: undefined }, /published/],
  ['no targets', { targets: [] }, /targets/],
  ['an unknown target', { targets: ['notlynx'] }, /targets/],
  ['an id that is not lower-case words', { id: 'Not An Id' }, /id/],
  ['a title with space around it', { title: ' padded ' }, /title/],
  ['a link that is not https', { link: 'http://example.org/' }, /link/],
  ['an unknown severity', { severity: 'apocalyptic' }, /severity/],
  ['a date that is not one', { published: '12 November' }, /published/],
  ['a day that does not exist', { expires: '2027-02-30' }, /expires/],
  ['a field the schema does not know', { colour: 'red' }, /colour/],
  ['a version range for all', { targets: ['all'], versions: { all: '<1' } }, /versions/],
  ['a version range that is not one', { versions: { phlynx: 'old ones' } }, /not a semver range/],
  ['a version range for an application not targeted', { versions: { cuflynx: '<1' } }, /not among/],
  ['an expiry before publication', { expires: '2026-11-01' }, /expires before/],
]) {
  test(`rejects ${what}`, () => {
    const problems = problemsOf(notice(overrides))
    assert.ok(problems.length > 0, 'no problem was found')
    assert.match(problems.join('\n'), expected)
  })
}

test('rejects an id used twice, naming both notices', () => {
  const problems = problemsOf(notice(), notice({ id: 'another' }), notice({ title: 'A repeat' }))
  assert.deepEqual(problems, ['notices[2] "2026-11-12-a-notice": the id is already used by notices[0]'])
})

test('reports a value that fits none of a choice in one line', () => {
  assert.deepEqual(problemsOf(notice({ expires: 'next year' })), [
    'notices[0] "2026-11-12-a-notice" /expires: must be a day (YYYY-MM-DD) or a moment (YYYY-MM-DDTHH:MM:SSZ)',
  ])
  assert.deepEqual(problemsOf(notice({ targets: ['phlynx', 'notlynx'] })), [
    'notices[0] "2026-11-12-a-notice" /targets/1: must be all, phlynx or cuflynx',
  ])
  assert.deepEqual(problemsOf(notice({ severity: 'loud' })), [
    'notices[0] "2026-11-12-a-notice" /severity: must be equal to one of the allowed values: info, warning, critical',
  ])
})

test('says which notice a schema problem is in', () => {
  const [problem] = problemsOf(notice(), notice({ id: 'second', severity: 'loud' }))
  assert.match(problem, /^notices\[1\] "second" \/severity: /)
})
