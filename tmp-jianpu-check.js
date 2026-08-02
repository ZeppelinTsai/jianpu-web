const ABCJS = require('./index.js');
const jianpu = require('./src/jianpu');
const abc = [
  'X:1',
  'T:小跑步間奏練習',
  'C:ZeppelinTsai',
  'M:3/4',
  'L:1/4',
  'K:C',
  'Q:120',
  'V:1 clef=treble name="Melody"',
  '[V:1]',
  '"C"EFG|GGG|"F"ABc|cc c|',
  '"C"cBA|GGG|"G7"cBA|FFF|',
  '"Am"ABc|AAA|"C"CB,A,|B,CC|',
  '|1"F"CDE|DED|D3-|D3:|',
  '|2"F"CDG,|DEF|"F"EED|D3|]',
].join('\n');
const result = jianpu.fromAbc(abc, { staffWidth: 1400 }, ABCJS.parseOnly);
console.log(JSON.stringify({
  warnings: result.warnings,
  lines: result.layout.lines.map(function(line) {
    return {
      voltas: (line.voltaBrackets || []).map(function(bracket) { return { label: bracket.label }; }),
      measures: line.measures.map(function(measure) {
        return {
          endingBar: measure.endingBar && {
            type: measure.endingBar.type,
            startEnding: measure.endingBar.startEnding,
            endEnding: measure.endingBar.endEnding,
          },
          events: measure.events.length,
        };
      }),
    };
  }),
}, null, 2));
