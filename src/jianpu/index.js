"use strict";

var createJianpuConverter = require("./create-jianpu-converter");
var layoutJianpu = require("./layout-jianpu");
var parseJianpu = require("./parse-jianpu");
var instrumentPlayer = require("./instrument-player");
var renderJianpuSvg = require("./render-jianpu-svg");

// Case-insensitive lookup from a V: voice's name= attribute to the
// instrument sample pack used to play back its notes. Anything not listed
// here (or a voice with no name= at all) falls back to "piano". "guitar"
// deliberately stays pointed at the acoustic pack for now — guitar-nylon
// and guitar-electric exist on disk but aren't mapped to a name= yet, to
// avoid users needing to know which of three guitar tones they'd get.
var NAME_TO_INSTRUMENT = {
	'melody': 'piano',
	'chords': 'piano',
	'bass': 'bass-electric',
	'guitar': 'guitar',
	'violin': 'violin',
	'harp': 'harp',
	'flute': 'flute',
	'pad': 'piano',
	'glockenspiel': 'piano',
	'pizzicato': 'violin',
	'bassoon': 'bassoon',
	'cello': 'cello',
	'clarinet': 'clarinet',
	'contrabass': 'contrabass',
	'french horn': 'french-horn',
	'saxophone': 'saxophone',
	'trombone': 'trombone',
	'trumpet': 'trumpet',
	'tuba': 'tuba',
	'xylophone': 'xylophone',
	'organ': 'organ',
	'harmonium': 'harmonium',
};

function instrumentFromVoiceName(name) {
	if (!name) return "piano";
	var key = String(name).trim().toLowerCase();
	return NAME_TO_INSTRUMENT[key] || "piano";
}

function keyLabelFromStaffKey(key) {
	key = key || {};
	var tonic = (key.root || "C") + (key.acc || "");
	var mode = String(key.mode || "").toLowerCase();
	var isMinor = mode === "m" || mode === "min" || mode === "minor";
	return (isMinor ? "6=" : "1=") + tonic.replace(/#/g, "♯").replace(/b/g, "♭");
}

function keyLabelFromText(key) {
	var value = String(key || "C").trim();
	var minorMatch = value.match(/^([A-Ga-g])([#b]?)(?:m|min|minor)$/i);
	if (minorMatch)
		return "6=" + (minorMatch[1].toUpperCase() + minorMatch[2])
			.replace(/#/g, "♯").replace(/b/g, "♭");
	return "1=" + value.replace(/#/g, "♯").replace(/b/g, "♭");
}

function meterLabel(staff) {
	var meter = staff && staff.meter;
	if (!meter || !meter.value || !meter.value.length)
		return "";
	return meter.value.map(function(value) {
		return value.num + "/" + value.den;
	}).join("+");
}

function tempoLabel(tune) {
	var tempo = tune.metaText && tune.metaText.tempo;
	if (!tempo || !tempo.bpm)
		return "";
	return "♩=" + tempo.bpm;
}

function findFirstStaff(tune) {
	for (var i = 0; i < tune.lines.length; i++) {
		if (tune.lines[i].staff && tune.lines[i].staff.length)
			return tune.lines[i].staff[0];
	}
	return null;
}

// abcjs's own w: line parser (addWords in src/parse/abc_parse.js) consumes
// syllables against note elements as it walks the tune, but it does this
// silently: if a `w:` line has too FEW words it just stops (later notes get
// no `.lyric` at all), and if it has too MANY it drops the leftovers with no
// trace. Neither case leaves enough of a fingerprint on the parsed tune to
// detect "too many syllables" after the fact. So for validation we
// independently re-tokenize the raw `w:` line text ourselves. Nothing on the
// parsed tune retains that raw text, so we re-scan the original ABC input.
//
// Returns an array parallel to tune.lines (one entry per music line that
// actually reaches the tune, i.e. lines with a .staff), where each entry is
// either null (no `w:` line followed that music line) or the raw text after
// the "w:" prefix.
function extractLyricLines(rawAbc) {
	var lines = String(rawAbc).replace(/\r\n?/g, "\n").split("\n");
	var result = [];
	var i = 0;
	while (i < lines.length) {
		var line = lines[i].replace(/\s+$/, "");
		if (line.length === 0 || line[0] === "%") {
			i++;
			continue;
		}
		var fieldMatch = /^[A-Za-z]:/.exec(line);
		if (fieldMatch) {
			// A header/info field line (X:, T:, K:, w:, V:, ...). Standalone
			// `w:` lines not immediately following a recognized music line are
			// not associated with anything; skip them defensively.
			i++;
			continue;
		}
		// Strip quoted chord/annotation strings, inline fields like [K:C], and
		// !decoration! marks to see if anything musical (notes/bars) is left.
		var stripped = line
			.replace(/"[^"]*"/g, "")
			.replace(/\[[A-Za-z]:[^\]]*\]/g, "")
			.replace(/![^!]*!/g, "");
		if (stripped.trim().length === 0) {
			// No musical content on this line (e.g. a lone "[V:1]" line).
			i++;
			continue;
		}
		// This is a music line.
		var lyricText = null;
		i++;
		if (i < lines.length) {
			var next = lines[i].replace(/\s+$/, "");
			if (/^w:/.test(next)) {
				lyricText = next.substring(2);
				i++;
			}
		}
		result.push(lyricText);
	}
	return result;
}

// Splits the raw text of one `w:` line into per-measure syllable-slot
// counts. Real words, and the `_`/`*` skip markers, each count as filling
// one slot; `|` divides measures, matching abcjs's own bar-realignment
// syntax for `w:` lines.
function countLyricSlotsPerMeasure(rawWordsLine) {
	if (rawWordsLine === null || rawWordsLine === undefined)
		return null;
	return rawWordsLine.split("|").map(function(segment) {
		var tokens = segment.trim().split(/\s+/).filter(function(token) {
			return token.length > 0;
		});
		return tokens.length;
	});
}

function convertAbcTune(tune, rawAbc) {
	var firstStaff = findFirstStaff(tune);
	if (!firstStaff)
		throw new Error("The ABC tune contains no staff.");

	var converter = createJianpuConverter(firstStaff.key);
	var elements = [];
	var warnings = tune.warnings ? tune.warnings.slice() : [];
	var lyricLinesByMusicLine = rawAbc ? extractLyricLines(rawAbc) : [];
	var musicLineIndex = 0;
	// Measure numbers run continuously across the whole tune (matching how
	// layout-jianpu numbers measures), not per music line.
	var measureNumber = 0;

	tune.lines.forEach(function(line) {
		if (!line.staff || !line.staff[0])
			return;
		var staff = line.staff[0];
		if (!staff.voices || !staff.voices[0])
			return;
		if (staff.voices.length > 1)
			warnings.push("Only the first voice is rendered in this playground.");

		// staff.title[0], when present, is voice 0's name= attribute (only
		// populated on the music line where the voice was first declared);
		// keep using the last-resolved instrument on subsequent lines.
		if (staff.title && staff.title[0])
			converter.setInstrument(instrumentFromVoiceName(staff.title[0]));

		var lyricSlotsPerMeasure =
			countLyricSlotsPerMeasure(lyricLinesByMusicLine[musicLineIndex]);
		musicLineIndex++;
		var lyricMeasureIndex = 0;
		var playableNoteCount = 0;

		staff.voices[0].forEach(function(element) {
			if (element.el_type === "bar") {
				measureNumber++;
				if (lyricSlotsPerMeasure) {
					var expectedSlots = lyricSlotsPerMeasure[lyricMeasureIndex];
					if (expectedSlots !== undefined &&
						expectedSlots !== playableNoteCount) {
						warnings.push(
							"Lyric syllable count doesn't match note count in measure " +
							measureNumber + "."
						);
					}
					lyricMeasureIndex++;
				}
				playableNoteCount = 0;
				converter.resetBar();
				elements.push({ type: "bar", barType: element.type });
			} else if (element.el_type === "note") {
				if (element.rest === undefined)
					playableNoteCount++;
				converter.convertNote(element).forEach(function(event) {
					elements.push(event);
				});
			}
		});
		// A trailing partial measure with no closing bar still needs to be
		// checked, but keep it best-effort: don't let it throw or otherwise
		// disrupt the rest of the tune.
		if (lyricSlotsPerMeasure && playableNoteCount > 0) {
			measureNumber++;
			var expectedTrailingSlots = lyricSlotsPerMeasure[lyricMeasureIndex];
			if (expectedTrailingSlots !== undefined &&
				expectedTrailingSlots !== playableNoteCount) {
				warnings.push(
					"Lyric syllable count doesn't match note count in measure " +
					measureNumber + "."
				);
			}
		}
		elements.push({ type: "line_break" });
	});

	return {
		elements: elements,
		header: {
			title: tune.metaText && tune.metaText.title || "",
			composer: tune.metaText && tune.metaText.composer || "",
			keyLabel: keyLabelFromStaffKey(firstStaff.key),
			meterLabel: meterLabel(firstStaff),
			tempoLabel: tempoLabel(tune),
		},
		warnings: warnings.concat(converter.context.warnings),
	};
}

function finish(elements, header, warnings, options) {
	options = options || {};
	var layoutOptions = Object.assign({}, options, {
		title: header.title,
		keyLabel: header.keyLabel,
		meterLabel: header.meterLabel,
		composer: header.composer || "",
		tempoLabel: header.tempoLabel || "",
	});
	var layout = layoutJianpu(elements, layoutOptions, options.measureText);
	return {
		svg: renderJianpuSvg(layout, options.svg),
		layout: layout,
		warnings: (warnings || []).concat(layout.warnings),
	};
}

function fromAbc(abc, options, parseOnly) {
	if (typeof parseOnly !== "function")
		throw new TypeError("fromAbc requires ABCJS.parseOnly as its third argument.");
	var tunes = parseOnly(abc);
	if (!tunes || !tunes.length)
		throw new Error("ABCJS.parseOnly returned no tunes.");
	var converted = convertAbcTune(tunes[0], abc);
	return finish(converted.elements, converted.header, converted.warnings, options);
}

function fromText(input, options) {
	var parsed = parseJianpu(input);
	return finish(parsed.elements, {
		title: parsed.header.title,
		keyLabel: keyLabelFromText(parsed.header.key),
		meterLabel: parsed.header.meter,
	}, parsed.warnings, options);
}

module.exports = {
	fromAbc: fromAbc,
	fromText: fromText,
	convertAbcTune: convertAbcTune,
	createJianpuConverter: createJianpuConverter,
	layoutJianpu: layoutJianpu,
	parseJianpu: parseJianpu,
	instrumentPlayer: instrumentPlayer,
	renderJianpuSvg: renderJianpuSvg,
};
