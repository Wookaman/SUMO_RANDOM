# Hand-coded HTML5 with Planck.js, not Construct 3

Basket Random, our reference, is built in Construct 3 (a visual editor whose physics is Box2D). We chose plain HTML5 + JavaScript with Planck.js, a JavaScript port of Box2D. This keeps the same ragdoll physics feel while keeping the whole game as readable, editable code with no paid editor or project format. Flash was ruled out because browsers dropped it in 2020.

## Considered Options

- **Construct 3** (what Basket Random uses): visual editor and paid subscription; the project can't be written or reviewed as plain code.
- **Godot**: capable free engine with web export, but needs the editor installed, produces a 10-40 MB web build instead of one small HTML file, and its default physics feels different from Box2D. Revisit if the game grows many modes or targets Steam/mobile.
- **C++ (raylib + Box2D)**: no performance need (about 12 physics bodies in total), and it needs a separate build for each operating system plus Emscripten to stay playable in a browser.
