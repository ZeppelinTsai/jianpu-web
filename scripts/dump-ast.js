// 用法: node scripts/dump-ast.js
// 直接使用 abcjs 的 parser (不經過 renderer),把 Tune AST 印出來。

var Parse = require('../src/parse/abc_parse');

// 一段簡單的 ABC 譜:C 大調、4/4、一小節四分音符 do-re-mi-fa,
// 第二小節有一個八分音符 beam、一個附點、一個休止符、一個和弦、一個升記號。
var abc = [
	'X:1',
	'T:Test Tune',
	'M:4/4',
	'L:1/4',
	'K:C',
	'C D E F | G2 A/B/ z | [CEG] ^F2 |]',
].join('\n');

var parser = new Parse();
parser.parse(abc);
var tune = parser.getTune();

// 為了看清楚 note 的結構,寫一個精簡的走訪器,只列出音樂事件。
function summarize(tune) {
	console.log('=== 精簡摘要 (只列音樂事件) ===');
	tune.lines.forEach(function (line, li) {
		if (!line.staff) {
			console.log('line ' + li + ': (非五線譜行) ' + JSON.stringify(Object.keys(line)));
			return;
		}
		line.staff.forEach(function (staff, si) {
			console.log('line ' + li + ' / staff ' + si +
				'  clef=' + (staff.clef && staff.clef.type) +
				'  key=' + JSON.stringify(staff.key && staff.key.accidentals) +
				'  meter=' + JSON.stringify(staff.meter));
			staff.voices.forEach(function (voice, vi) {
				console.log('  voice ' + vi + ':');
				voice.forEach(function (el) {
					if (el.el_type === 'note') {
						if (el.rest) {
							console.log('    rest        dur=' + el.duration + '  type=' + el.rest.type);
						} else {
							var ps = el.pitches.map(function (p) {
								return p.name + '(pitch=' + p.pitch + ',vPos=' + p.verticalPos +
									(p.accidental ? ',' + p.accidental : '') + ')';
							}).join(' + ');
							console.log('    note dur=' + el.duration +
								(el.startBeam ? ' [startBeam]' : '') +
								(el.endBeam ? ' [endBeam]' : '') +
								'  ' + ps);
						}
					} else {
						console.log('    ' + el.el_type + '  ' + JSON.stringify(
							Object.keys(el).filter(function (k) { return k !== 'el_type'; })
								.reduce(function (o, k) { o[k] = el[k]; return o; }, {})));
					}
				});
			});
		});
	});
}

summarize(tune);

console.log('\n=== metaText ===');
console.log(JSON.stringify(tune.metaText, null, 2));

console.log('\n=== 完整 AST (tune.lines) ===');
console.log(JSON.stringify(tune.lines, null, 2));
