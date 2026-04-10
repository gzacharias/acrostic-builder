const COLS = 20;

document.documentElement.style.setProperty('--cols', COLS);

document.addEventListener('keydown', e => {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const selected = document.querySelector('.grid-cell.selected');
    if (selected) {
      const input = selected.querySelector('input');
      if (input && document.activeElement !== input) {
        input.focus();
        // don't need to set value here, the input's own keydown/input handlers will fire
      }
    }
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
  for (const cell of puzzle_data.quote_cells)
    if (cell.letter_index != null)
      add_div(grid, 'grid-cell letter-cell',
              el => { add_div(el, 'cell-id-row',
                              elt => { add_span(elt, 'cell-id-left', letter_index_label(cell.letter_index));
                                       add_span(elt, 'cell-id-right', word_index_label(cell.word_index))
                                     });
                      add_div(el, 'cell-input-container',
                              elt => add_text_input(elt, 'letter-input', elt => { elt.dataset.index = cell.letter_index;
                                                                                  elt._cell_data = cell; // is this used?
                                                                                }));
                    })

    else
      add_div(grid, 'grid-cell punct-cell', el => add_span(el, 'punct-cell-text', cell.char));
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
                                                  elt => { add_text_input(elt, 'letter-input', elt => { elt.dataset.index = ltr.clue_index;
                                                                                                        const grid_input = grid_inputs[ltr.letter_index];
                                                                                                        elt._grid_input = grid_input;
                                                                                                        grid_input._clue_input = elt;
                                                                                                      });
                                                           add_span(elt, 'clue-box-number',letter_index_label(ltr.letter_index));
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
    inputs[pos].select();
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (is_letter(e.key)) {
      const ch = e.key.toUpperCase();
      this_input.value = ch; other_input.value = ch;
      move_by(+1);
    }
    else if (e.key == ' ') { // delete and stay in place
      this_input.value = ''; other_input.value = '';
    }
    else {} // Ignore.  Might want to beep or something.
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    this_input.value = ''; other_input.value = '';
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
