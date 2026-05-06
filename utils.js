////// just for debugging
function show_storage () {
  for (let i = 0; i < localStorage.length; i++) {
    console.log(localStorage.key(i), localStorage.getItem(localStorage.key(i)));
  }
}

function clean_storage(prefix) {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      console.log(key, localStorage.getItem(key));
      keys.push(key);
    }
  }
  if (confirm("Remove all these keys?")) {
    keys.forEach(key => localStorage.removeItem(key));
  }
}

    

async function fix_gist (username) {
  const data = await gist_request(await get_gist_url(username), 'GET');
  for (const file of Object.values(data.files)) {
    if (file.filename !== '.keep') {
      const data = read_data(file.content); // brings it to current format version
      if (file.content !== JSON.stringify(data))
        await store_puzzle(username, file.filename, data);
    }
  }
  show_gist();
}


async function show_gist (username) {
  const data = await gist_request(await get_gist_url(username), 'GET');
  Object.entries(data.files).forEach(([name, info]) => { console.log(name, info); });
}
////// end debugging tools


async function decrypt_key(encrypted_key) {
  let passphrase = localStorage.getItem('acrostic.passphrase');
  if (!passphrase) {
    passphrase = prompt('Enter site password:');
    if (!passphrase) return null;
  }
  try {
    const enc = new TextEncoder();
    const from_b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key_material = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: from_b64(encrypted_key.salt), iterations: 100000, hash: 'SHA-256' },
      key_material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: from_b64(encrypted_key.iv) },
      key, from_b64(encrypted_key.data));
    const decoded_key = new TextDecoder().decode(decrypted);
    localStorage.setItem('acrostic.passphrase', passphrase);
    return decoded_key;
  } catch {
    localStorage.removeItem('acrostic.passphrase');
    alert('Wrong passphrase');
    return null; // wrong passphrase
  }
}

function get_user_name (prompt_text) {
  const stored = localStorage.getItem('acrostic.username');
  if (stored || !prompt_text) return stored;
  const name = prompt(prompt_text);
  if (name) localStorage.setItem('acrostic.username', name);
  return name;
}


async function do_fetch (url, method, headers, content) {
  let response;
  try {
    if (content !== undefined) headers['Content-Type'] = 'application/json';
    response = await fetch(url, {method: method, headers: headers, body: JSON.stringify(content)});
  } catch (e) {
    throw new Error(`${url} Network error: ${e.message}`);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`${url} error ${response.status}: ${body.message ?? 'unknown'}`);
  }
  return response.json();
}

// Is there really no predefined way to do something like this??
let audio_ctx, beep_gain;
function beep() {
  if (!audio_ctx) {
    audio_ctx = new AudioContext();
    beep_gain = audio_ctx.createGain();
    beep_gain.connect(audio_ctx.destination);
    beep_gain.gain.value = 0;
    const beep_osc = audio_ctx.createOscillator();
    beep_osc.frequency.value = 880;
    beep_osc.connect(beep_gain);
    beep_osc.start();
  }
  beep_gain.gain.cancelScheduledValues(audio_ctx.currentTime);
  beep_gain.gain.setValueAtTime(0.1, audio_ctx.currentTime);
  beep_gain.gain.setValueAtTime(0, audio_ctx.currentTime + 0.05);
}

// TODO: set up global error handling so this can abort
function bug (msg) {
  console.log(msg || 'bug');
  debugger;  // this often doesn't work in safari
  const err = new Error().stack;
  console.log(err); 
}

function map_to_str (things, fn) { return [...things].map(fn).join(''); }

function is_letter(ch) {
  return /\p{L}/u.test(ch);
}

function letters_of (bag_of_chars) {
  if (bag_of_chars == null) bug("bad call to letters_of");
  return [...bag_of_chars].filter(is_letter).join('').toUpperCase();
}

function read_data (str) {
  const data = JSON.parse(str);
  if (data.format === 1) {
    data.uuid = crypto.randomUUID();
    const clue_table = data.clues;
    data.clues = data.words.map(word => [word+':', clue_table[letters_of(word)]]);
    data.words = data.words.map(word => word.slice(1));
    data.format = 2;
  }
  if (data.format === 2) {
    data.name = 'New Puzzle';
    data.format = 3;
  }
  if (data.format === 3) {
    data.clues = data.clues.map(([label, clue]) => [label.slice(0, -1), clue]);
    data.format = 4;
  }

  if (data.format !== 4) {
    alert(`Unsupported file format version ${data.format}`);
    return null;
  }
  if (data.words.length != letters_of(data.source).length) {
    alert('Corrupted data file');
    return null;
  }
  return data;
}



function first_mismatch (string1, string2, max) {
  const min_str_len = Math.min(string1.length, string2.length);
  const lim =  max ?  Math.min(min_str_len, max) : min_str_len;
  for (let i = 0;  i < lim; i++) if (string1[i] !== string2[i]) return i;
  return (string1.length !== string2.length && lim !== max) ? lim : null;
}

function add_elt (parent, type, init_fn) {
  const elt = document.createElement(type);
  if (init_fn) init_fn(elt);
  parent.appendChild(elt);
  return elt;
}

function add_div (parent, class_name, init_fn) {
  return add_elt (parent, 'div', e => { if (class_name) e.className = class_name;
                                        if (init_fn) init_fn(e);
                                      });
}

function add_span (parent, class_name, text_or_init_fn) {
  return add_elt (parent, 'span', e => { if (class_name) e.className = class_name;
                                         if (typeof text_or_init_fn === 'function')
                                           text_or_init_fn(e);
                                         else if (text_or_init_fn)
                                           e.textContent = text_or_init_fn;
                                       });

}

function add_text_input(parent, class_name, init_fn) {
  return add_elt (parent, 'input', e => { e.type = 'text';
                                          if (class_name) e.className = class_name;
                                          if (init_fn) init_fn(e); });
}

function get_selection () {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const elt = document.activeElement;
  if (!elt || !elt.contains(range.commonAncestorContainer)) return null;
  const pre = range.cloneRange();
  pre.setStart(elt, 0);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { element: elt, start, end: start + range.toString().length };
}

function set_selection(data) {
  if (!data) return;
  const {element, start, end} = data;
  const sel = window.getSelection();
  const range = document.createRange();
  let pos = 0;
  let start_set = false;

  function walk(node) {
    if (node.nodeType === 3) {
      const node_len = node.textContent.length;
      if (!start_set && start - pos <= node_len) {
        range.setStart(node, start - pos);
        start_set = true;
      }
      if (start_set && end - pos <= node_len) {
        range.setEnd(node, end - pos);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
      pos += node_len;
    } else {
      for (const child of node.childNodes)
        if (walk(child)) return true;
    }
    return false;
  }
  if (!walk(element)) {
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
  

// sets html but assumes the same character positions.
function set_input_markup (elt, html) {
  const sel = get_selection();
  elt.innerHTML = html;
  if (sel?.element === elt) set_selection(sel);
}

function set_input_text (elt, str) {
  // Don't clobber selection if don't have to..
  if (elt.innerText !== str) elt.innerText = str;
}

const progress_overlay_elt = document.getElementById('thinking-overlay');

function show_overlay(text) {
  progress_overlay_elt.textContent = text;
  progress_overlay_elt.style.display = 'block';
}

function hide_overlay () {
  progress_overlay_elt.style.display = 'none';
}

// ***************************************** Claude ***************************************

// TODO: in the webkit version, don't want to require a password in order to decode the api_key, therefore want the api_key to be stored there.
// can have a  getAPIKey message.  Is there any advantage to not sending the api key to webkit and just talking to claude from swift?


// Generated by encrypt-key.mjs
const CLAUDE_KEY = {"salt":"3D1RJZVP8CYRWOVwMQVm+Q==","iv":"3e42zkuRgz+rpNtq","data":"Agyq7XlVyKZ5TZKispu42hDI9ZdiKeJ8RUuh5blzIBFReU1A8K7M3DMCXhmDmQbDnicrbafE+BVG0Sm1CXNMN/8kTxpYR7OERKLZXM1zYsGYcDPIzfhO3pH3JXpWhBAntA6vAdgTdhHi2QxepMapfyboq36YJ4yyfOiefw=="};

let cached_claude_promise = null;
async function get_claude_key() {
  return await (cached_claude_promise ||= decrypt_key(CLAUDE_KEY))
}

async function ask_claude (overlay_text, system, words) {
  const api_key = await get_claude_key();
  if (!api_key) return null;
  try {
    if (overlay_text) show_overlay(overlay_text);
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
    if (!data || data.content.length == 0) { console.log('Error getting claude response'); return null; }
    return data.content[0].text;
  }
  finally { if (overlay_text) hide_overlay(); }
}
