const ABCJS = require("./index.js");
const abc = [
  "X:1",
  "T:小跑步間奏練習",
  "C:ZeppelinTsai",
  "M:3/4",
  "L:1/4",
  "K:C",
  "Q:120",
  'V:1 clef=treble name="Melody"',
  "[V:1]",
  '"C"EFG|GGG|"F"ABc|cc c|',
  '"C"cBA|GGG|"G7"cBA|FFF|',
  '"Am"ABc|AAA|"C"CB,A,|B,CC|',
  '|1"F"CDE|DED|D3-|D3:|',
  '|2"F"CDG,|DEF|"F"EED|D3|]',
].join("\n");
const tune = ABCJS.parseOnly(abc);
const seq = ABCJS.synth.sequence(tune);
console.log(JSON.stringify(seq[0], null, 2));
