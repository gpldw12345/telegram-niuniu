# Telegram Niuniu World Cup Bot

Telegram betting bot for World Cup matches.

## Agreed MVP

- Displayed as RM balance only, no real-money wallet.
- Markets: `1X2`, `Asian Handicap`, `Correct Score`.
- Betting windows: pre-match and half-time.
- Half-time bets settle against final full-time score.
- Asian Handicap shows up to 3 lines per match.
- Correct Score odds start as admin-managed/manual odds.
- Admin site manages users, balances, matches, odds, bets, and settlement.
- Development can use mock odds until real World Cup data is available.

## Project Layout

```text
apps/api      Telegram bot, API server, odds sync jobs
apps/admin    Admin dashboard
packages/shared  Shared market/window constants
prisma        Database schema
docs          Product workflow notes
```

## First Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev:api
```

In another terminal:

```bash
npm run dev:admin
```

## Next Build Step

Wire the Telegram bot `/start` and group match post flow against real database records.

## Odds Provider

The project starts with `ODDS_PROVIDER=mock` so we can build before real World Cup odds are available. Later, set:

```env
ODDS_PROVIDER=odds-api
ODDS_API_KEY=your_key
```

Correct Score remains admin-managed for MVP unless a provider with correct-score coverage is added.
