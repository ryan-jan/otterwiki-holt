// Notion's floating outline while editing, built from the headings in the rich editor and kept up
// to date as they change. It uses the same markup and classes as holt.js's outline on the page,
// so it looks and behaves the same, and holt.css shows it from 1200px.

export function createOutline(getView) {
  const content = document.getElementById('content-wrapper');
  const toc = document.createElement('nav');
  toc.className = 'holt-toc';
  toc.setAttribute('aria-label', 'On this page');
  const ladder = document.createElement('div');
  ladder.className = 'holt-toc-ladder';
  ladder.setAttribute('aria-hidden', 'true');
  const panel = document.createElement('div');
  panel.className = 'holt-toc-panel';
  toc.append(ladder, panel);
  document.getElementById('page-wrapper').append(toc);

  let entries = [];
  // A clicked section stays highlighted until the reader scrolls by hand, as on the page.
  let pinned = null;

  const headings = () => {
    const view = getView();
    const found = [];
    view.state.doc.forEach((node, offset) => {
      if (node.type.name !== 'heading' || !node.textContent.trim()) return;
      const dom = view.nodeDOM(offset);
      if (dom instanceof HTMLElement) found.push({ level: node.attrs.level, text: node.textContent, dom });
    });
    return found;
  };

  const current = () => {
    if (pinned && entries.some((entry) => entry.dom === pinned)) return pinned;
    if (!entries.length) return null;
    if (content.scrollTop === 0) return entries[0].dom;
    const line = content.getBoundingClientRect().top + content.clientHeight / 4;
    const passed = entries.filter((entry) => entry.dom.getBoundingClientRect().top <= line);
    return (passed.at(-1) ?? entries[0]).dom;
  };

  const highlight = () => {
    const active = current();
    for (const entry of entries) {
      entry.link.classList.toggle('sidebar-active', entry.dom === active);
      entry.rung.classList.toggle('holt-toc-rung-active', entry.dom === active);
    }
  };

  // Level with the page's title row, as on the page. The title is the editor's first block.
  const place = () => {
    const first = getView().dom.firstElementChild;
    const rung = ladder.firstElementChild;
    if (!first || !rung || !ladder.offsetParent) return;
    const box = first.getBoundingClientRect();
    const row = box.top + content.scrollTop + box.height / 2;
    toc.style.setProperty('--holt-toc-top', `${row - rung.offsetTop - rung.offsetHeight / 2}px`);
  };

  const refresh = () => {
    const found = headings();
    toc.hidden = found.length < 2;
    const levels = found.map((heading) => heading.level);
    const top = Math.min(...levels);
    entries = found.map((heading) => {
      // Relative to the highest heading, as Otter Wiki numbers its own outline.
      const level = Math.min(heading.level - top + 1, 6);
      const rung = document.createElement('span');
      rung.className = `holt-toc-rung holt-toc-rung-${level}`;
      const link = document.createElement('a');
      link.href = '#';
      link.className = `sidebar-link sidebar-toc-${level}`;
      link.textContent = heading.text;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        pinned = heading.dom;
        heading.dom.scrollIntoView({ block: 'start' });
        highlight();
        toc.classList.remove('holt-toc-open');
      });
      return { ...heading, rung, link };
    });
    ladder.replaceChildren(...entries.map((entry) => entry.rung));
    panel.replaceChildren(...entries.map((entry) => entry.link));
    highlight();
    place();
  };

  const reveal = () => panel.querySelector('.sidebar-active')?.scrollIntoView({ block: 'nearest' });
  toc.addEventListener('mouseenter', reveal);
  toc.addEventListener('focusin', reveal);
  ladder.addEventListener('click', () => {
    if (!window.matchMedia('(hover: none)').matches) return;
    toc.classList.add('holt-toc-open');
    reveal();
  });
  const closeOnTap = (event) => {
    if (!ladder.contains(event.target)) toc.classList.remove('holt-toc-open');
  };
  document.addEventListener('click', closeOnTap);

  const unpin = () => {
    pinned = null;
  };
  for (const type of ['wheel', 'touchmove']) content.addEventListener(type, unpin, { passive: true });
  content.addEventListener('scroll', highlight, { passive: true });
  window.addEventListener('resize', place);

  refresh();

  return {
    refresh,
    destroy() {
      for (const type of ['wheel', 'touchmove']) content.removeEventListener(type, unpin);
      content.removeEventListener('scroll', highlight);
      window.removeEventListener('resize', place);
      document.removeEventListener('click', closeOnTap);
      toc.remove();
    },
  };
}
