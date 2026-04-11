// TODO: add panel to show quote source
// TODO: add button for Show Illegal


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
    const grid_input = grid_cell?.querySelector('input');
    const clue_input = document.querySelector('.clue-box input.selected');
    if (grid_input && clue_input) {
      if (document.activeElement !== grid_input && document.activeElement !== clue_input) {
        // When user selects some random static text on the page, activeElements becomes the whole body.
        // Ideally we'd remember which section user was in last so can return focus to it.  For now always
        // just go to the grid.
        e.preventDefault();
        grid_input.focus();
        // Now pass the key on to the grid.
        grid_input.dispatchEvent(new KeyboardEvent('keydown', {
          key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, bubbles: true
        }));
      }
    }
    else // just a sanity check
      if (grid_input || clue_input) debugger; /* should be both or none */
  }
});


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

  quote_cells = [...puzzle.quote.toUpperCase()].map((ch, index) => {
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
  words = puzzle.words.map((arr, word_index) => {
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
                                elt => add_text_input(elt, 'letter-input', elt => { elt.dataset.index = cell_data.letter_index;
                                                                                    elt.dataset.answer = cell_data.char;
                                                                                    cell.addEventListener('click', () => elt.focus());
                                                                                  }));
                      })

    else
      add_div(grid, 'grid-cell punct-cell', el => add_span(el, 'punct-cell-text', cell_data.char));
  const grid_inputs = [...grid.querySelectorAll('.cell-input-container .letter-input')];

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
                                                  box => { add_text_input(box, 'letter-input', elt => { elt.dataset.index = ltr.clue_index;
                                                                                                        elt.dataset.answer = ltr.char;
                                                                                                        const grid_input = grid_inputs[ltr.letter_index];
                                                                                                        elt._grid_input = grid_input;
                                                                                                        grid_input._clue_input = elt;
                                                                                                        // Any click in the box, focus on me!
                                                                                                        box.addEventListener('click', () => elt.focus());
                                                                                                      });
                                                           add_span(box, 'clue-box-number',letter_index_label(ltr.letter_index));
                                                          }) });
                      add_span(elt, 'clue-text', word_data.clue);
                    });
  });
  const clue_inputs = [...container.querySelectorAll('.clue-box .letter-input')];

  for(const inp of grid_inputs) {
    inp.addEventListener('keydown', e => handle_letter_input(e, grid_inputs, inp, inp._clue_input));
    inp.addEventListener('focus', () => handle_focus(inp, inp._clue_input));
  };

  for (const inp of clue_inputs) {
    inp.addEventListener('keydown', e => handle_letter_input(e, clue_inputs, inp, inp._grid_input));
    inp.addEventListener('focus', () => handle_focus(inp._grid_input, inp))
  };
}




function handle_letter_input (e, inputs, this_input, other_input) {
  if (inputs[+this_input.dataset.index] !== this_input) debugger;
  function move_by (offset) {
    let pos = +this_input.dataset.index + offset;
    if (pos < 0)  pos = inputs.length - 1;
    if (pos >= inputs.length) pos = 0;
    inputs[pos].focus();
  }
  function set_value (ch) {
    this_input.value = ch;
    other_input.value = ch;
    const ans = this_input.dataset.answer;
    console.log('set value', ch, ans);
    if (ans !== other_input.answer) debugger;
    this_input.classList.toggle('illegal', ch !== ans);
    other_input.classList.toggle('illegal', ch !== ans);
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

function handle_focus (grid_input, clue_input) {
  const selected = document.querySelectorAll('.selected');
  if (selected) selected.forEach((elt, i) => elt.classList.remove('selected'));
  grid_input.closest('.grid-cell').classList.add('selected');
  clue_input.classList.add('selected');
}

render_puzzle(init_puzzle_data(test_puzzle));
