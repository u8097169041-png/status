/**
 * Unicode-fähige Wortgrenzen. `\b` kennt in JavaScript nur ASCII-Buchstaben: Vor „über“, „öffentlich“ oder nach „groß“
 * liegt für `\b` keine Wortgrenze. `uw()` ersetzt `\b` durch eine Grenze, die alle Buchstaben und Ziffern berücksichtigt.
 */
const BOUNDARY = '(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))';

export function uw(re: RegExp): RegExp {
  const flags = re.flags.includes('u') || re.flags.includes('v') ? re.flags : `${re.flags}u`;
  return new RegExp(re.source.replace(/(?<!\\)\\b/g, BOUNDARY), flags);
}
