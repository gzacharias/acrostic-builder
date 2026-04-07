const quotation_elt = document.getElementById('quotation');
const source_elt    = document.getElementById('source');
const unused_letters_elt   = document.getElementById('letters');
const words_container = document.getElementById('words-container');
const words_placeholder = document.getElementById('words-placeholder');
const clue_btn      = document.getElementById('clue-btn');


let clue_mode = false;
function set_clue_mode(on_off) {
  clue_mode = on_off;
  words_container.classList.toggle('clue-mode', clue_mode);
  clue_btn.textContent = (clue_mode ? 'Edit Puzzle' : 'Add Clues');
}

function source_text () { return source_elt.textContent; }

function all_word_rows () { return [...words_container.querySelectorAll('.word-row')] }
function word_initial_elt (row) { return row.querySelector('.word-letter') }
function word_initial (row) { return row.querySelector('.word-letter').textContent }
function word_input_elt (row) { return row.querySelector('.word-input') }
function word_input_text (row) { return row.querySelector('.word-input').textContent }
function full_word_text (row) { return word_initial(row) + word_input_text(row) }
function clue_label_elt (row) { return row.querySelector('.clue-label') }
function clue_label_text (row) {return row.querySelector('.clue-label').textContent }
function clue_input_elt (row) { return row.querySelector('.clue-input') }
function clue_input_text (row) { return row.querySelector('.clue-input').textContent }

function map_to_str (things, fn) { return [...things].map(fn).join(''); }

// Is there really no predefined way to do something like this??
const audio_ctx = new AudioContext();
function beep() {
  const osc = audio_ctx.createOscillator();
  osc.connect(audio_ctx.destination);
  osc.frequency.value = 440;
  osc.start();
  osc.stop(audio_ctx.currentTime + 0.1);
}

function char_if_letter(ch) {
  return /\p{L}/u.test(ch);
}

function letters_of (bag_of_chars) {
  return [...bag_of_chars].filter(char_if_letter).join('').toUpperCase();
}

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
  function walk(node) {
    if (node.nodeType === 3) { // TEXT_NODE
      const len = node.textContent.length;
      if (pos + len >= offset) {
        range.setStart(node, offset - pos);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
      pos += len;
    } else {
      for (const child of node.childNodes)
        if (walk(child)) return true;
    }
    return false;
  }
  walk(elt);
}

function set_input_html (elt, html) {
  const offset = get_cursor_pos(elt);
  elt.innerHTML = html;
  if (offset) set_cursor_pos(elt, offset);
}

function clean_word_input (input) {
  const raw = input.textContent;
  const filtered = letters_of(raw);
  if (filtered !== raw) {
    if (filtered.length !== raw.length) beep(); // means going to ignore something.
    const pos = get_cursor_pos(input);
    // Count how many letters precede the cursor in the original text
    const prefix = [...raw.slice(0, pos ?? raw.length)].filter(char_if_letter).length;
    input.textContent = filtered;
    set_cursor_pos(input, prefix);
  }
}
  
function word_navigation_handler(e, input_getter) {
  const inputs = all_word_rows().map(input_getter);
  const i = inputs.indexOf(e.target);
  if ((e.shiftKey && e.key === 'Enter') || (e.ctrlKey && e.key === 'p')) {
    const prev = inputs[i - 1];
    if (prev) prev.focus();
    e.preventDefault();
  } else if (e.key === 'Enter' || (e.ctrlKey && e.key === 'n')) {
    const next = inputs[i + 1];
    if (next) next.focus();
    e.preventDefault();
  }
}


function make_word_row (index, ch, html) {
  if (clue_mode) debugger;
  const row = document.createElement('div');
  row.className = 'word-row';

  const word_part = document.createElement('div');
  word_part.className = 'word-part';
  word_part.style.flex = '1';

  const initial = document.createElement('span');
  initial.className = 'word-letter';
  initial.textContent = ch;
  word_part.appendChild(initial);

  const word_input = document.createElement('div');
  word_input.style.flex = '1';
  word_input.contentEditable = 'true';
  word_input.className = 'word-input editable';
  word_input.dataset.index = index;
  word_input.setAttribute('placeholder',`enter a word starting with "${ch}"…`);
  word_input.type = 'text';
  word_input.innerHTML = html;
  word_input.addEventListener('input', () => { clean_word_input(word_input); update_letters(); });
  word_input.addEventListener('keydown', e => { word_navigation_handler(e, word_input_elt) });
  word_part.appendChild(word_input);

  row.appendChild(word_part);

  return row;
}

function ensure_clue_part (row) {
  if (!row.querySelector('.clue-part')) {
    const clue_part = document.createElement('div');
    clue_part.className = 'clue-part';
    clue_part.style.flex = '1';
    const label = document.createElement('span');
    label.className = 'clue-label';
    clue_part.appendChild(label);

    const clue_input = document.createElement('div');
    clue_input.contentEditable = 'true';
    clue_input.className = 'clue-input editable';
    clue_input.addEventListener('keydown', e => { word_navigation_handler(e, clue_input_elt) });
    clue_part.appendChild(clue_input);
    row.appendChild(clue_part);
  }
  // Only need to call this when switching to clue mode.  Once in clue mode, the words don't change.
  const full_word = full_word_text(row);
  clue_label_elt(row).textContent = full_word + ":";
  clue_input_elt(row).setAttribute('placeholder', `enter clue for ${full_word}…`);
}


function unused_letters() {
  const used = {};
  for (const ch of letters_of(source_text()) + map_to_str(all_word_rows(), word_input_text))
    used[ch] = (used[ch] ?? 0) + 1;

  const unused = [];
  for (const ch of letters_of(quotation_elt.textContent))
    if (used[ch] > 0) used[ch]--;  else unused.push(ch);

  return unused.sort().join('');
}

function update_letters () {
  if (clue_mode) debugger;
  unused_letters_elt.textContent = unused_letters().match(/(.)\1*/g)?.join(' ') ?? '';
  update_error_markup();
  clue_btn.disabled = !clue_mode && !!(all_word_rows().length == 0 || // hasn't started yet.
                                       unused_letters_elt.textContent || // or there are still unused letters
                                       source_elt.querySelector('.illegal') || // or there are illegal chars in source
                                       words_container.querySelector('.illegal')); // or words.

}

function rebuild_words() {
  if (clue_mode) debugger;
  const new_source = source_text();
  if (!new_source) {
    words_container.innerHTML = '';
    words_container.appendChild(words_placeholder);
    return;
  }
  const new_initials = letters_of(new_source);

  const existing_words = all_word_rows();
  if (new_initials === map_to_str(existing_words, word_initial))
    return;
  const existing_map = {};
  for (const word of existing_words) {
    const ch = word_initial(word);
    if (!existing_map[ch]) existing_map[ch] = [];
    existing_map[ch].push(word_input_text(word));
  }

  words_container.innerHTML = '';

  for (let i = 0; i < new_initials.length; i++) {
    const ch = new_initials[i];
    const text = existing_map[ch]?.shift() ?? '';
    words_container.appendChild(make_word_row(i, ch, text));
  }
}

source_elt.addEventListener('input', () => { rebuild_words(); update_letters(); });

quotation_elt.addEventListener('input', update_letters);


// --------------------- Illegal Char Handling -----------------------------------------------------------
function update_error_markup () {
  const available_letters = {};
  for (const ch of letters_of(quotation_elt.textContent)) available_letters[ch] = (available_letters[ch] ?? 0) + 1;

  function char_html (ch) {
    if (char_if_letter(ch)) {
      const upper_ch = ch.toUpperCase();
      if (available_letters[upper_ch] > 0) {
        available_letters[upper_ch]--;
        return ch;
      }
      else
        return `<span class="illegal">${ch}</span>`;
    }
    else return null;
  }

  // Render source, and record state for use in word initials
  const source_states = [];
  const source_html = map_to_str(source_text(),
                                 ch => { const text = char_html(ch);
                                         if (text) source_states.push(text.length > 1); // save for letters only.
                                         return text ?? ch });

  for (const word of all_word_rows()) {
    word_initial_elt(word).classList.toggle('illegal', source_states.shift());
    const word_html = map_to_str(word_input_text(word), ch => char_html(ch) ?? ch);
    set_input_html(word_input_elt(word), word_html);
  }

  // Do this last so it doesn't disturb the cursor in any word input.
  set_input_html(source_elt, source_html);
}

// --------------------- Clue Mode -----------------------------------------------------------

let clues_table = {}; // maps full word to clue.  gets rebuild when load a puzzle, hence the LET
function save_clues_from_ui () {
  for (const row of all_word_rows()) {
    clue = clue_input_text(row);
    if (clue) clues_table[clue_label_text(row)] = clue;
  }
}
function fetch_saved_clue (row) { return clues_table[clue_label_text(row)] ?? '' }


function toggle_clue_mode () {
  if (clue_mode) {
    // Save clues from UI before switching, because now will mess around and recreate all the rows.
    save_clues_from_ui();
    // Unfreeze quotation and source.  Since everything was frozen, no need to update anything.
    quotation_elt.contentEditable = 'true';
    source_elt.contentEditable = 'true';
  } else {
    // Freeze quotation and source
    quotation_elt.contentEditable = 'false';
    source_elt.contentEditable = 'false';
    // Initialize clues.
    const rows = all_word_rows();
    for (const row of all_word_rows()) {
      ensure_clue_part(row);
      clue_input_elt(row).textContent = fetch_saved_clue(row);
    }
  }
  set_clue_mode(!clue_mode);
}

clue_btn.addEventListener('click', toggle_clue_mode);



// --------------------- Buttons -----------------------------------------------------------

///  Save
function get_puzzle_data() {
  if (clue_mode) save_clues_from_ui();
  return {
    quotation: quotation_elt.textContent,
    source: source_text(),
    words: all_word_rows().map(word_input_text),
    clues: clues_table
  };
}

if (window.webkit?.messageHandlers?.save)
  document.getElementById('save-btn').addEventListener('click', () => {
    const json = JSON.stringify(get_puzzle_data(), null, 2);
    window.webkit.messageHandlers.save.postMessage(json);
  })
else
  document.getElementById('save-btn').addEventListener('click', () => {
    const json = JSON.stringify(get_puzzle_data(), null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    a.download = 'acrostic.acr';
    a.click();
  });

/// Load
function load_puzzle_data(data) {
  if (clue_mode) toggle_clue_mode();

  clues_table = data.clues ?? {};
  quotation_elt.textContent = data.quotation;
  source_elt.innerHTML = data.source;
  rebuild_words();
  const rows = all_word_rows();
  if (data.words.length !== rows.length)
    alert(`Bad file: expected ${rows.length} words, got ${data.words.length}`);
  else
    data.words.forEach((val, i) => { word_input_elt(rows[i]).textContent = val; });
  update_letters();
}

if (window.webkit?.messageHandlers?.load)
  document.getElementById('load-btn').addEventListener('click', () => {
    window.webkit.messageHandlers.load.postMessage(''); });
else
  document.getElementById('load-btn').addEventListener('click', () => {
    document.getElementById('file-input').click(); });


document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => load_puzzle_data(JSON.parse(e.target.result));
  reader.readAsText(file);
  e.target.value = '';  // reset so same file can be loaded again
});

/// Restart
function restart_puzzle() {
  if (!confirm('Start a new puzzle? Unsaved changes will be lost.')) return;
  quotation_elt.textContent = '';
  source_elt.innerHTML = '';
  rebuild_words();
  update_letters();
}

document.getElementById('restart-btn').addEventListener('click', restart_puzzle);

/// Quit

if (!window.webkit?.messageHandlers?.quit)
  document.getElementById('quit-btn').style.display = 'none';
else
  document.getElementById('quit-btn').addEventListener('click', () => {
    window.webkit.messageHandlers.quit.postMessage('')});

                                                       
