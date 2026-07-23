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
	assert.ok(line.naturalWidth <= 252);
});
assert.deepStrictEqual(layout.warnings, []);
assert.strictEqual(layout.lines[0].measures[1].beamLines.length, 1);
assert.strictEqual(layout.lines[0].measures[1].beamLines[0].x1, 191);
assert.strictEqual(layout.lines[0].measures[1].beamLines[0].x2, 229);

var fixedCountLayout = layoutJianpu(elements, {
	staffWidth: 800,
	measuresPerLine: 1,
});
assert.deepStrictEqual(fixedCountLayout.lines.map(function(line) {
	return line.measures.length;
}), [1, 1, 1]);

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
