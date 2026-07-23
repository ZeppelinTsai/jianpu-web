"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Parse = require("../../src/parse/abc_parse");
var createJianpuConverter = require("../../src/jianpu/create-jianpu-converter");
var layoutJianpu = require("../../src/jianpu/layout-jianpu");
var renderJianpuSvg = require("../../src/jianpu/render-jianpu-svg");

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
	staffWidth: 800,
	title: tune.metaText.title,
	keyLabel: "1=C",
	meterLabel: "4/4",
});
var svg = renderJianpuSvg(layout);

assert.match(svg, /^<\?xml/);
assert.match(svg, /<svg[\s\S]*<\/svg>$/);
assert.strictEqual((svg.match(/class="jianpu-number"/g) || []).length, 12);
assert.strictEqual((svg.match(/class="jianpu-underline jianpu-beam"/g) || []).length, 1);
assert.strictEqual((svg.match(/class="jianpu-extension"/g) || []).length, 2);
assert.strictEqual((svg.match(/class="jianpu-bar"/g) || []).length, 4);
assert.match(svg, /class="jianpu-accidental"[^>]*>♯<\/text>/);

var outputDirectory = path.resolve(__dirname, "../../test-output");
var outputPath = path.join(outputDirectory, "test-tune.svg");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, svg, "utf8");

console.log(JSON.stringify({
	outputPath: outputPath,
	width: layout.width,
	height: layout.height,
	lines: layout.lines.length,
	measures: layout.lines.reduce(function(count, line) {
		return count + line.measures.length;
	}, 0),
	svgElements: {
		numbers: (svg.match(/class="jianpu-number"/g) || []).length,
		underlines: (svg.match(/class="jianpu-underline/g) || []).length,
		extensionDashes: (svg.match(/class="jianpu-extension"/g) || []).length,
		barLines: (svg.match(/class="jianpu-bar"/g) || []).length,
	},
	warnings: converter.context.warnings.concat(layout.warnings),
}, null, 2));
