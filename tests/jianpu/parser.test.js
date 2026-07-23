"use strict";

var assert = require("assert");
var parseJianpu = require("../../src/jianpu/parse-jianpu");

var README_EXAMPLE = [
	"T:Octave and Duration Example",
	"M:4/4",
	"K:C",
	"1, 2,, 3 4' | 5'' 6_ 7_ 1- | 2. 3__ 4__ 5- |",
	"6.. 7__ 1- | 2--- | 0 0 0 0 |]",
].join("\n");

var parsed = parseJianpu(README_EXAMPLE);
assert.deepStrictEqual(parsed.header, {
	title: "Octave and Duration Example",
	meter: "4/4",
	key: "C",
});
assert.deepStrictEqual(parsed.warnings, []);

var events = parsed.elements.filter(function(element) {
	return element.type !== "bar";
});
var bars = parsed.elements.filter(function(element) {
	return element.type === "bar";
});

assert.strictEqual(events.length, 20);
assert.deepStrictEqual(bars.map(function(bar) {
	return bar.barType;
}), [
	"bar_thin",
	"bar_thin",
	"bar_thin",
	"bar_thin",
	"bar_thin",
	"bar_thin_thick",
]);

function compact(event) {
	return {
		numbers: event.notes.map(function(note) { return note.number; }),
		octaves: event.notes.map(function(note) { return note.octaveDots; }),
		accidentals: event.notes.map(function(note) {
			return note.accidentalMark;
		}),
		duration: event.durationMarks,
	};
}

assert.deepStrictEqual(events.map(compact), [
	{ numbers: [1], octaves: [-1], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [2], octaves: [-2], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [3], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [4], octaves: [1], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [5], octaves: [2], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [6], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 1, dots: 0 } },
	{ numbers: [7], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 1, dots: 0 } },
	{ numbers: [1], octaves: [0], accidentals: [null], duration: { extensionDashes: 1, underlines: 0, dots: 0 } },
	{ numbers: [2], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 1 } },
	{ numbers: [3], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 2, dots: 0 } },
	{ numbers: [4], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 2, dots: 0 } },
	{ numbers: [5], octaves: [0], accidentals: [null], duration: { extensionDashes: 1, underlines: 0, dots: 0 } },
	{ numbers: [6], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 2 } },
	{ numbers: [7], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 2, dots: 0 } },
	{ numbers: [1], octaves: [0], accidentals: [null], duration: { extensionDashes: 1, underlines: 0, dots: 0 } },
	{ numbers: [2], octaves: [0], accidentals: [null], duration: { extensionDashes: 3, underlines: 0, dots: 0 } },
	{ numbers: [0], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [0], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [0], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ numbers: [0], octaves: [0], accidentals: [null], duration: { extensionDashes: 0, underlines: 0, dots: 0 } },
]);

var syntaxFeatures = parseJianpu("_4_ ^^5 [135]' |]").elements;
assert.deepStrictEqual(syntaxFeatures[0], {
	notes: [{ number: 4, octaveDots: 0, accidentalMark: "flat" }],
	durationMarks: { extensionDashes: 0, underlines: 1, dots: 0 },
});
assert.deepStrictEqual(syntaxFeatures[1], {
	notes: [{ number: 5, octaveDots: 0, accidentalMark: "dblsharp" }],
	durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
});
assert.deepStrictEqual(syntaxFeatures[2], {
	notes: [
		{ number: 1, octaveDots: 1, accidentalMark: null },
		{ number: 3, octaveDots: 1, accidentalMark: null },
		{ number: 5, octaveDots: 1, accidentalMark: null },
	],
	durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
});

var octaveWarning = parseJianpu("1''' 2,,,");
assert.deepStrictEqual(octaveWarning.elements.map(function(event) {
	return event.notes[0].octaveDots;
}), [2, -2]);
assert.strictEqual(octaveWarning.warnings.length, 2);

[
	"1',",
	"0'",
	"0,",
	"0-",
	"8",
	"1...",
	"1_-",
	"[135",
].forEach(function(invalidInput) {
	assert.throws(function() {
		parseJianpu(invalidInput);
	}, function(error) {
		return error instanceof parseJianpu.JianpuSyntaxError &&
			Number.isInteger(error.index);
	}, "Expected a JianpuSyntaxError for " + invalidInput);
});

console.log(JSON.stringify({
	header: parsed.header,
	eventCount: events.length,
	barCount: bars.length,
	invalidInputsRejected: 8,
	warnings: parsed.warnings,
}, null, 2));
