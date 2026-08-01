"use strict";

// Minimal browser-only sample player used to click-to-play jianpu notes.
// Supports three instrument sample packs, each of which only recorded a
// handful of notes across their range; every other pitch is played back by
// pitch-shifting the nearest sample.
//
// Sample naming conventions differ per pack:
//   piano:  "<note><octave>v10.mp3", sharps written as "#" (e.g. "D#4v10.mp3")
//   guitar: "<note><octave>.mp3",    sharps written as "s" (e.g. "As2.mp3")
//   violin: "<note><octave>.mp3",    no sharps in this pack

var DEFAULT_INSTRUMENT = "piano";

var NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiFromNoteName(name) {
	// Accepts both "#" (piano) and "s" (guitar/violin) sharp notation.
	var match = /^([A-G])(#|s)?(-?\d+)$/.exec(name);
	if (!match) return null;
	var semitone = NOTE_SEMITONES[match[1]] + (match[2] ? 1 : 0);
	return (Number(match[3]) + 1) * 12 + semitone;
}

var PIANO_NOTE_NAMES = [
	"A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7",
	"C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
	"D#1", "D#2", "D#3", "D#4", "D#5", "D#6", "D#7",
	"F#1", "F#2", "F#3", "F#4", "F#5", "F#6", "F#7",
];

var GUITAR_NOTE_NAMES = [
	"A2", "A3", "A4", "As2", "As3", "As4",
	"B2", "B3", "B4",
	"C3", "C4", "C5", "Cs3", "Cs4", "Cs5",
	"D2", "D3", "D4", "D5", "Ds2", "Ds3", "Ds4",
	"E2", "E3", "E4",
	"F2", "F3", "F4", "Fs2", "Fs3", "Fs4",
	"G2", "G3", "G4", "Gs2", "Gs3", "Gs4",
];

var VIOLIN_NOTE_NAMES = [
	"A3", "A4", "A5", "A6",
	"C4", "C5", "C6", "C7",
	"E4", "E5", "E6",
	"G3", "G4", "G5", "G6",
];

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

var INSTRUMENTS = {
	piano: {
		sampleDir: "./piano-samples/",
		samples: buildSamples(PIANO_NOTE_NAMES, pianoFileName),
	},
	guitar: {
		sampleDir: "./guitar-acoustic-samples/",
		samples: buildSamples(GUITAR_NOTE_NAMES, plainFileName),
	},
	violin: {
		sampleDir: "./violin-samples/",
		samples: buildSamples(VIOLIN_NOTE_NAMES, plainFileName),
	},
};

// Public map of instrument -> sample list, e.g. instrumentPlayer.samples.guitar
var samples = {};
Object.keys(INSTRUMENTS).forEach(function(instrument) {
	samples[instrument] = INSTRUMENTS[instrument].samples;
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
 * @param {string} [instrument] "piano" (default), "guitar", or "violin".
 *   Any unrecognized or missing value falls back to "piano".
 * @param {string} [baseUrl] Directory containing that instrument's mp3 files.
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
 * @param {string} [instrument] "piano" (default), "guitar", or "violin".
 *   Any unrecognized or missing value falls back to "piano".
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
	loadSamples: loadSamples,
	playNote: playNote,
};
