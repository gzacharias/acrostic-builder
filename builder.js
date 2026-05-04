// TODO: Export, to put puzzle in file
// TODO: Allow Edit Clues even if puzzle is not complete, as long as there are some words.
// TODO: Removme save/load handlers in XCode
// TODO: Word input can be half the size it is, and can be in two columns

const puzzle_name_elt = document.getElementById('puzzle-name');
const quotation_elt = document.getElementById('quotation');
const source_elt    = document.getElementById('source');
const unused_letters_elt   = document.getElementById('letters');
const words_container = document.getElementById('words-container');

const clue_btn      = document.getElementById('clue-btn');
const save_btn      = document.getElementById('save-btn');
const load_btn      = document.getElementById('load-btn');
const restart_btn   = document.getElementById('restart-btn');
const quit_btn      = document.getElementById('quit-btn');


const Puzzle = { clue_mode: false,
                 saved_clues: [], // null when in clue mode, array in edit mode
                 last_autosave: null, // last puzzle_data
                 last_filesave: null, // last puzzle_data saved in a file.
                 uuid: null,
               };

const LABEL_SUFFIX = ':';


function puzzle_name () { return puzzle_name_elt.value.trim(); }

function source_text () { return source_elt.textContent; }
function quote_text () { return quotation_elt.textContent; }

function all_word_rows () { return [...words_container.querySelectorAll('.word-row')] }
function word_initial_elt (row) { return row.querySelector('.word-letter') }
function word_input_elt (row) { return row.querySelector('.word-input') }
function clue_label_elt (row) { return row.querySelector('.clue-label') }
function clue_input_elt (row) { return row.querySelector('.clue-input') }


function word_initial_text (row) { return word_initial_elt(row).textContent }
function word_input_text (row) { return word_input_elt(row).textContent }
function full_word_text (row) { return word_initial_text(row) + word_input_text(row) }
function clue_label_text (row) { return clue_label_elt(row).textContent }
function clue_input_text (row) { return clue_input_elt(row).textContent }
function clue_word_text (row) { return clue_label_text(row).slice(0, -LABEL_SUFFIX.length) }


puzzle_name_elt.addEventListener('input', name_changed);
quotation_elt.addEventListener('input', quote_changed);
source_elt.addEventListener('input', source_changed);


// --------------------------------- word/clue rows -------------------------------------------------------------------

function row_navigation_handler(e, input_getter) {
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

function word_input_handler (input) {
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
}

function make_word_row (index, ch, html) {
  const row = document.createElement('div');
  row.className = 'word-row';
  row.dataset.index = index;

  add_div(row, 'word-part',
          word_part => { add_span(word_part, 'word-letter', ch);
                         add_div(word_part,  'word-input editable',
                                 inp => { inp.setAttribute('spellcheck', 'false');
                                          inp.setAttribute('autocomplete', 'off');
                                          inp.setAttribute('autocorrect', 'off');
                                          inp.setAttribute('autocapitalize', 'off');
                                          inp.contentEditable = 'true';
                                          inp.dataset.index = index;
                                          inp.setAttribute('placeholder',`enter a word starting with "${ch}"…`);
                                          inp.innerHTML = html;
                                          inp.addEventListener('input', () => { word_input_handler(inp); word_changed(); });
                                          inp.addEventListener('keydown', e => { row_navigation_handler(e, word_input_elt) });
                                        });
                       });
  add_div(row, 'clue-part',
          clue_part => { add_span(clue_part, 'clue-label');
                         add_div(clue_part, 'clue-input editable',
                                 inp => { inp.contentEditable = 'true';
                                          inp.dataset.index = row.dataset.index;
                                          inp.addEventListener('input', clue_changed);
                                          inp.addEventListener('keydown', e => { row_navigation_handler(e, clue_input_elt) });
                                        })
                       });
  return row;
}

// This is primarily called when source changes, so selection is most likely in the source, so don't worry about selection...
function make_words_from_data (word_arr) {
  words_container.innerHTML = '';
  const initials = letters_of(source_text());
  const col1 = add_div(words_container, 'words-column');
  const col2 = add_div(words_container, 'words-column');
  const half = Math.ceil(initials.length / 2);
  for (let i = 0; i < initials.length; i++)
    (i < half ? col1 : col2).appendChild(make_word_row(i, initials[i], word_arr[i]));
}

// Update words to match current source
function update_words () {
  const new_source = source_text();
  const new_initials = letters_of(new_source);
  const rows = all_word_rows();
  if (new_initials !== map_to_str(rows, word_initial_text)) {
    // initials changed, so have to make new words section.
    const word_map = {}; // ch => all words starting with that char.
    for (const word_row of rows) {
      const ch = word_initial_text(word_row);
      if (!word_map[ch]) word_map[ch] = [];
      word_map[ch].push(word_input_text(word_row));
    }
    const words_arr = [...new_initials].map(ch => (word_map[ch]?.shift() ?? ''));
    make_words_from_data(words_arr);
  }
}

function current_clues_from_ui () {
  return all_word_rows().map(row => [clue_word_text(row), clue_input_text(row)]);
}


// Update clues to match current words
function update_clues (clues_arr) {
  const rows = all_word_rows();
  const indent =  Math.max(...rows.map(row => word_input_text(row).length)) + 2;
  const clue_map = {};
  // If there are multiple instances of the same word, should store both clues, but sooo unlikely...
  clues_arr.forEach(([word, text]) => { clue_map[letters_of(word)] = text; });
  for (const row of rows) {
    const word = full_word_text(row);
    const label = clue_label_elt(row);
    const input = clue_input_elt(row);
    label.textContent = word + LABEL_SUFFIX;
    label.style.width = `${indent}ch`;
    set_input_text(input, clue_map[letters_of(word)] ?? '');
    input.setAttribute('placeholder', `enter clue for ${word}…`);
  }
}

async function suggest_clues() {
  const no_clues = all_word_rows().filter(row => !clue_input_text(row));
  const n = no_clues.length;
  if (n === 0) return;
  const text = await ask_claude("Pondering clue suggestions…",
                                'You are a great crossword puzzle creator.  You are creating clever clues for words in a crossword puzzle.' +
                                'The clues should be non-obvious, hard to guess, playful, interesting. ' +
                                `The user will give you a list of ${n} words, one per line. ` + 
                                `Reply with a JSON array of exactly ${n} strings, one clue per word, in the same order.` +
                                'The clue for a word must not include the word. ' +
                                'If a word appear nonsensical, just imagine what it might mean and provide a clue anyway',
                                no_clues.map(full_word_text).join('\n')+'\n');
  const clues = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']')+1));
  if (clues.length !== no_clues.length) {
    console.log('clue data', clues);
    bug("Mismatched answer from claude");
  }
  else for (let i = 0; i < clues.length; i++) set_input_text(clue_input_elt(no_clues[i]), clues[i]);
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
  document.body.classList.toggle('clue-mode', Puzzle.clue_mode);
  clue_btn.textContent = (Puzzle.clue_mode ? 'Edit Puzzle' : 'Add Clues');
}

clue_btn.addEventListener('click', toggle_clue_mode);


// ----------------------------- Available letters -----------------------------------------------------------------


function rebuild_letters () {
  const used_count = {};
  for (const ch of letters_of(source_text() + map_to_str(all_word_rows(), word_input_text)))
    used_count[ch] = (used_count[ch] ?? 0) + 1;

  const unused = [];
  for (const ch of letters_of(quote_text()))
    if (used_count[ch] > 0) used_count[ch]--;  else unused.push(ch);

  // It's ok to do this even in clue mode, the elt still exists even if not shown.
  // although it shouldn't ever be needed in clue mode as as nothing changes.
  unused_letters_elt.textContent = unused.sort().join('').match(/(.)\1*/g)?.join(' ') ?? '';
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
// ----------------------------------------------------------------------------------------------------

function name_changed () {
  state_changed();
}

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

function word_changed () {
  rebuild_letters();
  update_error_markup();
  state_changed();
}

function clue_changed () {
  state_changed();
}


function state_changed () {
  autosave_puzzle();
  clue_btn.disabled = !Puzzle.clue_mode && (all_word_rows().length == 0 || // hasn't started yet.
                                            unused_letters_elt.textContent || // or there are still unused letters
                                            source_elt.querySelector('.illegal') || // or there are illegal chars in source
                                            words_container.querySelector('.illegal')); // or in words.
  save_btn.disabled = !puzzle_needs_saving();
}



// --------------------- loading/saving  -----------------------------------------------------------


// ignore if visible text is empty, ignore saved clues and puzzle name changes...
function puzzle_is_empty () { return quote_text() === '' && source_text() === '' }

function puzzle_needs_saving () {
  return Puzzle.last_filesave ? Puzzle.last_filesave !== Puzzle.last_autosave : !puzzle_is_empty();
}

function ok_to_discard_puzzle () {
  return !puzzle_needs_saving() || confirm('Discard current puzzle? Unsaved changes will be lost.')
}

function get_puzzle_data () {
  if (puzzle_is_empty()) return null;
  return { format: 4,
           uuid: Puzzle.uuid,
           name: puzzle_name(),
           quotation: quote_text(),
           source: source_text(),
           words: all_word_rows().map(word_input_text),
           clues: (Puzzle.clue_mode ? current_clues_from_ui() : Puzzle.saved_clues)
         };
}

////  Autosave

const AUTOSAVE_PREFIX = 'acrostic.autosave.'
const AUTOSAVE_TIME_PREFIX = 'acrostic.autosave.time.'

function autosave_puzzle () {
  const data = get_puzzle_data();
  // if has been autosaved before, have to save even if empty now, so old data doesn't come back!
  if (data || Puzzle.last_autosave) {
    const data_str = JSON.stringify(data);
    if (Puzzle.last_autosave !== data_str) {
      Puzzle.last_autosave = data_str;
      localStorage.setItem(AUTOSAVE_PREFIX+Puzzle.uuid, data_str);
      localStorage.setItem(AUTOSAVE_TIME_PREFIX+Puzzle.uuid, Date.now());
    }
  }
}

// used on window reactivation and on startup.
function update_from_autosave () {
  const last_puzzle = localStorage.getItem(AUTOSAVE_PREFIX+Puzzle.uuid);
  const last_file = localStorage.getItem(FILESAVE_PREFIX+Puzzle.uuid);
  if (!last_puzzle) return;
  if (last_puzzle === Puzzle.last_autosave) {
    if (last_file === Puzzle.last_filesave) return;
    Puzzle.last_filesave = last_file;
    state_changed();
  } else {
    Puzzle.last_filesave = last_file;
    update_puzzle_from_data(read_data(last_puzzle));
  }
}


function find_newest_autosave () {
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

function update_puzzle_from_data (data) {
  const current_rows = all_word_rows();
  const words_are_new = (source_elt.textContent !== data.source ||
                         current_rows.length !== data.words.length || 
                         current_rows.some((row, i) => (word_input_text(row) !== data.words[i])));

  // Can't stay in clue mode if the puzzle itself changed, since everything assumes no puzzle changes
  // while in clue mode.  Also in clue mode, clue labels correspond to the words, which might not be
  // the case if the autsave came from edit mode.
  if (Puzzle.clue_mode &&
      (quotation_elt.textContent !== data.quotation || words_are_new ||
       current_rows.length !== data.clues.length ||
       current_rows.some((row, i) => clue_word_text(row) !== data.clues[i][0])))
    toggle_clue_mode();

  puzzle_name_elt.value = data.name;
  set_input_text(quotation_elt, data.quotation);
  set_input_text(source_elt, data.source);

  if (words_are_new) {
    // If focus is on a word row, try to keep the focus on the same row
    // In the future could also try to maintain selection...
    function dwim_new_index (inp, data) {
      const old_index = +inp.dataset.index;
      const row = current_rows[old_index]
      const initial = word_initial_text(row);
      const input = word_input_text(row);
      // Try to find the same word in the new words, but account for the fact that the same word can
      // appear multiple times during editing (eg. if the word is just the initial).
      let count = 0;
      for (let i = 0; i < old_index; i++)
        if (initial === word_initial_text(current_rows[i]) && input === word_input_text(current_rows[i])) count++;
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
      all_word_rows().forEach((row, i) => set_input_text(clue_input_elt(row), data.clues[i][1]));
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

let User_Name = null;

// If prompt is specified, will ask the user, otherwise just looks up cache.
function init_user_name (optional_prompt) {
  if (!User_Name) {
    User_Name = get_user_name(optional_prompt);
    if (User_Name) {
      const elt = document.getElementById('username-display');
      elt.textContent = `Welcome back ${User_Name}!`;
      elt.style.display = 'block';
    }
  }
}

function  ensure_logged_in () {
  init_user_name("Enter user name: ");
  return User_Name != null;
}


// Save
const FILESAVE_PREFIX = 'acrostic.filesave.';

async function save_to_file () {
  if (!ensure_logged_in()) return;
  const name = puzzle_name();
  try {
    if (!Puzzle.last_filesave || read_data(Puzzle.last_filesave).name !== name) {
      const new_content = await load_puzzle(User_Name, name);
      // Need to load it to check if exists, so might as well check if changed
      if  (new_content && new_content !== Puzzle.last_autosave
           && !confirm(`Puzzle file "${name}" already exists, overwrite it?`))
        return;
      }
    const content = Puzzle.last_autosave;
    // TODO: can this happen when changing version?  Make sure autosave is always in current version when loading from autosave.
    if (JSON.stringify(get_puzzle_data()) !== Puzzle.last_autosave) bug('save called with obsolete autosave');
    show_overlay('Saving…');
    // TODO: change store_puzzle to take json, and use Puzzle.last_autosave, no need to return anything
    await store_puzzle(User_Name, name, content);
    Puzzle.last_filesave = content;
    localStorage.setItem(FILESAVE_PREFIX+Puzzle.uuid, content);
    console.log('saved');
    state_changed();
  } catch (e) {
    console.log('Save failed', e);
  } finally {
    hide_overlay();
  }
};

async function load_from_file () {
  if (!ok_to_discard_puzzle()) return;
  if (!ensure_logged_in()) return;
  const file_info = await select_puzzle_dialog(User_Name);
  if (!file_info) return;
  const content = file_info.content;
  const data = read_data(content);
  if (data.name !== file_info.filename) bug("Filename doesn't match loaded puzzle name");
  start_fresh_puzzle(data.uuid); // this forces edit mode
  Puzzle.last_filesave = content;
  localStorage.setItem(FILESAVE_PREFIX+Puzzle.uuid, content);
  update_puzzle_from_data(data); // this will call needs saving, which needs last_filesave set up
  if (Puzzle.last_autosave !== content) {
    if (JSON.parse(content).format === data.format) {
      console.log("file_info", content);
      console.log("last auto", Puzzle.last_autosave);
      bug("Expected loaded serialization to be the same as input"); // means loaded something wrong...
    }}
}

save_btn.addEventListener('click', save_to_file);
load_btn.addEventListener('click', load_from_file);

function start_fresh_puzzle (uuid) {
  if (Puzzle.clue_mode) toggle_clue_mode(); // take off clue mode classes buttons etc
  Puzzle.uuid = uuid ?? crypto.randomUUID();
  Puzzle.last_autosave = undefined;  // should get overwritten almost immediately
  Puzzle.last_filesave = null;
  puzzle_name_elt.value = 'New Puzzle';
  quotation_elt.textContent = '';
  source_elt.textContent = '';
  Puzzle.saved_clues = [];
  make_words_from_data([]);
  unused_letters_elt.textContent = '';
}


/// Restart
restart_btn.addEventListener('click', () => {
  if (ok_to_discard_puzzle()) {
    start_fresh_puzzle();
    state_changed();
  }});

/// Quit

if (!window.webkit?.messageHandlers?.quit)
  quit_btn.style.display = 'none';
else
  quit_btn.addEventListener('click', () => {
    if (ok_to_discard_puzzle()) window.webkit.messageHandlers.quit.postMessage('')
  });


///  Initialize
init_user_name();
start_fresh_puzzle();

{ const uuid = find_newest_autosave();
  if (uuid) {
    console.log('FOund autosave', uuid);
    Puzzle.uuid = uuid;
    update_from_autosave();
  }
  else {
    console.log("Didnt find autosave");
    state_changed(); // update buttons, autosave.
  }

  if (!Puzzle.last_autosave && !puzzle_is_empty()) bug("I expect last_autosave to be set up");
}
