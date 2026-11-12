import { readFileSync, writeFileSync } from 'node:fs'

import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import semver from 'semver'

const ROOT = new URL('../../', import.meta.url)
export const FEED_URL = new URL('notices.json', ROOT)

const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'))

export const schema = readJson(new URL('schema/notices.schema.json', ROOT))
/** The applications a notice can target, as the schema lists them. */
export const APPLICATIONS = schema.$defs.application.enum
export const ALL_TARGETS = 'all'
export const SEVERITIES = schema.$defs.notice.properties.severity.enum

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const matchesSchema = ajv.compile(schema)

export const readFeed = () => readJson(FEED_URL)

export function writeFeed(feed) {
  writeFileSync(FEED_URL, JSON.stringify(feed, null, 2) + '\n')
}

/** `/notices/2/title` as `notices[2] "the-id" /title`, so the notice at fault can be found. */
function locate(feed, path) {
  const match = /^\/notices\/(\d+)(.*)$/.exec(path)
  if (!match) return path || 'the feed'
  const id = feed.notices?.[match[1]]?.id
  const named = typeof id === 'string' ? ` "${id}"` : ''
  return `notices[${match[1]}]${named}${match[2] ? ' ' + match[2] : ''}`
}

/** What a schema error means, in words for whoever wrote the notice. */
function describe(error) {
  if (error.keyword === 'anyOf') {
    return /\/targets\/\d+$/.test(error.instancePath)
      ? `must be ${[ALL_TARGETS, ...APPLICATIONS].join(', ').replace(/, ([^,]+)$/, ' or $1')}`
      : 'must be a day (YYYY-MM-DD) or a moment (YYYY-MM-DDTHH:MM:SSZ)'
  }
  if (error.params?.additionalProperty) return `${error.message} (${error.params.additionalProperty})`
  if (error.params?.allowedValues) return `${error.message}: ${error.params.allowedValues.join(', ')}`
  return error.message
}

/**
 * Everything wrong with `feed`: where it departs from the schema, and what the schema cannot say - ids used
 * twice, version ranges that are not ranges, notices that expire before they are published.
 *
 * @param {*} feed - The parsed feed.
 * @returns {string[]} One line per problem; empty when the feed is sound.
 */
export function validateFeed(feed) {
  if (!matchesSchema(feed)) {
    // A value that fits none of a choice of schemas is reported once per schema and once more for the choice;
    // one plain line says it better.
    const choices = matchesSchema.errors.filter((error) => error.keyword === 'anyOf').map((e) => e.instancePath)
    return matchesSchema.errors
      .filter((error) => error.keyword === 'anyOf' || !choices.includes(error.instancePath))
      .map((error) => `${locate(feed, error.instancePath)}: ${describe(error)}`)
  }

  const problems = []
  const seen = new Map()
  feed.notices.forEach((notice, index) => {
    const where = `notices[${index}] "${notice.id}"`

    if (seen.has(notice.id)) problems.push(`${where}: the id is already used by notices[${seen.get(notice.id)}]`)
    else seen.set(notice.id, index)

    for (const [application, range] of Object.entries(notice.versions ?? {})) {
      if (semver.validRange(range) === null) {
        problems.push(`${where} /versions/${application}: "${range}" is not a semver range`)
      }
      if (!notice.targets.includes(application) && !notice.targets.includes(ALL_TARGETS)) {
        problems.push(`${where} /versions/${application}: ${application} is not among the notice's targets`)
      }
    }

    if (notice.expires && Date.parse(notice.expires) <= Date.parse(notice.published)) {
      problems.push(`${where} /expires: the notice expires before it is published`)
    }
  })
  return problems
}
