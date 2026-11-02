# Motion and mobile verification

Measured on 1 November 2026 in visible native Chrome Beta 158 with GPU rendering enabled. The attached display is 60 Hz. Results are recorded in [performance-results.json](performance-results.json).

## Frame cadence

Each run records five approximately four-second scenes: hero, card entrance during native touch scrolling, outro transition during native touch scrolling, about, and community. The phone viewport is 390 × 844 at DPR 3. Desktop is 1080 × 913 at DPR 1.

| Run | Frame rate across scenes | Intervals over 25 ms | Long tasks during capture |
| --- | --- | --- | --- |
| Optimized desktop | 59.99–60.01 fps | 0 | 0 |
| Phone emulation | 59.99–60.00 fps | 0 | 0 |
| Phone emulation, 4× CPU throttling | 59.99–60.01 fps | 0 | 0 |

Measurements combine requestAnimationFrame timing with DevTools rendering traces. The longest observed interval in these optimized captures was 17.8 ms. These establish smooth cadence on this 60 Hz setup; they do not establish actual 120 Hz presentation or performance on a physical phone. No artificial frame-rate or refresh-rate overrides were used.

## Rendering work removed

Native ViewTimeline animations replace the per-scroll JavaScript transform loop. CSS rotation and counter-rotation replace the wheel's per-frame size reads and transform writes. Ambient patterns move with transforms instead of background-position repaints. Card entrances, hover transforms, and reveal transforms use separate elements. Shadows fade using opacity rather than interpolating box-shadow.

| Desktop scene, four-second trace | Paint records before | Paint records after |
| --- | ---: | ---: |
| Hero | 482 | 0 |
| Card entrance | 746 | 19 |
| Outro transition | 1,045 | 20 |
| About | 729 | 0 |
| Community | 729 | 0 |

The optimized captures recorded zero Layout events. The remaining transition paint records occur around scene state changes; the steady ambient animations recorded zero paints and raster tasks. Card-entrance raster tasks fell from 2,162 to 20.

This follows the [transform and opacity performance guidance](https://web.dev/articles/animations-guide) and Chrome's [native scroll animation guidance](https://developer.chrome.com/blog/scroll-animation-performance-case-study).

## Responsive and interaction checks

- Portrait viewports: 320 × 568, 375 × 667, 390 × 844, and 430 × 932.
- Landscape viewport: 667 × 375.
- All five sizes retain the pinned scene sequence, the five learning cards, and the outro. No horizontal overflow or card-content overflow was detected.
- The public GitHub Pages site loads its stylesheet, script, and all three geometric images successfully.
- Public-site hover checks observed an intermediate scale of 1.03714 before settling at 1.045, confirming interpolation rather than a jump.
- The wheel rotates while the combined topic-label rotation remains zero. The center medallion's rectangle remains unchanged.
- Practice cards have opaque cream backgrounds and a settled hover scale of 1.012.
- Reduced motion removes scroll animations and returns the story to normal document flow.
- The fallback was exercised with ViewTimeline unavailable; the learning panel remains visible at the intended scroll position.
- No uncaught JavaScript errors were observed during the public-site interaction checks.

## Repeat the profiling pass

The dependency-free script attaches to a visible native Chrome window through its local debugging port. Use a separate temporary browser profile and keep the page visible and undisturbed during capture.

On macOS, launch Chrome (replace the application name with Chrome Beta if needed):

```sh
open -na 'Google Chrome' --args \
  --remote-debugging-port=9223 \
  --user-data-dir=/tmp/majalis-performance-profile \
  --no-first-run --no-default-browser-check \
  'https://bermyboystechsolutions.github.io/majalis-prototype/'
```

From this repository:

```sh
RELOAD=1 node scripts/profile.mjs desktop
WIDTH=390 HEIGHT=844 DPR=3 RELOAD=1 node scripts/profile.mjs phone
WIDTH=390 HEIGHT=844 DPR=3 CPU_RATE=4 RELOAD=1 node scripts/profile.mjs phone-4x
```

Results, screenshots, and DevTools traces are saved in the ignored `.performance/` directory. Device emulation and CPU throttling stay attached to the profiling connection for the full measurement.

## Icon consistency polish

Decorative font glyphs were replaced with shared inline SVG symbols so phones cannot substitute emoji artwork. The existing bubble, book, star, bars, wave, arrow, and infinity motifs now scale within their containers. Wheel path geometry and animation timing are shared across desktop and mobile; medallion and pattern proportions scale consistently.

Native Chrome checks passed at 1440 × 900, 390 × 844, 320 × 568, and 667 × 375: all 24 icon instances resolve to the same symbols, the wheel path geometry is identical, and the five cards have no content or viewport overflow. A two-second phone-emulated hero check measured approximately 60 fps with no intervals over 25 ms. This was a focused follow-up check, not a repeat of the full benchmark above.

## Account CTA checks

Native Chrome interaction checks passed at 1440 × 900, 390 × 844, and 320 × 568. Header Sign up and Log in controls fit with 44px-tall targets; sign-up actions in the hero and community section open the correct account preview. Mode switching, keyboard focus containment, Escape, close controls, native touch taps, and returning to the learning-spaces scene all pass. No uncaught JavaScript errors were observed. Account registration/login are clearly marked as coming soon; the prototype collects no credentials.
