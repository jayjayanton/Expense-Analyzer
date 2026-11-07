'use strict';
// Loads the Python runtime in-browser and exposes the existing Python parser to JS.
window.pythonAnalyzer = (() => {
 let ready;
 async function initialize() {
  if (!ready) ready = (async () => {
   if (typeof loadPyodide !== 'function') throw Error('Python runtime could not load. Check your internet connection.');
   const py = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'});
   const response = await fetch('python/analyzer.py');
   if (!response.ok) throw Error('Could not load Python analysis engine ('+response.status+'). Use GitHub Pages or a local web server.');
   await py.runPythonAsync(await response.text());
   return py;
  })().catch(error=>{ready=null;throw error;});
  return ready;
 }
 return { initialize, async parseStatement(csvText) {
  const py = await initialize();
  const fn = py.globals.get('analyze_json');
  try { return JSON.parse(fn(csvText)); } finally { fn.destroy(); }
 }};
})();
