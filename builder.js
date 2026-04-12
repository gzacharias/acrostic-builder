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
  document.body.classList.toggle('clue-mode', clue_mode);
  document.getElementById('words-label').textContent = clue_mode ? 'Clues' : 'Words';
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
    const prefix = [...raw.slice(0, pos ?? raw.length)].filter(is_letter).length;
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

  add_div(row, 'word-part',
          word_part => { word_part.style.flex = '1';
                         add_span(word_part, 'word-letter', ch);
                         add_div(word_part,  'word-input editable',
                                 elt => { elt.style.flex = '1';
                                          elt.contentEditable = 'true';
                                          elt.dataset.index = index;
                                          elt.setAttribute('placeholder',`enter a word starting with "${ch}"…`);
                                          elt.innerHTML = html;
                                          elt.addEventListener('input', () => { clean_word_input(elt); update_letters(); });
                                          elt.addEventListener('keydown', e => { word_navigation_handler(e, word_input_elt) });
                                        });
                       });
  return row;
}

function ensure_clue_part (row) {
  if (!row.querySelector('.clue-part')) {
    add_div(row, 'clue-part',
            elt => { elt.style.flex = '1';
                     add_span(elt, 'clue-label');
                     add_div(elt, 'clue-input editable',
                             elt => { elt.contentEditable = 'true';
                                      elt.addEventListener('keydown', e => { word_navigation_handler(e, clue_input_elt) });
                                    })
                   });
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
    if (is_letter(ch)) {
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

// This preserves clues for words that have been changed, in case they come back during editing.
let clues_table = {}; // maps full word to clue.  gets rebuild when load a puzzle, hence the LET
function save_clues_from_ui () {
  for (const row of all_word_rows()) {
    clues_table[full_word_text(row)] = clue_input_text(row);
  }
}

function toggle_clue_mode () {
  if (clue_mode) {
    // Save clues from UI before switching, because now will mess around and recreate all the rows.
    // Perhaps should save these somewhere in the DOM, e.g words_container
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
    const indent =  (Math.max(...rows.map(row => word_input_text(row).length)) + 2) + 'ch';
    for (const row of all_word_rows()) {
      ensure_clue_part(row);
      clue_input_elt(row).textContent = clues_table[full_word_text(row)] ?? '';
      clue_label_elt(row).style.width = indent;
    }
    suggest_clues();
  }
  set_clue_mode(!clue_mode);
}

clue_btn.addEventListener('click', toggle_clue_mode);


// --------------------- Claude -----------------------------------------------------------

let cached_api_key = null;

async function get_api_key() {
  if (cached_api_key) return cached_api_key;
  let passphrase = localStorage.getItem('acrostic_passphrase');
  if (!passphrase) {
    passphrase = prompt('Enter password:');
    if (!passphrase) return null;
  }
  const key = await decrypt_api_key(passphrase);
  if (!key) {
    localStorage.removeItem('acrostic_passphrase');
    alert('Wrong passphrase');
    return null;
  }
  localStorage.setItem('acrostic_passphrase', passphrase);
  cached_api_key = key;
  return key;
}

// Generated by encrypt-key.mjs
const ENCRYPTED_KEY = {"salt":"3D1RJZVP8CYRWOVwMQVm+Q==","iv":"3e42zkuRgz+rpNtq","data":"Agyq7XlVyKZ5TZKispu42hDI9ZdiKeJ8RUuh5blzIBFReU1A8K7M3DMCXhmDmQbDnicrbafE+BVG0Sm1CXNMN/8kTxpYR7OERKLZXM1zYsGYcDPIzfhO3pH3JXpWhBAntA6vAdgTdhHi2QxepMapfyboq36YJ4yyfOiefw=="};

async function decrypt_api_key(passphrase) {
  try {
    const enc = new TextEncoder();
    const from_b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key_material = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: from_b64(ENCRYPTED_KEY.salt), iterations: 100000, hash: 'SHA-256' },
      key_material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: from_b64(ENCRYPTED_KEY.iv) },
      key, from_b64(ENCRYPTED_KEY.data));
    return new TextDecoder().decode(decrypted);
  } catch {
    return null; // wrong passphrase
  }
}


async function post_message(system, words) {
  if (window.webkit?.messageHandlers?.suggestClues) {
    document.getElementById('thinking-overlay').style.display = 'block';
    window.webkit.messageHandlers.suggestClues.postMessage({system: system, words: words}); // will callback to receive_clue_suggestions
  } else {
    const api_key = await get_api_key();
    if (!api_key) return;
    try {
      document.getElementById('thinking-overlay').style.display = 'block';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': api_key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true'  // required for browser calls
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: system,
          messages: [{ role: 'user', content: words }]
        })
      });
      const data = await response.json();
      receive_clue_suggestions(data);
    } finally { document.getElementById('thinking-overlay').style.display = 'none';  }
  }
}

async function suggest_clues() {
  const no_clues = all_word_rows().filter(row => !clue_input_text(row));
  const n = no_clues.length;
  if (n === 0) return;
  post_message(`You are creating clues for a crossword puzzle. The user will give you a list of ${n} words, one per line. ` + 
               "Do not include the word in your clue. " +
               `Reply with corresponding clues, one per line, in the same order, nothing else. ` +
               `Your answer must have exactly ${n} lines, no intro, no summary. ` +
               "Don't ask questions, if you don't understand something, just do your best. ",
               no_clues.map(full_word_text).join('\n')+'\n');
}


function receive_clue_suggestions(data) {
  document.getElementById('thinking-overlay').style.display = 'none';
  if (!data) { console.log('Error getting clue suggestions'); return; }
  const clues = data.content[0].text.split('\n');
  const no_clues = all_word_rows().filter(row => !clue_input_text(row));
  if (clues.length !== no_clues.length) { console.log("Mismatched answer from claude"); debugger; }
  else for (let i = 0; i < clues.length; i++) clue_input_elt(no_clues[i]).textContent = clues[i];
}



// --------------------- Buttons -----------------------------------------------------------

///  Save puzzle
function get_puzzle_data() {
  if (clue_mode) save_clues_from_ui();
  return {
    format: 1,
    quotation: quotation_elt.textContent,
    source: source_text(),
    words: all_word_rows().map(full_word_text),
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
  source_elt.textContent = data.source;
  rebuild_words();
  const rows = all_word_rows();
  if (data.words.length !== rows.length)
    alert(`Bad file: expected ${rows.length} words, got ${data.words.length}`);
  else if (data.format == 1) 
    data.words.forEach((val, i) => { word_input_elt(rows[i]).textContent = val.slice(1); });
  else
    alert(`Unsupposed file format version ${data.format}`);
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
  if (clue_mode) toggle_clue_mode();
  
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

                                                       
