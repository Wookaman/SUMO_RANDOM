# Classic scripts on one shared `Sumo` global, not ES modules

The game must start by double-clicking `index.html`, and browsers refuse to load ES module scripts from file:// URLs. So every source file is a classic script (an IIFE that adds to `globalThis.Sumo`) loaded by ordered `<script src>` tags, and Node tests load the same files with `require` through `tests/load.js`. We rejected a bundler to keep the project build-free; if the game ever needs one, switching to ES modules is a mechanical change.
