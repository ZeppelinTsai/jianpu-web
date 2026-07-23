"use strict";

var assert = require("assert");
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
