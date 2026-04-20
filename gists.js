const GISTS_GITHUB_KEY = {"salt":"0cHUwtSEypu38nxB7iOYjA==","iv":"OICYj0TZfHrqe0+e","data":"LZwwVgaCwJTkVPL4NWm4owQD3+Ne2iAFxndeAeL8+83qne7jPoEhf/nT3/Vef2qUWQlEZV+jahM="};

const REGISTRY_GIST_ID = '1ffcabe8f9baa5cddb7e2d12d3bf2898';

let cached_github_key_promise = null;
async function gist_fetch (url, method, content) {
  const key = await (cached_github_key_promise ||= decrypt_key(GISTS_GITHUB_KEY));
  return do_fetch(url, method, { 'Authorization': `token ${key}`,
                                 'Accept': 'application/vnd.github.v3+json' }, content);
}


// Checks localStorage first, then registry.
// Creates new gist if username is unclaimed.
async function get_gist_url () {
  const username = Puzzle.username;// puzzle_username();
  const stored = localStorage.getItem('acrostic.gist_url');
  if (stored) return stored;
  const registry_data = await gist_fetch(`https://api.github.com/gists/${REGISTRY_GIST_ID}`, 'GET');
  const registry = JSON.parse(registry_data.files['registry.json'].content);
  function register_url_for(id) {
    const url = `https://api.github.com/gists/${id}`;
    localStorage.setItem('acrostic.gist_url', url);
    return url;
  }

  // Not a normal situation. ***** TODO: Reexamine this once settle on how we first get the username
  if (registry[username]) {
    // username exists but no gist_url in local storage.  Could have cleared localStorage, or using
    // a different browser, or something funky happened when getting the user name.
    return register_url_for(registry[username]);
  }

  // New user — create their gist and register them
  const data = await gist_fetch('https://api.github.com/gists', 'POST', 
                                { description: `Acrostic puzzles – ${username}`,
                                  public: false,
                                  files: { '.keep': { content: '{}' } }  // gists need at least one file.
                                });
  const gist_id = data.id;
  // Update registry
  registry[username] = gist_id;
  await gist_fetch(`https://api.github.com/gists/${REGISTRY_GIST_ID}`, 'PATCH', 
                   { files: { 'registry.json': { content: JSON.stringify(registry) } } });

  return register_url_for(gist_id);
}

async function store_puzzle(name, puzzle_data) {
  await gist_fetch(await get_gist_url(), 'PATCH', 
                   { files: { [name]: { content: JSON.stringify(puzzle_data) } } });
}


// Sigh, this loads the whole gist.  If this becomes a problem, could store a list of puzzles in .keep...
async function puzzle_exists (name) {
  const data = await gist_fetch(await get_gist_url(), 'GET');
  return data.files[name] != null
}


async function select_puzzle_dialog () {
  const data = await gist_fetch(await get_gist_url(), 'GET');
  // TODO: change to puzzle files having a prefix or suffix, rather than enumerating
  // all files that are NOT puzzles.
  const puzzle_files = Object.entries(data.files).filter(([name, content]) => name !== '.keep');
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    add_div(overlay, 'load-dialog', d => {
      add_div(d, 'dialog-title', t => t.textContent = 'Load Puzzle');
      const list = add_div(d, 'puzzle-list');
      for (const [name, file_data] of puzzle_files) {
        add_div(list, 'puzzle-item', item => {
          item.textContent = name;
          item.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve({name: name, content: JSON.parse(file_data.content)});
          });
          item.addEventListener('contextmenu', e => {
            e.preventDefault();
            // future: show_puzzle_preview(item, content);
          });
        });
      }
      add_div(d, 'dialog-cancel', btn => {
        btn.textContent = 'Cancel';
        btn.addEventListener('click', () => {
          document.body.removeChild(overlay);
          resolve(null);
        });
      });
    });
    document.body.appendChild(overlay);
  });
}

