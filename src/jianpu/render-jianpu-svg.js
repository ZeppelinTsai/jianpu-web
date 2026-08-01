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
 * @param {{fontFamily?:string,titleFontFamily?:string,
 *   notationFontFamily?:string,className?:string}} options
 * @returns {string}
 */
function renderJianpuSvg(layout, options) {
	options = options || {};
	var fontFamily = options.fontFamily ||
		'"Noto Sans", "Noto Sans Symbols 2", "Arial Unicode MS", sans-serif';
	var notationFontFamily = options.notationFontFamily ||
		'"Times New Roman", "Noto Serif", "Noto Serif Symbols", Georgia, serif';
	var titleFontFamily = options.titleFontFamily ||
		'"Songti TC", "PMingLiU", "MingLiU", "SimSun", serif';
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
		".jianpu-header,.jianpu-meter,.jianpu-title,.jianpu-composer{" +
		"font-family:" + fontFamily + ";fill:currentColor}" +
		".jianpu-number,.jianpu-accidental,.jianpu-chord,.jianpu-dynamic," +
		".jianpu-measure-number,.jianpu-fingering-text,.jianpu-page-number{" +
		"font-family:" + notationFontFamily + ";fill:currentColor}" +
		".jianpu-number{text-anchor:middle;font-size:" +
		number(layout.style.numberFontSize) + "px;font-weight:700}" +
		".jianpu-accidental{text-anchor:end;font-size:" +
		number(layout.style.numberFontSize * 0.7) + "px}" +
		".jianpu-title{text-anchor:middle;font-size:" +
		number(layout.style.titleFontSize) + "px;font-weight:600;" +
		"font-family:" + titleFontFamily + "}" +
		".jianpu-header{font-size:" + number(layout.style.headerFontSize) + "px}" +
		".jianpu-meter{text-anchor:middle;font-size:" +
		number(layout.style.meterFontSize || layout.style.headerFontSize * 0.78) +
		"px;font-weight:400}" +
		".jianpu-composer{text-anchor:end;font-size:" +
		number(layout.style.composerFontSize) + "px;font-style:italic}" +
		".jianpu-chord{text-anchor:middle;font-size:" +
		number(layout.style.chordFontSize) + "px;font-weight:400}" +
		".jianpu-dynamic{text-anchor:middle;font-size:" +
		number(layout.style.dynamicFontSize) + "px;font-style:italic}" +
		".jianpu-measure-number{font-size:" +
		number(layout.style.measureNumberFontSize) + "px;font-weight:400}" +
		".jianpu-page-number{text-anchor:end;font-size:" +
		number(layout.style.pageNumberFontSize || 13) +
		"px;font-weight:400}" +
		".jianpu-fingering-text{text-anchor:middle;dominant-baseline:central;" +
		"font-size:" + number(layout.style.fingeringFontSize) + "px}" +
		".jianpu-octave-dot,.jianpu-duration-dot{fill:currentColor}" +
		".jianpu-note{cursor:pointer}" +
		".jianpu-note:hover .jianpu-number{fill:#1a73e8}" +
		".jianpu-fingering-circle{fill:white;stroke:currentColor;stroke-width:1}" +
		".jianpu-underline,.jianpu-extension,.jianpu-bar,.jianpu-tie{" +
		"stroke:currentColor;fill:none;stroke-linecap:butt}" +
		".jianpu-meter-line{stroke:currentColor;fill:none}" +
		"</style>");

	if (layout.header.title) {
		output.push('<text class="jianpu-title" x="' +
			number(layout.header.titlePosition.x) + '" y="' +
			number(layout.header.titlePosition.y) + '">' +
			escapeXml(layout.header.title) + "</text>");
	}
	if (layout.header.composer) {
		output.push('<text class="jianpu-composer" x="' +
			number(layout.header.composerPosition.x) + '" y="' +
			number(layout.header.composerPosition.y) + '">' +
			escapeXml(layout.header.composer) + "</text>");
	}

	if (layout.header.keyLabel) {
		output.push('<text class="jianpu-header" x="' +
			number(layout.header.keyPosition.x) + '" y="' +
			number(layout.header.keyPosition.y) + '">' +
			escapeXml(layout.header.keyLabel) + "</text>");
	}
	if (layout.header.meterPosition) {
		output.push('<text class="jianpu-meter jianpu-meter-numerator" x="' +
			number(layout.header.meterPosition.x) + '" y="' +
			number(layout.header.meterPosition.numeratorY) + '">' +
			escapeXml(layout.header.meterPosition.numerator) + "</text>");
		output.push('<text class="jianpu-meter jianpu-meter-denominator" x="' +
			number(layout.header.meterPosition.x) + '" y="' +
			number(layout.header.meterPosition.denominatorY) + '">' +
			escapeXml(layout.header.meterPosition.denominator) + "</text>");
		output.push(lineSvg(
			layout.header.meterPosition.fractionLine,
			"jianpu-meter-line"
		));
	} else if (layout.header.meterLabel) {
		output.push('<text class="jianpu-header" x="' +
			number(layout.header.meterTextPosition.x) + '" y="' +
			number(layout.header.meterTextPosition.y) + '">' +
			escapeXml(layout.header.meterLabel) + "</text>");
	}
	if (layout.header.showTempo && layout.header.tempoLabel) {
		output.push('<text class="jianpu-header" x="' +
			number(layout.header.tempoPosition.x) + '" y="' +
			number(layout.header.tempoPosition.y) + '">' +
			escapeXml(layout.header.tempoLabel) + "</text>");
	}

	layout.lines.forEach(function(layoutLine) {
		output.push('<g class="jianpu-line" data-line="' +
			(layoutLine.index + 1) + '">');
		output.push('<text class="jianpu-measure-number" x="' +
			number(layoutLine.measureNumber.x) + '" y="' +
			number(layoutLine.measureNumber.y) + '">' +
			escapeXml(layoutLine.measureNumber.text) + "</text>");
		layoutLine.measures.forEach(function(measure) {
			output.push('<g class="jianpu-measure" data-measure="' +
				(measure.index + 1) + '">');
			measure.events.forEach(function(event) {
				output.push('<g class="jianpu-event" data-duration-beats="' +
					number(event.durationBeats) + '">');
				event.notePositions.forEach(function(note) {
					var clickable = typeof note.midi === "number";
					if (clickable) {
						output.push('<g class="jianpu-note" data-midi="' +
							note.midi + '">');
					}
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
					if (clickable) output.push("</g>");
				});
				event.annotations.chords.forEach(function(annotation) {
					output.push('<text class="jianpu-chord" x="' +
						number(annotation.x) + '" y="' + number(annotation.y) + '">' +
						escapeXml(annotation.text) + "</text>");
				});
				event.annotations.dynamics.forEach(function(annotation) {
					output.push('<text class="jianpu-dynamic" x="' +
						number(annotation.x) + '" y="' + number(annotation.y) + '">' +
						escapeXml(annotation.text) + "</text>");
				});
				event.annotations.fingerings.forEach(function(annotation) {
					output.push('<circle class="jianpu-fingering-circle" cx="' +
						number(annotation.cx) + '" cy="' + number(annotation.cy) +
						'" r="' + number(annotation.r) + '"/>');
					output.push('<text class="jianpu-fingering-text" x="' +
						number(annotation.cx) + '" y="' + number(annotation.cy) + '">' +
						escapeXml(annotation.text) + "</text>");
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
		layoutLine.tiePaths.forEach(function(tie) {
			output.push('<path class="jianpu-tie" d="' + escapeXml(tie.d) +
				'" stroke-width="1.2"/>');
		});
		output.push("</g>");
	});
	(layout.pageNumbers || []).forEach(function(pageNumber) {
		output.push('<text class="jianpu-page-number" x="' +
			number(pageNumber.x) + '" y="' + number(pageNumber.y) + '">' +
			escapeXml(pageNumber.text) + "</text>");
	});

	output.push("</svg>");
	return output.join("\n");
}

module.exports = renderJianpuSvg;
