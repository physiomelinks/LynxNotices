// Checks notices.json: `npm run validate`. Exits with 1, listing what is wrong, when the feed is not sound.
import { readFeed, validateFeed } from './lib/feed.mjs'

let feed
try {
  feed = readFeed()
} catch (error) {
  console.error(`notices.json cannot be read: ${error.message}`)
  process.exit(1)
}

const problems = validateFeed(feed)
if (problems.length) {
  console.error(`notices.json has ${problems.length} problem${problems.length === 1 ? '' : 's'}:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`notices.json is sound: ${feed.notices.length} notice${feed.notices.length === 1 ? '' : 's'}.`)
