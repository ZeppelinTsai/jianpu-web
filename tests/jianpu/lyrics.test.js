"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var tuneBook = require("../../src/api/abc_tunebook");
var jianpu = require("../../src/jianpu");

// --- Positive case -------------------------------------------------------
// The 思愁 fixture with `w:` lyric lines added (digits 1-71 as placeholder
// syllables, `_` marking tie-continuation slots). Every measure's syllable
// count was hand-verified to match its note count, so this must validate
// with zero lyric-mismatch warnings.
var abcPath = path.resolve(__dirname, "fixtures/si-chou-lyrics.abc");
var abc = fs.readFileSync(abcPath, "utf8");
var result = jianpu.fromAbc(abc, { staffWidth: 800 }, tuneBook.parseOnly);

var outputPath = path.resolve(__dirname, "../../test-output/si-chou-lyrics.svg");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, result.svg, "utf8");

assert.deepStrictEqual(result.warnings, []);

var events = result.layout.lines.reduce(function(list, line) {
	line.measures.forEach(function(measure) {
		measure.events.forEach(function(event) { list.push(event); });
	});
	return list;
}, []);

// 76 playable notes total (same melody as the si-chou fixture); every one
// of them is claimed by the w: lines, so every event should carry a lyric
// slot (either a real syllable, or "" for a `_` continuation).
assert.strictEqual(events.length, 76);
assert.ok(events.every(function(event) { return event.lyric !== null; }));

var realSyllables = events.filter(function(event) { return event.lyric !== ""; });
var continuations = events.filter(function(event) { return event.lyric === ""; });
assert.strictEqual(realSyllables.length, 71);
assert.strictEqual(continuations.length, 5);
assert.deepStrictEqual(
	realSyllables.map(function(event) { return event.lyric; }),
	Array.from({ length: 71 }, function(_, i) { return String(i + 1); })
);

// Every event with a lyric slot got a computed render position, and that
// position sits below the note's other duration marks.
events.forEach(function(event) {
	assert.ok(event.annotations.lyric);
	assert.ok(event.annotations.lyric.y > event.notePositions[0].y);
});

assert.strictEqual((result.svg.match(/class="jianpu-lyric"/g) || []).length, 71);
assert.strictEqual(
	(result.svg.match(/class="jianpu-lyric jianpu-lyric-extend"/g) || []).length,
	5
);
assert.match(result.svg, /class="jianpu-lyric jianpu-lyric-extend"[^>]*>–</);

// --- Negative case ---------------------------------------------------
// Deliberately mismatched: measure 1 has 3 notes (C D E) but only 2 words.
// Measure 2 has 2 notes and 2 words, and must NOT warn.
var mismatchAbc = [
	"X:1",
	"K:C",
	"L:1/4",
	"CDE|FG|]",
	"w:foo bar | baz qux",
].join("\n");
var mismatchResult = jianpu.fromAbc(
	mismatchAbc,
	{ staffWidth: 800 },
	tuneBook.parseOnly
);
assert.strictEqual(mismatchResult.warnings.length, 1);
assert.strictEqual(
	mismatchResult.warnings[0],
	"Lyric syllable count doesn't match note count in measure 1."
);

// Too many syllables must also be caught (not just too few).
var extraAbc = [
	"X:1",
	"K:C",
	"L:1/4",
	"CD|EF|]",
	"w:one two three | four five",
].join("\n");
var extraResult = jianpu.fromAbc(extraAbc, { staffWidth: 800 }, tuneBook.parseOnly);
assert.strictEqual(extraResult.warnings.length, 1);
assert.match(extraResult.warnings[0], /measure 1\.$/);

// No `w:` line at all must never produce a lyric-mismatch warning.
var noLyricsAbc = ["X:1", "K:C", "L:1/4", "CDE|FG|]"].join("\n");
var noLyricsResult = jianpu.fromAbc(
	noLyricsAbc,
	{ staffWidth: 800 },
	tuneBook.parseOnly
);
assert.deepStrictEqual(noLyricsResult.warnings, []);

console.log(JSON.stringify({
	outputPath: outputPath,
	events: events.length,
	realSyllables: realSyllables.length,
	continuations: continuations.length,
	warnings: result.warnings,
	mismatchWarnings: mismatchResult.warnings,
	extraWarnings: extraResult.warnings,
	noLyricsWarnings: noLyricsResult.warnings,
}, null, 2));
