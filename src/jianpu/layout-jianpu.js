"use strict";

var DEFAULT_OPTIONS = {
	staffWidth: 800,
	measuresPerLine: undefined,
	paddingLeft: 24,
	paddingRight: 24,
	paddingTop: 20,
	paddingBottom: 20,
	headerHeight: 80,
	lineHeight: 102,
	measurePadding: 10,
	eventGap: 10,
	minimumMeasurePadding: 2,
	minimumEventGap: 2,
	maximumFlexibleScale: 2.5,
	numberFontSize: 22,
	headerFontSize: 16,
	showTempo: false,
	titleFontSize: 24,
	composerFontSize: 14,
	measureNumberFontSize: 15,
	fingeringFontSize: 11,
	fingeringRadius: 8,
	chordFontSize: 14,
	dynamicFontSize: 13,
	chordNoteGap: 22,
	rhythmCellWidth: 26,
	numberWidth: 14,
	accidentalWidth: 14,
	accidentalGap: 2,
	accidentalRaise: 8,
	octaveDotRadius: 2,
	octaveDotGap: 5,
	tieArcHeight: 10,
	numberTopOffset: 23,
	numberBottomOffset: 5,
	underlineGap: 2,
	underlineSpacing: 4,
	durationDotWidth: 7,
	durationDotRadius: 1.8,
	extensionLeadGap: 5,
	extensionDashWidth: 16,
	barGap: 14,
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
		(marks.extensionDashes ? options.extensionLeadGap : 0) +
		marks.extensionDashes * options.rhythmCellWidth +
		marks.dots * options.durationDotWidth;
	var chordWidth = 0;
	(event.chordSymbols || []).forEach(function(chord) {
		chordWidth = Math.max(
			chordWidth,
			measureText(chord, { fontSize: options.chordFontSize })
		);
	});

	return {
		source: event,
		naturalWidth: Math.max(widestNote + rightWidth, chordWidth),
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
		if (element && element.type === "line_break") {
			if (current.events.length || current.endingBar) {
				current.forceLineBreakAfter = true;
				measures.push(current);
				current = createMeasure(measures.length);
			} else if (measures.length) {
				measures[measures.length - 1].forceLineBreakAfter = true;
			}
		} else if (element && element.type === "bar") {
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
		measure.fixedWidth = eventsWidth + endingBarWidth;
		measure.naturalWidth = measure.fixedWidth +
			options.measurePadding * 2 + gapsWidth;
		measure.minimumWidth = measure.fixedWidth +
			options.minimumMeasurePadding * 2 +
			Math.max(0, measure.events.length - 1) * options.minimumEventGap;
	});

	return measures;
}

function wrapMeasures(measures, contentWidth, options, warnings) {
	var lines = [];
	var current = [];
	var currentWidth = 0;
	var currentMinimumWidth = 0;

	function finishLine() {
		if (current.length) {
			lines.push({ measures: current, naturalWidth: currentWidth });
			lines[lines.length - 1].minimumWidth = currentMinimumWidth;
			current = [];
			currentWidth = 0;
			currentMinimumWidth = 0;
		}
	}

	measures.forEach(function(measure) {
		var fixedCountReached =
			options.measuresPerLine &&
			current.length >= options.measuresPerLine;
		var widthReached =
			!options.measuresPerLine &&
			current.length > 0 &&
			currentMinimumWidth + measure.minimumWidth > contentWidth;

		if (fixedCountReached || widthReached)
			finishLine();

		if (measure.minimumWidth > contentWidth) {
			warnings.push(
				"Measure " + (measure.index + 1) +
				" is wider than the available content width and was kept intact."
			);
		}

		current.push(measure);
		currentWidth += measure.naturalWidth;
		currentMinimumWidth += measure.minimumWidth;
		if (measure.forceLineBreakAfter)
			finishLine();
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

function positionLine(line, lineIndex, contentWidth, options) {
	var lineTop = options.paddingTop + options.headerHeight + lineIndex * options.lineHeight;
	var baselineY = lineTop + options.lineHeight * 0.62;
	var cursorX = options.paddingLeft;
	var fixedWidth = line.measures.reduce(function(sum, measure) {
		return sum + measure.fixedWidth;
	}, 0);
	var naturalFlexibleWidth = line.naturalWidth - fixedWidth;
	var minimumFlexibleWidth = line.minimumWidth - fixedWidth;
	var availableFlexibleWidth = Math.max(
		minimumFlexibleWidth,
		contentWidth - fixedWidth
	);
	var measurePadding = options.measurePadding;
	var eventGap = options.eventGap;

	if (availableFlexibleWidth >= naturalFlexibleWidth) {
		var growScale = Math.min(
			options.maximumFlexibleScale,
			availableFlexibleWidth / naturalFlexibleWidth
		);
		measurePadding *= growScale;
		eventGap *= growScale;
	} else {
		var shrinkCapacity = naturalFlexibleWidth - minimumFlexibleWidth;
		var shrinkFraction = shrinkCapacity > 0 ?
			(naturalFlexibleWidth - availableFlexibleWidth) / shrinkCapacity : 1;
		shrinkFraction = Math.max(0, Math.min(1, shrinkFraction));
		measurePadding -=
			(options.measurePadding - options.minimumMeasurePadding) * shrinkFraction;
		eventGap -=
			(options.eventGap - options.minimumEventGap) * shrinkFraction;
	}

	line.index = lineIndex;
	line.y = lineTop;
	line.height = options.lineHeight;
	line.measureNumber = {
		text: String(line.measures[0].index + 1),
		x: Math.max(4, options.paddingLeft - 16),
		y: lineTop + 27,
	};
	line.measurePadding = measurePadding;
	line.eventGap = eventGap;
	line.width = fixedWidth +
		line.measures.length * measurePadding * 2 +
		line.measures.reduce(function(sum, measure) {
			return sum + Math.max(0, measure.events.length - 1) * eventGap;
		}, 0);
	// Centre every measure's note group between its left and right boundaries.
	// Splitting the remaining line width equally across both sides of every
	// measure avoids leaving a large one-sided gap after a bar line.
	line.justifyMeasurePadding = line.measures.length ?
		Math.max(0, contentWidth - line.width) / (line.measures.length * 2) : 0;
	measurePadding += line.justifyMeasurePadding;
	line.measurePadding = measurePadding;
	line.width += line.justifyMeasurePadding * line.measures.length * 2;

	line.measures.forEach(function(measure) {
		measure.x = cursorX;
		measure.y = lineTop;
		measure.width = measure.fixedWidth +
			measurePadding * 2 +
			Math.max(0, measure.events.length - 1) * eventGap;

		var eventX = cursorX + measurePadding +
			(measure.endingBar ? options.barGap / 2 : 0);
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
				var eventUnderlines = event.source.durationMarks.underlines;
				var lowDotBaseY = noteY + options.numberBottomOffset;
				if (note.octaveDots < 0 && eventUnderlines > 0) {
					lowDotBaseY =
						noteY +
						options.numberBottomOffset +
						options.underlineGap +
						(eventUnderlines - 1) * options.underlineSpacing +
						options.octaveDotGap;
				}
				for (var dotIndex = 0; dotIndex < octaveDotCount; dotIndex++) {
					octaveDotPositions.push({
						cx: noteX,
						cy: note.octaveDots > 0 ?
							noteY - options.numberTopOffset - dotIndex * options.octaveDotGap :
							lowDotBaseY + dotIndex * options.octaveDotGap,
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
					tieStart: note.tieStart === true,
					tieEnd: note.tieEnd === true,
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
			event.annotations = {
				chords: (event.source.chordSymbols || []).map(function(chord, index) {
					return {
						text: chord,
						x: eventX + event.noteColumnWidth / 2,
						y: lineTop + 27 - index * (options.chordFontSize + 2),
					};
				}),
				dynamics: [],
				fingerings: (event.source.fingerings || []).map(
					function(fingering, index) {
						return {
							text: fingering,
							cx: eventX + event.noteColumnWidth / 2,
							cy: lineTop + 9 - index * (options.fingeringRadius * 2 + 3),
							r: options.fingeringRadius,
						};
					}
				),
			};
			var lowestNote = event.notePositions[0];
			var underlineStartY =
				lowestNote.y +
				options.numberBottomOffset +
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
			if (event.durationMarks.extensionDashes)
				rightCursor += options.extensionLeadGap;
			for (var dashIndex = 0;
				dashIndex < event.durationMarks.extensionDashes;
				dashIndex++) {
				var dashStart =
					rightCursor +
					dashIndex * options.rhythmCellWidth +
					(options.rhythmCellWidth - options.extensionDashWidth) / 2;
				event.durationLayout.extensionDashes.push({
					x1: dashStart,
					x2: dashStart + options.extensionDashWidth,
					y1: lowestNote.y - options.numberBottomOffset,
					y2: lowestNote.y - options.numberBottomOffset,
					strokeWidth: 1.5,
				});
			}

			rightCursor +=
				event.durationMarks.extensionDashes * options.rhythmCellWidth;
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
			(event.source.dynamics || []).forEach(function(dynamic, index) {
				var lowestVisualY = underlineStartY +
					Math.max(0, event.durationMarks.underlines - 1) *
						options.underlineSpacing;
				event.notePositions.forEach(function(note) {
					note.octaveDotPositions.forEach(function(dot) {
						lowestVisualY = Math.max(lowestVisualY, dot.cy + dot.r);
					});
				});
				event.annotations.dynamics.push({
					text: dynamic,
					x: eventX + event.noteColumnWidth / 2,
					y: lowestVisualY + 14 + index * (options.dynamicFontSize + 2),
				});
			});

			delete event.source;
			eventX += event.width + eventGap;
		});
		mergeBeamUnderlines(measure, options);

		if (measure.endingBar) {
			var barX = cursorX + measure.width - measure.endingBar.width;
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

function tieSignature(note) {
	return note.number + ":" + note.octaveDots;
}

function tiePath(startX, endX, y, arcHeight) {
	var middleX = (startX + endX) / 2;
	return "M " + startX + " " + y +
		" C " + middleX + " " + (y - arcHeight) +
		", " + middleX + " " + (y - arcHeight) +
		", " + endX + " " + y;
}

function tieAnchorY(note, options) {
	var anchorY = note.y - options.numberTopOffset;
	note.octaveDotPositions.forEach(function(dot) {
		if (dot.cy < note.y)
			anchorY = Math.min(anchorY, dot.cy - dot.r - 3);
	});
	return anchorY;
}

function layoutTies(lines, options, warnings) {
	var pending = new Map();
	lines.forEach(function(line) {
		line.tiePaths = [];
		line.measures.forEach(function(measure) {
			measure.events.forEach(function(event) {
				event.notePositions.forEach(function(note) {
					var signature = tieSignature(note);
					if (note.tieEnd) {
						var start = pending.get(signature);
						if (!start) {
							warnings.push("Tie end for " + signature +
								" has no matching start.");
						} else if (start.line === line) {
							var sameLineY = Math.min(
								tieAnchorY(start.note, options),
								tieAnchorY(note, options)
							);
							line.tiePaths.push({
								d: tiePath(start.note.x + 6, note.x - 6,
									sameLineY, options.tieArcHeight),
							});
							pending.delete(signature);
						} else {
							var startLineEnd = start.line.measures[
								start.line.measures.length - 1
							];
							var outgoingEndX = startLineEnd.x + startLineEnd.width - 5;
							start.line.tiePaths.push({
								d: tiePath(start.note.x + 6, outgoingEndX,
									tieAnchorY(start.note, options),
									options.tieArcHeight),
							});
							line.tiePaths.push({
								d: tiePath(options.paddingLeft + 5, note.x - 6,
									tieAnchorY(note, options),
									options.tieArcHeight),
							});
							pending.delete(signature);
						}
					}
					if (note.tieStart)
						pending.set(signature, { note: note, line: line });
				});
			});
		});
	});
	pending.forEach(function(value, signature) {
		warnings.push("Tie start for " + signature + " has no matching end.");
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
		positionLine(line, index, contentWidth, options);
	});
	layoutTies(lines, options, warnings);
	var infoX = options.paddingLeft;
	var infoY = options.paddingTop + options.headerHeight - 12;
	var keyLabel = options.keyLabel || "";
	var meterLabel = options.meterLabel || "";
	var meterParts = /^(\d+)\s*\/\s*(\d+)$/.exec(meterLabel);
	var keyWidth = keyLabel ?
		measureText(keyLabel, { fontSize: options.headerFontSize }) : 0;
	var meterFontSize = options.headerFontSize * 0.78;
	var meterWidth = meterParts ? Math.max(
		measureText(meterParts[1], { fontSize: meterFontSize }),
		measureText(meterParts[2], { fontSize: meterFontSize })
	) : measureText(meterLabel, { fontSize: options.headerFontSize });
	var meterCenterX = infoX + keyWidth + (keyLabel ? 10 : 0) + meterWidth / 2;
	var meterTextX = infoX + keyWidth + (keyLabel ? 10 : 0);
	var tempoX = meterTextX + (meterLabel ? meterWidth + 12 : 0);

	return {
		width: options.staffWidth,
		height:
			options.paddingTop +
			options.headerHeight +
			lines.length * options.lineHeight +
			options.paddingBottom,
		header: {
			title: options.title || "",
			keyLabel: keyLabel,
			meterLabel: meterLabel,
			composer: options.composer || "",
			tempoLabel: options.tempoLabel || "",
			titlePosition: {
				x: options.staffWidth / 2,
				y: options.paddingTop + options.titleFontSize,
			},
			infoPosition: {
				x: infoX,
				y: infoY,
			},
			keyPosition: {
				x: infoX,
				y: infoY,
			},
			meterPosition: meterParts ? {
				numerator: meterParts[1],
				denominator: meterParts[2],
				x: meterCenterX,
				numeratorY: infoY - 10,
				denominatorY: infoY + 7,
				fractionLine: {
					x1: meterCenterX - meterWidth / 2 - 1,
					x2: meterCenterX + meterWidth / 2 + 1,
					y1: infoY - 5,
					y2: infoY - 5,
					strokeWidth: 1,
				},
			} : null,
			meterTextPosition: {
				x: meterTextX,
				y: infoY,
			},
			tempoPosition: {
				x: tempoX,
				y: infoY,
			},
			showTempo: options.showTempo === true,
			composerPosition: {
				x: options.staffWidth - options.paddingRight,
				y: options.paddingTop + options.titleFontSize + 24,
			},
		},
		style: {
			numberFontSize: options.numberFontSize,
			headerFontSize: options.headerFontSize,
			meterFontSize: meterFontSize,
			titleFontSize: options.titleFontSize,
			composerFontSize: options.composerFontSize,
			measureNumberFontSize: options.measureNumberFontSize,
			fingeringFontSize: options.fingeringFontSize,
			chordFontSize: options.chordFontSize,
			dynamicFontSize: options.dynamicFontSize,
		},
		lines: lines,
		warnings: warnings,
	};
}

layoutJianpu.defaultMeasureText = defaultMeasureText;
layoutJianpu.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

module.exports = layoutJianpu;
