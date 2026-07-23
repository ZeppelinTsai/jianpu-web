"use strict";

function escapeXml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function number(value) {
	return Number(value.toFixed(3));
}

function lineSvg(line, className) {
	return '<line class="' + className + '" x1="' + number(line.x1) +
		'" y1="' + number(line.y1) + '" x2="' + number(line.x2) +
		'" y2="' + number(line.y2) + '" stroke-width="' +
		number(line.strokeWidth) + '"/>';
}

function circleSvg(circle, className) {
	return '<circle class="' + className + '" cx="' + number(circle.cx) +
		'" cy="' + number(circle.cy) + '" r="' + number(circle.r) + '"/>';
}

/**
 * Convert a completed layout model to SVG. This function does not lay out or
 * alter coordinates.
 *
 * @param {{width:number,height:number,header:Object,style:Object,lines:Array}} layout
 * @param {{fontFamily?:string,className?:string}} options
 * @returns {string}
 */
function renderJianpuSvg(layout, options) {
	options = options || {};
	var fontFamily = options.fontFamily ||
		'"Noto Sans", "Noto Sans Symbols 2", "Arial Unicode MS", sans-serif';
	var className = options.className || "abcjs-jianpu";
	var output = [];

	output.push('<?xml version="1.0" encoding="UTF-8"?>');
	output.push('<svg xmlns="http://www.w3.org/2000/svg" class="' +
		escapeXml(className) + '" width="' + number(layout.width) +
		'" height="' + number(layout.height) + '" viewBox="0 0 ' +
		number(layout.width) + " " + number(layout.height) +
		'" role="img" aria-label="' +
		escapeXml(layout.header.title || "Jianpu notation") + '">');
	output.push("<style>" +
		".abcjs-jianpu{background:#fff;color:#111}" +
		".jianpu-number,.jianpu-header,.jianpu-title,.jianpu-accidental{" +
		"font-family:" + fontFamily + ";fill:currentColor}" +
		".jianpu-number{text-anchor:middle;font-size:" +
		number(layout.style.numberFontSize) + "px}" +
		".jianpu-accidental{text-anchor:end;font-size:" +
		number(layout.style.numberFontSize * 0.7) + "px}" +
		".jianpu-title{text-anchor:middle;font-size:" +
		number(layout.style.titleFontSize) + "px;font-weight:600}" +
		".jianpu-header{font-size:" + number(layout.style.headerFontSize) + "px}" +
		".jianpu-octave-dot,.jianpu-duration-dot{fill:currentColor}" +
		".jianpu-underline,.jianpu-extension,.jianpu-bar{" +
		"stroke:currentColor;fill:none;stroke-linecap:butt}" +
		"</style>");

	if (layout.header.title) {
		output.push('<text class="jianpu-title" x="' +
			number(layout.header.titlePosition.x) + '" y="' +
			number(layout.header.titlePosition.y) + '">' +
			escapeXml(layout.header.title) + "</text>");
	}

	var headerParts = [];
	if (layout.header.keyLabel)
		headerParts.push(layout.header.keyLabel);
	if (layout.header.meterLabel)
		headerParts.push(layout.header.meterLabel);
	if (headerParts.length) {
		output.push('<text class="jianpu-header" x="' +
			number(layout.header.infoPosition.x) + '" y="' +
			number(layout.header.infoPosition.y) + '">' +
			escapeXml(headerParts.join("    ")) + "</text>");
	}

	layout.lines.forEach(function(layoutLine) {
		output.push('<g class="jianpu-line" data-line="' +
			(layoutLine.index + 1) + '">');
		layoutLine.measures.forEach(function(measure) {
			output.push('<g class="jianpu-measure" data-measure="' +
				(measure.index + 1) + '">');
			measure.events.forEach(function(event) {
				output.push('<g class="jianpu-event">');
				event.notePositions.forEach(function(note) {
					if (note.accidentalPosition) {
						output.push('<text class="jianpu-accidental" x="' +
							number(note.accidentalPosition.x) + '" y="' +
							number(note.accidentalPosition.y) + '">' +
							escapeXml(note.accidentalText) + "</text>");
					}
					output.push('<text class="jianpu-number" x="' +
						number(note.x) + '" y="' + number(note.y) + '">' +
						note.number + "</text>");
					note.octaveDotPositions.forEach(function(dot) {
						output.push(circleSvg(dot, "jianpu-octave-dot"));
					});
				});
				event.durationLayout.underlines.forEach(function(line) {
					output.push(lineSvg(line, "jianpu-underline"));
				});
				event.durationLayout.extensionDashes.forEach(function(line) {
					output.push(lineSvg(line, "jianpu-extension"));
				});
				event.durationLayout.dots.forEach(function(dot) {
					output.push(circleSvg(dot, "jianpu-duration-dot"));
				});
				output.push("</g>");
			});
			measure.beamLines.forEach(function(line) {
				output.push(lineSvg(line, "jianpu-underline jianpu-beam"));
			});
			if (measure.endingBar) {
				measure.endingBar.lines.forEach(function(line) {
					output.push(lineSvg(line, "jianpu-bar"));
				});
			}
			output.push("</g>");
		});
		output.push("</g>");
	});

	output.push("</svg>");
	return output.join("\n");
}

module.exports = renderJianpuSvg;
