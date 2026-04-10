// Is there really no predefined way to do something like this??
const audio_ctx = new AudioContext();
function beep() {
  const osc = audio_ctx.createOscillator();
  osc.connect(audio_ctx.destination);
  osc.frequency.value = 440;
  osc.start();
  osc.stop(audio_ctx.currentTime + 0.1);
}

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
