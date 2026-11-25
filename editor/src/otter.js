// Calls into the Otter Wiki editor page the rich editor runs on.

const csrf = () => document.querySelector('meta[name="csrf-token"]').content;

// The editor opens at /<page>/edit or /<page>?edit, so take the page from the save form instead.
const previewUrl = () =>
  document.getElementById('saveform').getAttribute('action').replace(/\/save$/, '/preview');

// Renders Markdown with Otter Wiki's own renderer, so what the rich editor shows and checks
// against is exactly what the page will show.
export async function renderMarkdown(markdown) {
  const form = new FormData();
  form.append('content', markdown);
  const response = await fetch(previewUrl(), {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf() },
    body: form,
  });
  if (!response.ok) throw new Error(`Preview failed with HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('json')) {
    throw new Error(`Otter Wiki answered ${response.url} with a page rather than a preview.`);
  }
  // The preview wraps the page in breadcrumbs. Only the page itself is wanted.
  const template = document.createElement('template');
  template.innerHTML = (await response.json()).preview_content;
  return template.content.querySelector('.page')?.innerHTML ?? template.innerHTML;
}

// Uploads a file as an attachment of the page, the same way pasting into CodeMirror does.
export async function uploadAttachment(file, name) {
  const { uploadUrl } = window.otterwikiEditorConfig.inlineAttachmentOptions;
  const form = new FormData();
  form.append('file', file, name);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf() },
    body: form,
  });
  if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);
  const result = await response.json();
  return result.filename.replace(/^\.\//, '');
}

export const attachmentUrl = (filename) =>
  './' + encodeURIComponent(filename).replace(/\(/g, '%28').replace(/\)/g, '%29');

export function wikiPages() {
  return [...document.querySelectorAll('#wikilink option')].map((o) => o.value).filter(Boolean);
}

// The page's attachments, from the editor's attachment panel. Otter Wiki gives images a thumbnail.
export function pageAttachments() {
  return [...document.querySelectorAll('#attachment-filename option')]
    .filter((option) => option.value)
    .map((option) => {
      const [filename, url, thumbnail] = option.value.split('/--/');
      return { filename, url, thumbnail };
    });
}
