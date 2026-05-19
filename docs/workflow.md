# Product Workflow

## Daily Pre-Match Flow

1. Backend syncs World Cup events from The Odds API.
2. Backend stores matches, opening odds snapshots, and active betting windows.
3. Bot posts today's matches to the Telegram group.
4. Each match message has a `Place Bet` button with a deep link into private bot chat.
5. User chooses market, selection, stake, and confirms.
6. Stake is deducted immediately from the user's play-points balance.
7. The bet stores the exact odds used at confirmation time.

## Half-Time Flow

1. At half-time, admin or system opens the half-time betting window.
2. Bot posts a second group message for that match.
3. Users can place another bet using the same markets.
4. Half-time bets use the half-time odds snapshot.
5. All half-time bets settle against the final full-time score.

## Markets

### 1X2

Selections:

- Home win
- Draw
- Away win

Settlement is based on the final full-time result.

### Asian Handicap

Each match shows up to 3 handicap lines.

Example:

```text
Argentina -0.25 @ 0.75 / Japan +0.25 @ 1.05
Argentina -0.5  @ 0.90 / Japan +0.5  @ 0.98
Argentina -0.75 @ 1.10 / Japan +0.75 @ 0.82
```

Settlement supports full win, half win, push, half loss, and full loss.

### Correct Score

Correct Score starts as admin-managed odds for MVP. The Odds API can still be used for match data and supported market odds, while the admin site controls the correct-score offer list.

## Data Before Real World Cup Odds

The first build uses a provider switch:

- `ODDS_PROVIDER=mock` for development and demos.
- `ODDS_PROVIDER=odds-api` when real World Cup odds are available.

The admin site can also override odds manually, which is important for Correct Score and any missing handicap lines.

## Admin Responsibilities

- Add and deduct user points.
- Open and close betting windows.
- Review odds snapshots and manual odds.
- Settle matches after final score.
- Audit all point changes and admin actions.
