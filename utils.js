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

function bug (msg) {
  if (msg) console.log(msg);
  // alert('bug: '+msg);
  debugger; // this doesn't seem to be working!
}

function map_to_str (things, fn) { return [...things].map(fn).join(''); }

function is_letter(ch) {
  return /\p{L}/u.test(ch);
}

function letters_of (bag_of_chars) {
  if (bag_of_chars == null) {
    console.log("bad call to letters_of");
    debugger;
  }
  return [...bag_of_chars].filter(is_letter).join('').toUpperCase();
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
