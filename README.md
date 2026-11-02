# MAJALIS

A preliminary landing-page prototype for a Muslim educational community spanning Islamic knowledge, practical skills, personal development, and community.

## Shareable preview

https://bermyboystechsolutions.github.io/majalis-prototype/

GitHub Pages publishes the root of `main`. Push committed changes to update the preview.

## Preview locally

Run from this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/ in Chrome.

## Motion and responsive design

- A rotating geometric wheel with upright topic labels and a fixed center.
- Native browser scroll timelines drive the pinned learning scenes and crossfades.
- Separate layers handle scroll entrances and card hover motion.
- The phone layout preserves the scene sequence and native touch scrolling.
- A cached-geometry fallback supports browsers without ViewTimeline.
- Reduced motion preferences disable the pinned animation sequence.

The generated Moroccan and Ottoman inspired geometric assets contain no Arabic text. This is a visual prototype; course, account, membership, and payment features are not connected.
