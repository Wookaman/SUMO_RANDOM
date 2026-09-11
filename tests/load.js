'use strict';
// Loads Planck and every src module that exists so far, in browser load order, and returns the shared Sumo namespace.
const fs = require('node:fs');
const path = require('node:path');

globalThis.planck = require('../vendor/planck.min.js');

const ORDER = ['config', 'pixels', 'font', 'input', 'rules', 'wrestler', 'arena', 'dance', 'match', 'render'];
for (const name of ORDER) {
  const file = path.join(__dirname, '..', 'src', `${name}.js`);
  if (fs.existsSync(file)) require(file);
}

module.exports = globalThis.Sumo;
