# Banner Layout Tool

Clean React + Vite single-page banner composition tool.

## Run locally

```bash
npm install
npm run dev
```

## MVP features

- Left controls panel with:
  - background color picker
  - background image upload
  - ratio selector (16:9, 9:16, 4:5)
  - center text input (max 3 lines)
  - text color + font size controls
  - box color + corner radius controls
  - linked/independent movement toggle
  - slider-based box size and offset controls
- Right preview canvas with:
  - responsive aspect-ratio rendering
  - four decorative corner boxes
  - always-centered middle text
  - solid or uploaded image background
- Linked movement mode:
  - top-left mirrors bottom-right
  - top-right mirrors bottom-left
