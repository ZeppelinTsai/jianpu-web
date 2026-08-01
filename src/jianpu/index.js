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

function convertAbcTune(tune) {
	var firstStaff = findFirstStaff(tune);
	if (!firstStaff)
		throw new Error("The ABC tune contains no staff.");

	var converter = createJianpuConverter(firstStaff.key);
	var elements = [];
	var warnings = tune.warnings ? tune.warnings.slice() : [];

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
	var converted = convertAbcTune(tunes[0]);
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
