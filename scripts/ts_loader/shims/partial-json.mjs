// Minimal stand-in for `partial-json`: closes unterminated strings/arrays/objects then JSON.parse.
export const Allow = { STR:1, NUM:2, ARR:4, OBJ:8, NULL:16, BOOL:32 };
export function parse(s){
  let out = '', stack = [], inStr = false, esc = false;
  for (const ch of s){ out += ch; if (inStr){ if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === '[' ) stack.push(']'); else if (ch === '{') stack.push('}'); else if (ch === ']' || ch === '}') stack.pop(); }
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, '').replace(/,\s*"[^"]*"\s*:?\s*$/, '').replace(/:\s*$/, ':null');
  while (stack.length) out += stack.pop();
  return JSON.parse(out);
}
