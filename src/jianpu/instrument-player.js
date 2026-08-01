"use strict";

// Minimal browser-only sample player used to click-to-play jianpu notes.
// Supports many instrument sample packs, each of which only recorded a
// handful of notes across their range; every other pitch is played back by
// pitch-shifting the nearest sample.
//
// Sample naming conventions differ per pack:
//   piano:            "<note><octave>v10.mp3", sharps written as "#" (e.g. "D#4v10.mp3")
//   everything else:  "<note><octave>.mp3",     sharps written as "s" (e.g. "As2.mp3")
//
// sampleDir paths are relative to the site root (matching how index.html is
// served), not to this module, so both the eager preload calls and the
// lazy-load fallback inside playNote() resolve correctly regardless of
// where they're called from.

var DEFAULT_INSTRUMENT = "piano";

var NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiFromNoteName(name) {
	// Accepts both "#" (piano) and "s" (everything else) sharp notation.
	var match = /^([A-G])(#|s)?(-?\d+)$/.exec(name);
	if (!match) return null;
	var semitone = NOTE_SEMITONES[match[1]] + (match[2] ? 1 : 0);
	return (Number(match[3]) + 1) * 12 + semitone;
}

function pianoFileName(name) {
	return name + "v10.mp3";
}

function plainFileName(name) {
	return name + ".mp3";
}

function buildSamples(noteNames, fileNameFor) {
	return noteNames.map(function(name) {
		return {
			name: name,
			fileName: fileNameFor(name),
			midi: midiFromNoteName(name),
		};
	});
}

// One entry per instrument: its sample directory (under src/jianpu/) and
// the exact note names recorded for it (verified against the files on disk
// — these packs are sparse, so every other pitch is reached by
// pitch-shifting the nearest one in nearestSample()).
var INSTRUMENT_DEFS = {
	piano: {
		dir: "piano-samples",
		fileNameFor: pianoFileName,
		notes: [
			"A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7",
			"C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
			"D#1", "D#2", "D#3", "D#4", "D#5", "D#6", "D#7",
			"F#1", "F#2", "F#3", "F#4", "F#5", "F#6", "F#7",
		],
	},
	guitar: {
		dir: "guitar-acoustic-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A3", "A4", "As2", "As3", "As4",
			"B2", "B3", "B4",
			"C3", "C4", "C5", "Cs3", "Cs4", "Cs5",
			"D2", "D3", "D4", "D5", "Ds2", "Ds3", "Ds4",
			"E2", "E3", "E4",
			"F2", "F3", "F4", "Fs2", "Fs3", "Fs4",
			"G2", "G3", "G4", "Gs2", "Gs3", "Gs4",
		],
	},
	violin: {
		dir: "violin-samples",
		fileNameFor: plainFileName,
		notes: [
			"A3", "A4", "A5", "A6",
			"C4", "C5", "C6", "C7",
			"E4", "E5", "E6",
			"G3", "G4", "G5", "G6",
		],
	},
	"bass-electric": {
		dir: "bass-electric-samples",
		fileNameFor: plainFileName,
		notes: [
			"As1", "As2", "As3", "As4",
			"Cs1", "Cs2", "Cs3", "Cs4", "Cs5",
			"E1", "E2", "E3", "E4",
			"G1", "G2", "G3", "G4",
		],
	},
	harp: {
		dir: "harp-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A4", "A6",
			"B1", "B3", "B5", "B6",
			"C3", "C5",
			"D2", "D4", "D6", "D7",
			"E1", "E3", "E5",
			"F2", "F4", "F6", "F7",
			"G1", "G3", "G5",
		],
	},
	flute: {
		dir: "flute-samples",
		fileNameFor: plainFileName,
		notes: [
			"A4", "A5", "A6",
			"C4", "C5", "C6", "C7",
			"E4", "E5", "E6",
		],
	},
	bassoon: {
		dir: "bassoon-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A3", "A4",
			"C3", "C4", "C5",
			"E4",
			"G2", "G3", "G4",
		],
	},
	cello: {
		dir: "cello-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A3", "A4", "As2", "As3",
			"B2", "B3", "B4",
			"C2", "C3", "C4", "C5", "Cs3", "Cs4",
			"D2", "D3", "D4", "Ds2", "Ds3", "Ds4",
			"E2", "E3", "E4",
			"F2", "F3", "F4", "Fs3", "Fs4",
			"G2", "G3", "G4", "Gs2", "Gs3", "Gs4",
		],
	},
	clarinet: {
		dir: "clarinet-samples",
		fileNameFor: plainFileName,
		notes: [
			"As3", "As4", "As5",
			"D3", "D4", "D5", "D6",
			"F3", "F4", "F5",
			"Fs6",
		],
	},
	contrabass: {
		dir: "contrabass-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "As1",
			"B3",
			"C2", "Cs3",
			"D2",
			"E2", "E3",
			"Fs1", "Fs2",
			"G1", "Gs2", "Gs3",
		],
	},
	"french-horn": {
		dir: "french-horn-samples",
		fileNameFor: plainFileName,
		notes: [
			"A1", "A3",
			"C2", "C4",
			"D3", "D5", "Ds2",
			"F3", "F5",
			"G2",
		],
	},
	"guitar-electric": {
		dir: "guitar-electric-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A3", "A4", "A5",
			"C3", "C4", "C5", "C6", "Cs2",
			"Ds3", "Ds4", "Ds5",
			"E2",
			"Fs2", "Fs3", "Fs4", "Fs5",
		],
	},
	"guitar-nylon": {
		dir: "guitar-nylon-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A3", "A4", "A5", "As5",
			"B1", "B2", "B3", "B4",
			"Cs3", "Cs4", "Cs5",
			"D2", "D3", "D5", "Ds4",
			"E2", "E3", "E4", "E5",
			"Fs2", "Fs3", "Fs4", "Fs5",
			"G3", "G5", "Gs2", "Gs4", "Gs5",
		],
	},
	harmonium: {
		dir: "harmonium-samples",
		fileNameFor: plainFileName,
		notes: [
			"A2", "A3", "A4", "As2", "As3", "As4",
			"B2", "B3", "B4",
			"C2", "C3", "C4", "C5", "Cs2", "Cs3", "Cs4", "Cs5",
			"D2", "D3", "D4", "D5", "Ds2", "Ds3", "Ds4",
			"E2", "E3", "E4",
			"F2", "F3", "F4", "Fs2", "Fs3",
			"G2", "G3", "G4", "Gs2", "Gs3", "Gs4",
		],
	},
	organ: {
		dir: "organ-samples",
		fileNameFor: plainFileName,
		notes: [
			"A1", "A2", "A3", "A4", "A5",
			"C1", "C2", "C3", "C4", "C5", "C6",
			"Ds1", "Ds2", "Ds3", "Ds4", "Ds5",
			"Fs1", "Fs2", "Fs3", "Fs4", "Fs5",
		],
	},
	saxophone: {
		dir: "saxophone-samples",
		fileNameFor: plainFileName,
		notes: [
			"A4", "A5", "As3", "As4",
			"B3", "B4",
			"C4", "C5", "Cs3", "Cs4", "Cs5",
			"D3", "D4", "D5", "Ds3", "Ds4", "Ds5",
			"E3", "E4", "E5",
			"F3", "F4", "F5", "Fs3", "Fs4", "Fs5",
			"G3", "G4", "G5", "Gs3", "Gs4", "Gs5",
		],
	},
	trombone: {
		dir: "trombone-samples",
		fileNameFor: plainFileName,
		notes: [
			"As1", "As2", "As3",
			"C3", "C4", "Cs2", "Cs4",
			"D3", "D4", "Ds2", "Ds3", "Ds4",
			"F2", "F3", "F4",
			"Gs2", "Gs3",
		],
	},
	trumpet: {
		dir: "trumpet-samples",
		fileNameFor: plainFileName,
		notes: [
			"A3", "A5", "As4",
			"C4", "C6",
			"D5", "Ds4",
			"F3", "F4", "F5",
			"G4",
		],
	},
	tuba: {
		dir: "tuba-samples",
		fileNameFor: plainFileName,
		notes: [
			"As1", "As2", "As3",
			"D3", "D4", "Ds2",
			"F1", "F2", "F3",
		],
	},
	xylophone: {
		dir: "xylophone-samples",
		fileNameFor: plainFileName,
		notes: [
			"C5", "C6", "C7", "C8",
			"G4", "G5", "G6", "G7",
		],
	},
};

var INSTRUMENTS = {};
Object.keys(INSTRUMENT_DEFS).forEach(function(key) {
	var def = INSTRUMENT_DEFS[key];
	INSTRUMENTS[key] = {
		sampleDir: "src/jianpu/" + def.dir + "/",
		samples: buildSamples(def.notes, def.fileNameFor),
	};
});

// Public map of instrument -> sample list, e.g. instrumentPlayer.samples.guitar
var samples = {};
// Public map of instrument -> the site-root-relative directory its mp3s
// live in, e.g. instrumentPlayer.sampleDirs.guitar === "src/jianpu/guitar-acoustic-samples/"
// (folder names don't all match "<instrument>-samples", e.g. guitar/guitar-acoustic).
var sampleDirs = {};
Object.keys(INSTRUMENTS).forEach(function(instrument) {
	samples[instrument] = INSTRUMENTS[instrument].samples;
	sampleDirs[instrument] = INSTRUMENTS[instrument].sampleDir;
});

function normalizeInstrument(instrument) {
	var key = String(instrument || "").toLowerCase();
	return INSTRUMENTS[key] ? key : DEFAULT_INSTRUMENT;
}

var audioContext = null;
var buffers = {}; // instrument -> (fileName -> decoded AudioBuffer)
var loadingPromises = {}; // instrument -> Promise

Object.keys(INSTRUMENTS).forEach(function(instrument) {
	buffers[instrument] = {};
});

function getAudioContext() {
	if (!audioContext) {
		var AudioContextClass = window.AudioContext || window.webkitAudioContext;
		audioContext = new AudioContextClass();
	}
	return audioContext;
}

function loadSample(instrument, sample, baseUrl) {
	// Encode only the filename: sample names can contain "#", which a
	// relative URL would otherwise parse as a fragment separator.
	return fetch(baseUrl + encodeURIComponent(sample.fileName))
		.then(function(response) {
			if (!response.ok)
				throw new Error(
					"Could not load " + instrument + " sample " + sample.fileName
				);
			return response.arrayBuffer();
		})
		.then(function(arrayBuffer) {
			return getAudioContext().decodeAudioData(arrayBuffer);
		})
		.then(function(audioBuffer) {
			buffers[instrument][sample.fileName] = audioBuffer;
		});
}

/**
 * Pre-load and decode all samples for one instrument.
 * @param {string} [instrument] "piano" (default) or any other key in
 *   instrumentPlayer.samples. Any unrecognized or missing value falls back
 *   to "piano".
 * @param {string} [baseUrl] Directory containing that instrument's mp3
 *   files; defaults to its actual location under src/jianpu/.
 * @returns {Promise}
 */
function loadSamples(instrument, baseUrl) {
	instrument = normalizeInstrument(instrument);
	if (!loadingPromises[instrument]) {
		baseUrl = baseUrl || INSTRUMENTS[instrument].sampleDir;
		loadingPromises[instrument] = Promise.all(
			INSTRUMENTS[instrument].samples.map(function(sample) {
				return loadSample(instrument, sample, baseUrl);
			})
		);
	}
	return loadingPromises[instrument];
}

function nearestSample(instrument, midiNumber) {
	var instrumentSamples = INSTRUMENTS[instrument].samples;
	var nearest = instrumentSamples[0];
	var nearestDistance = Infinity;
	instrumentSamples.forEach(function(sample) {
		var distance = Math.abs(sample.midi - midiNumber);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearest = sample;
		}
	});
	return nearest;
}

/**
 * Play the sample nearest to midiNumber, pitch-shifted to the exact note.
 * @param {string} [instrument] "piano" (default) or any other key in
 *   instrumentPlayer.samples. Any unrecognized or missing value falls back
 *   to "piano".
 * @param {number} midiNumber MIDI note number (60 = middle C).
 * @param {number} [duration] Seconds to hold the note before releasing.
 * @returns {AudioBufferSourceNode|null}
 */
function playNote(instrument, midiNumber, duration) {
	instrument = normalizeInstrument(instrument);

	if (typeof midiNumber !== "number" || !isFinite(midiNumber))
		return null;

	var sample = nearestSample(instrument, midiNumber);
	var buffer = buffers[instrument][sample.fileName];
	if (!buffer) {
		loadSamples(instrument).then(function() {
			playNote(instrument, midiNumber, duration);
		});
		return null;
	}

	var context = getAudioContext();
	if (context.state === "suspended") context.resume();

	var source = context.createBufferSource();
	source.buffer = buffer;
	source.playbackRate.value = Math.pow(2, (midiNumber - sample.midi) / 12);

	var gainNode = context.createGain();
	source.connect(gainNode);
	gainNode.connect(context.destination);

	var seconds = typeof duration === "number" && duration > 0 ? duration : 0.8;
	var releaseStart = Math.max(0, seconds - 0.08);
	var now = context.currentTime;
	gainNode.gain.setValueAtTime(1, now);
	gainNode.gain.setValueAtTime(1, now + releaseStart);
	gainNode.gain.linearRampToValueAtTime(0.0001, now + seconds);

	source.start(now);
	source.stop(now + seconds + 0.05);

	return source;
}

module.exports = {
	samples: samples,
	sampleDirs: sampleDirs,
	loadSamples: loadSamples,
	playNote: playNote,
};
