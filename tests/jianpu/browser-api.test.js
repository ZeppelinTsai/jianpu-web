"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var tuneBook = require("../../src/api/abc_tunebook");
var jianpu = require("../../src/jianpu");

var abc = [
	"X:1",
	"T:Test Tune",
	"M:4/4",
	"L:1/4",
	"K:C",
	"C D E F | G2 A/B/ z | [CEG] ^F2 |]",
].join("\n");
var text = [
	"T:Octave and Duration Example",
	"M:4/4",
	"K:C",
	"1, 2,, 3 4' | 5'' 6_ 7_ 1- | 2. 3__ 4__ 5- |",
	"6.. 7__ 1- | 2--- | 0 0 0 0 |]",
].join("\n");

var abcResult = jianpu.fromAbc(abc, { staffWidth: 800 }, tuneBook.parseOnly);
var textResult = jianpu.fromText(text, { staffWidth: 800 });

assert.match(abcResult.svg, /Test Tune/);
assert.match(textResult.svg, /Octave and Duration Example/);
assert.deepStrictEqual(abcResult.warnings, []);
assert.deepStrictEqual(textResult.warnings, []);
assert.strictEqual(abcResult.layout.lines.length, 1);
assert.strictEqual(textResult.layout.lines.length, 1);

var abcWithWarning = jianpu.fromAbc(
	"X:1\nK:C\nC ? D |]",
	{ staffWidth: 800 },
	tuneBook.parseOnly
);
assert.ok(abcWithWarning.warnings.length > 0);

var fingeringResult = jianpu.fromAbc(
	"X:1\nK:C\n\"Am\"\"^1\"c' |]",
	{ staffWidth: 300 },
	tuneBook.parseOnly
);
var fingeringEvent =
	fingeringResult.layout.lines[0].measures[0].events[0];
assert.strictEqual(fingeringEvent.annotations.fingerings[0].text, "1");
assert.strictEqual(
	fingeringEvent.notePositions[0].octaveDotPositions.length,
	2
);
assert.ok(
	fingeringEvent.annotations.fingerings[0].cy <
		fingeringEvent.notePositions[0].octaveDotPositions[0].cy
);
assert.ok(
	fingeringEvent.annotations.chords[0].y <
		fingeringEvent.annotations.fingerings[0].cy -
			fingeringEvent.annotations.fingerings[0].r
);
assert.ok(
	fingeringEvent.notePositions[0].octaveDotPositions.reduce(
			function(top, dot) { return Math.min(top, dot.cy - dot.r); },
			Infinity
		) -
		(fingeringEvent.annotations.fingerings[0].cy +
			fingeringEvent.annotations.fingerings[0].r) >=
		jianpu.layoutJianpu.DEFAULT_OPTIONS.fingeringGap
);
assert.match(fingeringResult.svg, /class="jianpu-fingering-circle"/);
assert.match(fingeringResult.svg, /class="jianpu-fingering-text"[^>]*>1<\/text>/);

var playground = fs.readFileSync(
	path.resolve(__dirname, "../../jianpu-playground.html"),
	"utf8"
);
assert.match(playground, /列印／儲存 PDF/);
assert.match(playground, /@media print/);
assert.match(playground, /window\.print\(\)/);

console.log(JSON.stringify({
	abc: {
		width: abcResult.layout.width,
		lines: abcResult.layout.lines.length,
		warnings: abcResult.warnings,
	},
	text: {
		width: textResult.layout.width,
		lines: textResult.layout.lines.length,
		warnings: textResult.warnings,
	},
}, null, 2));
