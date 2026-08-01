"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var tuneBook = require("../../src/api/abc_tunebook");
var jianpu = require("../../src/jianpu");

var abcPath = path.resolve(__dirname, "fixtures/si-chou.abc");
var abc = fs.readFileSync(abcPath, "utf8");
var tunes = tuneBook.parseOnly(abc);

assert.strictEqual(tunes.length, 1);
var converted = jianpu.convertAbcTune(tunes[0]);
var result = jianpu.fromAbc(abc, {
	staffWidth: 800,
}, tuneBook.parseOnly);
var events = converted.elements.filter(function(element) {
	return Array.isArray(element.notes);
});
var bars = converted.elements.filter(function(element) {
	return element.type === "bar";
});
var outputPath = path.resolve(__dirname, "../../test-output/si-chou.svg");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, result.svg, "utf8");

assert.strictEqual(events.length, 76);
assert.strictEqual(bars.length, 38);
assert.strictEqual(events[0].notes[0].number, 6);
assert.strictEqual(events[1].notes[0].number, 2);
assert.strictEqual(result.layout.header.keyLabel, "6=A");
assert.strictEqual(result.layout.header.meterLabel, "4/4");
assert.strictEqual(result.layout.header.showTempo, false);
assert.strictEqual(result.layout.header.tempoLabel, "♩=180");
assert.strictEqual(result.layout.header.composer, "ZeppelinTsai");
assert.strictEqual((result.svg.match(/class="jianpu-number"/g) || []).length, 76);
assert.strictEqual((result.svg.match(/class="jianpu-chord"/g) || []).length, 33);
assert.strictEqual((result.svg.match(/class="jianpu-dynamic"/g) || []).length, 5);
assert.strictEqual((result.svg.match(/class="jianpu-meter-line"/g) || []).length, 1);
assert.ok(result.layout.height <= 1170);
assert.strictEqual(events.filter(function(event) {
	return event.notes.some(function(note) { return note.tieStart; });
}).length, 5);
assert.strictEqual(events.filter(function(event) {
	return event.notes.some(function(note) { return note.tieEnd; });
}).length, 5);
assert.ok((result.svg.match(/class="jianpu-tie"/g) || []).length >= 5);
assert.deepStrictEqual(result.layout.lines[0].measures.map(function(measure) {
	return measure.index + 1;
}), [1, 2, 3, 4]);
result.layout.lines.forEach(function(line) {
	assert.ok(line.width <= 752 + 1e-9);
	assert.strictEqual(
		Number(line.measureNumber.text),
		line.measures[0].index + 1
	);
	line.measures.forEach(function(measure) {
		for (var i = 0; i < measure.events.length - 1; i++) {
			var dashes = measure.events[i].durationLayout.extensionDashes;
			if (dashes.length) {
				var dashEnd = dashes[dashes.length - 1].x2;
				assert.ok(
					measure.events[i + 1].x - dashEnd >= 5,
					"Extension dash must keep a safe gap before the next event."
				);
			}
		}
	});
});
var firstEventX = result.layout.lines[0].measures[0].events[0].x;
result.layout.lines.forEach(function(line) {
	assert.strictEqual(line.measures[0].events[0].x, firstEventX);
});
assert.strictEqual(
	(result.svg.match(/class="jianpu-measure-number"/g) || []).length,
	result.layout.lines.length
);

console.log(JSON.stringify({
	outputPath: outputPath,
	key: tunes[0].lines[0].staff[0].key,
	meter: tunes[0].lines[0].staff[0].meter,
	tuneWarnings: tunes[0].warnings || [],
	events: events.length,
	bars: bars.length,
	lines: result.layout.lines.length,
	chordSymbols: (result.svg.match(/class="jianpu-chord"/g) || []).length,
	dynamics: (result.svg.match(/class="jianpu-dynamic"/g) || []).length,
	ties: (result.svg.match(/class="jianpu-tie"/g) || []).length,
	warnings: result.warnings,
}, null, 2));

assert.strictEqual(result.warnings.length, 0);
