# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no build, lint or test tooling, and no dependencies. To run the game, open `index.html` in a recent browser (it uses `ctx.roundRect` and nested CSS). This directory is not a git repository.

## Architecture

`index.html` holds the markup, `style.css` the styles and `script.js` the code, loaded at the end of `<body>` so the elements it looks up already exist. The icons are `favicon.svg` and `apple-touch-icon.png`, a 180×180 PNG of the same 8-ball on a light grey background. The script draws on load and redraws when balls change or the cursor moves over the canvas. There is no animation loop yet. The `#play` and `#reset` buttons have no handlers, and there are no physics or rules.

- **Coordinates:** `poolTable.x`, `y`, `width` and `height` describe the playing surface (the 2:1 area between the cushion noses), not the outer table. Cushions and rails are drawn outward from it, so use these values as the bounce boundaries for ball physics. `clampToSurface` clamps ball centres to these bounds inset by `BALL_RADIUS`, and `findPlacement` works out where a ball would land, for both placing and the ghost ball.
- **Draw order:** `drawPool` paints in layers, so the order of its calls matters. Pockets are drawn over the cushions and rails, then balls, then arrows, with the ghost ball last.
- **Themes:** table colours (cloth, cushions, rails, diamonds) live in `THEMES`, not on `poolTable`. The draw functions read them from the current `theme`, and the `#theme` button cycles through the list. The chosen theme's name is saved in `localStorage` and restored on load.
- **Scaling:** the canvas always draws at 800×600, but CSS shrinks it to fit narrow screens. Convert pointer positions with `toCanvasPoint` rather than using `offsetX`/`offsetY`.
- **Grid alignment:** diamonds are positioned from `NO_OF_COLUMNS` and `NO_OF_ROWS`, so they stay lined up with the grid lines. The baulk line sits on `BAULK_COLUMN`.
- **Arrows:** with the `#arrow-mode` checkbox ticked, clicks stop placing balls and a drag starting on a ball adds an arrow to `arrows`. Dragged onto another ball, the tip snaps to that ball's edge (`arrowTip`), and holding Shift snaps the angle to 45° steps (`snapToAngle`). An arrow from the white ball onto another ball also gets a contact `ghost` ball, which can be dragged around the object ball within the possible cut angles (`limitGhostBall`), snapping to 45° steps around it with Shift. Each arrow holds references to its ball and any snapped `target`, so `removeOrphanedArrows` must run whenever balls are removed or replaced.
