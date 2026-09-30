# Touchline · 3D Soccer Tracking Studio

React + Three.js workspace for exploring SkillCorner player tracking, trimming sequences, and sharing tactical moments. Built for the **US Soccer × Georgia State ColorStack Tech League** challenge.

## Quick start

Requirements: **Node.js 20.19+**, npm, **Python 3.9+** for the optional dataset helper, and a browser with WebGL. Chrome/Edge are recommended for WebM export.

```bash
npm install
npm run data
npm run dev
```

Open the local URL printed by Vite and click **Load bundled match**. The download helper selects the first match in SkillCorner's current official match list. Select another match with:

```bash
python3 scripts/download_match.py --id YOUR_MATCH_ID
```

**The source ZIP deliberately excludes tracking datasets.** Downloaded metadata, tracking, and the generated manifest live under ignored `public/data/`. Never commit that directory's contents to the submission repository.

For a production build:

```bash
npm run test
npm run build
npm run preview
```

Deploy `dist/` with any static host. If you build after downloading data, Vite copies that match to `dist/data/` for hosted playback. Keep that deployed data out of the Git repository. Without bundled data, visitors can import local files and the app still works.

## First-time walkthrough

1. **Load a match:** use the bundled-match button, or select `{id}_match.json` using **Metadata**, then import the corresponding tracking JSON/JSONL. Metadata identifies team membership and jersey numbers. A neutral jersey explicitly indicates unavailable team metadata.
2. **Explore:** play/pause, drag the timeline, seek ±5 seconds, or change playback speed. The elapsed playback clock and original period/match clock are both shown.
3. **Change your angle:** Tactical gives an overhead view; Free Orbit supports dragging and wheel zoom; Player Follow tracks the selected player. Select players from the menu below the pitch.
4. **Inspect:** toggle trails and jersey labels. The HUD displays the selected player's estimated speed and the source's identified player in possession.
5. **Trim:** drag the two trim handles or type exact start/end seconds. Clips must be greater than zero and no longer than ten seconds. **Set start at playhead** captures the current moment; **Preview** stops at the trimmed end.
6. **Save:** the clip library holds named sequences for the current session. A saved clip can be replayed, shared, or deleted.
7. **Share:** choose a timestamp URL, portable JSON, or WebM video. Timestamp links require a hosted URL and the same match loaded by the recipient. Portable JSON includes only the needed positions plus boundary frames and can be imported directly by another user.

Keyboard: Space toggles playback and left/right arrows seek five seconds when focus is outside an editing field or button. Native controls also work with keyboard navigation.

## Stack and project structure

| Layer | Choice | Reason |
|---|---|---|
| App | React, Vite | Static hosting; fast development and production bundling |
| HUD | Tailwind CSS, Lucide React | Responsive slate `#0F172A` interface and labeled controls |
| Rendering | Three.js, React Three Fiber, Drei | GPU rendering, frame-loop access, orbit controls and line geometry |
| App state | Zustand | Match, cameras, overlays and saved clip metadata |
| Playback | Mutable clock + direct mesh refs | No React reconciliation for player movement |
| Parsing | Web Worker + typed arrays | Move parsing off the UI thread; transfer buffers without copying them back |
| Export | Canvas captureStream + MediaRecorder | Browser-native 3D video recording with portable JSON fallback |

```text
src/
  components/
    Pitch3D.jsx          Procedural grass, regulation markings, goals, stands and lights
    TrackingScene.jsx    Player meshes, number sprites, shadows, trails and cameras
    VideoControls.jsx    Playback, timeline, trim handles, clip library and sharing dialog
  lib/
    parseSkillCorner.js  Input normalization, typed buffers, interpolation and speeds
    parse.worker.js      Background parser and transferable buffers
    playback.js          Mutable render clock and range boundaries
    clips.js             Validation, timestamp links and portable clip generation
    exportWebM.js        Recording lifecycle, cancellation and cleanup
    demo.js              Explicitly labeled synthetic smoke-test fixture
  App.jsx                File import, scene shell, camera and overlay controls
  store.js               Zustand app state
scripts/download_match.py
tests/tracking.test.js
```

## Tracking architecture

The official repository currently documents **10 FPS extrapolated tracking JSONL**, not a fixed 25 FPS format. Source timestamps define timing. The parser also accepts arrays and legacy `data`/`trackable_object` frames when matching metadata is supplied.

Coordinates are in meters, centered on the pitch. Mapping is `world.x = source.x`, `world.z = -source.y`, and `world.y = ball.z` when ball elevation exists. Missing ball height defaults to the ground. Pitch dimensions come from metadata with a 105 × 68 m fallback. All frames are preserved; the parser does not assume exactly 22 unique player IDs because substitutions add identities over a match.

Normalized frames become flat `Float32Array` buffers; timestamps use `Float64Array`. A binary search finds the bracketing source frames at playback time. Positions use `A + (B − A) × alpha`. Rendering therefore interpolates at the display refresh rate, commonly 60 Hz, without generating a much larger precomputed 60 FPS dataset. It also works for 10, 25 and 30 FPS inputs.

Periods are concatenated into an elapsed tracking timeline. The original timestamps and periods remain available in the HUD. Duplicate timestamps retain the last frame. Large source gaps and period transitions are never interpolated. Missing coordinates hide the corresponding mesh rather than drawing a fabricated player at the origin. Frame-to-frame speed is not smoothing-adjusted and can be noisy; it is an estimate, not a validated physical-performance metric.

`TrackingScene.useFrame` advances the mutable clock, computes a frame pair, and mutates mesh positions. It does **not** call React setters or Zustand setters during rendering. The HUD reads the clock at 10 Hz; camera/overlay changes are ordinary React state updates. Trail buffer geometries are allocated once and updated at 10 Hz. Number textures are locally drawn canvases, so rendering does not depend on external fonts or image assets.

## Clip and recording behavior

- Trims are positive-duration, at most ten seconds, and inside the loaded match.
- Clip replay restarts at its own start after reaching its end. Manual timeline scrubbing returns to full-match playback.
- Portable clips retain bracketing frames, preserving interpolation at exact trim boundaries. The exported `range` limits playback to the selected portion.
- Timestamp URLs encode match ID, start and end. A recipient must have the same match file; files are not uploaded to a server.
- WebM records the current 3D camera in real time at requested 60 FPS, normal speed, with looping off. It records the canvas, not DOM HUD text. Other controls lock during export. The previous playback state is restored afterward.
- Export supports cancellation and stops when the tab becomes hidden. Browser encoder availability is checked before recording; portable JSON is the fallback.
- Clips are session-only and reset when a match is loaded. Download portable clips to retain them.

## Performance and honest limits

No app can guarantee “zero frame lag” on every GPU or browser. Device pixel ratio is capped at 1.5, jersey textures are cached, mesh positions use direct refs, trails use preallocated buffers, and parsing runs in a worker. Large matches still require RAM for text parsing plus typed arrays. The import cap is 250 MiB. WebM timing/frame cadence depends on the browser, encoder and device; this is not an offline frame-perfect encoder. No audio is exported.

The bundled synthetic demo is clearly marked and is **not** the required real-match submission. Use the download helper and verify an actual SkillCorner match before your final demo. Procedural grass avoids external textures and canvas-taint issues. Stadium geometry is lightweight and stylized; players are jersey markers, not motion-captured bodies.

## Validation

`npm test` covers JSONL decoding, source FPS inference, 25-to-60 FPS interpolation, coordinate/ball-height mapping, metadata teams, missing tracking, period transitions, gaps, duplicate timestamps, legacy input, clip limits, shared-match validation, portable clip round trips, and playback boundaries. See `VALIDATION.md` for checks actually performed in the authoring environment. A passing unit suite is not proof of browser rendering or export correctness; test your target browser and hardware before presenting.

## Video tutorial plan (90–120 seconds)

- **0:00–0:15:** introduce Touchline and load the official match. Point out both teams, the ball and the source FPS.
- **0:15–0:35:** play/pause, scrub to a moment, and demonstrate slow motion.
- **0:35–0:55:** switch to Free Orbit, then select a player and use Player Follow. Show trails and possession.
- **0:55–1:20:** mark the playhead, trim seven seconds, name the sequence, preview and save it.
- **1:20–1:40:** download a portable clip and import it to demonstrate recipient playback. Show WebM export.
- **1:40–2:00:** briefly explain timestamp interpolation, direct mesh updates and dataset-independent parsing.

This is a recording outline, **not a completed tutorial video**. Record the real app using your browser or screen recorder for the official submission.

## Submission checklist

- [ ] Load and verify one official SkillCorner match.
- [ ] Verify tracking playback, all three cameras, clip boundaries and WebM in the target browser.
- [ ] Record and include the first-time-user tutorial video.
- [ ] Push this source project to your GitHub repository, excluding datasets and `node_modules`.
- [ ] Add your repository URL and hosted app URL to your submission.

## Sources and credit

- SkillCorner Open Data: https://github.com/SkillCorner/opendata
- React Three Fiber performance guidance: https://r3f.docs.pmnd.rs/advanced/pitfalls
- Canvas captureStream: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
- MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

Credit SkillCorner for downloaded tracking data and follow the upstream data license. This project is an independent student tool, not an official US Soccer product. The supplied rubric targets guide the implementation; no score or bug-free certification is claimed.
