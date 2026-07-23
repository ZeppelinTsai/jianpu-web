"use strict";

var DIATONIC_INDEX = {
	C: 0,
	D: 1,
	E: 2,
	F: 3,
	G: 4,
	A: 5,
	B: 6,
};

var VALID_ACCIDENTALS = {
	sharp: true,
	flat: true,
	natural: true,
	dblsharp: true,
	dblflat: true,
};

var EPSILON = 1e-9;
var QUARTER = 0.25;

function mod(value, divisor) {
	return ((value % divisor) + divisor) % divisor;
}

function cloneKey(key) {
	key = key || {};
	return {
		root: key.root || "C",
		acc: key.acc || "",
		mode: key.mode || "",
		accidentals: (key.accidentals || []).map(function(accidental) {
			return { note: accidental.note, acc: accidental.acc };
		}),
	};
}

function getRootLetter(key) {
	var root = String(key.root || "C").match(/[A-Ga-g]/);
	return root ? root[0].toUpperCase() : "C";
}

function isMinorKey(key) {
	var mode = String(key.mode || "").toLowerCase();
	return mode === "m" || mode === "min" || mode === "minor";
}

function buildKeyAccidentals(key) {
	var result = new Map();
	key.accidentals.forEach(function(accidental) {
		if (!accidental || !accidental.note || !VALID_ACCIDENTALS[accidental.acc])
			return;
		result.set(String(accidental.note).replace(/[^A-Ga-g]/g, "").toUpperCase(), accidental.acc);
	});
	return result;
}

function pitchIdentity(pitch) {
	var letter = getPitchLetter(pitch);
	var absolutePitch = Number(pitch.pitch);
	var octave = Math.floor(absolutePitch / 7);
	return letter + ":" + octave;
}

function getPitchLetter(pitch) {
	var fromName = String(pitch.name || "").match(/[A-Ga-g]/);
	if (fromName)
		return fromName[0].toUpperCase();
	return Object.keys(DIATONIC_INDEX)[mod(Number(pitch.pitch), 7)];
}

function dottedMultiplier(dots) {
	return dots === 1 ? 1.5 : dots === 2 ? 1.75 : 1;
}

function findDurationRepresentation(duration) {
	for (var dots = 0; dots <= 2; dots++) {
		var base = duration / dottedMultiplier(dots);
		var beats = base / QUARTER;

		if (beats >= 1 && Math.abs(beats - Math.round(beats)) < EPSILON) {
			return {
				baseDuration: base,
				extensionDashes: Math.round(beats) - 1,
				underlines: 0,
				dots: dots,
			};
		}

		if (beats < 1) {
			var underlines = Math.log(1 / beats) / Math.log(2);
			if (Math.abs(underlines - Math.round(underlines)) < EPSILON) {
				return {
					baseDuration: base,
					extensionDashes: 0,
					underlines: Math.round(underlines),
					dots: dots,
				};
			}
		}
	}
	return null;
}

function durationMarks(representation) {
	return {
		extensionDashes: representation.extensionDashes,
		underlines: representation.underlines,
		dots: representation.dots,
	};
}

/**
 * Create a stateful converter from ABCJS Tune AST notes to jianpu events.
 *
 * AccidentalMark:
 * 'sharp'|'flat'|'natural'|'dblsharp'|'dblflat'|null
 *
 * JianpuEvent:
 * {
 *   notes: [{ number, octaveDots, accidentalMark }, ...],
 *   durationMarks: { extensionDashes, underlines, dots }
 * }
 *
 * @param {{root:string, acc:string, mode:string,
 *   accidentals:Array<{note:string,acc:string}>}} initialKey
 * @returns {{
 *   context: {
 *     key:Object,
 *     keyAccidentals:Map,
 *     measureAccidentals:Map,
 *     warnings:string[]
 *   },
 *   convertNote:function(Object):Array<Object>,
 *   getEffectiveAccidental:function(Object):(string|null),
 *   resetBar:function():void,
 *   setKey:function(Object):void
 * }}
 */
function createJianpuConverter(initialKey) {
	var context = {
		key: cloneKey(initialKey),
		keyAccidentals: new Map(),
		measureAccidentals: new Map(),
		warnings: [],
	};

	function setKey(key) {
		context.key = cloneKey(key);
		context.keyAccidentals = buildKeyAccidentals(context.key);
		context.measureAccidentals.clear();
	}

	function resetBar() {
		context.measureAccidentals.clear();
	}

	function getEffectiveAccidental(pitch) {
		var measureAccidental = context.measureAccidentals.get(pitchIdentity(pitch));
		if (measureAccidental)
			return measureAccidental;
		return context.keyAccidentals.get(getPitchLetter(pitch)) || null;
	}

	function convertPitch(pitch) {
		var rootIndex = DIATONIC_INDEX[getRootLetter(context.key)];
		var relativePitch = Number(pitch.pitch) - rootIndex;
		// Scale degrees are relative to the key, but octave marks describe the
		// pitch's actual ABC register. For example, c/d must keep their upper
		// octave dots in A minor instead of being pulled into A's tonic octave.
		var octaveDots = Math.floor(Number(pitch.pitch) / 7);
		var tonicNumberOffset = isMinorKey(context.key) ? 5 : 0;
		var number = mod(relativePitch + tonicNumberOffset, 7) + 1;

		if (octaveDots < -2 || octaveDots > 2) {
			context.warnings.push(
				"Pitch " + (pitch.name || pitch.pitch) +
				" is " + Math.abs(octaveDots) +
				" octaves " + (octaveDots > 0 ? "above" : "below") +
				" the central jianpu octave."
			);
			octaveDots = Math.max(-2, Math.min(2, octaveDots));
		}

		var accidentalMark = null;
		if (pitch.accidental) {
			if (VALID_ACCIDENTALS[pitch.accidental]) {
				accidentalMark = pitch.accidental;
				context.measureAccidentals.set(pitchIdentity(pitch), pitch.accidental);
			} else {
				context.warnings.push("Unsupported accidental: " + pitch.accidental);
			}
		}

		var convertedPitch = {
			number: number,
			octaveDots: octaveDots,
			accidentalMark: accidentalMark,
		};
		if (pitch.startTie)
			convertedPitch.tieStart = true;
		if (pitch.endTie)
			convertedPitch.tieEnd = true;
		return convertedPitch;
	}

	function restEvent(marks) {
		return {
			notes: [{ number: 0, octaveDots: 0, accidentalMark: null }],
			durationMarks: marks,
		};
	}

	function convertRest(representation) {
		if (representation.extensionDashes === 0)
			return [restEvent(durationMarks(representation))];

		var count = representation.extensionDashes + 1;
		var marks = {
			extensionDashes: 0,
			underlines: 0,
			dots: representation.dots,
		};
		var events = [];
		for (var i = 0; i < count; i++)
			events.push(restEvent(marks));
		return events;
	}

	function convertNote(note) {
		if (!note || note.el_type !== "note")
			throw new TypeError("convertNote expects an ABCJS note element.");

		var representation = findDurationRepresentation(Number(note.duration));
		if (!representation) {
			context.warnings.push("Unsupported duration: " + note.duration);
			return [];
		}

		if (note.rest)
			return convertRest(representation);

		if (!Array.isArray(note.pitches) || note.pitches.length === 0) {
			context.warnings.push("A non-rest note has no pitches.");
			return [];
		}

		var event = {
			notes: note.pitches.map(convertPitch),
			durationMarks: durationMarks(representation),
		};
		if (note.chord) {
			event.chordSymbols = note.chord.filter(function(chord) {
				return chord && chord.name &&
					(!chord.position || chord.position === "default" ||
						(chord.position === "above" &&
							!/^[1-5①②③④⑤]$/.test(chord.name)));
			}).map(function(chord) {
				return chord.name;
			});
			event.fingerings = note.chord.filter(function(chord) {
				return chord && chord.position === "above" &&
					/^[1-5①②③④⑤]$/.test(chord.name);
			}).map(function(chord) {
				return chord.name;
			});
		}
		if (note.decoration) {
			event.dynamics = note.decoration.filter(function(decoration) {
				return /^(pppp|ppp|pp|p|mp|mf|f|ff|fff|ffff)$/.test(decoration);
			});
		}
		if (note.startBeam || note.endBeam) {
			event.beam = {
				start: note.startBeam === true,
				end: note.endBeam === true,
			};
		}
		return [event];
	}

	setKey(initialKey);

	return {
		context: context,
		convertNote: convertNote,
		getEffectiveAccidental: getEffectiveAccidental,
		resetBar: resetBar,
		setKey: setKey,
	};
}

module.exports = createJianpuConverter;
