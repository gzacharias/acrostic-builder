// TODO: add autossave so reload doesn't clear everything
// TODO: add '(n words)' at end of clue as needed.
// TODO: in builder, provide support for a source label, would be like "Author only", and add it here.
// TODO: tooltips.
// TODO: make up/down arrow work in the grid
// TODO: way to control Show_Illegal, also go-to-next-cell-on-input.
// TODO: should resize as window changes.


let Show_Illegal = false; // user option, currently ignored.

const COLS = 20;

document.addEventListener('keydown', e => {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const grid_cell = document.querySelector('.grid-cell.selected');
    if (grid_cell) {
      // When user selects some random static text on the page, activeElements becomes the whole body, and
      // so input is thrown away. Ideally we'd remember which section user was in last so can return focus
      // to it.  For now always just go to the grid.
      const grid_input = grid_cell.querySelector('input');
      if (!Object.values(grid_input._inputs).includes(document.activeElement)) {
        e.preventDefault();
        grid_input.focus();
        // Now pass the key on to the grid.
        grid_input.dispatchEvent(new KeyboardEvent('keydown', {
          key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, bubbles: true
        }));
      }
    }};
});

// just here so can add debugging statements when needed
function change_focus (inp) {
  inp.focus();
}

function handle_letter_input (e, inputs, this_input) {
  // so really don't need to pass this_input in...
  if (this_input !== document.activeElement) bug();
  if (inputs[+this_input.dataset.index] !== this_input) bug();
  function move_by (offset) {
    let pos = +this_input.dataset.index + offset;
    if (pos < 0)  pos = inputs.length - 1;
    if (pos >= inputs.length) pos = 0;
    inputs[pos].focus();
  }
  function set_value (ch) {
    const ans = this_input.dataset.answer;
    [...Object.values(this_input._inputs)].forEach(inp => { inp.value = ch;
                                                            inp.classList.toggle('illegal', ch && ch !== ans); })
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (is_letter(e.key)) {
      set_value(e.key.toUpperCase());
      move_by(+1);
    }
    else if (e.key == ' ') { // delete and stay in place
      set_value('');
    }
    else {} // Ignore.  Might want to beep or something.
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    set_value('');
    move_by(-1);
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
    e.preventDefault();
    move_by(-1);
  } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    move_by(+1);
  }
}

function handle_selection_change (grid_input) {
  const selected = document.querySelectorAll('.selected');
  if (selected) selected.forEach((elt, i) => elt.classList.remove('selected'));
  grid_input.closest('.grid-cell').classList.add('selected');
  grid_input._inputs.clue.classList.add('selected');
  grid_input._inputs.source?.classList.add('selected');
}




// Taken from puzzlebaron, only for testing.
const test_puzzle = {
  "format": 4,
  "quote": "And indeed it could be said that once the faintest stirring of hope became possible, the dominion of plague was ended.",
  "uuid": "lasjkd;asjfd",
  "name": "test puzzle",
  "source": "Albert Camus",
  "words":["s the crow",
           "a Boheme",
           "otanist",
           "pic poet",
           "opes-off",
           "ied-to",
           "hanneled",
           "bolished",
           "agnitudes",
           "nidentified",
           "addening"],
  "clues": [["As the crow", "___ flies"],
            ["La Boheme", "Inspiration for Rent"],
            ["Botanist", "Plant studier"],
            ["Epic poet", "Homer or Dante"],
            ["Ropes-off", "Secures, as a crime scene"],
            ["Tied-to", "Connected with"],
            ["Channeled", "Did a psychic's job, maybe"],
            ["Abolished", "Put an end to"],
            ["Magnitudes", "Extents"],
            ["Unidentified", "Part of U.F.O."],
            ["Saddening", "Depressing"]]
};

function report_bad_puzzle (message) {
  // DO TO: Need a more graceful exit.
  console.log(message);
  debugger;
  return null;
}


function word_index_label (word_index) {
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  return labels[word_index % labels.length].repeat(Math.trunc(word_index / labels.length)+1);
}

function letter_index_label (letter_index) { return letter_index+1 }

function check_puzzle_complete (puzzle) {
  const source_letters = letters_of(puzzle.source);
  const words = puzzle.words;
  if (words.length != puzzle.clues.length || words.length != source_letters.length)
    return false;
  if (words.some((word_input, index) => { const clue = puzzle.clues[index];
                                          return !clue[1] || (source_letters[index] + word_input) !== clue[0]; }))
    return false;

  const all_letters = letters_of(puzzle.quotation);
  let len = all_letters.length;
  const counts = {};
  for (const ch of all_letters) counts[ch] = (counts[ch] ?? 0) + 1;
  if ((len -= source_letters.length) < 0) return false;

  for (const ch of source_letters) if (counts[ch] > 0) counts[ch]--; else return false;
  for (const word of words) {
    const word_letters = letters_of(word);
    if ((len -= word_letters.length) < 0) return false;
    for (const ch of word_letters) if (counts[ch] > 0) counts[ch]--; else return false;
  }
  return len === 0;
}

function init_puzzle_data (puzzle) {
  if (!check_puzzle_complete(puzzle)) {
    alert ('incomplete puzzle');
    return;
  }

  let next_letter_index = 0;
  const available_cells = {}; // each letter -> all the possible cells for it.

  const quote_cells = [...puzzle.quotation.toUpperCase()].map((ch, index) => {
    const cell = { index: index, char: ch };
    if (is_letter(ch)) {
      cell.letter_index = next_letter_index++;
      (available_cells[ch] ??= []).push(cell);
    }
    return cell;
  });


  if (next_letter_index === 0) {
    return report_bad_puzzle('No letters in quote!');
  }

  let clue_index = 0;
  const source_letters = letters_of(puzzle.source);
  const words = puzzle.words.map((word_input, word_index) => {
    const word = source_letters[word_index] + word_input;
    return { word: word,
             clue: puzzle.clues[word_index][1],
             letters: [...letters_of(word)].map(ch => {
               const cell = available_cells[ch].pop(); // claim this cell
               cell.word_index = word_index;
               cell.clue_index = clue_index;
               return {char: ch, clue_index: clue_index++, letter_index: cell.letter_index };
             }) }
  });
  return { quote_cells,  words}
}
//  cells  { char, letter_index, word_index, clue_index }
//  words  { word[text], clue[text], letters }
// letter { char, clue_index, letter_index} // or maybe cell.letter_index.

function add_letter_input (parent, index, answer, container, init_fn) {
  function init_input (inp) {
    inp.dataset.index = index;
    inp.dataset.answer = answer;
    inp._inputs = {self: inp};
    if (container)
      container.addEventListener('click', () => change_focus(inp));
    if (init_fn) init_fn(inp);
  }
  return add_text_input(parent, 'letter-input', init_input);
}

function render_puzzle (puzzle_data) {

  document.documentElement.style.setProperty('--cols', COLS);

  /*********************  Grid ************************/
  const grid = document.getElementById('quote-grid');
  grid.innerHTML = '';
  for (const cell_data of puzzle_data.quote_cells)
    if (cell_data.letter_index != null)
      add_div(grid, 'grid-cell letter-cell',
              cell => { add_div(cell, 'cell-id-row',
                                elt => { add_span(elt, 'cell-id-left', letter_index_label(cell_data.letter_index));
                                         add_span(elt, 'cell-id-right', word_index_label(cell_data.word_index))
                                       });
                        add_div(cell, 'cell-input-container',
                                elt => add_letter_input(elt, cell_data.letter_index, cell_data.char, cell));
                      });

    else
      add_div(grid, 'grid-cell punct-cell', el => add_span(el, 'punct-cell-text', cell_data.char));
  const grid_inputs = [...grid.querySelectorAll('.cell-input-container .letter-input')];
     

  function add_clue_box (container, loc, index, ltr) {
    function connect_input (new_inp) {
      const grid_input = grid_inputs[ltr.letter_index];
      new_inp._inputs.grid = grid_input;
      grid_input._inputs[loc] = new_inp;
      const other_loc = (loc === 'clue' ? 'source' : 'clue');
      const other_input = grid_input._inputs[other_loc];
      if (other_input) {
        other_input._inputs[loc] = new_inp;
        new_inp._inputs[other_loc] = other_input;
      }
    }
    return add_div(container, 'clue-box',
                   box => { add_letter_input(box, index, ltr.char, box, connect_input);
                            add_span(box, 'clue-box-number', letter_index_label(ltr.letter_index));
                        });
  }

  /*********************  Source  line ************************/
  const src_container = document.getElementById('source-container');
  src_container.innerHTML = '';

  add_span(src_container, 'source-label', "Source:");

  puzzle_data.words.forEach((word_data, word_index) => {
    const letter = word_data.letters[0];
    add_clue_box(src_container, 'source', word_index, letter);
  });
  const source_inputs = [...src_container.querySelectorAll('.letter-input')];

  /*********************  Clues ************************/
  const clue_container = document.getElementById('clues-container');
  clue_container.innerHTML = '';
  const col1 = add_div(clue_container, 'clues-column');
  const col2 = add_div(clue_container, 'clues-column');

  const split = Math.ceil(puzzle_data.words.length / 2);

  puzzle_data.words.forEach ((word_data, word_index) => {
    const row = add_div(word_index < split ? col1 : col2, 'clue-row');
    add_span(row, 'clue-label', word_index_label(word_index));
    add_div(row, 'clue-content',
            elt => { add_div(elt, 'clue-boxes',
                             elt => { for (const letter of word_data.letters) add_clue_box(elt, 'clue', letter.clue_index, letter) });
                     add_span(elt, 'clue-text', word_data.clue);
                   });
  });
  const clue_inputs = [...clue_container.querySelectorAll('.clue-box .letter-input')];


  /*********************  Event handling ************************/

  for(const inp of grid_inputs) {
    inp.addEventListener('keydown', e => handle_letter_input(e, grid_inputs, inp));
    inp.addEventListener('focus', () => handle_selection_change(inp));
  };

  for (const inp of source_inputs) {
    inp.addEventListener('keydown', e => handle_letter_input(e, source_inputs, inp));
    inp.addEventListener('focus', () => handle_selection_change(inp._inputs.grid));
  }

  for (const inp of clue_inputs) {
    inp.addEventListener('keydown', e => handle_letter_input(e, clue_inputs, inp));
    inp.addEventListener('focus', () => handle_selection_change(inp._inputs.grid));
  };
}


(async () => { 
  const file  = await select_puzzle_dialog(get_user_name(),
                                           file => check_puzzle_complete(read_data(file.content)) );
  const data = file ? read_data(file.content) : test_puzzle;
  const info = init_puzzle_data(data);
  render_puzzle(info);
})();





