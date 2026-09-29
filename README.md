# WatchAdjust

A Three.js guide for setting watch complications — moon phase, annual calendar, perpetual calendar, day-date, and complete calendar.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

Run the tests with `npm test`.

## Features

- **3D watch preview** — turn and zoom a realistic watch (leather strap or steel bracelet); hands and complication windows update to match your target date/time
- **Set it yourself** — enter what your watch shows now and get exact steps ("press the day corrector 3 times"), then practise on the 3D watch: tap the crown to pull it, drag it to turn, press the correctors. Steps tick off as the watch matches, and it warns you when a move would damage a real watch (e.g. using the calendar between 9 pm and 3 am)
- **Brand models** — Rolex Day-Date 40, Seiko Presage day-date, Patek Philippe Annual Calendar, IWC Portugieser Perpetual Calendar, Longines Master Collection Moonphase and Frederique Constant Classics Moonphase, each with its own controls and look (steps follow the usual instructions; the owner's manual has the final word)
- **Beginner friendly** — each complication has a plain-English explanation, and watch jargon (crown, corrector, aperture…) is tappable for a definition
- **Show on watch** — tap a step to highlight and zoom to the part of the watch it refers to; tick steps off as you go
- **Time travel** — step a day or month at a time (← / →, Shift for months) or press play (Space) to watch the date flip and the moon wax and wane
- **Moon phase** — accurate to about an hour (Meeus), with lunar age, illumination and a Southern Hemisphere view
- **Annual calendar** — date, month, day-of-week with warnings for Feb / 30-day month quirks
- **Perpetual calendar** — full date setup including leap-year notes
- **Day-date** — Rolex-style day and date alignment
- **Complete calendar** — date, day, month, and moon phase together
- **Responsive** — on phones the watch stays pinned while the guide scrolls; light and dark themes follow your system (or the toggle)

Pick a complication, set the date and time, and follow the steps.
