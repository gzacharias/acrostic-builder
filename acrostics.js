// TODO: don't allow unavailable leetters in title!

const quotation_elt = document.getElementById('quotation');
const source_elt    = document.getElementById('source');
const letters_elt   = document.getElementById('letters');
const words_elt     = document.getElementById('words-container');

// Is there really no predefined way to do something like this??
function beep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.frequency.value = 440;
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}



function filter_str(thing, fn) { return [...thing].filter(fn).join(''); }

function map_str(thing, fn) { return [...thing].map(fn).join(''); }


function letters_of (str) {
  return filter_str(str, ch => /\p{L}/u.test(ch)).toUpperCase();
}

function unused_letters() {
  const source = source_elt.value;
  const words = map_str(words_elt.querySelectorAll('.word-input'), inp => inp.value);
  const used = {};
  for (const ch of letters_of (source+words))
    used[ch] = (used[ch] ?? 0) + 1;

  const unused = [];
  for (const ch of letters_of(quotation_elt.value))
    if (used[ch] > 0) used[ch]--;  else unused.push(ch);

  return unused.sort().join('');
}

function update_letters () {
  letters_elt.textContent = unused_letters().match(/(.)\1*/g)?.join(' ') ?? '';
}

function rebuild_words() {
  const source = source_elt.value;
  if (!source) {
    words_elt.innerHTML = '';
    words_elt.appendChild(document.getElementById('words-placeholder'));
    return;
  }

  const initials = letters_of(source);
  const words = [...words_elt.querySelectorAll('.word-row')];
  if (initials === words.map(row => row.querySelector('.word-letter').textContent).join(''))
    return;


  const existing = {};
  for (const row  of words) {
    const ch = row.querySelector('.word-letter').textContent;
    const text = row.querySelector('.word-input').value;
    if (!existing[ch]) existing[ch] = [];
    existing[ch].push(text)
  }

  words_elt.innerHTML = '';

  for (let i = 0; i < initials.length; i++) {
    const ch = initials[i];

    const row = document.createElement('div');
    row.className = 'word-row';

    const initial = document.createElement('span');
    initial.className = 'word-letter';
    initial.textContent = ch;
    row.appendChild(initial);

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'word-input';
    inp.dataset.index = i;
    inp.placeholder = ` word starting with "${ch}"…`;
    // Find first unused prior word with the same letter
    inp.value = existing[ch]?.shift() ?? '';

    inp.addEventListener('input', update_letters);
    // Navigation
    inp.addEventListener('keydown', e => {
      if ((e.shiftKey && e.key === 'Enter') || (e.ctrlKey && e.key === 'p')) {
        const inputs = [...words_elt.querySelectorAll('.word-input')];
        const i = inputs.indexOf(e.target);
        const prev = inputs[i - 1];
        if (prev) prev.focus();
        e.preventDefault();
      } else if (e.key === 'Enter' || (e.ctrlKey && e.key === 'n')) {
        const inputs = [...words_elt.querySelectorAll('.word-input')];
        const i = inputs.indexOf(e.target);
        const next = inputs[i + 1];
        if (next) next.focus();
        e.preventDefault();
      }});

    // error checking
    inp.addEventListener('beforeinput', e => {
      if (!e.data) return;  // deletion, paste, etc. — let it through for now
      const unused = unused_letters();
      for (const ch of letters_of(e.data)) {
        if (!unused.includes(ch)) {

          //letters_elt.style.backgroundColor = 'pink';
          //setTimeout(() => letters_elt.style.backgroundColor = '', 300);
          letters_elt.style.color = 'red';
          setTimeout(() => letters_elt.style.color = '', 300);
          beep();
          e.preventDefault();
          return;
        }}});

    row.appendChild(inp);

    words_elt.appendChild(row);
  }
}


source_elt.addEventListener('input', () => { rebuild_words(); update_letters(); });

quotation_elt.addEventListener('input', update_letters);




// ---------------------Save & Restore -----------------------------------------------------------

function get_puzzle_data() {
  return {
    quotation: quotation_elt.value,
    source: source_elt.value,
    words: [...words_elt.querySelectorAll('.word-input')].map(inp => inp.value)
  };
}

function load_puzzle_data(data) {
  quotation_elt.value = data.quotation;
  source_elt.value = data.source;
  rebuild_words();
  const inputs = [...words_elt.querySelectorAll('.word-input')];
  data.words.forEach((val, i) => { if (inputs[i]) inputs[i].value = val; });
  update_letters();
}

document.getElementById('save-btn').addEventListener('click', () => {
  const json = JSON.stringify(get_puzzle_data(), null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  a.download = 'acrostic.json';
  a.click();
});

document.getElementById('load-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => load_puzzle_data(JSON.parse(e.target.result));
  reader.readAsText(file);
});
