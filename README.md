# Fantasy Force Draft Command

Live draft board for ESPN league **296381258** (Foolish Club / The Fantasy Force).

12-team PPR · QB, 2 RB, 3 WR, TE, FLEX, K, DST.

## Get a permanent URL (Vercel)

Repo: https://github.com/kdurbin88-lang/fantasy-force-draft

1. Open [vercel.com/new](https://vercel.com/new)
2. Import **fantasy-force-draft**
3. If it does not appear: **Adjust GitHub App Permissions** → enable this repo → Import
4. Deploy (leave the defaults)
5. Bookmark the `*.vercel.app` URL and pin it next to ESPN

## Draft night

1. Open the Vercel site next to ESPN.
2. Set **SLOT**.
3. Click **WATCH ESPN WINDOW** and share **Pick History**, or paste picks.
4. Take the name on the hero card. Round 1 pick 4 = **Jahmyr Gibbs**.

## Edge sniffer (optional)

`python helper/espn-sniffer.py` after launching Edge with `--remote-debugging-port=9222`.
