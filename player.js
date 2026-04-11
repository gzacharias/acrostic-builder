// TODO: save in reasonable format
// TODO: add panel to show quote source
// TODO: add button for Show Illegal
//  TODO: in builder, provide support for a source hint, would be like "Author only"


// TODO: tooltips.
// TODO: make up/down arrow work in the grid
// TODO: show which cell (in grid or in clues) is actually the focus, which determines motion.
//    In fact, maybe should just show whole grid or whole clue area being selected, as it's
//    not about the current cell, but what the next one will be.
// TODO: option to show errors.



let Show_Illegal = false; // user option



const COLS = 20;

document.documentElement.style.setProperty('--cols', COLS);

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

function handle_letter_input (e, inputs, this_input) {
  if (inputs[+this_input.dataset.index] !== this_input) debugger;
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




// This will eventually come from a loaded puzzle file.
// Expected shape:
//   puzzle.quote    — string, the full quotation text
//   puzzle.source   — string, attribution
//   puzzle.words    — array of { clue, letters: [...letterIndices] }
//                     where letterIndices are 1-based indices into the
//                     sequence of letters in the quote.
//
// For now, word assignments are synthesized by cycling.
// Right now, we save words which are missing the initial letter, and the clues

const test_puzzle = {
  quote: "What thou lovest well remains, The rest is dross.",
  source: "Ezra Pound, The Pisan Cantos",
  words: [["WHATWELL", "Not who or when"],
          ["THOUTHE", "foo fie fum"],
          ["ISLOVE", "another"],
          ["RESTST", "fie"],
          ["REDRMAINOSSS", "can't imagine any better"]]
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

function init_puzzle_data (puzzle) {
  let next_letter_index = 0;
  const available_cells = {}; // each letter -> all the possible cells for it.

  const quote_cells = [...puzzle.quote.toUpperCase()].map((ch, index) => {
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
  const words = puzzle.words.map((arr, word_index) => {
    const word = arr[0].toUpperCase();
    const clue = arr[1];
    return { word: word,
             clue: clue,
             letters: [...word].map(ch => {
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

function render_puzzle (puzzle_data) {

  function add_letter_input (parent, index, answer, container, init_fn) {
    return add_text_input(parent, 'letter-input', elt => { elt.dataset.index = index;
                                                           elt.dataset.answer = answer;
                                                           elt._inputs = {self: elt};
                                                           if (container)
                                                             container.addEventListener('click', () => elt.focus());
                                                           if (init_fn) init_fn(elt);
                                                         });
  }

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
                      })

    else
      add_div(grid, 'grid-cell punct-cell', el => add_span(el, 'punct-cell-text', cell_data.char));
  const grid_inputs = [...grid.querySelectorAll('.cell-input-container .letter-input')];


  const src_container = document.getElementById('source-container');
  src_container.innerHTML = '';

  for (const word_data of puzzle_data.words) {
    const initial = word_data.letters[0];
    const box = add_div(src_container, 'source-box',
                        box => { add_letter_input(box, word_data.word_index, initial.char, box,
                                                  elt => { elt.classList.add('source-input');
                                                           const grid_input = grid_inputs[initial.letter_index];
                                                           elt._inputs.grid = grid_input;
                                                           grid_input._inputs.source = elt;
                                                         });
                               });
  }

  const source_inputs = [...src_container.querySelectorAll('.letter-input')];


  const container = document.getElementById('clues-container');
  container.innerHTML = '';
  const col1 = add_div(container, 'clues-column');
  const col2 = add_div(container, 'clues-column');

  const split = Math.ceil(puzzle_data.words.length / 2);

  puzzle_data.words.forEach ((word_data, word_index) => {
    const row = add_div(word_index < split ? col1 : col2, 'clue-row');
    add_span(row, 'clue-label', word_index_label(word_index));
    add_div(row, 'clue-content',
             elt => { add_div(elt, 'clue-boxes',
                               elt => {for (const ltr of word_data.letters)
                                          add_div(elt, 'clue-box',
                                                  box => { add_letter_input(box, ltr.clue_index, ltr.char, box,
                                                                            elt => { const grid_input = grid_inputs[ltr.letter_index];
                                                                                     grid_input._inputs.clue = elt;
                                                                                     elt._inputs.grid = grid_input;
                                                                                     const source_input = grid_input._inputs.source;
                                                                                     if (source_input) {
                                                                                       source_input._inputs.clue = elt;
                                                                                       elt._inputs.source = source_input;
                                                                                     }});
                                                           add_span(box, 'clue-box-number',letter_index_label(ltr.letter_index));
                                                          }) });
                      add_span(elt, 'clue-text', word_data.clue);
                    });
  });
  const clue_inputs = [...container.querySelectorAll('.clue-box .letter-input')];

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





render_puzzle(init_puzzle_data(test_puzzle));
