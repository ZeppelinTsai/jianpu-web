"use strict";

// Minimal browser-only piano sample player used to click-to-play jianpu
// notes. The sample pack only recorded 4 notes per octave (C, D#, F#, A),
// spanning the full 88-key piano range A0-C8; every other pitch is played
// back by pitch-shifting the nearest sample.
var SAMPLE_DIR = "./piano-samples/";

var NOTE_SEMITONES = {
	C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
	"F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

var SAMPLE_NAMES = [
	"A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7",
	"C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
	"D#1", "D#2", "D#3", "D#4", "D#5", "D#6", "D#7",
	"F#1", "F#2", "F#3", "F#4", "F#5", "F#6", "F#7",
];

function midiFromNoteName(name) {
	var match = /^([A-G]#?)(-?\d+)$/.exec(name);
	return (Number(match[2]) + 1) * 12 + NOTE_SEMITONES[match[1]];
}

var samples = SAMPLE_NAMES.map(function(name) {
	return {
		name: name,
		fileName: name + "v10.mp3",
		midi: midiFromNoteName(name),
	};
});

var audioContext = null;
var buffers = {}; // fileName -> decoded AudioBuffer
var loadingPromise = null;

function getAudioContext() {
	if (!audioContext) {
		var AudioContextClass = window.AudioContext || window.webkitAudioContext;
		audioContext = new AudioContextClass();
	}
	return audioContext;
}

function loadSample(sample, baseUrl) {
	// Encode only the filename: sample names like "F#4v10.mp3" contain "#",
	// which a relative URL would otherwise parse as a fragment separator.
	return fetch(baseUrl + encodeURIComponent(sample.fileName))
		.then(function(response) {
			if (!response.ok)
				throw new Error("Could not load piano sample " + sample.fileName);
			return response.arrayBuffer();
		})
		.then(function(arrayBuffer) {
			return getAudioContext().decodeAudioData(arrayBuffer);
		})
		.then(function(audioBuffer) {
			buffers[sample.fileName] = audioBuffer;
		});
}

/**
 * Pre-load and decode all 30 piano samples.
 * @param {string} [baseUrl] Directory containing the mp3 files.
 * @returns {Promise}
 */
function loadSamples(baseUrl) {
	if (!loadingPromise) {
		baseUrl = baseUrl || SAMPLE_DIR;
		loadingPromise = Promise.all(
			samples.map(function(sample) {
				return loadSample(sample, baseUrl);
			})
		);
	}
	return loadingPromise;
}

function nearestSample(midiNumber) {
	var nearest = samples[0];
	var nearestDistance = Infinity;
	samples.forEach(function(sample) {
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
 * @param {number} midiNumber MIDI note number (60 = middle C).
 * @param {number} [duration] Seconds to hold the note before releasing.
 * @returns {AudioBufferSourceNode|null}
 */
function playNote(midiNumber, duration) {
	if (typeof midiNumber !== "number" || !isFinite(midiNumber))
		return null;

	var sample = nearestSample(midiNumber);
	var buffer = buffers[sample.fileName];
	if (!buffer) {
		loadSamples().then(function() {
			playNote(midiNumber, duration);
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
