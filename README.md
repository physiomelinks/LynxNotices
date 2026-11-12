# Lynx Notices

Notices shown inside the Physiome Links applications, [PhLynx](https://github.com/physiomelinks/phlynx) and CUFLynx: announcements such as an upcoming end of support for an older file format.

Every notice lives in one file, [`notices.json`](notices.json). The applications fetch it when they start, show the notices addressed to them, and remember on each user's machine which ones have been read. Merging a change to `main` publishes it; no application release is needed.

## Posting a notice

### With the issue form

1. Open a new issue and choose **Post a notice**.
2. Fill in the title, the severity and the applications. Everything else is optional.
3. Submit. A pull request adding the notice appears within a minute, linked from the issue.
4. Review and merge the pull request. The notice reaches the applications a few minutes later, and the issue closes.

The form fills in two fields for you:

- **`id`** is made from the publication date and the title, such as `2026-11-12-support-for-pre-0-5-workspace-files`.
- **`published`** is the day the pull request is drafted, unless you name a later day in **Publish on**.

If the form has a mistake, the workflow comments on the issue saying what is wrong. Edit the issue and it tries again.

The pull request is drafted straight away for people with access to this repository. For an issue from anyone else, a maintainer adds the `approved` label to draft it.

### By hand

Add an entry to the top of `notices` in [`notices.json`](notices.json), run `npm install` once and then `npm run validate`, and open a pull request.

```json
{
  "id": "2026-11-12-support-for-pre-0-5-workspace-files",
  "title": "Support for pre-0.5 workspace files ends in v0.8",
  "description": "Re-save older workspaces to upgrade them.",
  "link": "https://github.com/physiomelinks/phlynx/issues/1234",
  "severity": "warning",
  "published": "2026-11-12",
  "expires": "2027-03-01",
  "targets": ["phlynx"],
  "versions": { "phlynx": "<0.8.0" }
}
```

## Fields

| Field | Required | What it holds |
| --- | --- | --- |
| `id` | yes | Lower-case words joined by hyphens. Unique, and never changed or reused. |
| `title` | yes | One line of plain text, up to 100 characters. |
| `targets` | yes | Where the notice is shown: `["all"]`, or any of `"phlynx"` and `"cuflynx"`. |
| `published` | yes | When the notice is first shown. Notices are listed newest first. |
| `description` | no | Plain text, up to 600 characters. Line breaks are kept; markup is shown as written. |
| `link` | no | Where to read more. Must start with `https://`. |
| `severity` | no | `info` (the default), `warning` or `critical`. |
| `expires` | no | When the notice stops being shown. |
| `versions` | no | By application, the versions that show the notice, as a [semver range](https://github.com/npm/node-semver#ranges). An application left out shows it in every version. |

Dates are a day (`2026-11-12`, meaning 00:00 UTC that day) or a moment (`2026-11-12T09:00:00Z`).

The full definition is [`schema/notices.schema.json`](schema/notices.schema.json).

## Rules worth knowing

- **Never change or reuse an `id`.** Applications remember read notices by id, so a changed id shows up as unread for everyone, and a reused one is hidden from everyone who read the first.
- **To correct a notice, edit it in place.** People who have read it will not be told again. If the correction matters, post a new notice.
- **To withdraw a notice, delete it.** It disappears from the applications the next time they fetch.
- **Give an expiry to anything temporary.** A new user sees every unexpired notice as unread.
- **A notice is public as soon as it is merged**, even with a later `published` date: the file is readable by anyone.

## How applications read the file

Applications fetch

```
https://cdn.jsdelivr.net/gh/physiomelinks/LynxNotices@main/notices.json
```

and should follow these rules, so that old installs keep working as the file grows:

- Read the file only when `schema` is `1`. A layout that older applications could not read will be published under a new schema number, at a new path.
- Show a notice when `targets` holds the application's name or `all`, the application's version is within its range in `versions` (if it has one), `published` has passed and `expires` has not.
- Ignore fields you do not know, and skip any entry you cannot read without dropping the rest.
- Treat `title` and `description` as plain text, never as HTML, and follow only `https` links.

jsDelivr serves a branch file for up to twelve hours. The **Validate** workflow asks it to refresh after every merge to `main`, which brings that down to a few minutes.

## Adding an application

1. Add its name, in lower case, to `$defs.application` in [`schema/notices.schema.json`](schema/notices.schema.json).
2. In [`.github/ISSUE_TEMPLATE/notice.yml`](.github/ISSUE_TEMPLATE/notice.yml), add it to the **Applications** options and add an `<Name> versions` field. The name there may be capitalised however the application writes it.

`npm test` fails if the two disagree.

## What the checks cover

`npm run validate` checks `notices.json` against the schema, and also that no id is used twice, that every version range is a real semver range for an application the notice targets, and that no notice expires before it is published. It runs on every pull request and on every push to `main`.

Pull requests drafted from the issue form are validated by the drafting workflow itself before they are opened. GitHub does not start other workflows for pull requests opened by a workflow, so the **Validate** check does not appear on them.

## Setting up the repository

These are one-off steps for a maintainer:

1. Create the labels `notice` and `approved`. The issue form applies `notice` only if the label exists.
2. Under **Settings → Actions → General → Workflow permissions**, tick **Allow GitHub Actions to create and approve pull requests**.
3. Protect `main` so that changes need a reviewed pull request. If you also require the **Validate** check, pull requests drafted from the issue form need closing and reopening to run it.
