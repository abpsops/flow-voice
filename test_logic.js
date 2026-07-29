const fs = require('fs');
const html = fs.readFileSync('/home/claude/build/flow-voice-agent/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- fake DOM ----
const ROB = {}; // id -> value string
const CFG = {}; // id -> value string (rates/caps)
global.window = { speechSynthesis: { onvoiceschanged: null, getVoices: () => [] }, devicePixelRatio: 1 };
global.document = {
  getElementById: (id) => {
    if (ROB[id] !== undefined) return { value: ROB[id] };
    if (CFG[id] !== undefined) return { value: CFG[id] };
    return null;
  },
  addEventListener: () => {} // DOMContentLoaded hook - not needed for these unit tests
};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const sandbox = {};
const vm = require('vm');
const ctx = vm.createContext(Object.assign({ console, window: global.window, document: global.document, localStorage: global.localStorage, Math, Date, Array, Object, JSON, Set }, sandbox));
vm.runInContext(script, ctx);

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('PASS:', name); }
  else { fail++; console.log('FAIL:', name); }
}

// Helper: `let`/`const` declared at the top level of a vm script are NOT
// exposed as properties on the context object, so ctx.ops = [...] would
// silently create an unrelated property instead of touching the real
// lexical `ops`/`pendingSequence` bindings. Run real assignment
// statements back through the same context instead.
function setVar(name, value) {
  ctx.__tmp = value;
  vm.runInContext(`${name} = __tmp;`, ctx);
}
function getVar(name) {
  return vm.runInContext(name, ctx);
}
function call(name, ...args) {
  ctx.__args = args;
  return vm.runInContext(`${name}(...__args)`, ctx);
}

// ==== 1. Date parser regression (from README's 26-case claim) ====
const parseDT = ctx.parseDT;
const cases = [
  ['25th August', d => d.getMonth() === 7 && d.getDate() === 25],
  ['25 TH AUG', d => d.getMonth() === 7 && d.getDate() === 25],
  ['August 25th', d => d.getMonth() === 7 && d.getDate() === 25],
  ['August 25', d => d.getMonth() === 7 && d.getDate() === 25],
  ['tomorrow', d => { const t = new Date(); t.setDate(t.getDate()+1); return d.getDate() === t.getDate(); }],
  ['25th Aug at 2pm', d => d.getMonth() === 7 && d.getDate() === 25 && d.getHours() === 14],
  ['garbage nonsense text', d => d === null],
  ['2pm', d => d.getHours() === 14],
];
cases.forEach(([input, check]) => {
  const d = parseDT(input);
  assert(`parseDT(${JSON.stringify(input)})`, check(d));
});

// ==== 2. Per-barge ops isolation (the bug fix) ====
setVar('ops', [
  { vessel: 'ALPHA', barge: 'FNSA 10', start: new Date(Date.now()+3600000), etc: new Date(Date.now()+7200000), vQty: 100, mQty: 0, port: 'FUJ' },
  { vessel: 'BETA',  barge: 'FNSA 11', start: new Date(Date.now()+3600000), etc: new Date(Date.now()+7200000), vQty: 50,  mQty: 0, port: 'FUJ' },
]);
const opsFor10 = call('opsForBarge', 'FNSA 10');
const opsFor11 = call('opsForBarge', 'FNSA 11');
assert('opsForBarge FNSA 10 only sees its own op', opsFor10.length === 1 && opsFor10[0].vessel === 'ALPHA');
assert('opsForBarge FNSA 11 only sees its own op', opsFor11.length === 1 && opsFor11[0].vessel === 'BETA');

// unassigned op should show up for both (conservative default)
const opsWithGamma = getVar('ops').concat([{ vessel: 'GAMMA', barge: null, start: new Date(Date.now()+3600000), etc: new Date(Date.now()+7200000), vQty: 20, mQty: 0, port: null }]);
setVar('ops', opsWithGamma);
assert('unassigned op is conservatively counted for both barges', call('opsForBarge','FNSA 10').some(o=>o.vessel==='GAMMA') && call('opsForBarge','FNSA 11').some(o=>o.vessel==='GAMMA'));

// ==== 3. runFeasibilityCheck doesn't cross-block barges ====
// Reset ops: FNSA 10 fully booked around the requested time; FNSA 11 free.
// Set up minimal DOM stubs consumed by getBargeConfig / getROB / addBubble/etc.
global.document.createElement = () => ({ classList:{add(){},remove(){}}, appendChild(){}, });
ctx.document = ctx.document || global.document;

// capture spoken output
let lastSpeech = null;
setVar('addBubble', (role, text) => { lastSpeech = text; });
setVar('addResultBubble', (feasible, html) => { lastSpeech = { feasible, html }; });
setVar('speak', (t) => {});

const reqDate = new Date(); reqDate.setDate(reqDate.getDate()+2); reqDate.setHours(10,0,0,0);
setVar('ops', [
  { vessel: 'BLOCKER', barge: 'FNSA 10', start: new Date(reqDate.getTime()-3600000), etc: new Date(reqDate.getTime()+3*3600000), vQty: 100, mQty: 0, port: 'FUJ' },
]);
ROB['rob-fnsa10-v'] = '900';
ROB['rob-fnsa11-v'] = '900';
const dateText = `${reqDate.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][reqDate.getMonth()]} ${reqDate.getFullYear()} ${String(reqDate.getHours()).padStart(2,'0')}:00`;
call('runFeasibilityCheck', { qty: 200, fuel: 'VLSFO', dateTimeText: dateText, barge: null, port: null });
assert('feasible answer picks FNSA 11 (not blocked by FNSA 10 commitment)', lastSpeech && lastSpeech.feasible === true && lastSpeech.html.includes('FNSA 11'));

// ==== 4. Stock shortfall triggers pendingSequence, not a silent guess ====
setVar('ops', []);
ROB['rob-fnsa10-v'] = '50';
ROB['rob-fnsa11-v'] = '50';
lastSpeech = null;
call('runFeasibilityCheck', { qty: 500, fuel: 'VLSFO', dateTimeText: dateText, barge: 'FNSA 10', port: null });
const ps1 = getVar('pendingSequence');
assert('stock shortfall sets pendingSequence instead of silently declining', ps1 !== null && ps1.barge === 'FNSA 10');
assert('shortfall response asks before/after', lastSpeech && /before/i.test(lastSpeech.html) && /after/i.test(lastSpeech.html));

// resolve as "before" -> should now have full rawROB (50) which is still short of 500
call('resolveSequence', 'before');
assert('pendingSequence cleared after resolve', getVar('pendingSequence') === null);

// Now test a shortfall that DOES resolve positively when answered "before"
setVar('ops', [
  { vessel: 'EARLYJOB', barge: 'FNSA 10', start: new Date(Date.now()+3600000), etc: new Date(Date.now()+2*3600000), vQty: 400, mQty: 0, port: 'FUJ' },
]);
ROB['rob-fnsa10-v'] = '500';
lastSpeech = null;
const req2 = new Date(); req2.setDate(req2.getDate()+5); req2.setHours(9,0,0,0);
const dateText2 = `${req2.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][req2.getMonth()]} ${req2.getFullYear()} 09:00`;
call('runFeasibilityCheck', { qty: 300, fuel: 'VLSFO', dateTimeText: dateText2, barge: 'FNSA 10', port: null });
assert('shortfall #2 correctly triggers (EARLYJOB ahead of it eats ROB)', getVar('pendingSequence') !== null);
lastSpeech = null;
call('resolveSequence', 'before');
assert('answering BEFORE gives full rawROB (500 >= 300) -> feasible', lastSpeech && lastSpeech.feasible === true);


// ==== 5. Zero-ROB barge is excluded outright, never offered/cited ====
setVar('ops', []);
ROB['rob-fnsa10-v'] = '0';
ROB['rob-fnsa11-v'] = '600';
lastSpeech = null;
call('runFeasibilityCheck', { qty: 200, fuel: 'VLSFO', dateTimeText: dateText, barge: null, port: null });
assert('zero-ROB FNSA 10 never appears as the answer', lastSpeech && lastSpeech.feasible === true && lastSpeech.html.includes('FNSA 11') && !lastSpeech.html.includes('FNSA 10'));

// both zero -> plain "nothing to work with" message, not a crash/guess
ROB['rob-fnsa10-v'] = '0';
ROB['rob-fnsa11-v'] = '0';
lastSpeech = null;
call('runFeasibilityCheck', { qty: 200, fuel: 'VLSFO', dateTimeText: dateText, barge: null, port: null });
assert('both barges zero-ROB -> clean message, not a false answer', typeof lastSpeech === 'string' && /0 MT/.test(lastSpeech));

// zero-ROB barge excluded from split-supply candidates too
ROB['rob-fnsa10-v'] = '0';
ROB['rob-fnsa11-v'] = '5000';
CFG['cap-fnsa10-v']='4000'; CFG['cap-fnsa11-v']='4000';
const splitResult = call('trySplitSupply', 'VLSFO', 3000, reqDate);
assert('split-supply returns null when only one barge has any stock', splitResult === null);

// ==== 6. "sir" is worked into spoken/displayed responses ====
const addSir = ctx.addSir;
assert('addSir appends to a statement', addSir('That works.') === 'That works, sir.');
assert('addSir inserts before a question mark', addSir('Before or after?') === 'Before or after, sir?');
assert('addSir does not double up if already present', addSir('Yes sir, that works.') === 'Yes sir, that works.');

ROB['rob-fnsa10-v'] = '900'; ROB['rob-fnsa11-v'] = '900';
setVar('ops', []);
lastSpeech = null;
call('runFeasibilityCheck', { qty: 200, fuel: 'VLSFO', dateTimeText: dateText, barge: 'FNSA 10', port: null });
assert('feasible spoken response addresses the user as sir', lastSpeech && lastSpeech.feasible === true && /sir/i.test(lastSpeech.html));


// ==== 7. Exact bug from the screenshot: a barge with ZERO ops on the
// schedule must never be reported as "booked" — false conflicts can only
// come from another barge's ops leaking across, which per-barge
// filtering should prevent entirely. ====
ROB['rob-fnsa10-v'] = '900'; ROB['rob-fnsa11-v'] = '900';
setVar('ops', [
  // FNSA 10 is fully booked across the requested window; FNSA 11 has
  // NO ops at all attributed to it.
  { vessel: 'BUSY_SHIP', barge: 'FNSA 10', start: new Date(req2.getTime()-3600000), etc: new Date(req2.getTime()+5*3600000), vQty: 500, mQty: 0, port: 'FUJ' },
]);
lastSpeech = null;
call('runFeasibilityCheck', { qty: 250, fuel: 'VLSFO', dateTimeText: dateText2, barge: null, port: null });
assert('barge with zero ops is never reported as booked/delayed', lastSpeech && lastSpeech.feasible === true && lastSpeech.html.includes('FNSA 11') && !/booked/i.test(lastSpeech.html));

// ==== 8. Add/remove barge ====
const beforeLen = getVar('BARGE_NAMES').length;
const names = getVar('BARGE_NAMES');
names.push('FNSA 12');
assert('BARGE_NAMES accepts a new barge (in place mutation)', getVar('BARGE_NAMES').length === beforeLen + 1 && getVar('BARGE_NAMES').includes('FNSA 12'));
CFG['cap-fnsa12-v'] = '4000';
ROB['rob-fnsa10-v'] = '3000'; ROB['rob-fnsa11-v'] = '3000'; ROB['rob-fnsa12-v'] = '3000';
const splitWithThree = call('trySplitSupply', 'VLSFO', 5000, reqDate);
assert('split-supply can use a 3rd barge once added', splitWithThree !== null);
// remove it again
const idx = getVar('BARGE_NAMES').indexOf('FNSA 12');
vm.runInContext(`BARGE_NAMES.splice(${idx}, 1)`, ctx);
assert('BARGE_NAMES correctly shrinks after removal', !getVar('BARGE_NAMES').includes('FNSA 12'));

console.log(`\n${pass} passed, ${fail} failed (final)`);
process.exit(fail ? 1 : 0);
