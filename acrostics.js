const quotation_elt = document.getElementById('quotation');
const author_elt    = document.getElementById('author');
const letters_elt   = document.getElementById('letters');
const answers_elt   = document.getElementById('answers-container');

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
  const author = author_elt.value;
  const answers = map_str(answers_elt.querySelectorAll('.answer-input'), inp => inp.value);
  const used = {};
  for (const ch of letters_of (author+answers))
    used[ch] = (used[ch] ?? 0) + 1;

  const unused = [];
  for (const ch of letters_of(quotation_elt.value))
    if (used[ch] > 0) used[ch]--;  else unused.push(ch);

  return unused.sort().join('');
}

function update_letters () {
  letters_elt.textContent = unused_letters().match(/(.)\1*/g)?.join(' ') ?? '';
}

function rebuild_answers() {
  const author = author_elt.value;
  if (!author) {
    answers_elt.innerHTML = '<span id="answers-placeholder">Answers appear here once an author is entered.</span>';
    return;
  }

  const initials = letters_of(author);
  const answers = [...answers_elt.querySelectorAll('.answer-row')];
  if (initials === answers.map(row => row.querySelector('.answer-letter').textContent).join(''))
    return;


  const existing = {};
  for (const row  of answers) {
    const ch = row.querySelector('.answer-letter').textContent;
    const text = row.querySelector('.answer-input').value;
    if (!existing[ch]) existing[ch] = [];
    existing[ch].push(text)
  }

  answers_elt.innerHTML = '';

  for (let i = 0; i < initials.length; i++) {
    const ch = initials[i];

    const row = document.createElement('div');
    row.className = 'answer-row';

    const initial = document.createElement('span');
    initial.className = 'answer-letter';
    initial.textContent = ch;
    row.appendChild(initial);

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'answer-input';
    inp.dataset.index = i;
    inp.placeholder = ` answer starting with "${ch}"…`;
    // Find first unused prior answer with the same letter
    inp.value = existing[ch]?.shift() ?? '';

    inp.addEventListener('input', update_letters);
    // Navigation
    inp.addEventListener('keydown', e => {
      if ((e.shiftKey && e.key === 'Enter') || (e.ctrlKey && e.key === 'p')) {
        const inputs = [...answers_elt.querySelectorAll('.answer-input')];
        const i = inputs.indexOf(e.target);
        const prev = inputs[i - 1];
        if (prev) prev.focus();
        e.preventDefault();
      } else if (e.key === 'Enter' || (e.ctrlKey && e.key === 'n')) {
        const inputs = [...answers_elt.querySelectorAll('.answer-input')];
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

    answers_elt.appendChild(row);
  }
}


author_elt.addEventListener('input', () => { rebuild_answers(); update_letters(); });

quotation_elt.addEventListener('input', update_letters);




// ---------------------Save & Restore -----------------------------------------------------------

function get_puzzle_data() {
  return {
    quotation: quotation_elt.value,
    author: author_elt.value,
    answers: [...answers_elt.querySelectorAll('.answer-input')].map(inp => inp.value)
  };
}

function load_puzzle_data(data) {
  quotation_elt.value = data.quotation;
  author_elt.value = data.author;
  rebuild_answers();
  const inputs = [...answers_elt.querySelectorAll('.answer-input')];
  data.answers.forEach((val, i) => { if (inputs[i]) inputs[i].value = val; });
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
