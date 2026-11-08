// Clone the one scene into every panel. Panels differ only by their data-time tokens.
const scene = document.getElementById('scene');
const TOKENS = ['wall', 'wood', 'lamp', 'rain', 'plant', 'paper'];

for (const frame of document.querySelectorAll('[data-scene]')) {
  const svg = scene.content.firstElementChild.cloneNode(true);

  // Object ids belong to the real app (one scene per page). Here the scene
  // repeats, so keep the names as data attributes to avoid duplicate ids.
  for (const el of svg.querySelectorAll('[id]')) {
    el.dataset.object = el.id;
    el.removeAttribute('id');
  }

  if (frame.dataset.viewbox) svg.setAttribute('viewBox', frame.dataset.viewbox);
  frame.append(svg);
}

for (const holder of document.querySelectorAll('.swatches')) {
  for (const token of TOKENS) {
    const dot = document.createElement('span');
    dot.className = 'swatch';
    dot.dataset.token = token;
    dot.title = `--${token}`;
    holder.append(dot);
  }
}
