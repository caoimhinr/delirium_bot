# Delirium Bot

Delirium Bot is a Discord bot built with `discord.js` and Azure OpenAI integration. It watches for commands and mentions, then replies in a few different personalities ranging from playful drama to supportive encouragement to a custom interactive claim workflow.

It also includes a web-based admin and maintenance panel, protected with Discord OAuth, plus PostgreSQL-backed storage for claims, events, guilds, members, and settings.

## Features

- Discord bot built on `discord.js`
- Azure OpenAI-backed responses
- Mention the bot to trigger a custom “Jas” persona reply
- Command-based interaction using the `$` prefix
- Drama mode for playful antagonizing replies
- Sweet mode for supportive replies
- Steam price checking from store links
- Interactive `$claim` command using reactions and replies
- PostgreSQL-backed data model for events, guilds, members, claims, and web settings
- Maintenance UI with Discord login and authorized member access
- Dockerized app runtime with Docker Compose support

## Commands

- `$ping` — basic availability check
- `$help` — lists available commands
- `$members` — prints usernames from `data/members.json`
- `$xemidan @user` — deletes the command message and posts a fixed insult
- `$drama [count]` — picks a recent message or a replied-to message and generates sassy replies
- `$sweet [count]` — picks a recent message or a replied-to message and generates supportive replies
- `$pricecheck <steam url>` — fetches the current Steam price for linked app URLs
- `$pricecheck drama <steam url>` — fetches the price and adds AI-generated mockery
- `$claim` — starts the interactive claim registration flow

## Claim flow

The `$claim` command follows the flow described in `PROMPT.md`:

1. The bot lists known events and adds numbered reactions.
2. The user reacts to choose an event.
3. The bot shows current claims for that event.
4. If the user or their guild already has a claim, the bot offers:
   - `✏️` edit latest existing claim
   - `➕` create a new claim
5. The bot asks for a phase number.
6. The bot asks for an optional description.
   - The user may reply with text
   - Or react with `✅` to skip
7. The bot saves the claim in PostgreSQL.

## Data model

Implemented tables:

- `events`
- `guilds`
- `members`
- `claims`
- `web_settings`

Default seeded events:

- `Castle Siege`
- `Guild Raid`
- `World Boss`

These can be managed in the maintenance UI.

## Web admin and maintenance

The Express app in `web/server.js` provides:

- Discord OAuth login via `passport-discord`
- `/settings` for guild prompt settings
- `/maintenance` for CRUD-style record management
- authorized access using `data/authorizedMembers.json`
- optional fallback role-based access using `ADMIN_ROLE_ID`

### Maintenance UI supports

- add/delete events
- add/update/delete guilds
- add/update/delete members
- delete claims

## Project structure

```text
.
├── index.js
├── discordClient.js
├── commands.js
├── claimFlow.js
├── claimService.js
├── db.js
├── llm/
│   └── endpoints.js
├── data/
│   ├── authorizedMembers.json
│   ├── prompts.js
│   ├── friends.js
│   └── members.json
├── web/
│   ├── server.js
│   ├── guildSettings.json
│   ├── views/
│   │   ├── settings.html
│   │   └── maintenance.html
│   └── public/
│       └── style.css
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Environment variables

Create a `.env` file with values like:

```env
DISCORD_TOKEN=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
MAX_COMPLETION_TOKENS=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_CALLBACK_URL=https://discord.caoimhinr.online/callback
SESSION_SECRET=

ADMIN_ROLE_ID=
GUILD_ID=
PORT=3000

POSTGRES_DB=delirium_bot
POSTGRES_USER=delirium
POSTGRES_PASSWORD=delirium_password
POSTGRES_PORT=5432
DATABASE_URL=postgres://delirium:delirium_password@postgres:5432/delirium_bot

ITAD_API_KEY=
```

## Authorized maintenance users

Edit `data/authorizedMembers.json` and add Discord user IDs that should be allowed into `/maintenance` and `/settings`.

Current default:

```json
[
  "361732550106021890"
]
```

## Running locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

## Running with Docker Compose

Build and start the stack:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f app
docker compose logs -f postgres
```

Stop the stack:

```bash
docker compose down
```

Remove stack and database volume:

```bash
docker compose down -v
```

## Notes

- The bot requires the `Message Content` privileged intent to read message text.
- The bot currently uses a `$` command prefix.
- The maintenance UI is intended to sit behind Nginx Proxy Manager at `discord.caoimhinr.online`.
- `DISCORD_CALLBACK_URL` should match the externally reachable callback URL.
- PostgreSQL is now actively used when `DATABASE_URL` is set.

## License

ISC
