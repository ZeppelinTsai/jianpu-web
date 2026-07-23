"use strict";

var BAR_TYPES = {
	"|]": "bar_thin_thick",
	"||": "bar_thin_thin",
	"[|": "bar_thick_thin",
	"|": "bar_thin",
};

var ACCIDENTALS = {
	"^^": "dblsharp",
	"__": "dblflat",
	"^": "sharp",
	"_": "flat",
	"=": "natural",
};

function JianpuSyntaxError(message, index, source) {
	this.name = "JianpuSyntaxError";
	this.message = message + " at character " + index + ".";
	this.index = index;
	this.source = source;
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, JianpuSyntaxError);
}
JianpuSyntaxError.prototype = Object.create(SyntaxError.prototype);
JianpuSyntaxError.prototype.constructor = JianpuSyntaxError;

function syntaxError(state, message) {
	throw new JianpuSyntaxError(message, state.index, state.source);
}

function startsWithAt(source, value, index) {
	return source.slice(index, index + value.length) === value;
}

function skipWhitespace(state) {
	while (state.index < state.source.length &&
		/\s/.test(state.source[state.index]))
		state.index++;
}

function parseAccidental(state) {
	var symbols = ["^^", "__", "^", "_", "="];
	for (var i = 0; i < symbols.length; i++) {
		var symbol = symbols[i];
		if (startsWithAt(state.source, symbol, state.index)) {
			state.index += symbol.length;
			return ACCIDENTALS[symbol];
		}
	}
	return null;
}

function makeNote(number, octaveDots, accidentalMark) {
	return {
		number: number,
		octaveDots: octaveDots,
		accidentalMark: accidentalMark,
	};
}

function parseChord(state, accidentalMark) {
	state.index++;
	var numbers = [];
	while (state.index < state.source.length &&
		state.source[state.index] !== "]") {
		var character = state.source[state.index];
		if (character < "1" || character > "7")
			syntaxError(state, "A chord may contain only scale degrees 1 through 7");
		numbers.push(Number(character));
		state.index++;
	}
	if (state.index >= state.source.length)
		syntaxError(state, "Unclosed chord");
	if (!numbers.length)
		syntaxError(state, "A chord must contain at least one note");
	state.index++;
	return numbers.map(function(number) {
		return makeNote(number, 0, accidentalMark);
	});
}

function parseNoteOrChord(state, accidentalMark) {
	var character = state.source[state.index];
	if (character === "[")
		return parseChord(state, accidentalMark);
	if (character < "0" || character > "7")
		syntaxError(state, "Expected a scale degree 0 through 7 or a chord");
	state.index++;
	if (character === "0" && accidentalMark)
		syntaxError(state, "A rest cannot have an accidental");
	return [makeNote(Number(character), 0, accidentalMark)];
}

function parseOctave(state, notes) {
	var first = state.source[state.index];
	if (first !== "'" && first !== ",")
		return;

	var count = 0;
	while (state.source[state.index] === first) {
		count++;
		state.index++;
	}
	if (state.source[state.index] === (first === "'" ? "," : "'"))
		syntaxError(state, "High and low octave marks cannot be mixed");
	if (notes.length === 1 && notes[0].number === 0)
		syntaxError(state, "A rest cannot have octave marks");

	var direction = first === "'" ? 1 : -1;
	if (count > 2) {
		state.warnings.push(
			"Octave mark at character " + (state.index - count) +
			" exceeds two octaves and was limited to " +
			(direction > 0 ? "+2" : "-2") + "."
		);
	}
	notes.forEach(function(note) {
		note.octaveDots = direction * Math.min(count, 2);
	});
}

function parseDuration(state, isRest) {
	var underlines = 0;
	var extensionDashes = 0;

	while (state.source[state.index] === "_") {
		underlines++;
		state.index++;
	}
	while (state.source[state.index] === "-") {
		extensionDashes++;
		state.index++;
	}
	if (underlines && extensionDashes)
		syntaxError(state, "Underlines and extension dashes cannot be mixed");
	if (isRest && extensionDashes)
		syntaxError(state, "A rest cannot use extension dashes");

	var dots = 0;
	while (state.source[state.index] === ".") {
		dots++;
		state.index++;
	}
	if (dots > 2)
		syntaxError(state, "More than two augmentation dots are not supported");

	return {
		extensionDashes: extensionDashes,
		underlines: underlines,
		dots: dots,
	};
}

function parseEvent(state) {
	var accidentalMark = parseAccidental(state);
	var notes = parseNoteOrChord(state, accidentalMark);
	parseOctave(state, notes);
	var durationMarks = parseDuration(
		state,
		notes.length === 1 && notes[0].number === 0
	);

	var next = state.source[state.index];
	if (next && !/\s/.test(next) && next !== "|" && next !== "[")
		syntaxError(state, "Unexpected character " + JSON.stringify(next));

	return {
		notes: notes,
		durationMarks: durationMarks,
	};
}

function parseBar(state) {
	var symbols = ["|]", "||", "[|", "|"];
	for (var i = 0; i < symbols.length; i++) {
		var symbol = symbols[i];
		if (startsWithAt(state.source, symbol, state.index)) {
			state.index += symbol.length;
			return { type: "bar", barType: BAR_TYPES[symbol] };
		}
	}
	return null;
}

function extractHeader(input) {
	var header = {
		title: "",
		meter: "",
		key: "",
	};
	var musicLines = [];

	String(input).replace(/\r\n?/g, "\n").split("\n").forEach(function(line) {
		var match = line.match(/^\s*([A-Za-z]):\s*(.*?)\s*$/);
		if (!match) {
			musicLines.push(line);
			return;
		}
		switch (match[1].toUpperCase()) {
			case "T": header.title = match[2]; break;
			case "M": header.meter = match[2]; break;
			case "K": header.key = match[2]; break;
			default: break;
		}
	});

	return {
		header: header,
		music: musicLines.join("\n"),
	};
}

/**
 * Parse ABC-inspired numbered notation into the event stream accepted by
 * layoutJianpu.
 *
 * @param {string} input
 * @returns {{
 *   header:{title:string,meter:string,key:string},
 *   elements:Array<Object>,
 *   warnings:Array<string>
 * }}
 */
function parseJianpu(input) {
	var extracted = extractHeader(input);
	var state = {
		source: extracted.music,
		index: 0,
		warnings: [],
	};
	var elements = [];

	while (state.index < state.source.length) {
		skipWhitespace(state);
		if (state.index >= state.source.length)
			break;

		var bar = parseBar(state);
		if (bar) {
			elements.push(bar);
			continue;
		}
		elements.push(parseEvent(state));
	}

	return {
		header: extracted.header,
		elements: elements,
		warnings: state.warnings,
	};
}

parseJianpu.JianpuSyntaxError = JianpuSyntaxError;

module.exports = parseJianpu;
