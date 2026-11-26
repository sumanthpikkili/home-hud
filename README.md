# Home HUD: a wall dashboard for an old Fire HD 10

A single-page "Jarvis-style" dashboard with a clock, weather, Environment Canada alerts, sun and moon, countdowns (with Ontario holidays), a bin-day reminder, voice-command tips and a news ticker. It runs free on GitHub Pages: no server, no API keys, no paid services.

```
index.html                      the whole dashboard (edit the CONFIG block at the top)
news.json                       headlines, refreshed by the GitHub Action
weather.json                    weather backup copy, refreshed by the GitHub Action
alerts.json                     Environment Canada alerts backup, refreshed by the GitHub Action
scripts/update-feeds.js         the script the Action runs
.github/workflows/news.yml      the schedule (every 30 minutes)
```

> **Privacy:** free GitHub Pages sites live in **public** repositories, so anyone with the link can see the page and its files. Use **city-centre coordinates only** (2 decimals), never your street address, and put nothing private in the countdowns, tips or quotes.

---

## 1. Create the repository

1. Sign up at **github.com** (free plan).
2. Click **+** (top right), then **New repository**.
3. Name it, for example `home-hud`. Choose **Public**. Tick **Add a README file**. Click **Create repository**.

## 2. Upload the files (website only, no command line)

**Regular files.** On the repo page click **Add file**, then **Upload files**. Drag in `index.html`, `news.json`, `weather.json` and `alerts.json`, then click **Commit changes**.

**Files in folders.** You can't drag folders whose names start with a dot, so create these one at a time:

1. Click **Add file**, then **Create new file**.
2. In the name box, type the **full path**: `.github/workflows/news.yml`. GitHub turns each `/` into a folder as you type.
3. Paste the contents of `news.yml` and click **Commit changes**.
4. Repeat with the path `scripts/update-feeds.js` and paste that file's contents.

## 3. Turn on GitHub Pages

1. In the repo, go to **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*. Set **Branch** to `main` and the folder to `/ (root)`. Click **Save**.
3. Wait 1–2 minutes and refresh. The page shows your live URL, for example `https://YOUR-USERNAME.github.io/home-hud/`.

## 4. Run the news job once to confirm it works

1. Open the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
2. Click **Update news and weather** on the left, then **Run workflow**, then the green **Run workflow** button.
3. After about 30 seconds you should see a green tick. Open the run to see one line per feed (`ok cbc-top: 10 headlines`, and so on).
4. A new commit, "Update news and weather", appears on the repo, and the ticker picks it up within about 10 minutes.

> **Headlines stopped updating?** GitHub pauses scheduled workflows in repos that have had no activity for 60 days. Go to **Actions**, then **Update news and weather**, and click **Enable workflow**. Run it once by hand. The ticker shows an amber **NEWS STALE** tag when headlines are more than 6 hours old.

## 5. Set up Fully Kiosk Browser on the Fire HD 10

1. Install Fully Kiosk Browser from fully-kiosk.com (sideload the APK; the Amazon Appstore version is outdated).
2. In **Settings**, then **Web Content Settings**, set **Start URL** to your GitHub Pages URL.
3. Recommended settings:
   - **Device Management:** *Keep Screen On* = ON, *Screen Orientation* = Landscape.
   - **Web Content Settings:** *Enable Pull to Refresh* = OFF, *Enable Zoom* = OFF.
   - **Web Browsing Settings:** *Load Start URL on Home Button* = ON.
   - **Advanced Web Settings:** *Reload on Screen On* = ON. Optionally, *Reload on Network Reconnect* = ON.
   - **Fullscreen mode** ON, *Hide Navigation Bar* and *Hide Status Bar* ON.
   - *Kiosk Mode* (Plus licence) is optional; the dashboard works without it.
4. In the Fire's own Settings, set **Display, then Sleep** to the longest value. Fully's *Keep Screen On* handles the rest.

The page reloads itself every 6 hours, which picks up your edits and clears memory on the old tablet. Night/dim mode starts at 22:00 and ends at 06:30.

## 6. Edit settings later

1. In the repo, click `index.html`, then the **pencil icon** (Edit).
2. Change values in the `CONFIG` block at the top: name, city, latitude/longitude, 12/24-hour clock, units, night hours, countdowns, tips, quotes, news options.
3. Click **Commit changes**. GitHub Pages republishes in about 1 minute.
4. The tablet checks for a changed `index.html` every 15 minutes and reloads itself when it finds one (`autoUpdateMinutes` in CONFIG). To see a change immediately, use Fully's **Reload**. If an old version still shows, add `?v=2` (any new number) to the end of the Start URL. That forces a fresh copy.

### Bin-day reminder

The `binDay` block in CONFIG is set for **Thursday** pickup: organics every week, with garbage and recycling alternating (Thursday 26 Nov 2026 was a garbage week). A weekday holiday on or before Thursday pushes pickup to Friday. If your schedule changes, adjust:

| Setting | What to put |
|---|---|
| `weekday` | Your collection day, e.g. `"Thursday"` |
| `weekly` | Items collected every week |
| `alternate.referenceDate` | Any collection date (`YYYY-MM-DD`) that was a "week A" day |
| `alternate.weekA` / `weekB` | What goes out on alternating weeks. Seasonal items can be `{ name: "Yard waste", months: [4,5,6,7,8,9,10,11] }` |
| `holidayShift` | `true` if a weekday holiday pushes collection back one day (Peel does this; check your calendar) |
| `remindFrom` / `remindUntil` | When the reminder shows: from this time the evening before, until this time on pickup morning |

The reminder appears at the top of the T-Minus panel and in the line under the greeting.

The weather backup (`weather.json`) reads latitude, longitude and timezone from `index.html` automatically, so you only change them in one place.

**Test switches** (add to the URL):

| Switch | What it does |
|---|---|
| `?night=1` / `?night=0` | Force night mode on / off |
| `?fps=1` | Show a frame-rate counter (top right) |
| `?perf=low` | Try a performance mode without editing CONFIG |
| `?boot=1` / `?boot=0` | Force / skip the boot animation |
| `?alerts=demo` | Show two sample weather alerts |
| `?wx=snow` / `?wx=rain` / `?wx=dots` | Preview the background particle styles |
| `?binday=thursday` | Pretend collection is on that weekday (to preview the reminder) |
| `?upd=0` | Turn off the auto-update check |

Switches can be combined: `?night=1&fps=1`.

## 7. Fire HD 10 tuning: what to lower if it feels laggy

Open the page with `?fps=1` and look at the FPS number. Anything above about 20 feels smooth. If it's lower, try these in order:

1. **`performanceMode: "medium"`**: 18 particles at 20 fps, 2 spinning rings, static hex grid.
2. **`tuning.particles: 0`**: turns off the canvas entirely (the biggest single saving).
3. **`tuning.spinningRings: 1`** (or `0`): fewer rotating layers in the reactor.
4. **`tuning.hexDrift: false`**: stops the drifting background grid.
5. **`tuning.scanLine: false`** and **`tuning.panelTicks: false`**: removes the remaining small animations.
6. **`performanceMode: "low"`**: does all of the above at once.

Night mode already pauses particles, rings and the grid.

## How it stays reliable

- **Clock:** works fully offline using the tablet's clock and the configured time zone.
- **Weather:** loads straight from Open-Meteo every 15 minutes. If that fails, it falls back to the `weather.json` copy on your own site, then to the last good copy saved on the tablet. Stale data gets an amber marker, and retries back off from 1 to 15 minutes.
- **Weather alerts:** the page asks Environment Canada every 5 minutes for alerts covering your coordinates, falling back to `alerts.json`. Warnings show as a red banner over the news ticker, while watches, advisories and special weather statements show in amber. Several alerts rotate. The banner stays visible in night mode.
- **Rain/snow timing:** Open-Meteo's 15-minute forecast drives the line under the conditions ("Snow starting around 3:15 PM", "Rain ending around 6:30 PM", "Dry for the next 11 hours").
- **Holidays:** Ontario statutory holidays (plus Civic Holiday) are worked out on the tablet and mixed into the countdowns (`holidays.show`, default 2). Set `holidays.observances: true` to add Mother's Day, Father's Day, Halloween and others.
- **News:** the GitHub Action fetches the CBC and BBC feeds (top stories plus technology) every 30 minutes. It keeps headline text only, never article text or images, and commits only when something changed. If one feed fails, its previous headlines are kept.
- **Burn-in protection:** the whole layout drifts a few pixels every 4 minutes.
- **Errors:** errors are swallowed and never shown on screen. Every module fails on its own, so one problem can't blank the page.
