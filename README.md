# n8n-nodes-alphone

This is an n8n community node. It lets you use [AlphOne](https://alph.one) in
your n8n workflows.

AlphOne is a self-hosted, task-centric CRM. Everything its interface does goes
through a JSON API, so anything you can do in the app you can automate here.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/)
workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Releasing](#releasing)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
in the n8n community nodes documentation.

## Operations

- Task
  - Create a task
  - Get a task
  - Get many tasks, filtered by day, by overdue cutoff, or by contact
  - Update a task
  - Complete a task
- Contact
  - Create a contact
  - Get a contact with its channel identities
  - Get many contacts, with optional search
  - Rename a contact
- Import
  - Get an import with its columns, its mapping, and its counts
  - Get many imports, newest first
  - Get the contacts an import created, each with the row that created it

## Credentials

AlphOne authenticates programs with an API token. Create one on the machine
running AlphOne:

```sh
alphone token create -email you@example.com -name n8n
```

The secret prints once and is stored only as a hash, so keep it somewhere safe.
A token acts as the user who created it. Revoke one with
`alphone token revoke`.

Add an AlphOne API credential in n8n with two fields:

- **Base URL**, where AlphOne answers, with no trailing slash
- **API Token**, the secret printed above

Use the credential's test button to confirm the connection before building a
workflow.

### Reaching AlphOne from a container

Inside a container, `localhost` means the container itself, never your machine.
Point the base URL at `http://host.docker.internal:8080` instead. Docker Engine
on Linux does not provide that name by default, so add it to the n8n service:

```yaml
extra_hosts:
  - 'host.docker.internal:host-gateway'
```

If AlphOne and n8n share a compose project, use the service name instead, such
as `http://alphone:8080`.

## Compatibility

Tested with n8n 2.33.6 and AlphOne 0.6.0.

## Usage

Listing tasks takes exactly one filter: a day, an overdue cutoff, or a contact.
Dates accept expressions, so a morning digest of today's work reads:

```text
Filter By: Due On A Day
Date:      {{ $now.toFormat('yyyy-MM-dd') }}
```

Get Many returns the records themselves rather than the response envelope, so
the next node receives one item per task or contact.

Creating a task needs a title and a due date. Due dates are calendar days,
`YYYY-MM-DD`, not timestamps, so rescheduling is day arithmetic in your own
timezone.

Task creation takes an optional Origin Event ID, the uuid of whatever the task
answers. AlphOne stores one task per origin, so a workflow that runs twice on
the same event gets the task it already created instead of a duplicate. Import
rows carry a `row_id` meant for exactly this, which is what makes an import
workflow safe to re-run after a failure halfway through.

Get Contacts on the Import resource returns one item per contact the import
created, each carrying `contact_id`, `name`, and the `row_id` that created it.
Feed those items into Loop Over Items to spread the work over days: with a
batch size of twenty and a due date of `{{ $now.plus({ days: $runIndex
}).toFormat('yyyy-MM-dd') }}`, the first twenty contacts are due today, the
next twenty tomorrow, and so on.

## Example workflows

Three ready-made workflows live in [examples](examples). Import one from the
n8n canvas menu, then open each AlphOne node and pick your credential, which
the files leave as a placeholder.

- [overdue-task-digest.json](examples/overdue-task-digest.json) collects the
  tasks you have not finished and builds a message from them, every morning at
  eight. Swap the final node for Slack, Gmail, or Telegram to deliver it.
- [whatsapp-message-to-task.json](examples/whatsapp-message-to-task.json)
  creates a task the moment a WhatsApp message arrives, linked to the contact
  AlphOne resolved it to, so the reply lands on the right day and the right
  person.

- [import-to-daily-tasks.json](examples/import-to-daily-tasks.json) turns a
  finished contact import into a call list spread over days. It waits for
  `import.completed`, reads the contacts that import created, and creates one
  task per contact in batches of twenty, dating each batch a day later than the
  one before. Every task carries its import row as the origin event, so
  re-running the workflow creates nothing twice.

The WhatsApp one needs the AlphOne WhatsApp plugin configured, and the import
one needs the importer plugin. Activate a workflow before testing it: an
inactive trigger has no subscription, so AlphOne has nowhere to deliver.

## Releasing

Publishing runs in GitHub Actions with an npm provenance attestation, which
n8n requires for community nodes.

One time, on npmjs.com under the package's Publish access settings, add a
Trusted Publisher: repository owner `gopherium`, repository
`n8n-nodes-alphone`, workflow `publish.yml`. No token secret is needed. As a
fallback, a granular npm token stored as the `NPM_TOKEN` repository secret
works too.

To release, run `npm run release` locally. It lints, builds, bumps the
version, updates the changelog, commits, tags, and pushes. The tag triggers
the publish workflow.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [AlphOne REST API reference](https://docs.alph.one/reference/rest-api/)
- [AlphOne automation guide](https://docs.alph.one/guides/automation/)
