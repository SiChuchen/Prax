# Plotboard — 落位即意图 · placement is intent

A single-page **spatial workspace**: a floor canvas with named zones, where you create
labeled objects and *land* them. Where an object sits **is** what it means — zone
membership is pure containment, "nearest" is pure center distance. Nothing is assigned
through forms; moving an object re-derives its meaning instantly.

Cell: `cell-j07-s07` (create × spatial-workspace) · acceptance seed: **空间操作有键盘等价物**
— every spatial operation has a keyboard equivalent.

## Run

No build, no backend, no external services.

- Open `index.html` directly (`file://` works), or
- serve the folder statically (e.g. `python -m http.server`) and open `/`.

The page renders a populated demo floor (4 zones, 13 tiles) synchronously at first
paint — there is no loading state. Scene changes autosave to `localStorage`;
**Reset scene** (two-click confirm) restores the built-in demo.

## Keyboard map (the acceptance seed)

| Group | Keys |
|---|---|
| Create & place | `N` new object · `R` new zone · `↑↓←→` position ghost (`Shift` ×5) · `Enter` drop · `Esc` cancel · double-click create/rename in place |
| Select | `Tab` / `Shift+Tab` cycle tiles · click select · `Ctrl+A` select all · `Esc` deselect |
| Move & place | `↑↓←→` nudge (`Shift` ×5; pans when nothing selected) · `1`–`8` send selection to zone n · drag to move · `[` `]` z-order |
| View | `W A S D` pan · `+` `−` zoom · `0` fit · `F` focus selection · wheel zoom · `Space`+drag pan |
| Edit | `Ctrl+D` duplicate · `Del` delete (deleting a zone keeps its tiles) · `G` snap toggle · `Enter` rename |
| Help | `?` keyboard map overlay |

Every pointer spatial operation (create, place, move, send-to-zone, pan, zoom) has the
keyboard equivalent listed above; press `?` in the app for the live overlay.

## Product logic

- **Zones (regions)** are named rectangles. A tile's zone = the zone containing its
  center point, recomputed on every move. Tile color dot + rail counts + inspector
  facts are all *derived* — there is no assignment metadata anywhere in the model.
- **Landing preview**: while placing or dragging, the status bar names the zone the
  object would land in and the zone border highlights (落位 → …).
- **Derived relation**: selecting a tile draws its nearest-neighbor link with distance
  in grid units and lists the fact in the inspector.

## Files

```
index.html   markup: titlebar · zone rail · floor canvas · inspector · status bar · help overlay
styles.css   design tokens + all styling (dark floor-canvas theme)
app.js       state, persistence (localStorage), view transform, pointer + keyboard interactions
```

Vanilla ES2017, zero dependencies, works from `file://`.
