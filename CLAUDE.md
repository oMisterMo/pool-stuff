# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no build, lint or test tooling, and no dependencies. To run the game, open `index.html` in a recent browser (it uses `ctx.roundRect` and nested CSS). This directory is not a git repository.

## Architecture

Everything is in `index.html`: markup, styles and one inline script that draws on load and redraws when balls change or the cursor moves over the canvas. There is no animation loop yet. The `#play` and `#reset` buttons have no handlers, and there are no physics or rules.

- **Coordinates:** `poolTable.x`, `y`, `width` and `height` describe the playing surface (the 2:1 area between the cushion noses), not the outer table. Cushions and rails are drawn outward from it, so use these values as the bounce boundaries for ball physics. `clampToSurface` clamps ball centres to these bounds inset by `BALL_RADIUS`, and `findPlacement` works out where a ball would land, for both placing and the ghost ball.
- **Draw order:** `drawPool` paints in layers, so the order of its calls matters. Pockets are drawn over the cushions and rails, and balls are drawn next, with the ghost ball last.
- **Grid alignment:** diamonds are positioned from `NO_OF_COLUMNS` and `NO_OF_ROWS`, so they stay lined up with the grid lines. The baulk line sits on `BAULK_COLUMN`.
