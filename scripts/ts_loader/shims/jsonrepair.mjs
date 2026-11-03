// Minimal stand-in for the `jsonrepair` package: fixes trailing commas, single quotes
// around keys/strings and unescaped inner double quotes are NOT handled. Marked as shim.
export function jsonrepair(s){ return s.replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)'([^']*)'\s*:/g, '$1"$2":'); }
