"use strict";

var assert = require("assert");
var Parse = require("../../src/parse/abc_parse");
var createJianpuConverter = require("../../src/jianpu/create-jianpu-converter");

var ABC = [
	"X:1",
	"T:Test Tune",
	"M:4/4",
	"L:1/4",
	"K:C",
	"C D E F | G2 A/B/ z | [CEG] ^F2 |]",
].join("\n");

function parse(abc) {
	var parser = new Parse();
	parser.parse(abc);
	return parser.getTune();
}

function convertVoice(staff) {
	var converter = createJianpuConverter(staff.key);
	var result = [];

	staff.voices[0].forEach(function(element) {
		if (element.el_type === "bar") {
			converter.resetBar();
			result.push({ type: "bar", barType: element.type });
		} else if (element.el_type === "note") {
			converter.convertNote(element).forEach(function(event) {
				result.push(event);
			});
		}
	});

	return { result: result, warnings: converter.context.warnings };
}

function notesInFirstVoice(abc) {
	var parsedTune = parse(abc);
	var parsedStaff = parsedTune.lines[0].staff[0];
	return {
		staff: parsedStaff,
		elements: parsedStaff.voices[0],
	};
}

var tune = parse(ABC);
var staff = tune.lines[0].staff[0];
var converted = convertVoice(staff);

var expected = [
	{ notes: [{ number: 1, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ notes: [{ number: 2, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ notes: [{ number: 3, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ notes: [{ number: 4, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ type: "bar", barType: "bar_thin" },
	{ notes: [{ number: 5, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 1, underlines: 0, dots: 0 } },
	{ notes: [{ number: 6, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 1, dots: 0 }, beam: { start: true, end: false } },
	{ notes: [{ number: 7, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 1, dots: 0 }, beam: { start: false, end: true } },
	{ notes: [{ number: 0, octaveDots: 0, accidentalMark: null }], durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 } },
	{ type: "bar", barType: "bar_thin" },
	{
		notes: [
			{ number: 1, octaveDots: 0, accidentalMark: null },
			{ number: 3, octaveDots: 0, accidentalMark: null },
			{ number: 5, octaveDots: 0, accidentalMark: null },
		],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
	{ notes: [{ number: 4, octaveDots: 0, accidentalMark: "sharp" }], durationMarks: { extensionDashes: 1, underlines: 0, dots: 0 } },
	{ type: "bar", barType: "bar_thin_thick" },
];

assert.deepStrictEqual(converted.result, expected);
assert.deepStrictEqual(converted.warnings, []);

var edgeConverter = createJianpuConverter({
	root: "A",
	acc: "",
	mode: "m",
	accidentals: [],
});

assert.deepStrictEqual(edgeConverter.convertNote({
	el_type: "note",
	duration: 0.25,
	pitches: [{ pitch: 5, name: "A", accidental: "dblsharp" }],
}), [{
	notes: [{ number: 6, octaveDots: 0, accidentalMark: "dblsharp" }],
	durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
}]);
assert.strictEqual(edgeConverter.context.measureAccidentals.get("A:0"), "dblsharp");

edgeConverter.resetBar();
assert.strictEqual(edgeConverter.context.measureAccidentals.size, 0);

assert.deepStrictEqual(edgeConverter.convertNote({
	el_type: "note",
	duration: 0.375,
	rest: { type: "rest" },
}), [{
	notes: [{ number: 0, octaveDots: 0, accidentalMark: null }],
	durationMarks: { extensionDashes: 0, underlines: 0, dots: 1 },
}]);

assert.deepStrictEqual(edgeConverter.convertNote({
	el_type: "note",
	duration: 0.5,
	rest: { type: "rest" },
}), [
	{
		notes: [{ number: 0, octaveDots: 0, accidentalMark: null }],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
	{
		notes: [{ number: 0, octaveDots: 0, accidentalMark: null }],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
]);

var octaveCase = notesInFirstVoice([
	"X:1",
	"L:1/4",
	"K:C",
	"C,, C, C c c' c'' C,,, |]",
].join("\n"));
var octaveConverter = createJianpuConverter(octaveCase.staff.key);
var octaveDots = [];

octaveCase.elements.forEach(function(element) {
	if (element.el_type === "note")
		octaveDots.push(octaveConverter.convertNote(element)[0].notes[0].octaveDots);
});

assert.deepStrictEqual(octaveDots, [-2, -1, 0, 1, 2, 2, -2]);
assert.strictEqual(octaveConverter.context.warnings.length, 2);
assert.match(octaveConverter.context.warnings[0], /3 octaves above/);
assert.match(octaveConverter.context.warnings[1], /3 octaves below/);

var keyCase = notesInFirstVoice([
	"X:1",
	"L:1/4",
	"K:D",
	"F C =F F | F _F F |]",
].join("\n"));
var keyConverter = createJianpuConverter(keyCase.staff.key);
var keyNotes = keyCase.elements.filter(function(element) {
	return element.el_type === "note";
});

assert.strictEqual(keyConverter.context.keyAccidentals.get("F"), "sharp");
assert.strictEqual(keyConverter.context.keyAccidentals.get("C"), "sharp");
assert.strictEqual(keyConverter.getEffectiveAccidental(keyNotes[0].pitches[0]), "sharp");
assert.strictEqual(keyConverter.getEffectiveAccidental(keyNotes[1].pitches[0]), "sharp");

var naturalEvent = keyConverter.convertNote(keyNotes[2])[0];
assert.strictEqual(naturalEvent.notes[0].accidentalMark, "natural");
assert.strictEqual(keyConverter.context.measureAccidentals.get("F:0"), "natural");
assert.strictEqual(keyConverter.getEffectiveAccidental(keyNotes[3].pitches[0]), "natural");

keyConverter.resetBar();
assert.strictEqual(keyConverter.context.measureAccidentals.size, 0);
assert.strictEqual(keyConverter.getEffectiveAccidental(keyNotes[4].pitches[0]), "sharp");

var flatEvent = keyConverter.convertNote(keyNotes[5])[0];
assert.strictEqual(flatEvent.notes[0].accidentalMark, "flat");
assert.strictEqual(keyConverter.context.measureAccidentals.get("F:0"), "flat");
assert.strictEqual(keyConverter.getEffectiveAccidental(keyNotes[6].pitches[0]), "flat");

keyConverter.resetBar();
assert.strictEqual(keyConverter.getEffectiveAccidental(keyNotes[6].pitches[0]), "sharp");

var minorOctaveCase = notesInFirstVoice([
	"X:1",
	"L:1/4",
	"K:Amin",
	"A B c d |]",
].join("\n"));
var minorOctaveConverter = createJianpuConverter(minorOctaveCase.staff.key);
var minorOctaveEvents = minorOctaveCase.elements
	.filter(function(element) { return element.el_type === "note"; })
	.map(function(element) {
		return minorOctaveConverter.convertNote(element)[0].notes[0];
	});
assert.deepStrictEqual(
	minorOctaveEvents.map(function(note) { return note.number; }),
	[6, 7, 1, 2]
);
assert.deepStrictEqual(
	minorOctaveEvents.map(function(note) { return note.octaveDots; }),
	[0, 0, 1, 1]
);

console.log(JSON.stringify({
	key: staff.key,
	events: converted.result,
	warnings: converted.warnings,
	additionalTests: {
		octaves: {
			octaveDots: octaveDots,
			warnings: octaveConverter.context.warnings,
		},
		keyAccidentals: {
			key: Object.fromEntries(keyConverter.context.keyAccidentals),
			naturalOverride: "natural",
			flatOverride: "flat",
			afterReset: keyConverter.getEffectiveAccidental(keyNotes[6].pitches[0]),
		},
	},
}, null, 2));
