const COLS = 20;

document.documentElement.style.setProperty('--cols', COLS);

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

// Word indices are 0 based, letter indices are 1-based, for reasons...
const word_labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

function word_index_label (word_index) {
  return word_labels[word_index % word_labels.length].repeat(Math.trunc(word_index / word_labels.length)+1);
}

// maybe convert to 0 based, then this would 1+
function letter_index_label (letter_index) { return letter_index }

// puzzle_cells is an array of cell data, either {char:nonletter} or {char:letter, letter_index, word_index, word_position },
// where word_index is an index in puzzzle_words.
// puzzle_words is an array of {word, clue, letters} where letters is an array of {char, cell}
let puzzle_cells = null;
let puzzle_words = null;

// Compute puzzle_cells and puzzle_words from puzzle description.
function init_puzzle_data (puzzle) {
  let next_letter_index = 1; // one-based, because user visible -- or maybe make it 0-based, and just have a letter_index_label()...
  const available_cells = {}; // each letter -> all the possible cells for it.

  puzzle_cells = [...puzzle.quote.toUpperCase()].map((ch, index) => {
    const cell = { index: index, char: ch };
    if (is_letter(ch)) {
      cell.letter_index = next_letter_index++;
      (available_cells[ch] ??= []).push(cell);
    }
    return cell;
  });

  console.log({puzzle_cells: puzzle_cells, available: available_cells});
  if (next_letter_index === 1) {
    return report_bad_puzzle('No letters in quote!');
  }

  puzzle_words = puzzle.words.map((arr, word_index) => {
    const word = arr[0].toUpperCase();
    const clue = arr[1];
    return { index: word_index,
             word: word,
             clue: clue,
             letters: [...word].map((ch, char_index) => {
               const cell = available_cells[ch].pop(); // claim this cell
               cell.word_index = word_index;
               cell.word_position = char_index;
               return {index: char_index, char: ch, cell: cell }
             }) }
  });
}

function grid_navigation (e, i, inputs) {
  if (e.key === 'Backspace' && !inputs[i].value && i > 0) {
    e.preventDefault();
    inputs[i - 1].focus();
    inputs[i - 1].select();
  } else if (e.key === 'ArrowLeft' && i > 0) {
    e.preventDefault();
    inputs[i - 1].focus();
  } else if (e.key === 'ArrowRight' && i + 1 < inputs.length) {
    e.preventDefault();
    inputs[i + 1].focus();
  }
}

function render_grid(puzzle) {
  init_puzzle_data (puzzle);

/*
  // Pad last row to a full COLS width with empty black cells.
  const totalCells = Math.ceil(cells.length / COLS) * COLS;
  while (cells.length < totalCells) cells.push({ letter: false, ch: '' });
*/

  // Render.
  const grid = document.getElementById('quote-grid');
  grid.innerHTML = '';

  for (const cell of puzzle_cells)
    if (cell.letter_index) {
      add_div(grid, 'grid-cell letter-cell',
              el => { add_div(el, 'cell-id-row',
                              elt => { add_span(elt, 'cell-id-left', letter_index_label(cell.letter_index));
                                       add_span(elt, 'cell-id-right', word_index_label(cell.word_index))
                                     });
                      add_div(el, 'cell-input-container',
                              elt => { add_input(elt, 'text', inp => { inp.maxLength = 1;
                                                                       // will probably want to store something in inp.dataset, but worry about that later
                                                                       // inp.dataset.idx = cell.letter_index;
                                                                     })  });
                    });

    } else {
      add_div(grid, 'grid-cell punct-cell',
              // why bother checking, why not just add a blank text?
              el => { if (cell.char.trim()) add_span(el, 'punct-cell-text', cell.char); });
    }

  const inputs = [...grid.querySelectorAll('.cell-input-container input')];

  // Keyboard navigation.
  inputs.forEach((inp, i) => {
    inp.addEventListener('keydown', e => grid_navigation(e, i, inputs));
    inp.addEventListener('input', () => {
      inp.value = letters_of(inp.value);
      if (inp.value && i + 1 < inputs.length) inputs[i + 1].focus();
    });
  });
}



render_grid(test_puzzle);
