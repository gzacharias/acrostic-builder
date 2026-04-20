////// just for debugging
function show_storage () {
  for (let i = 0; i < localStorage.length; i++) {
    console.log(localStorage.key(i), localStorage.getItem(localStorage.key(i)));
  }
}

function show_gist () {
}
//////


async function decrypt_key(encrypted_key) {
  let passphrase = localStorage.getItem('acrostic.passphrase');
  if (!passphrase) {
    passphrase = prompt('Enter password:');
    if (!passphrase) return null;
  }
  const key = await decrypt_key_with_passphrase(encrypted_key, passphrase);
  if (!key) {
    localStorage.removeItem('acrostic.passphrase');
    alert('Wrong passphrase');
    return null;
  }
  localStorage.setItem('acrostic.passphrase', passphrase);
  return key;
}

async function decrypt_key_with_passphrase(encrypted_key, passphrase) {
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
    return new TextDecoder().decode(decrypted);
  } catch {
    return null; // wrong passphrase
  }
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
const audio_ctx = new AudioContext();
const beep_gain = audio_ctx.createGain();
{ beep_gain.connect(audio_ctx.destination);
  beep_gain.gain.value = 0;
  const beep_osc = audio_ctx.createOscillator();
  beep_osc.frequency.value = 880;
  beep_osc.connect(beep_gain);
  beep_osc.start();
}

function beep() {
  beep_gain.gain.cancelScheduledValues(audio_ctx.currentTime);
  beep_gain.gain.setValueAtTime(0.1, audio_ctx.currentTime);
  beep_gain.gain.setValueAtTime(0, audio_ctx.currentTime + 0.05);
}

// TODO: set up global error handling so this can abort
function bug (msg) {
  if (msg) console.log(msg);
  debugger;  // this often doesn't work in safari
  const err = new Error().stack;
  console.log(err.stack); 
}

function map_to_str (things, fn) { return [...things].map(fn).join(''); }

function is_letter(ch) {
  return /\p{L}/u.test(ch);
}

function letters_of (bag_of_chars) {
  if (bag_of_chars == null) bug("bad call to letters_of");
  return [...bag_of_chars].filter(is_letter).join('').toUpperCase();
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
      if (!start_set && start - pos < node_len) {
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
  if (elt.textContent !== str) elt.textContent = str;
}
