"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var tuneBook = require("../../src/api/abc_tunebook");
var jianpu = require("../../src/jianpu");

// A short, purpose-built (not musically meaningful) piece exercising all 5
// "extended feature" items in one pass: a triplet, a repeat section with a
// first/second ending (volta), a slur across different pitches, a grace
// note, and two other decorations (staccato + accent).
var abcPath = path.resolve(__dirname, "fixtures/feature-showcase.abc");
var abc = fs.readFileSync(abcPath, "utf8");
var tunes = tuneBook.parseOnly(abc);

assert.strictEqual(tunes.length, 1);

var result = jianpu.fromAbc(abc, { staffWidth: 1400 }, tuneBook.parseOnly);
var outputPath = path.resolve(__dirname, "../../test-output/feature-showcase.svg");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, result.svg, "utf8");

// --- Item 1: tuplets ------------------------------------------------------
// "(3 D E F" written as three eighths but sounding as a quarter note's
// worth (2 eighths); durationBeats must reflect the *sounding* total (1
// beat across the 3 notes), not the naive 1.5 beats a plain-eighth reading
// would produce (the original bug).
var line1 = result.layout.lines[0];
var measure1Events = line1.measures[0].events;
var tupletEvents = measure1Events.filter(function(event) {
	return event.tuplet !== null;
});
assert.strictEqual(tupletEvents.length, 3);
assert.deepStrictEqual(tupletEvents.map(function(event) {
	return { ratio: event.tuplet.ratio, isStart: event.tuplet.isStart, isEnd: event.tuplet.isEnd };
}), [
	{ ratio: 3, isStart: true, isEnd: false },
	{ ratio: 3, isStart: false, isEnd: false },
	{ ratio: 3, isStart: false, isEnd: true },
]);
var tupletTotalBeats = tupletEvents.reduce(function(sum, event) {
	return sum + event.durationBeats;
}, 0);
assert.ok(
	Math.abs(tupletTotalBeats - 1) < 1e-9,
	"Triplet group must sound as 1 beat total (2 eighths), not 1.5."
);
assert.strictEqual(line1.measures[0].tupletBrackets.length, 1);
assert.strictEqual(line1.measures[0].tupletBrackets[0].label, "3");
assert.match(result.svg, /class="jianpu-tuplet-bracket"/);
assert.match(
	result.warnings.join(" | "),
	/Tuplet ratio 3 does not resolve to a representable jianpu duration/
);

// --- Item 2: repeat bars + volta -------------------------------------------
var line2 = result.layout.lines[1];
var repeatMeasures = line2.measures.filter(function(measure) {
	return measure.endingBar &&
		(measure.endingBar.type === "bar_left_repeat" ||
			measure.endingBar.type === "bar_right_repeat");
});
assert.strictEqual(repeatMeasures.length, 3);
repeatMeasures.forEach(function(measure) {
	assert.strictEqual(measure.endingBar.dots.length, 2);
});
assert.strictEqual(line2.voltaBrackets.length, 2);
assert.deepStrictEqual(
	line2.voltaBrackets.map(function(bracket) { return bracket.label; }),
	["1", "2"]
);
assert.match(result.svg, /class="jianpu-bar-dot"/);
assert.match(result.svg, /class="jianpu-volta-bracket"/);
assert.match(result.svg, />1\.<\/text>/);
assert.match(result.svg, />2\.<\/text>/);

// --- Item 3: slurs (distinct from ties) ------------------------------------
var line3 = result.layout.lines[2];
assert.strictEqual(line3.slurPaths.length, 1);
assert.strictEqual(line3.tiePaths.length, 0);
assert.match(result.svg, /class="jianpu-slur"/);
assert.ok(
	!/class="jianpu-tie"/.test(result.svg),
	"This fixture has a slur but no tie; the tie class must not appear."
);

// --- Item 4: grace notes ----------------------------------------------------
var graceEvent = line3.measures[0].events.filter(function(event) {
	return event.annotations.graceNotes.length > 0;
});
assert.strictEqual(graceEvent.length, 1);
assert.strictEqual(graceEvent[0].annotations.graceNotes[0].number, 2); // {d} -> scale degree 2 in K:C
assert.match(result.svg, /class="jianpu-grace-number"/);
assert.match(
	result.warnings.join(" | "),
	/Grace notes are rendered as simplified small notes/
);

// --- Item 5: other decorations (staccato rendered, accent warned) ---------
var line4 = result.layout.lines[3];
var staccatoEvent = line4.measures[0].events[0];
assert.ok(staccatoEvent.annotations.staccato !== null);
assert.match(result.svg, /class="jianpu-staccato-dot"/);
assert.match(
	result.warnings.join(" | "),
	/Decoration 'accent' is not yet supported and was not rendered\./
);

// Exactly the 3 expected warnings (tuplet approximation, grace note
// simplification, unsupported accent decoration) — no other feature in this
// fixture should silently misbehave or emit an unexpected warning.
assert.strictEqual(result.warnings.length, 3);

console.log(JSON.stringify({
	outputPath: outputPath,
	lines: result.layout.lines.length,
	warnings: result.warnings,
}, null, 2));
