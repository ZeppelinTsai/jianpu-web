"use strict";

var DEFAULT_OPTIONS = {
  staffWidth: 800,
  measuresPerLine: undefined,
  paddingLeft: 32,
  paddingRight: 24,
  paddingTop: 16,
  paddingBottom: 16,
  headerHeight: 68,
  // A short note (2-3 underlines) with a low octave dot and a lyric
  // syllable can put the lyric's visual bottom right around 107-115 units
  // below lineTop (verified empirically) — 130 keeps a safe margin above
  // the next line's chord-symbol row in that worst case without being
  // wasteful for ordinary content.
  lineHeight: 130,
  noteBaselineOffset: 63,
  linesPerPage: 10,
  pageFooterHeight: 24,
  pageNumberFontSize: 13,
  measurePadding: 10,
  eventGap: 10,
  minimumMeasurePadding: 2,
  minimumEventGap: 5,
  maximumFlexibleScale: 2.5,
  numberFontSize: 22,
  headerFontSize: 16,
  showTempo: false,
  titleFontSize: 35,
  composerFontSize: 14,
  measureNumberFontSize: 20,
  fingeringFontSize: 14,
  fingeringRadius: 8,
  fingeringGap: 5,
  chordFontSize: 18,
  dynamicFontSize: 13,
  lyricFontSize: 15,
  lyricGap: 8,
  chordNoteGap: 22,
  numberWidth: 14,
  accidentalWidth: 14,
  accidentalGap: 2,
  accidentalRaise: 8,
  octaveDotRadius: 2,
  octaveDotGap: 5,
  tieArcHeight: 10,
  numberTopOffset: 21,
  numberBottomOffset: 5,
  underlineGap: 0,
  underlineSpacing: 4,
  durationDotWidth: 7,
  durationDotRadius: 1.8,
  extensionDashWidth: 16,
  barGap: 14,
  doubleBarGap: 4,
  barTopExtra: 3,
  barBottomExtra: 8,
  thinBarWidth: 1,
  thickBarWidth: 4,
  tonicMidi: 60,
  repeatDotRadius: 2,
  repeatDotGap: 5,
  repeatDotSpacing: 7,
  voltaGap: 6,
  voltaTickHeight: 8,
  voltaFontSize: 13,
  tupletGap: 6,
  tupletTickHeight: 4,
  tupletFontSize: 13,
  graceNoteWidth: 12,
  graceNoteGap: 4,
  graceNoteFontSize: 13,
  graceNoteRaise: 4,
  slurExtraRaise: 6,
  slurExtraArc: 6,
  staccatoDotRadius: 1.6,
  staccatoGap: 5,
};

// Jianpu scale degrees (1-7) are treated as a major scale relative to the
// tune's tonic; this is an approximation that ignores mode/key-signature
// nuance but is good enough to derive a clickable pitch per note.
var SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

var ACCIDENTAL_SEMITONES = {
  sharp: 1,
  flat: -1,
  natural: 0,
  dblsharp: 2,
  dblflat: -2,
};

function noteMidiNumber(note, options) {
  if (!note.number) return null;
  var semitone = SCALE_SEMITONES[note.number - 1];
  var accidental = ACCIDENTAL_SEMITONES[note.accidentalMark] || 0;
  return options.tonicMidi + semitone + accidental + note.octaveDots * 12;
}

function eventDurationBeats(marks) {
  var dotMultiplier = marks.dots === 1 ? 1.5 : marks.dots === 2 ? 1.75 : 1;
  if (marks.underlines > 0)
    return dotMultiplier / Math.pow(2, marks.underlines);
  return (marks.extensionDashes + 1) * dotMultiplier;
}

var SUPPORTED_BARS = {
  bar_thin: true,
  bar_thin_thin: true,
  bar_thin_thick: true,
  bar_thick_thin: true,
  bar_left_repeat: true,
  bar_right_repeat: true,
  bar_dbl_repeat: true,
};

function mergeOptions(options) {
  return Object.assign({}, DEFAULT_OPTIONS, options || {});
}

function defaultMeasureText(text, style) {
  var fontSize =
    style && style.fontSize ? style.fontSize : DEFAULT_OPTIONS.numberFontSize;
  return String(text).length * fontSize * 0.6;
}

function accidentalText(accidentalMark) {
  switch (accidentalMark) {
    case "sharp":
      return "♯";
    case "flat":
      return "♭";
    case "natural":
      return "♮";
    case "dblsharp":
      return "𝄪";
    case "dblflat":
      return "𝄫";
    default:
      return "";
  }
}

function barWidth(barType, options) {
  switch (barType) {
    case "bar_thin_thin":
      return (
        options.thinBarWidth + options.thickBarWidth + options.doubleBarGap
      );
    case "bar_thin_thick":
    case "bar_thick_thin":
      return (
        options.thinBarWidth + options.thickBarWidth + options.doubleBarGap
      );
    // Standard repeat-bar geometry (matches staff notation convention): a
    // thin+thick bar pair plus two dots on the side facing the repeated
    // section. bar_left_repeat ("|:") opens toward the right (dots after
    // the bars); bar_right_repeat (":|") opens toward the left (dots
    // before the bars); bar_dbl_repeat ("::", simultaneously closing one
    // repeated section and opening the next) has dots on both sides.
    case "bar_left_repeat":
    case "bar_right_repeat":
      return (
        options.doubleBarGap +
        options.repeatDotGap +
        options.repeatDotRadius * 2
      );
    case "bar_dbl_repeat":
      return (
        options.repeatDotRadius * 4 +
        options.repeatDotGap * 2 +
        options.doubleBarGap * 2
      );
    default:
      return options.thinBarWidth;
  }
}

// Builds the line/dot geometry for a repeat-type bar (see barWidth above for
// the same left-to-right ordering, kept in sync with this function so the
// reserved width always matches what actually gets drawn).
function repeatBarGeometry(type, barX, y1, y2, options) {
  var lines = [];
  var dots = [];

  function addLine(x, strokeWidth) {
    lines.push({ x1: x, x2: x, y1: y1, y2: y2, strokeWidth: strokeWidth });
  }

  function addDots(cx) {
    var midY = (y1 + y2) / 2;
    dots.push(
      {
        cx: cx,
        cy: midY - options.repeatDotSpacing / 2,
        r: options.repeatDotRadius,
      },
      {
        cx: cx,
        cy: midY + options.repeatDotSpacing / 2,
        r: options.repeatDotRadius,
      },
    );
  }

  if (type === "bar_left_repeat") {
    var leftThinX = barX + options.doubleBarGap;
    addLine(barX, options.thickBarWidth);
    addLine(leftThinX, options.thinBarWidth);
    addDots(leftThinX + options.repeatDotGap + options.repeatDotRadius);
  } else if (type === "bar_right_repeat") {
    var dotCx = barX + options.repeatDotRadius;
    var thinX = dotCx + options.repeatDotRadius + options.repeatDotGap;
    addDots(dotCx);
    addLine(thinX, options.thinBarWidth);
    addLine(thinX + options.doubleBarGap, options.thickBarWidth);
  } else if (type === "bar_dbl_repeat") {
    var leftDotCx = barX + options.repeatDotRadius;
    var leftThin = leftDotCx + options.repeatDotRadius + options.repeatDotGap;
    var thick = leftThin + options.doubleBarGap;
    var rightThin = thick + options.doubleBarGap;
    var rightDotCx = rightThin + options.repeatDotGap + options.repeatDotRadius;
    addDots(leftDotCx);
    addLine(leftThin, options.thinBarWidth);
    addLine(thick, options.thickBarWidth);
    addLine(rightThin, options.thinBarWidth);
    addDots(rightDotCx);
  }

  return { lines: lines, dots: dots };
}

function measureEvent(event, options, measureText) {
  var widestNote = options.numberWidth;
  event.notes.forEach(function (note) {
    var width = measureText(String(note.number), {
      fontSize: options.numberFontSize,
    });
    var accidental = accidentalText(note.accidentalMark);
    if (accidental)
      width +=
        Math.max(
          options.accidentalWidth,
          measureText(accidental, { fontSize: options.numberFontSize * 0.7 }),
        ) + options.accidentalGap;
    widestNote = Math.max(widestNote, width);
  });

  var marks = event.durationMarks;
  var rightWidth =
    marks.extensionDashes * options.extensionDashWidth +
    marks.dots * options.durationDotWidth;
  var chordWidth = 0;
  (event.chordSymbols || []).forEach(function (chord) {
    chordWidth = Math.max(
      chordWidth,
      measureText(chord, { fontSize: options.chordFontSize }),
    );
  });
  var graceWidth = (event.graceNotes || []).length
    ? event.graceNotes.length * options.graceNoteWidth + options.graceNoteGap
    : 0;

  return {
    source: event,
    naturalWidth: Math.max(widestNote + rightWidth, chordWidth) + graceWidth,
    noteColumnWidth: widestNote,
    rightWidth: rightWidth,
    internalGapCount: marks.extensionDashes,
    graceWidth: graceWidth,
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

  elements.forEach(function (element) {
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
        warnings.push(
          "Unsupported bar type " + requestedType + "; rendered as bar_thin.",
        );
      }
      var previousMeasure = measures.length
        ? measures[measures.length - 1]
        : null;
      if (
        renderedType === "bar_thin" &&
        !current.events.length &&
        previousMeasure &&
        previousMeasure.endingBar
      ) {
        // A plain bar immediately following another bar, with no notes
        // between them (e.g. a repeat-close ":|" ending one source line
        // and a volta-open "|1" starting the next), carries no visual
        // meaning of its own beyond the startEnding/endEnding it's
        // marked with — the volta bracket already shows where the ending
        // begins. Left as its own (empty) measure, it renders as a bare
        // "|" floating at the start of the next line with nothing played
        // before it, unlike every other line which starts directly on a
        // note. Fold its startEnding/endEnding onto the previous bar
        // instead of creating an empty measure to hold it.
        if (element.startEnding)
          previousMeasure.endingBar.startEnding = element.startEnding;
        if (element.endEnding === true)
          previousMeasure.endingBar.endEnding = true;
      } else {
        current.endingBar = {
          sourceType: requestedType,
          type: renderedType,
          width: barWidth(renderedType, options),
          startEnding: element.startEnding || null,
          endEnding: element.endEnding === true,
        };
        measures.push(current);
        current = createMeasure(measures.length);
      }
    } else if (element && Array.isArray(element.notes)) {
      current.events.push(measureEvent(element, options, measureText));
    }
  });

  if (current.events.length || current.endingBar) measures.push(current);

  measures.forEach(function (measure) {
    var eventsWidth = measure.events.reduce(function (sum, event) {
      return sum + event.naturalWidth;
    }, 0);
    measure.flexGapCount =
      Math.max(0, measure.events.length - 1) +
      measure.events.reduce(function (sum, event) {
        return sum + event.internalGapCount;
      }, 0);
    var gapsWidth = measure.flexGapCount * options.eventGap;
    var endingBarWidth = measure.endingBar
      ? measure.endingBar.width + options.barGap
      : 0;
    measure.fixedWidth = eventsWidth + endingBarWidth;
    measure.naturalWidth =
      measure.fixedWidth + options.measurePadding * 2 + gapsWidth;
    measure.minimumWidth =
      measure.fixedWidth +
      options.minimumMeasurePadding * 2 +
      measure.flexGapCount * options.minimumEventGap;
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

  measures.forEach(function (measure) {
    var fixedCountReached =
      options.measuresPerLine && current.length >= options.measuresPerLine;
    var widthReached =
      !options.measuresPerLine &&
      current.length > 0 &&
      currentMinimumWidth + measure.minimumWidth > contentWidth;

    if (fixedCountReached || widthReached) finishLine();

    if (measure.minimumWidth > contentWidth) {
      warnings.push(
        "Measure " +
          (measure.index + 1) +
          " is wider than the available content width and was kept intact.",
      );
    }

    current.push(measure);
    currentWidth += measure.naturalWidth;
    currentMinimumWidth += measure.minimumWidth;
    if (measure.forceLineBreakAfter) finishLine();
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

    var maximumLevel = activeGroup.reduce(function (maximum, event) {
      return Math.max(maximum, event.durationMarks.underlines);
    }, 0);

    for (var level = 1; level <= maximumLevel; level++) {
      var run = [];

      function finishRun() {
        if (!run.length) return;
        var y = run.reduce(function (maximum, event) {
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

      activeGroup.forEach(function (event) {
        if (event.durationMarks.underlines >= level) run.push(event);
        else finishRun();
      });
      finishRun();
    }

    activeGroup.forEach(function (event) {
      event.durationLayout.underlines = [];
    });
    activeGroup = [];
  }

  measure.events.forEach(function (event) {
    if (event.beam.start) {
      finishGroup();
      activeGroup = [event];
    } else if (activeGroup.length) {
      activeGroup.push(event);
    }

    if (activeGroup.length && event.beam.end) finishGroup();
  });
  finishGroup();
}

function tupletTopY(event, options) {
  return event.notePositions.reduce(function (top, note) {
    return Math.min(top, tieAnchorY(note, options));
  }, Infinity);
}

// Groups consecutive events sharing a tuplet id (see event.tuplet, set from
// create-jianpu-converter's startTriplet/endTriplet tracking) and lays out a
// bracket + ratio number spanning the group, mirroring mergeBeamUnderlines'
// approach to beam grouping. A tuplet whose start/end don't both land inside
// this measure (e.g. it spans a bar line) is intentionally left unbracketed
// here — create-jianpu-converter's resetBar() already pushes a warning for
// that case — rather than drawing a bracket that doesn't actually match the
// source.
function mergeTupletBrackets(measure, options, warnings) {
  measure.tupletBrackets = [];
  var activeGroup = [];

  function finishGroup() {
    if (!activeGroup.length) return;
    var last = activeGroup[activeGroup.length - 1];
    if (!last.tuplet.isEnd) {
      warnings.push(
        "Tuplet " + activeGroup[0].tuplet.ratio + " in measure " +
          (measure.index + 1) +
          " has no matching end within the measure; bracket was not drawn."
      );
    } else if (activeGroup.length >= 2) {
      var first = activeGroup[0];
      var y =
        activeGroup.reduce(function (top, event) {
          return Math.min(top, tupletTopY(event, options));
        }, Infinity) - options.tupletGap;
      var x1 = first.x;
      var x2 = last.x + last.noteColumnWidth;
      measure.tupletBrackets.push({
        x1: x1,
        x2: x2,
        y: y,
        tickHeight: options.tupletTickHeight,
        label: String(first.tuplet.ratio),
        labelX: (x1 + x2) / 2,
        labelY: y - 3,
      });
    }
    activeGroup = [];
  }

  measure.events.forEach(function (event) {
    if (!event.tuplet) {
      finishGroup();
      return;
    }
    if (event.tuplet.isStart) {
      finishGroup();
      activeGroup = [event];
    } else if (activeGroup.length) {
      activeGroup.push(event);
    }
    if (activeGroup.length && event.tuplet.isEnd) finishGroup();
  });
  finishGroup();
}

function positionLine(line, lineIndex, contentWidth, options, warnings) {
  var pageIndex = Math.floor(lineIndex / options.linesPerPage);
  var lineTop =
    options.paddingTop +
    options.headerHeight +
    lineIndex * options.lineHeight +
    pageIndex * options.pageFooterHeight;
  var baselineY = lineTop + options.noteBaselineOffset;
  var cursorX = options.paddingLeft;
  var fixedWidth = line.measures.reduce(function (sum, measure) {
    return sum + measure.fixedWidth;
  }, 0);
  var naturalFlexibleWidth = line.naturalWidth - fixedWidth;
  var minimumFlexibleWidth = line.minimumWidth - fixedWidth;
  var availableFlexibleWidth = Math.max(
    minimumFlexibleWidth,
    contentWidth - fixedWidth,
  );
  var measurePadding = options.measurePadding;
  var eventGap = options.eventGap;

  if (availableFlexibleWidth >= naturalFlexibleWidth) {
    var growScale = Math.min(
      options.maximumFlexibleScale,
      availableFlexibleWidth / naturalFlexibleWidth,
    );
    measurePadding *= growScale;
    eventGap *= growScale;
  } else {
    var shrinkCapacity = naturalFlexibleWidth - minimumFlexibleWidth;
    var shrinkFraction =
      shrinkCapacity > 0
        ? (naturalFlexibleWidth - availableFlexibleWidth) / shrinkCapacity
        : 1;
    shrinkFraction = Math.max(0, Math.min(1, shrinkFraction));
    measurePadding -=
      (options.measurePadding - options.minimumMeasurePadding) * shrinkFraction;
    eventGap -= (options.eventGap - options.minimumEventGap) * shrinkFraction;
  }

  line.index = lineIndex;
  line.y = lineTop;
  line.height = options.lineHeight;
  line.measureNumber = {
    text: String(line.measures[0].index + 1),
    x: Math.max(8, options.paddingLeft - 20),
    y: lineTop + 9,
    textAnchor: "end",
  };
  line.eventGap = eventGap;
  var innerLineWidth =
    fixedWidth +
    line.measures.reduce(function (sum, measure) {
      return sum + measure.flexGapCount * eventGap;
    }, 0);
  // Give every measure an equal share of the remaining width while keeping
  // the first musical event at one stable x position on every line.
  var paddingPerMeasure = line.measures.length
    ? Math.max(0, contentWidth - innerLineWidth) / line.measures.length
    : 0;
  var firstLeftPadding = Math.min(
    options.measurePadding,
    paddingPerMeasure / 2,
  );
  line.measurePadding = firstLeftPadding;
  line.firstMeasurePadding = firstLeftPadding;
  line.firstMeasureContentPadding = options.measurePadding;
  line.paddingPerMeasure = paddingPerMeasure;
  line.width = innerLineWidth + paddingPerMeasure * line.measures.length;

  line.measures.forEach(function (measure, measureIndex) {
    var leftPadding =
      measureIndex === 0 ? firstLeftPadding : paddingPerMeasure / 2;
    var rightPadding =
      measureIndex === 0
        ? paddingPerMeasure - firstLeftPadding
        : paddingPerMeasure / 2;
    measure.x = cursorX;
    measure.y = lineTop;
    measure.leftPadding = leftPadding;
    measure.rightPadding = rightPadding;
    measure.width =
      measure.fixedWidth +
      leftPadding +
      rightPadding +
      measure.flexGapCount * eventGap;

    var contentLeftPadding =
      measureIndex === 0 ? options.measurePadding : leftPadding;
    measure.contentLeftPadding = contentLeftPadding;
    var eventX =
      cursorX +
      contentLeftPadding +
      (measure.endingBar ? options.barGap / 2 : 0);
    measure.events.forEach(function (event) {
      var noteStartX = eventX + (event.graceWidth || 0);
      event.x = noteStartX;
      event.graceStartX = eventX;
      event.y = baselineY;
      event.width = event.naturalWidth + event.internalGapCount * eventGap;
      event.notePositions = [];

      var notes = event.source.notes;
      notes.forEach(function (note, noteIndex) {
        var noteX = noteStartX + event.noteColumnWidth / 2;
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
            cy:
              note.octaveDots > 0
                ? noteY -
                  options.numberTopOffset -
                  dotIndex * options.octaveDotGap
                : lowDotBaseY + dotIndex * options.octaveDotGap,
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
          midi: noteMidiNumber(note, options),
          tieStart: note.tieStart === true,
          tieEnd: note.tieEnd === true,
          slurStart: note.slurStart || null,
          slurEnd: note.slurEnd || null,
          accidentalText: accidental,
          accidentalPosition: accidental
            ? {
                x: noteX - options.numberWidth / 2 - options.accidentalGap,
                y: noteY - options.accidentalRaise,
              }
            : null,
          octaveDotPositions: octaveDotPositions,
        });
      });

      event.durationMarks = Object.assign({}, event.source.durationMarks);
      event.durationBeats =
        eventDurationBeats(event.durationMarks) *
        (event.source.durationScale || 1);
      event.beam = Object.assign(
        { start: false, end: false },
        event.source.beam,
      );
      event.tuplet = event.source.tuplet || null;
      event.instrument = event.source.instrument || "piano";
      event.lyric =
        event.source.lyric !== undefined ? event.source.lyric : null;
      var highDotTop =
        baselineY - options.numberTopOffset - options.octaveDotRadius;
      event.notePositions.forEach(function (note) {
        note.octaveDotPositions.forEach(function (dot) {
          if (dot.cy < note.y)
            highDotTop = Math.min(highDotTop, dot.cy - dot.r);
        });
      });
      var hasStaccato = event.source.staccato === true;
      var staccatoY = highDotTop - options.staccatoGap;
      var fingeringCeiling = hasStaccato
        ? staccatoY - options.staccatoGap
        : highDotTop;
      var firstFingeringCy =
        fingeringCeiling - options.fingeringGap - options.fingeringRadius;
      var fingeringTop = firstFingeringCy - options.fingeringRadius;
      var chordBaseY = Math.min(lineTop + 15, fingeringTop - 4);
      event.annotations = {
        chords: (event.source.chordSymbols || []).map(function (chord, index) {
          return {
            text: chord,
            x: noteStartX + event.noteColumnWidth / 2,
            y: chordBaseY - index * (options.chordFontSize + 2),
          };
        }),
        dynamics: [],
        fingerings: (event.source.fingerings || []).map(
          function (fingering, index) {
            return {
              text: fingering,
              cx: noteStartX + event.noteColumnWidth / 2,
              cy: firstFingeringCy - index * (options.fingeringRadius * 2 + 3),
              r: options.fingeringRadius,
            };
          },
        ),
        // Grace notes are a best-effort visual: small numbers packed
        // left-to-right immediately before the main note, without their own
        // duration marks or precise beat-accurate spacing (see the warning
        // create-jianpu-converter pushes when note.gracenotes is present).
        graceNotes: (event.source.graceNotes || []).map(function (grace, index) {
          var gx = event.graceStartX + options.graceNoteWidth * (index + 0.5);
          var accidental = accidentalText(grace.accidentalMark);
          return {
            x: gx,
            y: baselineY - options.graceNoteRaise,
            number: grace.number,
            accidentalText: accidental,
            accidentalPosition: accidental
              ? {
                  x: gx - options.graceNoteWidth / 2,
                  y: baselineY - options.graceNoteRaise - options.accidentalRaise * 0.6,
                }
              : null,
          };
        }),
        staccato: hasStaccato
          ? {
              cx: noteStartX + event.noteColumnWidth / 2,
              cy: staccatoY,
              r: options.staccatoDotRadius,
            }
          : null,
      };
      var lowestNote = event.notePositions[0];
      var underlineStartY =
        lowestNote.y + options.numberBottomOffset + options.underlineGap;
      event.durationLayout = {
        underlines: [],
        extensionDashes: [],
        dots: [],
      };

      for (
        var underlineIndex = 0;
        underlineIndex < event.durationMarks.underlines;
        underlineIndex++
      ) {
        var underlineY =
          underlineStartY + underlineIndex * options.underlineSpacing;
        event.durationLayout.underlines.push({
          x1: noteStartX,
          x2: noteStartX + event.noteColumnWidth,
          y1: underlineY,
          y2: underlineY,
          strokeWidth: 1.4,
        });
      }

      var rightCursor = noteStartX + event.noteColumnWidth;
      for (
        var dashIndex = 0;
        dashIndex < event.durationMarks.extensionDashes;
        dashIndex++
      ) {
        var dashStart =
          rightCursor +
          (dashIndex + 1) * eventGap +
          dashIndex * options.extensionDashWidth;
        event.durationLayout.extensionDashes.push({
          x1: dashStart,
          x2: dashStart + options.extensionDashWidth,
          y1: lowestNote.y - options.numberBottomOffset,
          y2: lowestNote.y - options.numberBottomOffset,
          strokeWidth: 1.5,
        });
      }

      rightCursor +=
        event.durationMarks.extensionDashes *
        (options.extensionDashWidth + eventGap);
      for (
        var durationDotIndex = 0;
        durationDotIndex < event.durationMarks.dots;
        durationDotIndex++
      ) {
        event.durationLayout.dots.push({
          cx:
            rightCursor +
            options.durationDotWidth / 2 +
            durationDotIndex * options.durationDotWidth,
          cy: lowestNote.y - options.numberBottomOffset,
          r: options.durationDotRadius,
        });
      }
      (event.source.dynamics || []).forEach(function (dynamic, index) {
        var lowestVisualY =
          underlineStartY +
          Math.max(0, event.durationMarks.underlines - 1) *
            options.underlineSpacing;
        event.notePositions.forEach(function (note) {
          note.octaveDotPositions.forEach(function (dot) {
            lowestVisualY = Math.max(lowestVisualY, dot.cy + dot.r);
          });
        });
        event.annotations.dynamics.push({
          text: dynamic,
          x: noteStartX + event.noteColumnWidth / 2,
          y: lowestVisualY + 14 + index * (options.dynamicFontSize + 2),
        });
      });

      // Lyric text renders in its own row underneath everything else
      // stacked below the note: underlines, low-octave dots, and any
      // dynamic marking. Only compute/emit a position when there is an
      // actual lyric slot (event.lyric !== null); a "" value (tie/skip
      // continuation) still gets a position so render-jianpu-svg can draw
      // an extender mark there instead of a word.
      event.annotations.lyric = null;
      if (event.lyric !== null) {
        var lyricBaseY =
          underlineStartY +
          Math.max(0, event.durationMarks.underlines - 1) *
            options.underlineSpacing;
        event.notePositions.forEach(function (note) {
          note.octaveDotPositions.forEach(function (dot) {
            lyricBaseY = Math.max(lyricBaseY, dot.cy + dot.r);
          });
        });
        if (event.annotations.dynamics.length) {
          var lastDynamic =
            event.annotations.dynamics[event.annotations.dynamics.length - 1];
          lyricBaseY = Math.max(
            lyricBaseY,
            lastDynamic.y + options.dynamicFontSize / 2,
          );
        }
        event.annotations.lyric = {
          text: event.lyric,
          x: noteStartX + event.noteColumnWidth / 2,
          y: lyricBaseY + options.lyricGap + options.lyricFontSize,
        };
      }

      delete event.source;
      eventX += event.width + eventGap;
    });
    mergeBeamUnderlines(measure, options);
    mergeTupletBrackets(measure, options, warnings);

    if (measure.endingBar) {
      var isLineStartRepeatBar =
        measureIndex === 0 &&
        !measure.events.length &&
        (measure.endingBar.type === "bar_left_repeat" ||
          measure.endingBar.type === "bar_right_repeat" ||
          measure.endingBar.type === "bar_dbl_repeat");
      var barX = isLineStartRepeatBar
        ? cursorX
        : cursorX + measure.width - measure.endingBar.width;
      measure.endingBar.x = barX;
      measure.endingBar.y1 =
        baselineY - options.numberFontSize - options.barTopExtra;
      measure.endingBar.y2 = baselineY + options.barBottomExtra;
      measure.endingBar.lines = [];
      if (measure.endingBar.type === "bar_thin_thin") {
        measure.endingBar.lines.push(
          {
            x1: barX,
            x2: barX,
            y1: measure.endingBar.y1,
            y2: measure.endingBar.y2,
            strokeWidth: options.thinBarWidth,
          },
          {
            x1: barX + options.doubleBarGap,
            x2: barX + options.doubleBarGap,
            y1: measure.endingBar.y1,
            y2: measure.endingBar.y2,
            strokeWidth: options.thickBarWidth,
          },
        );
      } else if (measure.endingBar.type === "bar_thin_thick") {
        measure.endingBar.lines.push(
          {
            x1: barX,
            x2: barX,
            y1: measure.endingBar.y1,
            y2: measure.endingBar.y2,
            strokeWidth: options.thinBarWidth,
          },
          {
            x1: barX + options.doubleBarGap,
            x2: barX + options.doubleBarGap,
            y1: measure.endingBar.y1,
            y2: measure.endingBar.y2,
            strokeWidth: options.thickBarWidth,
          },
        );
      } else if (measure.endingBar.type === "bar_thick_thin") {
        measure.endingBar.lines.push(
          {
            x1: barX,
            x2: barX,
            y1: measure.endingBar.y1,
            y2: measure.endingBar.y2,
            strokeWidth: options.thickBarWidth,
          },
          {
            x1: barX + options.doubleBarGap,
            x2: barX + options.doubleBarGap,
            y1: measure.endingBar.y1,
            y2: measure.endingBar.y2,
            strokeWidth: options.thinBarWidth,
          },
        );
      } else if (
        measure.endingBar.type === "bar_left_repeat" ||
        measure.endingBar.type === "bar_right_repeat" ||
        measure.endingBar.type === "bar_dbl_repeat"
      ) {
        var repeatGeometry = repeatBarGeometry(
          measure.endingBar.type,
          barX,
          measure.endingBar.y1,
          measure.endingBar.y2,
          options,
        );
        measure.endingBar.lines = repeatGeometry.lines;
        measure.endingBar.dots = repeatGeometry.dots;
      } else {
        measure.endingBar.lines.push({
          x1: barX,
          x2: barX,
          y1: measure.endingBar.y1,
          y2: measure.endingBar.y2,
          strokeWidth: options.thinBarWidth,
        });
      }
      measure.endingBar.dots = measure.endingBar.dots || [];
    }

    cursorX += measure.width;
  });
}

function tieSignature(note) {
  return note.number + ":" + note.octaveDots;
}

function tiePath(startX, endX, y, arcHeight) {
  var width = endX - startX;
  var firstControlX = startX + width / 3;
  var secondControlX = startX + (width * 2) / 3;
  return (
    "M " +
    startX +
    " " +
    y +
    " C " +
    firstControlX +
    " " +
    (y - arcHeight) +
    ", " +
    secondControlX +
    " " +
    (y - arcHeight) +
    ", " +
    endX +
    " " +
    y
  );
}

function tieAnchorY(note, options) {
  var anchorY = note.y - options.numberTopOffset;
  note.octaveDotPositions.forEach(function (dot) {
    if (dot.cy < note.y) anchorY = Math.min(anchorY, dot.cy - dot.r - 3);
  });
  return anchorY;
}

function layoutTies(lines, options, warnings) {
  var pending = new Map();
  lines.forEach(function (line) {
    line.tiePaths = [];
    line.measures.forEach(function (measure) {
      measure.events.forEach(function (event) {
        event.notePositions.forEach(function (note) {
          var signature = tieSignature(note);
          if (note.tieEnd) {
            var start = pending.get(signature);
            if (!start) {
              warnings.push(
                "Tie end for " + signature + " has no matching start.",
              );
            } else if (start.line === line) {
              var sameLineY = Math.min(
                tieAnchorY(start.note, options),
                tieAnchorY(note, options),
              );
              line.tiePaths.push({
                d: tiePath(
                  start.note.x + 6,
                  note.x - 6,
                  sameLineY,
                  options.tieArcHeight,
                ),
              });
              pending.delete(signature);
            } else {
              var startLineEnd =
                start.line.measures[start.line.measures.length - 1];
              var outgoingEndX = startLineEnd.x + startLineEnd.width - 5;
              start.line.tiePaths.push({
                d: tiePath(
                  start.note.x + 6,
                  outgoingEndX,
                  tieAnchorY(start.note, options),
                  options.tieArcHeight,
                ),
              });
              line.tiePaths.push({
                d: tiePath(
                  options.paddingLeft + 5,
                  note.x - 6,
                  tieAnchorY(note, options),
                  options.tieArcHeight,
                ),
              });
              pending.delete(signature);
            }
          }
          if (note.tieStart) pending.set(signature, { note: note, line: line });
        });
      });
    });
  });
  pending.forEach(function (value, signature) {
    warnings.push("Tie start for " + signature + " has no matching end.");
  });
}

// Slurs are phrasing marks spanning a group of notes across different
// pitches (as opposed to a tie, which only ever connects two notes of the
// *same* pitch). abcjs identifies each slur by a numeric label shared
// between its startSlur/endSlur entries (see create-jianpu-converter's
// convertPitch), so — unlike layoutTies' pitch-signature map — the pending
// map here is keyed by that label. Only the first and last note of a slur
// matter for drawing; any notes in between are irrelevant to the arc.
function slurAnchorY(note, options) {
  return tieAnchorY(note, options) - options.slurExtraRaise;
}

function layoutSlurs(lines, options, warnings) {
  var pending = new Map();
  lines.forEach(function (line) {
    line.slurPaths = [];
    line.measures.forEach(function (measure) {
      measure.events.forEach(function (event) {
        event.notePositions.forEach(function (note) {
          (note.slurEnd || []).forEach(function (label) {
            var start = pending.get(label);
            if (!start) {
              warnings.push(
                "Slur end (label " + label + ") has no matching start.",
              );
              return;
            }
            pending.delete(label);
            var arcHeight = options.tieArcHeight + options.slurExtraArc;
            if (start.line === line) {
              var sameLineY = Math.min(
                slurAnchorY(start.note, options),
                slurAnchorY(note, options),
              );
              line.slurPaths.push({
                d: tiePath(start.note.x + 6, note.x - 6, sameLineY, arcHeight),
              });
            } else {
              var startLineEnd =
                start.line.measures[start.line.measures.length - 1];
              var outgoingEndX = startLineEnd.x + startLineEnd.width - 5;
              start.line.slurPaths.push({
                d: tiePath(
                  start.note.x + 6,
                  outgoingEndX,
                  slurAnchorY(start.note, options),
                  arcHeight,
                ),
              });
              line.slurPaths.push({
                d: tiePath(
                  options.paddingLeft + 5,
                  note.x - 6,
                  slurAnchorY(note, options),
                  arcHeight,
                ),
              });
            }
          });
          (note.slurStart || []).forEach(function (label) {
            pending.set(label, { note: note, line: line });
          });
        });
      });
    });
  });
  pending.forEach(function (value, label) {
    warnings.push("Slur start (label " + label + ") has no matching end.");
  });
}

// Voltas ("first/second ending" brackets) are read off bar elements'
// startEnding/endEnding fields (see index.js's convertAbcTune and
// groupMeasures above). Per ABC semantics, a bar with startEnding marks
// where the *next* measure begins the ending (the bar itself still closes
// out the previous section), while endEnding marks the bar that closes the
// ending's own last measure — the same bar can carry both simultaneously
// (":|1 ... :|2" style writing) to immediately open the next ending.
function layoutVoltas(lines, options, warnings) {
  var allMeasures = [];
  lines.forEach(function (line) {
    line.voltaBrackets = [];
    line.measures.forEach(function (measure) {
      allMeasures.push({ measure: measure, line: line });
    });
  });

  var active = null;
  var pendingLabel = null;

  function closeActive(endEntry) {
    var endX = endEntry.measure.endingBar
      ? endEntry.measure.endingBar.x
      : endEntry.measure.x + endEntry.measure.width;
    if (active.line === endEntry.line) {
      active.line.voltaBrackets.push({
        label: active.label,
        x1: active.startMeasure.x,
        x2: endX,
        y: active.line.y + options.voltaGap,
        tickHeight: options.voltaTickHeight,
        labelX: active.startMeasure.x + 6,
        labelY: active.line.y + options.voltaGap - 3,
      });
    } else {
      warnings.push(
        "Volta \"" + active.label + "\" spans multiple lines; only the " +
          "starting line's portion was bracketed.",
      );
      var startLineLast =
        active.line.measures[active.line.measures.length - 1];
      var startLineEndX = startLineLast.endingBar
        ? startLineLast.endingBar.x
        : startLineLast.x + startLineLast.width;
      active.line.voltaBrackets.push({
        label: active.label,
        x1: active.startMeasure.x,
        x2: startLineEndX,
        y: active.line.y + options.voltaGap,
        tickHeight: options.voltaTickHeight,
        labelX: active.startMeasure.x + 6,
        labelY: active.line.y + options.voltaGap - 3,
      });
    }
    active = null;
  }

  allMeasures.forEach(function (entry) {
    if (pendingLabel !== null) {
      active = { label: pendingLabel, startMeasure: entry.measure, line: entry.line };
      pendingLabel = null;
    }
    var endingBar = entry.measure.endingBar;
    if (!endingBar) return;
    if (endingBar.endEnding) {
      if (!active) {
        warnings.push("Volta ending marker has no matching start.");
      } else {
        closeActive(entry);
      }
    }
    if (endingBar.startEnding) pendingLabel = endingBar.startEnding;
  });

  if (active)
    warnings.push("Volta \"" + active.label + "\" has no matching end.");
  if (pendingLabel !== null)
    warnings.push(
      "Volta \"" + pendingLabel + "\" marker has no following measure.",
    );
}

// Chord symbols are placed at a fixed offset from their line's top
// (chordBaseY, computed per-event in positionLine) before volta brackets
// even exist yet — layoutVoltas runs afterward, since a bracket's
// position depends on line.y, which positionLine only just assigned. A
// volta bracket's horizontal line sits close enough to its line's top
// (options.voltaGap) that a chord glyph anchored at the default offset
// visually overlaps it: text renders *above* the y-coordinate it's
// anchored at, and the default chord offset leaves less clearance than a
// chord's font-size worth of ascender needs. This nudges any chord that
// would collide down below the bracket instead.
function resolveVoltaChordOverlap(lines, options) {
  lines.forEach(function (line) {
    if (!line.voltaBrackets || !line.voltaBrackets.length) return;
    var minChordBaseY =
      line.voltaBrackets.reduce(function (maxY, bracket) {
        return Math.max(maxY, bracket.y + bracket.tickHeight);
      }, 0) + options.chordFontSize;
    line.measures.forEach(function (measure) {
      measure.events.forEach(function (event) {
        var chords = event.annotations && event.annotations.chords;
        if (!chords || !chords.length) return;
        var delta = minChordBaseY - chords[0].y;
        if (delta <= 0) return;
        chords.forEach(function (chord) {
          chord.y += delta;
        });
      });
    });
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
  var contentWidth =
    options.staffWidth - options.paddingLeft - options.paddingRight;
  if (contentWidth <= 0)
    throw new RangeError(
      "staffWidth must be wider than the horizontal padding.",
    );

  var measures = groupMeasures(elements || [], options, measureText, warnings);
  var lines = wrapMeasures(measures, contentWidth, options, warnings);
  lines.forEach(function (line, index) {
    positionLine(line, index, contentWidth, options, warnings);
  });
  layoutTies(lines, options, warnings);
  layoutSlurs(lines, options, warnings);
  layoutVoltas(lines, options, warnings);
  resolveVoltaChordOverlap(lines, options);
  var totalPages = Math.ceil(lines.length / options.linesPerPage);
  var showPageNumbers =
    options.showPageNumbers === true ||
    (options.showPageNumbers === undefined && totalPages > 1);
  var pageNumbers = [];
  if (showPageNumbers) {
    for (var pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      var lastLineIndex = Math.min(
        lines.length - 1,
        (pageIndex + 1) * options.linesPerPage - 1,
      );
      pageNumbers.push({
        text: pageIndex + 1 + " / " + totalPages,
        x: options.staffWidth - options.paddingRight,
        y:
          lines[lastLineIndex].y +
          options.lineHeight +
          options.pageFooterHeight * 0.7,
      });
    }
  }
  var infoX = options.paddingLeft;
  var infoY = options.paddingTop + options.headerHeight - 12;
  var keyLabel = options.keyLabel || "";
  var meterLabel = options.meterLabel || "";
  var meterParts = /^(\d+)\s*\/\s*(\d+)$/.exec(meterLabel);
  var keyWidth = keyLabel
    ? measureText(keyLabel, { fontSize: options.headerFontSize })
    : 0;
  var meterFontSize = options.headerFontSize * 0.78;
  var meterWidth = meterParts
    ? Math.max(
        measureText(meterParts[1], { fontSize: meterFontSize }),
        measureText(meterParts[2], { fontSize: meterFontSize }),
      )
    : measureText(meterLabel, { fontSize: options.headerFontSize });
  var meterCenterX = infoX + keyWidth + (keyLabel ? 10 : 0) + meterWidth / 2;
  var meterTextX = infoX + keyWidth + (keyLabel ? 10 : 0);
  var tempoX = meterTextX + (meterLabel ? meterWidth + 12 : 0);

  return {
    width: options.staffWidth,
    height:
      options.paddingTop +
      options.headerHeight +
      lines.length * options.lineHeight +
      (totalPages > 1 ? totalPages * options.pageFooterHeight : 0) +
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
      meterPosition: meterParts
        ? {
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
          }
        : null,
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
      lyricFontSize: options.lyricFontSize,
      pageNumberFontSize: options.pageNumberFontSize,
      tupletFontSize: options.tupletFontSize,
      voltaFontSize: options.voltaFontSize,
      graceNoteFontSize: options.graceNoteFontSize,
    },
    lines: lines,
    pageNumbers: pageNumbers,
    warnings: warnings,
  };
}

layoutJianpu.defaultMeasureText = defaultMeasureText;
layoutJianpu.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

module.exports = layoutJianpu;
