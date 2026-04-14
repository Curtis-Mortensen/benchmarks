/**
 * score-list.js — Generic partial-credit scorer for promptfoo
 *
 * Usage in CSV __expected column:
 *   javascript:file://score-list.js
 *
 * Required vars (set as extra CSV columns):
 *   expected_items   — comma-separated list of items to look for
 *   pass_threshold   — (optional) minimum score to pass, default 0.8
 *   match_mode       — (optional) "exact" | "fuzzy" | "token", default "fuzzy"
 *   ordered          — (optional) "true" to also check order, default "false"
 *
 * match_mode details:
 *   exact  — the output must contain the item string verbatim (case-insensitive)
 *   fuzzy  — strips punctuation/extra spaces, checks if any word-token in the
 *            output is close enough (handles "NYC" vs "New York City" via aliases,
 *            parenthetical color stripping, etc.)
 *   token  — splits each expected item into words; ALL words must appear in the
 *            output (good for "Azorius (White, Blue)" style entries)
 *
 * Example CSV row (formats question):
 *   question,expected_items,pass_threshold,match_mode,__expected,__metric
 *   "Name the 7 MTG formats","Commander,Legacy,Modern,...",0.8,exact,javascript:file://score-list.js,List Accuracy
 */

module.exports = (output, context) => {
  const vars = context.vars || {};

  // ── 1. Parse inputs ──────────────────────────────────────────────────────────
  const rawItems = String(vars.expected_items || '');
  if (!rawItems.trim()) {
    return { pass: false, score: 0, reason: 'expected_items var is empty or missing.' };
  }

  const expected = rawItems
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const threshold = parseFloat(vars.pass_threshold ?? 0.8);
  const matchMode = String(vars.match_mode ?? 'fuzzy').toLowerCase();
  const checkOrder = String(vars.ordered ?? 'false').toLowerCase() === 'true';

  const outputLower = output.toLowerCase();

  // ── 2. Normalisation helpers ──────────────────────────────────────────────────

  // Strip parens and punctuation, collapse whitespace
  const normalise = str =>
    str
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')   // remove parenthetical notes, e.g. "(White, Blue)"
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Manual alias table for common abbreviations / alternate names
  const ALIASES = {
    'new york city': ['nyc', 'new york'],
    'los angeles': ['la', 'l.a.'],
    'sao paulo': ['são paulo', 'sao paulo'],
    'tap/untap': ['tap', 'untap'],
    'summer magic / edgar': ['summer magic', 'edgar'],
    'dragon con': ['dragoncon'],
  };

  // ── 3. Match functions ────────────────────────────────────────────────────────

  const matchExact = item => outputLower.includes(item.toLowerCase());

  const matchToken = item => {
    const tokens = normalise(item).split(' ').filter(Boolean);
    return tokens.every(tok => outputLower.includes(tok));
  };

  const matchFuzzy = item => {
    const normItem = normalise(item);
    const normOutput = normalise(outputLower);

    // Direct substring check first
    if (normOutput.includes(normItem)) return true;

    // Token check
    if (matchToken(item)) return true;

    // Alias check
    for (const [canonical, alts] of Object.entries(ALIASES)) {
      const canonMatch = normItem.includes(normalise(canonical)) || normalise(canonical).includes(normItem);
      if (canonMatch) {
        if (alts.some(alt => normOutput.includes(normalise(alt)))) return true;
      }
      if (alts.some(alt => normalise(alt) === normItem)) {
        if (normOutput.includes(normalise(canonical))) return true;
      }
    }

    return false;
  };

  const matchFn =
    matchMode === 'exact' ? matchExact :
    matchMode === 'token' ? matchToken :
    matchFuzzy;

  // ── 4. Score each item ────────────────────────────────────────────────────────

  const results = expected.map(item => ({
    item,
    found: matchFn(item),
  }));

  // ── 5. Order check (optional) ─────────────────────────────────────────────────
  let orderPenalty = 0;
  let orderReason = '';

  if (checkOrder) {
    const foundItems = results.filter(r => r.found).map(r => r.item);
    let lastIdx = -1;
    let outOfOrder = 0;
    for (const item of foundItems) {
      // find position of this item in output
      const pos = outputLower.indexOf(normalise(item).split(' ')[0]);
      if (pos < lastIdx) outOfOrder++;
      else lastIdx = pos;
    }
    if (outOfOrder > 0) {
      orderPenalty = outOfOrder / foundItems.length * 0.2; // up to 20% penalty
      orderReason = ` ${outOfOrder} item(s) appear out of expected order.`;
    }
  }

  // ── 6. Build result ───────────────────────────────────────────────────────────

  const matchCount = results.filter(r => r.found).length;
  const rawScore = matchCount / expected.length;
  const score = Math.max(0, rawScore - orderPenalty);
  const pass = score >= threshold;

  const missing = results.filter(r => !r.found).map(r => r.item);
  const missingStr = missing.length ? ` Missing: ${missing.join(', ')}.` : '';

  return {
    pass,
    score: Math.round(score * 1000) / 1000,
    reason: `Found ${matchCount}/${expected.length} items (score ${(score * 100).toFixed(1)}%).${missingStr}${orderReason}`,
  };
};
