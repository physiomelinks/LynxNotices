// Adds the notice an issue form asks for to notices.json. Run by the "Notice from issue" workflow, with the
// issue's body in ISSUE_BODY; to try it by hand: ISSUE_BODY="$(cat body.md)" node scripts/notice-from-issue.mjs
//
// On a runner it writes a report to $RUNNER_TEMP/notice-report.md - the pull request's description on success,
// what is wrong with the form on failure - and the notice's id to GITHUB_OUTPUT.
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { readFeed, validateFeed, writeFeed } from './lib/feed.mjs'
import { noticeFromIssue } from './lib/issueForm.mjs'

const { ISSUE_BODY, ISSUE_NUMBER, RUNNER_TEMP, GITHUB_OUTPUT } = process.env
const reportPath = RUNNER_TEMP ? join(RUNNER_TEMP, 'notice-report.md') : null

function report(text) {
  console.log(text)
  if (reportPath) writeFileSync(reportPath, text + '\n')
}

function fail(problems) {
  const list = problems.map((problem) => `- ${problem}`).join('\n')
  report(`The notice could not be drafted:\n\n${list}\n\nEdit the issue to try again.`)
  process.exit(1)
}

try {
  const feed = readFeed()
  const today = new Date().toISOString().slice(0, 10)
  const { notice, problems } = noticeFromIssue(ISSUE_BODY, { takenIds: feed.notices.map((n) => n.id), today })
  if (problems.length) fail(problems)

  // Newest first, as the applications list them.
  feed.notices.unshift(notice)
  const unsound = validateFeed(feed)
  if (unsound.length) fail(unsound.map((problem) => `\`${problem}\``))

  writeFeed(feed)
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `id=${notice.id}\n`)

  const closes = ISSUE_NUMBER ? `Closes #${ISSUE_NUMBER}.\n\n` : ''
  report(
    `${closes}Adds this notice, drafted from the issue form. Once merged it reaches the applications within a few minutes.\n\n` +
      '```json\n' +
      JSON.stringify(notice, null, 2) +
      '\n```'
  )
} catch (error) {
  fail([`\`${error.message}\``])
}
