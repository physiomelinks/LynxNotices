import { ALL_TARGETS, APPLICATIONS, SEVERITIES } from './feed.mjs'

/** The form's headings, by the notice field each fills. `<Application> versions` headings are read by name. */
export const FORM_LABELS = {
  title: 'Title',
  description: 'Description',
  severity: 'Severity',
  targets: 'Applications',
  link: 'Link',
  published: 'Publish on',
  expires: 'Expires',
}
/** The option of the Applications field that stands for every application. */
export const ALL_APPLICATIONS_OPTION = 'All applications'

const VERSIONS_LABEL = /^(.+) versions$/
const NO_RESPONSE = '_No response_'
const MAX_SLUG_LENGTH = 48

/**
 * The answers of an issue form, by heading. GitHub writes a submitted form as `### Heading` then the answer,
 * with `_No response_` for a field left empty.
 *
 * @param {string} body - The issue's body.
 * @returns {Map<string, string>}
 */
export function parseIssueForm(body) {
  const answers = new Map()
  const sections = String(body ?? '').replace(/\r\n/g, '\n').split(/^### +(.+?) *$/m)
  for (let i = 1; i < sections.length; i += 2) {
    const answer = sections[i + 1].trim()
    answers.set(sections[i], answer === NO_RESPONSE ? '' : answer)
  }
  return answers
}

/** `title` as the words of an id: lower case, joined by hyphens, cut at a word. */
function slug(title) {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  let joined = ''
  for (const word of words) {
    const longer = joined ? `${joined}-${word}` : word
    if (longer.length > MAX_SLUG_LENGTH) break
    joined = longer
  }
  return joined || 'notice'
}

/** An id of the day and title, numbered when the feed already has it. */
function uniqueId(published, title, taken) {
  const base = `${published.slice(0, 10)}-${slug(title)}`
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return id
}

/** An application's name in the form (PhLynx) as its name in the feed (phlynx), or null when it has none. */
function applicationNamed(name) {
  const lower = name.trim().toLowerCase()
  return APPLICATIONS.includes(lower) ? lower : null
}

/**
 * The notice an issue form asks for. The id and - unless the form names a day - the publication date are filled
 * in here; the rest is as written. What cannot be understood is reported, not guessed at; whether the notice
 * is sound is for `validateFeed` to say.
 *
 * @param {string} body - The issue's body.
 * @param {object} options
 * @param {Iterable<string>} options.takenIds - The ids already in the feed.
 * @param {string} options.today - Today, as YYYY-MM-DD.
 * @returns {{notice: object, problems: string[]}}
 */
export function noticeFromIssue(body, { takenIds, today }) {
  const answers = parseIssueForm(body)
  const answer = (field) => answers.get(FORM_LABELS[field]) ?? ''
  const problems = []

  const title = answer('title').replace(/\s+/g, ' ')
  if (!title) problems.push(`**${FORM_LABELS.title}** is empty.`)

  const targets = []
  const chosen = answer('targets').split(',').map((o) => o.trim()).filter(Boolean)
  for (const option of chosen) {
    const target = option === ALL_APPLICATIONS_OPTION ? ALL_TARGETS : applicationNamed(option)
    if (target === null) problems.push(`**${FORM_LABELS.targets}**: "${option}" is not an application.`)
    else if (!targets.includes(target)) targets.push(target)
  }
  if (!chosen.length) problems.push(`**${FORM_LABELS.targets}** has no application chosen.`)
  // Every application covers each one.
  const shownIn = targets.includes(ALL_TARGETS) ? [ALL_TARGETS] : targets

  const severity = answer('severity').toLowerCase() || SEVERITIES[0]
  const published = answer('published') || today

  const versions = {}
  for (const [label, range] of answers) {
    const match = VERSIONS_LABEL.exec(label)
    if (!match || !range) continue
    const application = applicationNamed(match[1])
    if (application === null) problems.push(`**${label}**: "${match[1]}" is not an application.`)
    else versions[application] = range
  }

  const notice = { id: uniqueId(published, title, new Set(takenIds)), title }
  if (answer('description')) notice.description = answer('description')
  if (answer('link')) notice.link = answer('link')
  notice.severity = severity
  notice.published = published
  if (answer('expires')) notice.expires = answer('expires')
  notice.targets = shownIn
  if (Object.keys(versions).length) notice.versions = versions

  return { notice, problems }
}
