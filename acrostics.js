const quotation_elt = document.getElementById('quotation');
const source_elt    = document.getElementById('source');
const letters_elt   = document.getElementById('letters');
const words_elt     = document.getElementById('words-container');

const words_placeholder = document.getElementById('words-placeholder');

function all_words () { return [...words_elt.querySelectorAll('.word-row')] }
function word_initial_elt (row) { return row.querySelector('.word-letter') }
function word_initial (row) { return row.querySelector('.word-letter').textContent }
function word_input (row) { return row.querySelector('.word-input') }
function word_text (row) { return row.querySelector('.word-input').textContent }

function get_cursor_pos(elt) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!elt.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(elt);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

function set_cursor_pos(elt, offset) {
  const sel = window.getSelection();
  const range = document.createRange();
  let pos = 0;
  for (const node of elt.childNodes) {
    const len = node.textContent.length;
    if (pos + len >= offset) {
      range.setStart(node.nodeType === 3 ? node : node.firstChild ?? node, offset - pos);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    pos += len;
  }
}

function set_input_html (elt, html) {
  const offset = get_cursor_pos(elt);
  elt.innerHTML = html;
  if (offset) set_cursor_pos(elt, offset);
}

function make_word_elt (index, ch, html) {
  const row = document.createElement('div');
  row.className = 'word-row';

  const initial = document.createElement('span');
  initial.className = 'word-letter';
  initial.textContent = ch;
  row.appendChild(initial);

  const input_container = document.createElement('div');
  input_container.style.position = 'relative';
  input_container.style.flex = '1';
  
  const input = document.createElement('div');
  input.contentEditable = 'true';
  input.type = 'text';
  input.className = 'word-input';
  input.dataset.index = index;
  input.placeholder = ` word starting with "${ch}"…`;
  input.innerHTML = html;

  input.addEventListener('input', update_letters);

  input.addEventListener('keydown', e => {
    if ((e.shiftKey && e.key === 'Enter') || (e.ctrlKey && e.key === 'p')) {
      const inputs = all_words().map(word_input);
      const i = inputs.indexOf(e.target);
      const prev = inputs[i - 1];
      if (prev) prev.focus();
      e.preventDefault();
    } else if (e.key === 'Enter' || (e.ctrlKey && e.key === 'n')) {
      const inputs = all_words().map(word_input);
      const i = inputs.indexOf(e.target);
      const next = inputs[i + 1];
      if (next) next.focus();
      e.preventDefault();
    }});

  input_container.appendChild(input);

/*
  const display = document.createElement('div');
  display.className = 'word-display';
  input.display = display;
  display.addEventListener('click', () => input.focus());

  input_container.appendChild(display);
*/

  row.appendChild(input_container);

  return row;
}



// Is there really no predefined way to do something like this??
function beep() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.frequency.value = 440;
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}


function char_if_letter(ch) {
  return /\p{L}/u.test(ch);
}

function letters_of (bag_of_chars) {
  return [...bag_of_chars].filter(char_if_letter).join('').toUpperCase();
}

function unused_letters() {
  const used = {};
  for (const ch of letters_of(source_elt.value + all_words().map(word_text).join('')))
    used[ch] = (used[ch] ?? 0) + 1;

  const unused = [];
  for (const ch of letters_of(quotation_elt.value))
    if (used[ch] > 0) used[ch]--;  else unused.push(ch);

  return unused.sort().join('');
}

function update_letters () {
  letters_elt.textContent = unused_letters().match(/(.)\1*/g)?.join(' ') ?? '';
  update_words_markup();
}

function rebuild_words() {
  const new_source = source_elt.value;
  if (!new_source) {
    words_elt.innerHTML = '';
    words_elt.appendChild(words_placeholder);
    return;
  }
  const new_initials = letters_of(new_source);

  const existing_words = all_words();
  if (new_initials === existing_words.map(word_initial).join(''))
    return;
  const existing_map = {};
  for (const word of existing_words) {
    const ch = word_initial(word);
    if (!existing_map[ch]) existing_map[ch] = [];
    existing_map[ch].push(word_text(word));
  }

  words_elt.innerHTML = '';

  for (let i = 0; i < new_initials.length; i++) {
    const ch = new_initials[i];
    const text = existing_map[ch]?.shift() ?? '';
    words_elt.appendChild(make_word_elt(i, ch, text));
  }
}

source_elt.addEventListener('input', () => { rebuild_words(); update_letters(); });

quotation_elt.addEventListener('input', update_letters);



// --------------------- Illegal Char Handling -----------------------------------------------------------
function update_words_markup () {
  const available_letters = {};
  for (const ch of letters_of(quotation_elt.value)) available_letters[ch] = (available_letters[ch] ?? 0) + 1;

  function check_illegal (ch) {
    ch = ch.toUpperCase();
    if (available_letters[ch] > 0) {
      available_letters[ch]--;
      return false;
    }
    else return true;
  }

  function render_char (ch) {
    return (char_if_letter(ch) && check_illegal(ch)) ? `<span class="illegal">${ch}</span>` : ch;


  }

  for (const word of all_words()) {
    word_initial_elt(word).classList.toggle('illegal', check_illegal(word_initial(word)));
    set_input_html(word_input(word), [...word_text(word)].map(render_char).join(''));
  }

}

// ---------------------Save & Restore -----------------------------------------------------------

function get_puzzle_data() {
  return {
    quotation: quotation_elt.value,
    source: source_elt.value,
    words: all_words().map(word_text)
  };
}

function load_puzzle_data(data) {
  quotation_elt.value = data.quotation;
  console.log('Quotation_elt',  quotation_elt);
  source_elt.value = data.source;
  rebuild_words();
  const rows = all_words();
  if (data.words.length !== rows.length)
    alert(`Bad file: expected ${rows.length} words, got ${data.words.length}`);
  else
    data.words.forEach((val, i) => { word_input(rows[i]).textContent = val; });
  update_letters();
}

document.getElementById('save-btn').addEventListener('click', () => {
  const json = JSON.stringify(get_puzzle_data(), null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  a.download = 'acrostic.acr';
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
  e.target.value = '';  // reset so same file can be loaded again
});
