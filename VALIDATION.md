# Validation report

Validation performed on September 30, 2026. This report states observed checks, not a production certification or score guarantee.

## Automated core tests

`npm test`: **12 tests passed**, including source coordinate mapping, ball elevation, JSONL, 25 FPS interpolation at a 60 FPS sample time, null/non-play frames, period transitions, missing data, large gaps, duplicate timestamps, legacy schema, clip limits, timestamp links, portable clip round trips, and playback ranges/looping.

## Real SkillCorner match

The downloader retrieved **match 2017461: Melbourne Victory Football Club vs Auckland FC** from the official repository, including the Git LFS tracking object rather than its pointer.

Observed normalization:

- 58,452 playable frames at 10 FPS.
- 32 player identities across the full game, including substitutions.
- 105 × 68 meter pitch.
- 5,845.1 seconds of concatenated playing-period timeline.
- Teams and jersey numbers resolved from match metadata; no missing-team warnings.
- Approximately 676 ms to normalize on this container in the initial Node integration check; this is not a browser or hardware performance guarantee.

Full dataset files are intentionally excluded from the deliverable and Git source. Run `npm run data` to fetch them yourself.

## Browser smoke checks

A headless Chromium browser using software WebGL rendered the React app with **no JavaScript page errors** during the checks:

- Pitch, jerseys and ball rendered on one WebGL canvas.
- Play/pause controls operated.
- All three camera buttons operated.
- A named one-second clip saved and replayed to its end.
- Timestamp link contained the expected start and end.
- Portable JSON clip downloaded.
- WebM export produced a nonempty downloadable video. FFprobe identified VP8 video at 1374 × 640 pixels.
- The real match loaded through the bundled-match button and background parsing worker.
- 768, 390 and 320 pixel viewports had no document-level horizontal overflow.
- Desktop and mobile screenshots were inspected; the mobile player selector was subsequently adjusted to wrap within its panel.

The export smoke check exposed empty streams during direct WebGL recording. Recording now copies frames to a 2D surface, flushes deferred drawing, requests capture frames explicitly, and uses a recording-specific elapsed-time clock. Cleanup restores the previous playback state.

## Production build

`npm run build` succeeded. The 3D JavaScript bundle exceeds Vite's default 500 kB chunk warning threshold; this is a loading-size warning, not a build failure. Three.js contributes much of the payload.

## Remaining practical checks

- Verify frame cadence and WebM timing on the computer/browser used in the live demo. Software rendering in a headless container cannot certify smooth GPU playback.
- Test Safari/Firefox if those browsers are part of your intended audience. WebM support varies; portable JSON remains available.
- Publish to your chosen host and verify a timestamp link from another device with the same match loaded.
- Record the required user tutorial and add your GitHub/hosted links to the actual competition submission.

There is no claim of zero latency, zero bugs, exact frame-perfect browser encoding, or a guaranteed rubric score.
