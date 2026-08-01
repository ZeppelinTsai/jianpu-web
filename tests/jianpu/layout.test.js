"use strict";

var assert = require("assert");
var Parse = require("../../src/parse/abc_parse");
var createJianpuConverter = require("../../src/jianpu/create-jianpu-converter");
var layoutJianpu = require("../../src/jianpu/layout-jianpu");

var ABC = [
	"X:1",
	"T:Test Tune",
	"M:4/4",
	"L:1/4",
	"K:C",
	"C D E F | G2 A/B/ z | [CEG] ^F2 |]",
].join("\n");

var parser = new Parse();
parser.parse(ABC);
var tune = parser.getTune();
var staff = tune.lines[0].staff[0];
var converter = createJianpuConverter(staff.key);
var elements = [];

staff.voices[0].forEach(function(element) {
	if (element.el_type === "bar") {
		converter.resetBar();
		elements.push({ type: "bar", barType: element.type });
	} else if (element.el_type === "note") {
		converter.convertNote(element).forEach(function(event) {
			elements.push(event);
		});
	}
});

var layout = layoutJianpu(elements, {
	staffWidth: 300,
	title: tune.metaText.title,
	keyLabel: "1=C",
	meterLabel: "4/4",
});

assert.strictEqual(layout.width, 300);
assert.strictEqual(layout.lines.length, 2);
assert.deepStrictEqual(layout.lines.map(function(line) {
	return line.measures.map(function(measure) {
		return measure.index + 1;
	});
}), [[1, 2], [3]]);
assert.deepStrictEqual(layout.lines.map(function(line) {
	return line.measures.map(function(measure) {
		return measure.events.length;
	});
}), [[4, 4], [2]]);
assert.strictEqual(layout.lines.reduce(function(sum, line) {
	return sum + line.measures.reduce(function(lineSum, measure) {
		return lineSum + measure.events.length;
	}, 0);
}, 0), 10);
layout.lines.forEach(function(line) {
	assert.ok(line.width <= 244 + 1e-9);
});
var justifiedLine = layout.lines[0];
assert.ok(
	justifiedLine.firstMeasurePadding <=
		layoutJianpu.DEFAULT_OPTIONS.measurePadding
);
assert.ok(Math.abs(justifiedLine.width - 244) < 1e-9);
assert.ok(Math.abs(
	justifiedLine.measures[1].x -
		(justifiedLine.measures[0].x + justifiedLine.measures[0].width)
) < 1e-9);
justifiedLine.measures.slice(1).forEach(function(measure) {
	var firstEvent = measure.events[0];
	var lastEvent = measure.events[measure.events.length - 1];
	var leftSpace = firstEvent.x - measure.x;
	var rightSpace = measure.endingBar.x -
		(lastEvent.x + lastEvent.width);
	assert.ok(Math.abs(leftSpace - rightSpace) < 1e-9);
});
assert.strictEqual(
	justifiedLine.measures[0].contentLeftPadding,
	layoutJianpu.DEFAULT_OPTIONS.measurePadding
);
assert.deepStrictEqual(layout.warnings, []);
var beamedMeasure = layout.lines[0].measures[1];
assert.strictEqual(beamedMeasure.beamLines.length, 1);
assert.strictEqual(beamedMeasure.beamLines[0].x1, beamedMeasure.events[1].x);
assert.strictEqual(
	beamedMeasure.beamLines[0].x2,
	beamedMeasure.events[2].x + beamedMeasure.events[2].noteColumnWidth
);

var fixedCountLayout = layoutJianpu(elements, {
	staffWidth: 800,
	measuresPerLine: 1,
});
assert.deepStrictEqual(fixedCountLayout.lines.map(function(line) {
	return line.measures.length;
}), [1, 1, 1]);

var lowOctaveUnderlineLayout = layoutJianpu([
	{
		notes: [{ number: 6, octaveDots: -1, accidentalMark: null }],
		durationMarks: { extensionDashes: 0, underlines: 1, dots: 0 },
	},
	{ type: "bar", barType: "bar_thin" },
], { staffWidth: 300 });
var lowOctaveEvent = lowOctaveUnderlineLayout.lines[0].measures[0].events[0];
assert.ok(
	lowOctaveEvent.durationLayout.underlines[0].y1 <
		lowOctaveEvent.notePositions[0].octaveDotPositions[0].cy
);

var extensionCellLayout = layoutJianpu([{
	notes: [{ number: 5, octaveDots: 0, accidentalMark: null }],
	durationMarks: { extensionDashes: 3, underlines: 0, dots: 0 },
}], { staffWidth: 300 });
var extensionLines =
	extensionCellLayout.lines[0].measures[0].events[0]
		.durationLayout.extensionDashes;
assert.strictEqual(extensionLines.length, 3);
assert.strictEqual(
	extensionLines[1].x1 - extensionLines[0].x1,
	layoutJianpu.DEFAULT_OPTIONS.extensionDashWidth +
		extensionCellLayout.lines[0].eventGap
);
assert.strictEqual(
	extensionLines[2].x1 - extensionLines[1].x1,
	layoutJianpu.DEFAULT_OPTIONS.extensionDashWidth +
		extensionCellLayout.lines[0].eventGap
);

var centeredDashLayout = layoutJianpu([
	{
		notes: [{ number: 4, octaveDots: 0, accidentalMark: null }],
		durationMarks: { extensionDashes: 1, underlines: 0, dots: 0 },
	},
	{
		notes: [{ number: 3, octaveDots: 0, accidentalMark: null }],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
], { staffWidth: 300 });
var centeredEvents = centeredDashLayout.lines[0].measures[0].events;
var dashCenter =
	(centeredEvents[0].durationLayout.extensionDashes[0].x1 +
		centeredEvents[0].durationLayout.extensionDashes[0].x2) / 2;
assert.ok(Math.abs(
	dashCenter - centeredEvents[0].notePositions[0].x -
	(centeredEvents[1].notePositions[0].x - dashCenter)
) < 1e-9);

var tieLayout = layoutJianpu([
	{
		notes: [{
			number: 5, octaveDots: 0, accidentalMark: null, tieStart: true,
		}],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
	{
		notes: [{
			number: 5, octaveDots: 0, accidentalMark: null, tieEnd: true,
		}],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
], { staffWidth: 300 });
var tiedNote = tieLayout.lines[0].measures[0].events[0].notePositions[0];
var tieStartY = Number(tieLayout.lines[0].tiePaths[0].d.split(" ")[2]);
assert.strictEqual(
	tieStartY,
	tiedNote.y - layoutJianpu.DEFAULT_OPTIONS.numberTopOffset
);

var finalDoubleBarLayout = layoutJianpu([
	{
		notes: [{ number: 1, octaveDots: 0, accidentalMark: null }],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	},
	{ type: "bar", barType: "bar_thin_thin" },
], { staffWidth: 300 });
var finalDoubleBar =
	finalDoubleBarLayout.lines[0].measures[0].endingBar.lines;
assert.strictEqual(
	finalDoubleBar[0].y2 - finalDoubleBar[0].y1,
	layoutJianpu.DEFAULT_OPTIONS.numberFontSize +
		layoutJianpu.DEFAULT_OPTIONS.barTopExtra +
		layoutJianpu.DEFAULT_OPTIONS.barBottomExtra
);
assert.deepStrictEqual(
	finalDoubleBar.map(function(line) { return line.strokeWidth; }),
	[
		layoutJianpu.DEFAULT_OPTIONS.thinBarWidth,
		layoutJianpu.DEFAULT_OPTIONS.thickBarWidth,
	]
);
assert.strictEqual(
	finalDoubleBar[1].x1 - finalDoubleBar[0].x1,
	layoutJianpu.DEFAULT_OPTIONS.doubleBarGap
);

var pagedElements = [];
for (var pageLineIndex = 0; pageLineIndex < 11; pageLineIndex++) {
	pagedElements.push({
		notes: [{ number: 1, octaveDots: 0, accidentalMark: null }],
		durationMarks: { extensionDashes: 0, underlines: 0, dots: 0 },
	});
	pagedElements.push({ type: "bar", barType: "bar_thin" });
	if (pageLineIndex < 10)
		pagedElements.push({ type: "line_break" });
}
var pagedLayout = layoutJianpu(pagedElements, { staffWidth: 300 });
assert.strictEqual(pagedLayout.lines.length, 11);
assert.deepStrictEqual(
	pagedLayout.pageNumbers.map(function(page) { return page.text; }),
	["1 / 2", "2 / 2"]
);
assert.ok(pagedLayout.pageNumbers[0].y < pagedLayout.lines[10].y);

console.log(JSON.stringify({
	width: layout.width,
	height: layout.height,
	header: layout.header,
	lineBreakDecision: layout.lines.map(function(line) {
		return {
			line: line.index + 1,
			naturalWidth: line.naturalWidth,
			measures: line.measures.map(function(measure) {
				return {
					measure: measure.index + 1,
					x: measure.x,
					width: measure.width,
					eventCount: measure.events.length,
					endingBar: measure.endingBar && measure.endingBar.type,
				};
			}),
		};
	}),
	warnings: layout.warnings,
}, null, 2));
