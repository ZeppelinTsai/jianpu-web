"use strict";

var DEFAULT_OPTIONS = {
	staffWidth: 800,
	measuresPerLine: undefined,
	paddingLeft: 24,
	paddingRight: 24,
	paddingTop: 20,
	paddingBottom: 20,
	headerHeight: 72,
	lineHeight: 104,
	measurePadding: 10,
	eventGap: 10,
	numberFontSize: 22,
	headerFontSize: 16,
	titleFontSize: 24,
	chordNoteGap: 25,
	numberWidth: 14,
	accidentalWidth: 14,
	accidentalGap: 2,
	accidentalRaise: 8,
	octaveDotRadius: 2,
	octaveDotGap: 6,
	numberTopOffset: 23,
	numberBottomOffset: 5,
	underlineGap: 5,
	underlineSpacing: 5,
	durationDotWidth: 7,
	durationDotRadius: 1.8,
	extensionDashWidth: 18,
	extensionDashGap: 4,
	barGap: 8,
	thinBarWidth: 1,
	thickBarWidth: 4,
};

var SUPPORTED_BARS = {
	bar_thin: true,
	bar_thin_thin: true,
	bar_thin_thick: true,
	bar_thick_thin: true,
};

function mergeOptions(options) {
	return Object.assign({}, DEFAULT_OPTIONS, options || {});
}

function defaultMeasureText(text, style) {
	var fontSize = style && style.fontSize ? style.fontSize : DEFAULT_OPTIONS.numberFontSize;
	return String(text).length * fontSize * 0.6;
}

function accidentalText(accidentalMark) {
	switch (accidentalMark) {
		case "sharp": return "♯";
		case "flat": return "♭";
		case "natural": return "♮";
		case "dblsharp": return "𝄪";
		case "dblflat": return "𝄫";
		default: return "";
	}
}

function barWidth(barType, options) {
	switch (barType) {
		case "bar_thin_thin":
			return options.thinBarWidth * 2 + options.barGap;
		case "bar_thin_thick":
		case "bar_thick_thin":
			return options.thinBarWidth + options.thickBarWidth + options.barGap;
		default:
			return options.thinBarWidth;
	}
}

function measureEvent(event, options, measureText) {
	var widestNote = options.numberWidth;
	event.notes.forEach(function(note) {
		var width = measureText(String(note.number), { fontSize: options.numberFontSize });
		var accidental = accidentalText(note.accidentalMark);
		if (accidental)
			width += Math.max(
				options.accidentalWidth,
				measureText(accidental, { fontSize: options.numberFontSize * 0.7 })
			) + options.accidentalGap;
		widestNote = Math.max(widestNote, width);
	});

	var marks = event.durationMarks;
	var rightWidth =
		marks.extensionDashes * options.extensionDashWidth +
		Math.max(0, marks.extensionDashes - 1) * options.extensionDashGap +
		marks.dots * options.durationDotWidth;

	return {
		source: event,
		naturalWidth: widestNote + rightWidth,
		noteColumnWidth: widestNote,
		rightWidth: rightWidth,
	};
}

function createMeasure(index) {
	return {
		index: index,
		events: [],
		endingBar: null,
		naturalWidth: 0,
	};
}

function groupMeasures(elements, options, measureText, warnings) {
	var measures = [];
	var current = createMeasure(0);

	elements.forEach(function(element) {
		if (element && element.type === "bar") {
			var requestedType = element.barType || "bar_thin";
			var renderedType = requestedType;
			if (!SUPPORTED_BARS[requestedType]) {
				renderedType = "bar_thin";
				warnings.push("Unsupported bar type " + requestedType + "; rendered as bar_thin.");
			}
			current.endingBar = {
				sourceType: requestedType,
				type: renderedType,
				width: barWidth(renderedType, options),
			};
			measures.push(current);
			current = createMeasure(measures.length);
		} else if (element && Array.isArray(element.notes)) {
			current.events.push(measureEvent(element, options, measureText));
		}
	});

	if (current.events.length || current.endingBar)
		measures.push(current);

	measures.forEach(function(measure) {
		var eventsWidth = measure.events.reduce(function(sum, event) {
			return sum + event.naturalWidth;
		}, 0);
		var gapsWidth = Math.max(0, measure.events.length - 1) * options.eventGap;
		var endingBarWidth = measure.endingBar ? measure.endingBar.width + options.barGap : 0;
		measure.naturalWidth =
			options.measurePadding * 2 +
			eventsWidth +
			gapsWidth +
			endingBarWidth;
	});

	return measures;
}

function wrapMeasures(measures, contentWidth, options, warnings) {
	var lines = [];
	var current = [];
	var currentWidth = 0;

	function finishLine() {
		if (current.length) {
			lines.push({ measures: current, naturalWidth: currentWidth });
			current = [];
			currentWidth = 0;
		}
	}

	measures.forEach(function(measure) {
		var fixedCountReached =
			options.measuresPerLine &&
			current.length >= options.measuresPerLine;
		var widthReached =
			!options.measuresPerLine &&
			current.length > 0 &&
			currentWidth + measure.naturalWidth > contentWidth;

		if (fixedCountReached || widthReached)
			finishLine();

		if (measure.naturalWidth > contentWidth) {
			warnings.push(
				"Measure " + (measure.index + 1) +
				" is wider than the available content width and was kept intact."
			);
		}

		current.push(measure);
		currentWidth += measure.naturalWidth;
	});

	finishLine();
	return lines;
}

function mergeBeamUnderlines(measure, options) {
	measure.beamLines = [];
	var activeGroup = [];

	function finishGroup() {
		if (activeGroup.length < 2) {
			activeGroup = [];
			return;
		}

		var maximumLevel = activeGroup.reduce(function(maximum, event) {
			return Math.max(maximum, event.durationMarks.underlines);
		}, 0);

		for (var level = 1; level <= maximumLevel; level++) {
			var run = [];

			function finishRun() {
				if (!run.length)
					return;
				var y = run.reduce(function(maximum, event) {
					var eventLine = event.durationLayout.underlines[level - 1];
					return Math.max(maximum, eventLine.y1);
				}, -Infinity);
				measure.beamLines.push({
					x1: run[0].x,
					x2: run[run.length - 1].x + run[run.length - 1].noteColumnWidth,
					y1: y,
					y2: y,
					strokeWidth: 1.4,
					level: level,
				});
				run = [];
			}

			activeGroup.forEach(function(event) {
				if (event.durationMarks.underlines >= level)
					run.push(event);
				else
					finishRun();
			});
			finishRun();
		}

		activeGroup.forEach(function(event) {
			event.durationLayout.underlines = [];
		});
		activeGroup = [];
	}

	measure.events.forEach(function(event) {
		if (event.beam.start) {
			finishGroup();
			activeGroup = [event];
		} else if (activeGroup.length) {
			activeGroup.push(event);
		}

		if (activeGroup.length && event.beam.end)
			finishGroup();
	});
	finishGroup();
}

function positionLine(line, lineIndex, options) {
	var lineTop = options.paddingTop + options.headerHeight + lineIndex * options.lineHeight;
	var baselineY = lineTop + options.lineHeight * 0.62;
	var cursorX = options.paddingLeft;

	line.index = lineIndex;
	line.y = lineTop;
	line.height = options.lineHeight;

	line.measures.forEach(function(measure) {
		measure.x = cursorX;
		measure.y = lineTop;
		measure.width = measure.naturalWidth;

		var eventX = cursorX + options.measurePadding;
		measure.events.forEach(function(event) {
			event.x = eventX;
			event.y = baselineY;
			event.width = event.naturalWidth;
			event.notePositions = [];

			var notes = event.source.notes;
			notes.forEach(function(note, noteIndex) {
				var noteX = eventX + event.noteColumnWidth / 2;
				var noteY = baselineY - noteIndex * options.chordNoteGap;
				var octaveDotPositions = [];
				var octaveDotCount = Math.abs(note.octaveDots);
				for (var dotIndex = 0; dotIndex < octaveDotCount; dotIndex++) {
					octaveDotPositions.push({
						cx: noteX,
						cy: note.octaveDots > 0 ?
							noteY - options.numberTopOffset - dotIndex * options.octaveDotGap :
							noteY + options.numberBottomOffset + dotIndex * options.octaveDotGap,
						r: options.octaveDotRadius,
					});
				}

				var accidental = accidentalText(note.accidentalMark);
				event.notePositions.push({
					x: noteX,
					y: noteY,
					number: note.number,
					octaveDots: note.octaveDots,
					accidentalMark: note.accidentalMark,
					accidentalText: accidental,
					accidentalPosition: accidental ? {
						x: noteX - options.numberWidth / 2 - options.accidentalGap,
						y: noteY - options.accidentalRaise,
					} : null,
					octaveDotPositions: octaveDotPositions,
				});
			});

			event.durationMarks = Object.assign({}, event.source.durationMarks);
			event.beam = Object.assign({ start: false, end: false }, event.source.beam);
			var lowestNote = event.notePositions[0];
			var lowestBelowDots = lowestNote.octaveDots < 0 ?
				Math.abs(lowestNote.octaveDots) : 0;
			var underlineStartY =
				lowestNote.y +
				options.numberBottomOffset +
				lowestBelowDots * options.octaveDotGap +
				options.underlineGap;
			event.durationLayout = {
				underlines: [],
				extensionDashes: [],
				dots: [],
			};

			for (var underlineIndex = 0;
				underlineIndex < event.durationMarks.underlines;
				underlineIndex++) {
				var underlineY =
					underlineStartY + underlineIndex * options.underlineSpacing;
				event.durationLayout.underlines.push({
					x1: eventX,
					x2: eventX + event.noteColumnWidth,
					y1: underlineY,
					y2: underlineY,
					strokeWidth: 1.4,
				});
			}

			var rightCursor = eventX + event.noteColumnWidth;
			for (var dashIndex = 0;
				dashIndex < event.durationMarks.extensionDashes;
				dashIndex++) {
				var dashStart =
					rightCursor +
					dashIndex * (options.extensionDashWidth + options.extensionDashGap);
				event.durationLayout.extensionDashes.push({
					x1: dashStart,
					x2: dashStart + options.extensionDashWidth,
					y1: lowestNote.y - options.numberBottomOffset,
					y2: lowestNote.y - options.numberBottomOffset,
					strokeWidth: 1.5,
				});
			}

			rightCursor +=
				event.durationMarks.extensionDashes * options.extensionDashWidth +
				Math.max(0, event.durationMarks.extensionDashes - 1) *
					options.extensionDashGap;
			for (var durationDotIndex = 0;
				durationDotIndex < event.durationMarks.dots;
				durationDotIndex++) {
				event.durationLayout.dots.push({
					cx: rightCursor +
						options.durationDotWidth / 2 +
						durationDotIndex * options.durationDotWidth,
					cy: lowestNote.y - options.numberBottomOffset,
					r: options.durationDotRadius,
				});
			}

			delete event.source;
			eventX += event.width + options.eventGap;
		});
		mergeBeamUnderlines(measure, options);

		if (measure.endingBar) {
			var barX = cursorX + measure.width - options.measurePadding -
				measure.endingBar.width;
			measure.endingBar.x = barX;
			measure.endingBar.y1 = lineTop + 12;
			measure.endingBar.y2 = lineTop + options.lineHeight - 18;
			measure.endingBar.lines = [];
			if (measure.endingBar.type === "bar_thin_thin") {
				measure.endingBar.lines.push(
					{ x1: barX, x2: barX, y1: measure.endingBar.y1,
						y2: measure.endingBar.y2, strokeWidth: options.thinBarWidth },
					{ x1: barX + options.barGap, x2: barX + options.barGap,
						y1: measure.endingBar.y1, y2: measure.endingBar.y2,
						strokeWidth: options.thinBarWidth }
				);
			} else if (measure.endingBar.type === "bar_thin_thick") {
				measure.endingBar.lines.push(
					{ x1: barX, x2: barX, y1: measure.endingBar.y1,
						y2: measure.endingBar.y2, strokeWidth: options.thinBarWidth },
					{ x1: barX + options.barGap, x2: barX + options.barGap,
						y1: measure.endingBar.y1, y2: measure.endingBar.y2,
						strokeWidth: options.thickBarWidth }
				);
			} else if (measure.endingBar.type === "bar_thick_thin") {
				measure.endingBar.lines.push(
					{ x1: barX, x2: barX, y1: measure.endingBar.y1,
						y2: measure.endingBar.y2, strokeWidth: options.thickBarWidth },
					{ x1: barX + options.barGap, x2: barX + options.barGap,
						y1: measure.endingBar.y1, y2: measure.endingBar.y2,
						strokeWidth: options.thinBarWidth }
				);
			} else {
				measure.endingBar.lines.push({
					x1: barX,
					x2: barX,
					y1: measure.endingBar.y1,
					y2: measure.endingBar.y2,
					strokeWidth: options.thinBarWidth,
				});
			}
		}

		cursorX += measure.width;
	});
}

/**
 * Lay out converted jianpu events without requiring a browser DOM.
 *
 * @param {Array<Object>} elements JianpuEvent and bar objects in source order.
 * @param {Object} options Fixed-width layout and header options.
 * @param {Function} measureText Optional (text, style) => width callback.
 * @returns {{width:number,height:number,header:Object,lines:Array,warnings:Array}}
 */
function layoutJianpu(elements, options, measureText) {
	options = mergeOptions(options);
	measureText = measureText || defaultMeasureText;

	var warnings = [];
	var contentWidth = options.staffWidth - options.paddingLeft - options.paddingRight;
	if (contentWidth <= 0)
		throw new RangeError("staffWidth must be wider than the horizontal padding.");

	var measures = groupMeasures(elements || [], options, measureText, warnings);
	var lines = wrapMeasures(measures, contentWidth, options, warnings);
	lines.forEach(function(line, index) {
		positionLine(line, index, options);
	});

	return {
		width: options.staffWidth,
		height:
			options.paddingTop +
			options.headerHeight +
			lines.length * options.lineHeight +
			options.paddingBottom,
		header: {
			title: options.title || "",
			keyLabel: options.keyLabel || "",
			meterLabel: options.meterLabel || "",
			titlePosition: {
				x: options.staffWidth / 2,
				y: options.paddingTop + options.titleFontSize,
			},
			infoPosition: {
				x: options.paddingLeft,
				y: options.paddingTop + options.headerHeight - 12,
			},
		},
		style: {
			numberFontSize: options.numberFontSize,
			headerFontSize: options.headerFontSize,
			titleFontSize: options.titleFontSize,
		},
		lines: lines,
		warnings: warnings,
	};
}

layoutJianpu.defaultMeasureText = defaultMeasureText;
layoutJianpu.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

module.exports = layoutJianpu;
