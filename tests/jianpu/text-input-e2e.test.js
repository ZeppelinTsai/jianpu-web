"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var parseJianpu = require("../../src/jianpu/parse-jianpu");
var layoutJianpu = require("../../src/jianpu/layout-jianpu");
var renderJianpuSvg = require("../../src/jianpu/render-jianpu-svg");

var TEXT_INPUT = [
	"T:Octave and Duration Example",
	"M:4/4",
	"K:C",
	"1, 2,, 3 4' | 5'' 6_ 7_ 1- | 2. 3__ 4__ 5- |",
	"6.. 7__ 1- | 2--- | 0 0 0 0 |]",
].join("\n");

var parsed = parseJianpu(TEXT_INPUT);
var layout = layoutJianpu(parsed.elements, {
	staffWidth: 800,
	title: parsed.header.title,
	keyLabel: "1=" + parsed.header.key,
	meterLabel: parsed.header.meter,
});
var svg = renderJianpuSvg(layout);

assert.strictEqual(parsed.elements.filter(function(element) {
	return element.type !== "bar";
}).length, 20);
assert.strictEqual(layout.lines.reduce(function(total, line) {
	return total + line.measures.length;
}, 0), 6);
assert.strictEqual(layout.warnings.length, 0);
assert.strictEqual(parsed.warnings.length, 0);

assert.strictEqual((svg.match(/class="jianpu-number"/g) || []).length, 20);
assert.strictEqual((svg.match(/class="jianpu-octave-dot"/g) || []).length, 6);
assert.strictEqual((svg.match(/class="jianpu-underline"/g) || []).length, 8);
assert.strictEqual((svg.match(/class="jianpu-duration-dot"/g) || []).length, 3);
assert.strictEqual((svg.match(/class="jianpu-extension"/g) || []).length, 6);
assert.strictEqual((svg.match(/class="jianpu-bar"/g) || []).length, 7);

var outputDirectory = path.resolve(__dirname, "../../test-output");
var outputPath = path.join(outputDirectory, "text-input-test.svg");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, svg, "utf8");

console.log(JSON.stringify({
	pipeline: [
		"parseJianpu",
		"layoutJianpu",
		"renderJianpuSvg",
	],
	outputPath: outputPath,
	width: layout.width,
	height: layout.height,
	lines: layout.lines.length,
	measures: 6,
	events: 20,
	svgElements: {
		numbers: 20,
		octaveDots: 6,
		underlines: 8,
		durationDots: 3,
		extensionDashes: 6,
		barLines: 7,
	},
	warnings: parsed.warnings.concat(layout.warnings),
}, null, 2));

