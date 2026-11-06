# The Rivalry League

A live cricket auction and league app. The superadmin spins a wheel to draw each player, team owners bid from their own phones, and every screen follows along in real time. After the auction it runs the league too: fixtures, tosses, results and a points table with net run rate.

It runs as a website on Vercel and as an Android app that loads the same site, so most updates reach phones without a reinstall. iPhone users can add the website to their Home Screen.

**Live site:** https://rivalryleague.vercel.app

## Who can do what

| Role | Sign-in | Can do |
|---|---|---|
| **Superadmin** | Password | Spin the wheel, sell players, set team budgets, manage teams, players, fixtures, results and settings, and assign owners |
| **Team owner** | Login ID and password set by the superadmin | Bid for their own team, see their squad and upload their team's logo |
| **Viewer** | None | Watch the auction, squads, fixtures and leaderboard |

Players do not have logins.

## Features

**Auction**
- Spin wheel, shown live on every screen on the Auction tab. Every screen gets a 2.5 second "Get ready", then the wheel turns together. The drawn player stays hidden, and bidding stays closed, until it stops
- Wheel filters: Available, Unsold or Everyone
- Direct nomination and direct sale from the player pool
- Owners bid in steps of ₹100, ₹250, ₹500 or ₹1,000 from their phones
- **No going back to smaller raises:** once a player has been raised by ₹250, the ₹100 step closes for that player, and so on up to ₹1,000. Every new player starts with all four steps open
- **My squad:** owners see the players they have bought, with prices, under their bid buttons
- Sold animation and sounds for spins, bids, sales and unsold players on every screen, with an on/off button in the header
- Add players one at a time, or paste a whole list under **Players → Add from Text**. List numbers and bullets are removed, duplicates are skipped, and a line can end with a base price
- Live sync across screens, about every 0.7 seconds while a player is up for bids
- Re-auction of sold or unsold players, with automatic refunds
- Keyboard shortcuts on desktop: `S` spin, `1`-`9` bid for a team, `Enter` sell, `U` unsold

**Auction rules enforced by the server**
- A team cannot go over its squad limit or its purse
- **Max bid:** a team must keep the ₹500 base price for each other open squad place, so it can always fill its squad
- A team already leading cannot outbid itself
- An owner's raise below the current minimum raise is refused
- A new spin is refused while the wheel is turning or a player is on the block, so a live bid is never lost
- Only the superadmin can change a team's budget
- A sale is refused if a newer bid has come in since the superadmin's screen last updated
- Simultaneous bids cannot overwrite each other

**League**
- Fixtures added by the superadmin, with date and venue. The number of league matches is set in League Settings (or asked on the first Add Match), and Add Match stops at that number
- Knockouts, chosen in League Settings: top 4 play semi-finals (1st v 4th, 2nd v 3rd) then the final, or top 2 go straight to the final. Once every league match has a result, a **Create semi-finals** / **Create final** button appears on the Schedule page, filled in from the points table. A tied or abandoned knockout sends the higher-placed team through. Knockout matches do not count in the points table
- 3D coin toss, closed once a match is completed
- Scorecard entry, including all-out, ties and no results
- Leaderboard ranked by points, then net run rate, then wins
- Win animation and sound on every screen when a team wins a match

| Result | Points |
|---|---|
| Win | 2 |
| Tie | 1 each |
| No result | 1 each |

Net run rate is runs scored per over minus runs conceded per over. A side bowled out is charged its full quota of overs. Abandoned matches do not count.

## How an auction runs

1. The superadmin adds teams and players, then assigns each owner under **Teams → Assign owner**.
2. Owners sign in and open the **Auction** tab.
3. The superadmin presses **Spin**. Every screen shows "Get ready" for 2.5 seconds, then the wheel turns.
4. When it stops, the player appears and owners bid.
5. The superadmin presses **Sold** or **Unsold**, then spins again.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript
- [Supabase](https://supabase.com) Postgres, reached with [postgres.js](https://github.com/porsager/postgres)
- Hand-written CSS in `app/globals.css`, with the Space Grotesk font and lucide-react icons
- [Capacitor](https://capacitorjs.com) for the Android app
- Vercel for hosting and GitHub Actions for APK builds

## Run it locally

You need Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Without `DATABASE_URL`, the app uses the local file `data/auction-db.json`. That file and `lib/server/db.ts` hold the default superadmin password for a new database. Change it in League Settings straight away.

### Environment variables

Put these in `.env.local`, which git ignores. Never commit them.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | In production | Supabase **Transaction pooler** connection string (port 6543) |
| `AUTH_SECRET` | In production | Long random string used to sign login sessions |

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Creates a production build |
| `npm start` | Runs the production build |
| `npm run icons` | Rebuilds the Android icon and splash images from `resources/` |

## Deploying

1. Create a Supabase project, open **SQL Editor**, paste all of `supabase/schema.sql` and press **Run**.
2. Import the repository into Vercel.
3. Add `DATABASE_URL` and `AUTH_SECRET` as environment variables.
4. Deploy. Each push to `main` then deploys automatically.

## Android app

The app is a thin Capacitor shell around the hosted site. Website changes reach the app without a reinstall. A new APK is only needed if the app's name, icon or web address changes.

1. In the GitHub repository, go to **Settings → Secrets and variables → Actions → Variables**.
2. Add `CAP_SERVER_URL` with your hosted site's address.
3. Each push to `main` builds an APK. You can also run **Build Android APK** from the Actions tab.
4. Download `rivalry-league-apk` from the finished run.

This is a debug build meant for sharing directly, not for the Play Store. The app needs an internet connection.

## iPhone

There is no iPhone app, because the APK only installs on Android. Open the website in Safari and choose **Share → Add to Home Screen**. It then opens from its own icon, without the browser bars. A real iOS app would need a Mac and a paid Apple Developer account.

## Project layout

```
supabase/            Database tables (schema.sql)
app/                 Main page, global styles and API routes (app/api)
components/
  common/            Shared pieces, including the spin wheel
  layout/            Top bar and navigation
  modals/            Popups such as Assign Owner and League Settings
  views/             One component per page
lib/
  client/            API client, sounds, live event effects and logo resizing
  server/
    auth/            Passwords, session tokens and login lockout
    services/        Auction, login, match, owner, player and team logic
    db.ts            Reads and writes the league data
  shared/            Used on both sides: max bid, standings and the player list reader
public/              Logo and iPhone icon
data/                Starter data for local runs without a database
android/             Capacitor Android project
resources/           App icon and splash images
www/                 Offline screen for the Android app
```

## Database

`supabase/schema.sql` creates these tables. You can view and edit them in Supabase's Table Editor.

| Table | One row per | Holds |
|---|---|---|
| `league` | league (one row) | Name, season, default purse, squad size, and the save counter |
| `superadmin` | one row | Superadmin name and password hash |
| `teams` | team | Name, short name, colour, owner, tagline, purse, spent, squad count, logo |
| `owner_logins` | team with an owner | Login ID and password hash. Removed with its team |
| `players` | player | Number, name, base price, status, buyer and price |
| `matches` | fixture | Teams, date, venue, toss, both scores, result |
| `auction_state` | one row | Player up for bidding, live bid, leader, minimum raise and the latest wheel spin |
| `login_attempts` | account and network | Wrong-password count for the lockout |

The app reads everything with `load_league()` and saves with `save_league()` in one transaction, so a save is all or nothing. The save counter in `league.rev` stops two simultaneous saves from overwriting each other.

**Editing in the Table Editor:** you can add or change rows by hand. Leave `id`, `position`, `number`, `short`, `color` and `purse` empty and they are filled in the way the app would. Every hand edit bumps `league.rev`, so open screens pick it up within seconds, and an app save made from an older copy is refused instead of overwriting it. Owner passwords cannot be added by hand, because only hashes are stored; use **Teams → Assign owner**.

**Speed:** screens ask `/api/state` for everything in one request, and pass the last revision so an unchanged league answers in a few bytes. Every change replies with the fresh league, so the screen updates without asking again. Team logos are served as cacheable images instead of inside every refresh.

Row Level Security is on for every table with no policies, and the two functions are closed to Supabase's public API keys. Only the app's own connection string can read or change data, and passwords are only ever stored as hashes.

## Security

- Every action that changes data is checked on the server, and owners can only act for their own team
- Superadmin and owner passwords are stored as salted scrypt hashes
- Sessions are signed and last 12 hours
- 8 wrong passwords from one network locks that login on that network for 15 minutes

If a database password has ever been committed to a public repository, treat it as exposed and change it.
