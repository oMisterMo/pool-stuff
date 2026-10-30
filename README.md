# 8 Ball Pool

A browser-based 8 ball pool collection of tips, guides, drills and more. Drawn on an HTML canvas with plain JavaScript. There are no dependencies or build step.

## Status

Early work in progress. So far the table is drawn and balls can be placed on it:

- Wooden long and short rails
- Cushions with angled ends at the pockets
- Four corner pockets and two side pockets
- Diamonds on the rails, lined up with the grid lines
- An 8×4 grid on the cloth, with a thicker baulk line
- White, red and yellow balls: pick a colour below the table, then click the table to place one. Placing a white ball replaces the current one, and a ball placed on top of another is pushed out to the nearest free spot. The table holds up to 50 balls. The clear buttons remove one colour or all balls

The **Play** and **Reset** buttons are on the page but don't do anything yet. There are no physics or rules.

## Running

Open `index.html` in a browser. The page uses `ctx.roundRect` and nested CSS, so it needs a recent browser.

## Project layout

All the code is in `index.html`: the page markup, styles and script.

| Function | Draws |
| --- | --- |
| `drawRails` | Wooden frame around the table |
| `drawCloth` | Green playing surface |
| `drawGridLines` | Grid and baulk line |
| `drawCushions` | All six cushions, using `drawCushion` |
| `drawDiamonds` | Rail diamonds, using `drawDiamond` |
| `drawPockets` | All six pockets |
| `drawBalls` | Placed balls |

`drawPool` calls these in order, and later layers paint over earlier ones.

## Configuration

Table sizes and colours are in the `poolTable` object. Grid and marking settings are constants at the top of the script, such as `NO_OF_COLUMNS` and `BAULK_COLUMN`.

`poolTable.x`, `y`, `width` and `height` describe the playing surface inside the cushions, which is 640×320 (2:1). The surface is centred on the 800×600 canvas, and the cushions and rails are drawn outside it.
