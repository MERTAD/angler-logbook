# Angler Logbook

A private logbook for anglers: save spots, trotlines and trolling paths on a map, log catches with photos and the conditions at the time, and check sun, moon and fish activity forecasts for any place and day.

Inspired by https://web.fishingpoints.app

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Save spots by typing coordinates, using your position or clicking the map, each with an icon, colour and notes; search, sort, edit and delete them.
- Draw trotlines and trolling paths on the map and see their length; rename, redraw or delete them.
- See your spots, paths and catches on one map, centre on your position, pick a point and measure distances in km and nautical miles.
- Log catches with species, time, place, size, gear, notes and photos; the sun, moon and activity conditions are recorded with each one.
- Get a daily fish activity score with major and minor periods, an hourly chart and a month calendar for a spot or coordinates.
- See sunrise, sunset, moonrise, moonset, moon overhead and underfoot, phase and illumination in the place's time zone.
- Download your spots and paths as a GPX file.

Left out: accounts and sign-in, which your Gateway handles; phone apps, widgets and alerts; tides, weather and other live data feeds; satellite and nautical chart layers; species guides and photo ID; GPX/KML import; plans and sharing.

## Setup

There are no secrets or settings. The app uses one D1 database and one R2 bucket (`photos`); R2 must be enabled on the Cloudflare account once.

```sh
pnpm install
pnpm dev          # run locally as a test user
pnpm test         # unit tests
pnpm run deploy   # put it on your Gateway
```

## Limitations

- The map is a bundled outline of coastlines and large lakes, with no streets, satellite imagery or depth; small lakes, rivers and islands don't show.
- Forecasts use sun and moon only. Times use a whole-hour UTC offset estimated from longitude unless you pick one, so daylight saving and odd zone borders need a manual pick.
- Photos are limited to 10 MB each (JPEG, PNG, WebP, GIF, HEIC or AVIF).
- Every member's data is private to them; nothing is shared within the team, and admins can't see others' data.
