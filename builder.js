// TODO: Allow Edit Clues even if puzzle is not complete, as long as there are some words.
// TODO switch to setAttribute('placeholder') for word_container
// TODO: in ok_to__discard, don't confirm if no changes since last save.
// TODO: Removme save/load handlers in XCode
// TODO: Check if file changed since last save/load.  Maybe have a puzzle.change_count


const puzzle_name_elt = document.getElementById('puzzle-name');
const quotation_elt = document.getElementById('quotation');
const source_elt    = document.getElementById('source');
const unused_letters_elt   = document.getElementById('letters');
const words_container = document.getElementById('words-container');
const words_placeholder = document.getElementById('words-placeholder');
const clue_btn      = document.getElementById('clue-btn');
const save_btn      = document.getElementById('save-btn');
const load_btn      = document.getElementById('load-btn');

const Puzzle = { clue_mode: false,
                 saved_clues: [], // null when in clue mode, array in edit mode
                 persistent_name: null, // last saved/loaded name
                 last_autosave: null,
                 username: null,
                 uuid: null,
               };

function puzzle_name () { return puzzle_name_elt.value.trim(); }

function puzzle_is_empty () { return quote_text() === '' && source_text() === '' }

function source_text () { return source_elt.textContent; }
function quote_text () { return quotation_elt.textContent; }

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

quotation_elt.addEventListener('input', quote_changed);
source_elt.addEventListener('input', source_changed);


// --------------------------------- word/clue rows -------------------------------------------------------------------

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

function word_change_handler (input) {
  // Spaces seem to all be non-breaking spaces
  function legal_char (ch) { return is_letter(ch) || ch === '-' || ch === ' ' || ch == '\u00A0'; };
  function count_illegal (str, start, end) {
    let n = 0;
    for (let i= start; i < end; i++) if (!legal_char(str[i])) ++n;
    return n;
  };
                                   
  const raw = input.textContent;
  const selection = get_selection();
  const filtered = [...raw].filter(legal_char).join('');
  if (filtered !== raw) {
    beep(); // we're going to ignore something they just typed
    set_input_text(input, filtered);
    if (selection?.element === input) {
      const bef_sel = count_illegal(raw, 0, selection.start);
      const in_sel = count_illegal(raw, selection.start, selection.end);
      if (bef_sel || in_sel) {
        selection.start -= bef_sel;
        selection.end -= bef_sel+in_sel;
        set_selection(selection);
      }
    }
  }
  rebuild_letters();
  update_error_markup();
  state_changed();
}

function clue_change_handler (input) {
  state_changed();
}

function make_word_row (index, ch, html) {
  const row = document.createElement('div');
  row.className = 'word-row';
  row.dataset.index = index;

  add_div(row, 'word-part',
          word_part => { word_part.style.flex = '1';
                         add_span(word_part, 'word-letter', ch);
                         add_div(word_part,  'word-input editable',
                                 inp => { inp.style.flex = '1';
                                          inp.contentEditable = 'true';
                                          inp.dataset.index = index;
                                          inp.setAttribute('placeholder',`enter a word starting with "${ch}"…`);
                                          inp.innerHTML = html;
                                          inp.addEventListener('keydown', e => { word_navigation_handler(e, word_input_elt) });
                                          inp.addEventListener('input', () => { word_change_handler(inp); });
                                        });
                       });
  add_div(row, 'clue-part',
          clue_part => { clue_part.style.flex = '1';
                         add_span(clue_part, 'clue-label');
                         add_div(clue_part, 'clue-input editable',
                                 inp => { inp.contentEditable = 'true';
                                          inp.dataset.index = row.dataset.index;
                                          inp.addEventListener('input', () => clue_change_handler(inp));
                                          inp.addEventListener('keydown', e => { word_navigation_handler(e, clue_input_elt) });
                                        })
                       });
  return row;
}

// This is primarily called when source changes, so selection is most likely in the source, so don't worry about selection...
function make_words_from_data (word_arr) {
  words_container.innerHTML = '';
  if (word_arr.length === 0) {
    words_container.appendChild(words_placeholder);
    return;
  }
  const initials = letters_of(source_text());
  for (let i = 0; i < initials.length; i++)
    words_container.appendChild(make_word_row(i, initials[i], word_arr[i]));
}

// Update words to match current source
function update_words () {
  const new_source = source_text();
  const new_initials = letters_of(new_source);
  const rows = all_word_rows();
  if (new_initials !== map_to_str(rows, word_initial)) {
    // initials changed, so have to make new words section.
    const word_map = {}; // ch => all words starting with that char.
    for (const word_row of rows) {
      const ch = word_initial(word_row);
      if (!word_map[ch]) word_map[ch] = [];
      word_map[ch].push(word_input_text(word_row));
    }
    const words_arr = [...new_initials].map(ch => (word_map[ch]?.shift() ?? ''));
    make_words_from_data(words_arr);
  }
}

function current_clues_from_ui () {
  return all_word_rows().map(row => [clue_label_text(row), clue_input_text(row)]);
}

const LABEL_SUFFIX = ':';

// Update clues to match current words
function update_clues (clues_arr) {
  const rows = all_word_rows();
  const indent =  (Math.max(...rows.map(row => word_input_text(row).length)) + 2) + 'ch';
  const clue_map = {};
  // If there are multiple instances of the same word, should store both clues, but sooo unlikely...
  clues_arr.forEach(([label, text]) => { clue_map[letters_of(label)] = text; });
  for (const row of rows) {
    const word = full_word_text(row);
    clue_label_elt(row).textContent = word + LABEL_SUFFIX;
    clue_label_elt(row).style.width = indent;
    set_input_text(clue_input_elt(row),clue_map[letters_of(word)] ?? '');
    clue_input_elt(row).setAttribute('placeholder', `enter clue for ${word}…`);
  }
}

function toggle_clue_mode () {
  if (Puzzle.clue_mode) {
    // Unfreeze quotation and source.  Since everything was frozen, no need to update anything.
    quotation_elt.contentEditable = 'true';
    source_elt.contentEditable = 'true';
    // Save the clues because word rows are going to remade when source changes.
    Puzzle.saved_clues = current_clues_from_ui();
  } else {
    // Freeze quotation and source
    quotation_elt.contentEditable = 'false';
    source_elt.contentEditable = 'false';
    // Move the saved clues back into word rows
    update_clues(Puzzle.saved_clues);
    Puzzle.saved_clues = null;
    suggest_clues();
  }
  Puzzle.clue_mode = !Puzzle.clue_mode;
  words_container.classList.toggle('clue-mode', Puzzle.clue_mode);
  document.body.classList.toggle('clue-mode', Puzzle.clue_mode);
  document.getElementById('words-label').textContent = Puzzle.clue_mode ? 'Clues' : 'Words';
  clue_btn.textContent = (Puzzle.clue_mode ? 'Edit Puzzle' : 'Add Clues');
}

clue_btn.addEventListener('click', toggle_clue_mode);


// ----------------------------------------------------------------------------------------------------

function source_changed () {
  update_words();
  rebuild_letters();
  update_error_markup();
  state_changed();
}

function quote_changed () {
  rebuild_letters();
  update_error_markup();
  state_changed();
}


function state_changed () {
  clue_btn.disabled = !Puzzle.clue_mode && (all_word_rows().length == 0 || // hasn't started yet.
                                            unused_letters_elt.textContent || // or there are still unused letters
                                            source_elt.querySelector('.illegal') || // or there are illegal chars in source
                                            words_container.querySelector('.illegal')); // or in words.
  save_btn.disabled = !quote_text()  && !source_text();
  autosave_puzzle();
}


function unused_letters() {
  const used = {};
  for (const ch of letters_of(source_text() + map_to_str(all_word_rows(), word_input_text)))
    used[ch] = (used[ch] ?? 0) + 1;

  const unused = [];
  for (const ch of letters_of(quote_text()))
    if (used[ch] > 0) used[ch]--;  else unused.push(ch);

  return unused.sort().join('');
}

function rebuild_letters () {
  // It's ok to do this even in clue mode, the elt still exists even if not shown.
  // although it shouldn't ever be needed in clue mode as as nothing changes.
  unused_letters_elt.textContent = unused_letters().match(/(.)\1*/g)?.join(' ') ?? '';
}

// --------------------- Illegal Char Handling -----------------------------------------------------------
function update_error_markup () {
  const available_letters = {};
  for (const ch of letters_of(quote_text())) available_letters[ch] = (available_letters[ch] ?? 0) + 1;

  function char_html (ch) {
    if (is_letter(ch)) {
      const upper_ch = ch.toUpperCase();
      if (available_letters[upper_ch] > 0) {
        available_letters[upper_ch]--;
        return ch;
      }
      else
        return `<span class="illegal">${ch}</span>`;
    }
    else return ch;
  }

  // Render source, and record state of letters for use in word initials
  const source_states = [];
  set_input_markup(source_elt,
                   map_to_str(source_text(),
                              ch => { const html = char_html(ch);
                                      if (is_letter(ch)) source_states.push(html.length > 1);
                                      return html }));
  for (const word of all_word_rows()) {
    word_initial_elt(word).classList.toggle('illegal', source_states.shift());
    set_input_markup(word_input_elt(word), map_to_str(word_input_text(word), char_html));
  }

}



// --------------------- Claude -----------------------------------------------------------

// Generated by encrypt-key.mjs
const CLAUDE_KEY = {"salt":"3D1RJZVP8CYRWOVwMQVm+Q==","iv":"3e42zkuRgz+rpNtq","data":"Agyq7XlVyKZ5TZKispu42hDI9ZdiKeJ8RUuh5blzIBFReU1A8K7M3DMCXhmDmQbDnicrbafE+BVG0Sm1CXNMN/8kTxpYR7OERKLZXM1zYsGYcDPIzfhO3pH3JXpWhBAntA6vAdgTdhHi2QxepMapfyboq36YJ4yyfOiefw=="};

let cached_claude_promise = null;
async function get_claude_key() {
  return await (cached_claude_promise ||= decrypt_key(CLAUDE_KEY))
}

async function post_message(system, words) {
  if (window.webkit?.messageHandlers?.suggestClues) {
    document.getElementById('thinking-overlay').style.display = 'block';
    window.webkit.messageHandlers.suggestClues.postMessage({system: system, words: words}); // will callback to receive_clue_suggestions
  } else {
    const api_key = await get_claude_key();
    if (!api_key) return;
    try {
      document.getElementById('thinking-overlay').style.display = 'block';
      const data = await do_fetch('https://api.anthropic.com/v1/messages','POST',
                                  { 'x-api-key': api_key,
                                    'anthropic-version': '2023-06-01',
                                    'anthropic-dangerous-direct-browser-access': 'true'  // required for browser calls
                                  },
                                  { model: 'claude-haiku-4-5-20251001',
                                    max_tokens: 1024,
                                    system: system,
                                    messages: [{ role: 'user', content: words }]
                                  });
      receive_clue_suggestions(data);
    } finally { document.getElementById('thinking-overlay').style.display = 'none';  }
  }
}

async function suggest_clues() {
  const no_clues = all_word_rows().filter(row => !clue_input_text(row));
  const n = no_clues.length;
  if (n === 0) return;
  post_message(`You are creating clever clues for a crossword puzzle. The user will give you a list of ${n} words, one per line. ` + 
               "Do not include the word in your clue. " +
               `Reply with corresponding clues, one per line, in the same order, nothing else. ` +
               `Your answer must have exactly ${n} lines, no intro, no summary. ` +
               "Don't ask questions, if you don't understand something, just do your best. ",
               no_clues.map(full_word_text).join('\n')+'\n');
}


function receive_clue_suggestions(data) {
  document.getElementById('thinking-overlay').style.display = 'none';
  if (!data || data.content.length == 0) { console.log('Error getting clue suggestions'); return; }
  const clues = data.content[0].text.split('\n');
  const no_clues = all_word_rows().filter(row => !clue_input_text(row));
  if (clues.length !== no_clues.length) { bug("Mismatched answer from claude"); }
  else for (let i = 0; i < clues.length; i++) set_input_text(clue_input_elt(no_clues[i]), clues[i]);
}

// --------------------- loading/saving  -----------------------------------------------------------


function ok_to_discard_puzzle () {
  return puzzle_is_empty() || confirm('Discard current puzzle? Unsaved changes will be lost.')
}

function get_puzzle_data() {
  if (puzzle_is_empty()) return null;
  return { format: 2,
           uuid: Puzzle.uuid,
           quotation: quote_text(),
           source: source_text(),
           words: all_word_rows().map(word_input_text),
           clues: (Puzzle.clue_mode ? current_clues_from_ui() : Puzzle.saved_clues)
         };
}

function read_data (str) {
  const data = JSON.parse(str);
  if (data.format === 1) {
    data.uuid = crypto.randomUUID();
    const clue_table = data.clues;
    data.clues = data.words.map(word => [word+LABEL_SUFFIX, clue_table[letters_of(word)]]);
    data.words = data.words.map(word => word.slice(1));
    data.format = 2;
  }
  if (data.format !== 2) {
    alert(`Unsupported file format version ${data.format}`);
    return null;
  }
  if (data.words.length != letters_of(data.source).length) {
    alert('Corrupted data file');
    return null;
  }
  return data;
}

function load_puzzle_from_file (data) {
  // Have confirmed it's ok to discard current puzzle
  start_fresh_puzzle(data.uuid); // this forces edit mode
  Puzzle.saved_clues = data.clues;
  set_input_text(quotation_elt, data.quotation);
  source_elt.textContent = data.source;
  make_words_from_data(data.words);
  rebuild_letters();
  update_error_markup();
  state_changed();
}

////  Autosave

const AUTOSAVE_PREFIX = 'acrostic.autosave.'
const AUTOSAVE_TIME_PREFIX = 'acrostic.autosave.time.'

function autosave_puzzle () {
  const data = get_puzzle_data();
  // if has been autosaved before, have to save even if no data, so old data doesn't come back!
  if (data || Puzzle.last_autosave) {
    const data_str = JSON.stringify(data);
    if (Puzzle.last_autosave !== data_str) {
      Puzzle.last_autosave = data_str;
      localStorage.setItem(AUTOSAVE_PREFIX+Puzzle.uuid, data_str);
      localStorage.setItem(AUTOSAVE_TIME_PREFIX+Puzzle.uuid, Date.now());
    }
  }
}

function find_newest_autosave () {
  let max_data = null;
  let max_time = 0;
  let uuid = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(AUTOSAVE_TIME_PREFIX)) {
      const time = +localStorage.getItem(key);
      if (time > max_time) {
        max_time = time;
        uuid = key.slice(AUTOSAVE_TIME_PREFIX.length);
      }}};
  return uuid;
}
  

// used on window reactivation and on startup.
function update_from_autosave() {
  const stored = localStorage.getItem(AUTOSAVE_PREFIX+Puzzle.uuid);
  if (!stored || stored === Puzzle.last_autosave) return;

  // Something changed while we were away.
  Puzzle.last_autosave = stored;
  const data = read_data(stored);
  const current_rows = all_word_rows();
  const words_are_new = (source_elt.textContent !== data.source ||
                         current_rows.length != data.words.length || 
                         current_rows.some((row, i) => (word_input_text(row) !== data.words[i])))

  // Can't stay in clue mode if the puzzle itself changed, since everything assumes no puzzle changes
  // while in clue mode.  Also in clue mode, clue labels correspond to the words, which might not be
  // the case if the autsave came from edit mode.
  if (Puzzle.clue_mode &&
      (quotation_elt.textContent !== data.quotation || words_are_new ||
       current_rows.length !== data.clues.length ||
       current_rows.some((row, i) => clue_label(row) !== data.clues[i][0])))
    toggle_clue_mode();


  set_input_text(quotation_elt, data.quotation);
  set_input_text(source_elt, data.source);

  if (words_are_new) {
    // If focus is on a word (or clue), try to keep the focus on the same word.
    // In the future could also try to maintain selection...
    function dwim_new_index (inp, data) {
      const old_index = +inp.dataset.index;
      const row = current_rows[old_index]
      const initial = word_initial(row);
      const input = word_input_text(row);
      // Try to find the same word in the new words, but account for the fact that the same word can
      // appear multiple times during editing (eg. if the word is just the initial).
      let count = 0;
      for (let i = 0; i < old_index; i++)
        if (initial === word_initial(current_rows[i]) && input === word_input_text(current_rows[i])) count++;
      const new_initials = letters_of(data.source);
      if (data.words.length != new_initials.length) bug("bad file");
      for (let i = 0; i < new_initials.length; i++)
        if (initial === new_initials[i] && input === data.words[i]) if (count-- === 0) return i;
      return null;
    }
    const active = document.activeElement;
    const active_row_class =  active && ['word-input', 'clue-input'].find(c => active.classList.contains(c));
    const new_index = active_row_class && dwim_new_index(active, data);
    make_words_from_data(data.words);
    if (Puzzle.clue_mode) // in clue mode, already checked that everything is copacetic
      all_word_rows().forEach((row, idx) => set_input_text(clue_input_elt(row), data.clues[idx][1]));
    else
      Puzzle.saved_clues = data.clues;

    if (new_index != null) all_word_rows()[new_index].querySelector(active_row_class).focus();
  }

  rebuild_letters();
  update_error_markup();
  state_changed(); // buttons etc.
}

document.addEventListener('visibilitychange', () => {
  // if (document.visibilityState === 'hidden') { }
  if (document.visibilityState === 'visible')  {
    update_from_autosave();
  }
});





// --------------------- Buttons -----------------------------------------------------------

function ensure_logged_in () {
  if (!Puzzle.username) {
    // TOOD: make this unnecessary by checking it at startup?  Don't care if logged
    // in in another window meantime...
    Puzzle.username = localStorage.getItem('acrostic.username');
    if (!Puzzle.username) {
      Puzzle.username = prompt("Enter user name: ");
      if (!Puzzle.username) return null;
      localStorage.setItem('acrostic.username', Puzzle.username);
    }}
  return Puzzle.username;
}

// Save

save_btn.addEventListener('click', async () => {
  if (!ensure_logged_in()) return;
  const name = puzzle_name();
  if (Puzzle.persistent_name !== name
      && await puzzle_exists(name)
      && !confirm(`Puzzle "${name}" exists, overwrite it?`))
    return;
  const data = get_puzzle_data();
  await store_puzzle(name, data);
  Puzzle.persistent_name = name;
  });


/// Load

load_btn.addEventListener('click', async () => {
  if (!ok_to_discard_puzzle()) return;
  if (!ensure_logged_in()) return;
  const file_info = await select_puzzle_dialog();
  if (!file_info) return;
  const data = file_info.content;
  load_puzzle_from_file(data);
  puzzle_name_elt.value = file_info.name;
  Puzzle.persistent_name = file_info.name;
});

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
function start_fresh_puzzle (uuid) {
  if (Puzzle.clue_mode) toggle_clue_mode(); // take off clue mode classes buttons etc
  Puzzle.last_autosave = null;
  Puzzle.uuid = uuid ?? crypto.randomUUID();
  Puzzle.persistent_name = null;
  puzzle_name_elt.value = 'New Puzzle';
  quotation_elt.textContent = '';
  source_elt.textContent = '';
  Puzzle.saved_clues = [];
  make_words_from_data([]);
  unused_letters_elt.textContent = '';
}
  

/// Restart
document.getElementById('restart-btn').addEventListener('click', () => {
  if (ok_to_discard_puzzle()) {
    start_fresh_puzzle();
    state_changed();
  }});

/// Quit

if (!window.webkit?.messageHandlers?.quit)
  document.getElementById('quit-btn').style.display = 'none';
else
  document.getElementById('quit-btn').addEventListener('click', () => {
    if (ok_to_discard_puzzle()) window.webkit.messageHandlers.quit.postMessage('')
  });

                                                       

///  Initialize
start_fresh_puzzle()

// If there's an autosaved puzzle, reload that.
{ const uuid = find_newest_autosave();
  if (uuid) {
    Puzzle.uuid = uuid;
    update_from_autosave();
  }
  else {
    state_changed(); // update buttons, autosave.
  }
}



