// Holt, a Notion-style theme for An Otter Wiki. https://github.com/ryan-jan/otterwiki-holt

// Moves the page's own actions out of the site navbar into a row above the page, beside the
// breadcrumbs, as Notion and Confluence do. Otter Wiki puts Edit in the navbar and lists the page
// tools (attachments, history and so on) at the top of the site menu, before its first divider.
(() => {
  const breadcrumbs = document.querySelector('#column-main nav[aria-label="Breadcrumbs"]');
  const siteMenu = document.querySelector('.navbar .dropdown-menu');
  if (!breadcrumbs || !siteMenu) return;

  const tools = [];
  for (const item of siteMenu.children) {
    if (item.classList.contains('dropdown-divider')) break;
    tools.push(item);
  }
  if (!tools.some((item) => item.getAttribute('href')?.endsWith('/attachments'))) return;
  tools.at(-1).nextElementSibling?.remove();

  const bar = document.createElement('div');
  bar.className = 'holt-pagebar';
  breadcrumbs.before(bar);
  const actions = document.createElement('div');
  actions.className = 'holt-pagebar-actions';
  bar.append(breadcrumbs, actions);

  const edit = document.getElementById('edit-page-btn');
  if (edit) actions.append(edit);

  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown';
  const toggle = document.createElement('button');
  toggle.className = 'btn btn-action';
  toggle.type = 'button';
  toggle.id = 'holt-page-menu-btn';
  toggle.title = 'Page actions';
  toggle.dataset.toggle = 'dropdown';
  toggle.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu dropdown-menu-right w-200';
  menu.setAttribute('aria-labelledby', toggle.id);
  menu.append(...tools);
  dropdown.append(toggle, menu);
  actions.append(dropdown);

  // Notion's "Full width" switch. Otter Wiki has nowhere to keep per-page display settings, so each
  // browser remembers it per page.
  const page = tools.find((item) => item.getAttribute('href')?.endsWith('/attachments'));
  const key = `holt-full-width:${page.getAttribute('href').replace(/\/attachments$/, '')}`;
  const stored = () => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };

  const divider = document.createElement('div');
  divider.className = 'dropdown-divider holt-full-width-divider';
  const fullWidth = document.createElement('button');
  fullWidth.type = 'button';
  fullWidth.className = 'dropdown-item-with-icon holt-full-width-toggle';
  fullWidth.setAttribute('role', 'menuitemcheckbox');
  fullWidth.innerHTML =
    '<span class="dropdown-icon"><i class="fas fa-arrows-alt-h"></i></span>Full width' +
    '<span class="holt-switch" aria-hidden="true"></span>';
  menu.append(divider, fullWidth);

  const apply = (on) => {
    document.body.classList.toggle('holt-full-width', on);
    fullWidth.setAttribute('aria-checked', String(on));
  };
  apply(stored());

  fullWidth.addEventListener('click', (event) => {
    // Keep the menu open so the switch can be seen to change, as in Notion.
    event.stopPropagation();
    const on = !document.body.classList.contains('holt-full-width');
    apply(on);
    try {
      if (on) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch {
      // Without storage it still applies until the page is left.
    }
  });
})();

// Turns the right-hand "On this page" column into Notion's floating outline: a short line per
// heading at the page's right edge, which opens into the full outline on hover or focus, or on tap
// on a touch screen. The links themselves move into the panel, so the highlighting below keeps
// working on them. Below 1200px Otter Wiki hides that column and keeps its copy in the sidebar.
(() => {
  const outline = document.querySelector('#column-extra #extranav-toc');
  const links = outline ? [...outline.querySelectorAll('a.sidebar-link')] : [];
  if (links.length < 2) return;

  const toc = document.createElement('nav');
  toc.className = 'holt-toc';
  toc.setAttribute('aria-label', 'On this page');

  const ladder = document.createElement('div');
  ladder.className = 'holt-toc-ladder';
  ladder.setAttribute('aria-hidden', 'true');
  for (const link of links) {
    const rung = document.createElement('span');
    const level = link.className.match(/sidebar-toc-(\d)/)?.[1] ?? '1';
    rung.className = `holt-toc-rung holt-toc-rung-${level}`;
    rung.dataset.tocHref = link.href;
    ladder.append(rung);
  }

  const panel = document.createElement('div');
  panel.className = 'holt-toc-panel';
  panel.append(...links);

  toc.append(ladder, panel);
  document.getElementById('page-wrapper').append(toc);

  // Like Notion, the first line sits level with the page's title row, measured as if the page were
  // scrolled to the top, and the outline stays there as the page scrolls.
  const content = document.getElementById('content-wrapper');
  const first = document.querySelector('.page')?.firstElementChild;
  const place = () => {
    if (!first || !ladder.offsetParent) return;
    const box = first.getBoundingClientRect();
    const rowHeight = /^H\d$/.test(first.tagName)
      ? box.height
      : parseFloat(getComputedStyle(first).lineHeight) || box.height;
    const row = box.top + content.scrollTop + rowHeight / 2;
    const rung = ladder.firstElementChild;
    toc.style.setProperty('--holt-toc-top', `${row - rung.offsetTop - rung.offsetHeight / 2}px`);
  };
  place();
  window.addEventListener('load', place);
  window.addEventListener('resize', place);

  const reveal = () => panel.querySelector('.sidebar-active')?.scrollIntoView({ block: 'nearest' });
  toc.addEventListener('mouseenter', reveal);
  toc.addEventListener('focusin', reveal);

  // Touch screens have no hover, so a tap opens the outline and a tap anywhere else, or on a
  // section, closes it.
  ladder.addEventListener('click', () => {
    if (!window.matchMedia('(hover: none)').matches) return;
    toc.classList.add('holt-toc-open');
    reveal();
  });
  document.addEventListener('click', (event) => {
    if (!ladder.contains(event.target)) toc.classList.remove('holt-toc-open');
  });
})();

// Highlights the section being read in "On this page", the way Notion's outline does. Otter Wiki
// highlights the first heading anywhere on screen, so on short pages a clicked section near the
// bottom never stays highlighted. This listener is added after Otter Wiki's, so it wins.
(() => {
  const content = document.getElementById('content-wrapper');
  const headings = [...document.querySelectorAll('.page > :is(h1, h2, h3, h4, h5, h6)')].filter(
    (heading) => heading.querySelector('a.anchor'),
  );
  if (!content || !headings.length) return;

  const hrefOf = (heading) => heading.querySelector('a.anchor').href;
  const links = [...document.querySelectorAll('a.sidebar-link')];

  // A clicked section stays highlighted until the reader scrolls by hand.
  let pinned = null;

  const current = () => {
    if (pinned) return pinned;
    if (content.scrollTop === 0) return headings[0];
    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
      return headings.at(-1);
    }
    // The section being read is the last one whose heading has reached the top quarter.
    const line = content.getBoundingClientRect().top + content.clientHeight / 4;
    const passed = headings.filter((heading) => heading.getBoundingClientRect().top <= line);
    return passed.at(-1) ?? headings[0];
  };

  const rungs = [...document.querySelectorAll('.holt-toc-rung')];

  const highlight = () => {
    const href = hrefOf(current());
    for (const link of links) link.classList.toggle('sidebar-active', link.href === href);
    for (const rung of rungs) rung.classList.toggle('holt-toc-rung-active', rung.dataset.tocHref === href);
  };

  for (const link of links) {
    const heading = headings.find((h) => hrefOf(h) === link.href);
    if (!heading) continue;
    link.addEventListener('click', () => {
      pinned = heading;
      highlight();
      // On phones the sidebar covers the page, so close it once a section is picked, like Notion.
      const wrapper = document.getElementById('page-wrapper');
      if (
        window.matchMedia('(max-width: 768px)').matches &&
        wrapper.getAttribute('data-sidebar-hidden') !== 'hidden'
      ) {
        window.halfmoon.toggleSidebar();
      }
    });
  }

  const unpin = () => {
    pinned = null;
  };
  for (const event of ['wheel', 'touchmove']) {
    content.addEventListener(event, unpin, { passive: true });
  }
  content.addEventListener('keydown', unpin);

  content.addEventListener('scroll', highlight, { passive: true });
  highlight();
})();

// Search as you type in a centred dialog, as in Notion. The navbar's search box becomes a button,
// and Otter Wiki's own form moves into the dialog, so / still opens it and ⌘K or Ctrl+K does too.
// Page and heading names come from the A–Z index and match instantly. Page text is searched
// through Otter Wiki's own search a moment later. Picking a result goes straight to it, and the
// last row opens the full search page as before.
(() => {
  const input = document.querySelector('.navbar #search-query');
  const form = input?.closest('form');
  if (!input || !form) return;

  const MAX_PAGES = 6;
  const MAX_SECTIONS = 4;
  const MAX_TEXT = 5;

  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');

  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'holt-search-button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = '<i class="fas fa-search"></i><span>Search</span>';
  const hint = document.createElement('kbd');
  hint.textContent = mac ? '⌘K' : 'Ctrl K';
  button.append(hint);
  form.before(button);

  const modal = document.createElement('div');
  modal.className = 'holt-search-modal';
  modal.hidden = true;
  const dialog = document.createElement('div');
  dialog.className = 'holt-search-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Search');
  form.prepend(Object.assign(document.createElement('i'), { className: 'fas fa-search' }));
  form.append(Object.assign(document.createElement('kbd'), { textContent: 'Esc' }));

  const panel = document.createElement('div');
  panel.className = 'holt-search';
  panel.id = 'holt-search';
  panel.setAttribute('role', 'listbox');
  panel.hidden = true;
  dialog.append(form, panel);
  modal.append(dialog);
  document.body.append(modal);
  input.setAttribute('aria-controls', panel.id);

  let index = null;
  let items = [];
  let active = 0;
  let textResults = [];
  let textQuery = null;
  let textTimer = null;
  let textRequest = null;

  // The cached index answers straight away, and a fresh copy is fetched once per page in the
  // background, so new and renamed pages turn up without a stale list slowing anything down.
  let refreshed = null;
  const fetchIndex = async () => {
    const response = await fetch('/-/index');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const entries = [];
    for (const block of doc.querySelectorAll('.pageindex-pageblock')) {
      const page = block.querySelector('a.pageindex-page');
      if (!page) continue;
      const href = page.getAttribute('href');
      const path = decodeURIComponent(href.replace(/^\//, ''));
      entries.push({ kind: 'page', title: page.textContent.trim(), path, href });
      for (const heading of block.querySelectorAll('a.pageindex-heading')) {
        entries.push({
          kind: 'section',
          title: heading.textContent.trim(),
          path,
          href: heading.getAttribute('href'),
        });
      }
    }
    index = entries;
    try {
      sessionStorage.setItem('holt-search-index', JSON.stringify(entries));
    } catch {
      // Not cached. The next page fetches it again.
    }
    return index;
  };

  const loadIndex = async () => {
    refreshed ??= fetchIndex();
    if (!index) {
      try {
        const cached = sessionStorage.getItem('holt-search-index');
        if (cached) index = JSON.parse(cached);
      } catch {
        // Storage can be blocked. Wait for the fetch instead.
      }
    }
    return index ?? refreshed;
  };

  const words = (query) => query.toLowerCase().split(/\s+/).filter(Boolean);

  // Every word has to appear. Names that start with the query rank first, then word starts. Pages
  // also match on their folder, but sections only on their heading, or a page name would list
  // every heading in it.
  const score = (entry, terms, query) => {
    const haystack = (entry.kind === 'page' ? `${entry.title} ${entry.path}` : entry.title).toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) return -1;
    const title = entry.title.toLowerCase();
    if (title.startsWith(query)) return 3;
    if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) return 2;
    return 1;
  };

  const nameMatches = (query) => {
    const terms = words(query);
    const lower = query.toLowerCase().trim();
    const ranked = (kind, max) =>
      index
        .filter((entry) => entry.kind === kind)
        .map((entry) => ({ entry, rank: score(entry, terms, lower) }))
        .filter(({ rank }) => rank >= 0)
        .sort((a, b) => b.rank - a.rank || a.entry.title.localeCompare(b.entry.title))
        .slice(0, max)
        .map(({ entry }) => entry);
    return { pages: ranked('page', MAX_PAGES), sections: ranked('section', MAX_SECTIONS) };
  };

  const searchText = async (query) => {
    textRequest?.abort();
    textRequest = new AbortController();
    const body = new FormData();
    body.append('query', query);
    // The form has no token when CSRF protection is off, as it was before Otter Wiki 2.20.
    const token = form.querySelector('input[name="csrf_token"]')?.value;
    if (token) body.append('csrf_token', token);
    const response = await fetch(form.action, { method: 'POST', body, signal: textRequest.signal });
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    return [...doc.querySelectorAll('#column-main h2.content-title > a')].map((link) => {
      const snippet = link.parentElement.nextElementSibling;
      return {
        kind: 'text',
        title: link.textContent.trim(),
        href: link.getAttribute('href'),
        snippet: snippet?.tagName === 'P' ? snippet.textContent.replace(/\[\.\.\]/g, '…').trim() : '',
      };
    });
  };

  // Builds text with each query word wrapped in <mark>, without parsing any HTML.
  const highlighted = (text, query) => {
    const fragment = document.createDocumentFragment();
    const terms = words(query).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!terms.length) {
      fragment.append(text);
      return fragment;
    }
    const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
    text.split(pattern).forEach((part, i) => {
      if (i % 2) {
        const mark = document.createElement('mark');
        mark.textContent = part;
        fragment.append(mark);
      } else if (part) {
        fragment.append(part);
      }
    });
    return fragment;
  };

  const ICONS = { page: 'file-text', section: 'hash', text: 'text-search', all: 'search' };

  const row = (item, query) => {
    const link = document.createElement('a');
    link.className = 'holt-search-item';
    link.href = item.href;
    link.setAttribute('role', 'option');
    link.dataset.icon = ICONS[item.kind];
    const main = document.createElement('span');
    main.className = 'holt-search-title';
    main.append(highlighted(item.title, query));
    link.append(main);
    const detail = item.kind === 'page' ? item.path.split('/').slice(0, -1).join(' / ')
      : item.kind === 'section' ? item.path.split('/').join(' / ')
      : item.snippet;
    if (detail) {
      const sub = document.createElement('span');
      sub.className = 'holt-search-detail';
      sub.append(highlighted(detail, query));
      link.append(sub);
    }
    return link;
  };

  const group = (label) => {
    const heading = document.createElement('div');
    heading.className = 'holt-search-group';
    heading.textContent = label;
    return heading;
  };

  const render = () => {
    const query = input.value.trim();
    panel.replaceChildren();
    items = [];
    if (!query || !index) {
      close();
      return;
    }
    const { pages, sections } = nameMatches(query);
    const seen = new Set(pages.map((page) => page.href));
    const text = (textQuery === query ? textResults : [])
      .filter((result) => !seen.has(result.href))
      .slice(0, MAX_TEXT);

    const add = (label, entries) => {
      if (!entries.length) return;
      panel.append(group(label));
      for (const entry of entries) {
        const link = row(entry, query);
        items.push(link);
        panel.append(link);
      }
    };
    add('Pages', pages);
    add('Sections', sections);
    add('In page text', text);
    if (textQuery !== query) {
      const pending = document.createElement('div');
      pending.className = 'holt-search-pending';
      pending.textContent = 'Searching page text…';
      panel.append(pending);
    }

    const all = row({ kind: 'all', title: `Search all pages for “${query}”`, href: '#' }, '');
    all.addEventListener('click', (event) => {
      event.preventDefault();
      form.submit();
    });
    items.push(all);
    panel.append(all);

    active = Math.min(active, items.length - 1);
    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const select = (i) => {
    active = (i + items.length) % items.length;
    items.forEach((item, j) => item.setAttribute('aria-selected', String(j === active)));
    items[active].scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('focus', () => {
    loadIndex().then(render).catch(() => {});
    refreshed?.then(() => input === document.activeElement && render()).catch(() => {});
  });

  input.addEventListener('input', () => {
    active = 0;
    render();
    clearTimeout(textTimer);
    const query = input.value.trim();
    if (!query) return;
    textTimer = setTimeout(() => {
      searchText(query)
        .then((results) => {
          textQuery = query;
          textResults = results;
          if (input.value.trim() === query) render();
        })
        .catch(() => {});
    }, 250);
  });

  let returnFocus = null;

  const open = () => {
    if (!modal.hidden) return;
    returnFocus = document.activeElement;
    modal.hidden = false;
    input.focus();
    input.select();
  };

  const dismiss = () => {
    if (modal.hidden) return;
    modal.hidden = true;
    returnFocus?.focus?.();
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    // Arrow keys move through the results, so Tab has nothing else to reach.
    if (event.key === 'Tab') {
      event.preventDefault();
      return;
    }
    if (panel.hidden || !items.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      select(active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      items[active].click();
    }
  });

  button.addEventListener('click', open);
  // A click on the dimmed page closes it. Keep focus in the box while a result is clicked.
  modal.addEventListener('click', (event) => {
    if (!dialog.contains(event.target)) dismiss();
  });
  panel.addEventListener('mousedown', (event) => event.preventDefault());

  // Captured before Otter Wiki's own / shortcut, which would focus the box while it's hidden. The
  // editor uses ⌘K for links, so neither shortcut fires while typing.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], .CodeMirror')) return;
      const command = (mac ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey;
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
      if ((command && event.key.toLowerCase() === 'k') || slash) {
        event.preventDefault();
        event.stopPropagation();
        open();
      }
    },
    true,
  );
})();

// Loads Holt's rich text editor on edit pages, from wherever this script came from, so jsDelivr and
// self-hosted installs both get it. It's large, so other pages never fetch it. data-editor="off"
// on Holt's script tag leaves Otter Wiki's Markdown editor on its own.
(() => {
  if (!document.getElementById('content_editor')) return;
  // holt.css hides the Markdown editor behind a spinner until this class, so it doesn't flash up
  // when rich mode is about to replace it.
  const settle = () => document.body.classList.add('holt-editor-settled');
  const script = document.currentScript;
  let markdown = false;
  try {
    markdown = localStorage.getItem('holt-rich-editor') === 'markdown';
  } catch {
    // Without storage, rich mode is the default.
  }
  if (markdown) settle();
  if (!script?.src || script.dataset.editor === 'off') {
    settle();
    return;
  }
  const { search } = new URL(script.src);
  const url = (file) => new URL(`${file}${search}`, script.src).href;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = url('holt-editor.css');
  document.head.append(css);
  const editor = document.createElement('script');
  editor.src = url('holt-editor.js');
  editor.addEventListener('error', settle);
  document.body.append(editor);
})();
