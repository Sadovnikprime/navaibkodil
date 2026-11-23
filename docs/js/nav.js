const SIMPLE_SCREENS = ['home', 'new', 'tickets', 'materials', 'contacts', 'settings'];

let renderScreen = () => {};
const visited = [location.hash || '#home'];
let replacing = false;

export function onNavigate(callback) {
  renderScreen = callback;
}

export function currentRoute() {
  const hash = location.hash.replace(/^#/, '') || 'home';
  let match;
  if ((match = hash.match(/^ticket-(\d+)$/))) return { name: 'ticket', id: match[1] };
  if ((match = hash.match(/^created-(\d+)$/))) return { name: 'created', id: match[1] };
  if ((match = hash.match(/^article-([a-z0-9-]+)$/))) return { name: 'article', id: match[1] };
  if (SIMPLE_SCREENS.includes(hash)) return { name: hash };
  return { name: 'home' };
}

export function go(hash) {
  if (location.hash === `#${hash}`) renderScreen(true);
  else location.hash = hash;
}

export function replace(hash) {
  if (location.hash === `#${hash}`) {
    renderScreen(true);
    return;
  }
  replacing = true;
  location.replace(`#${hash}`);
}

export function back(fallback = 'home') {
  if (visited.length > 1) history.back();
  else replace(fallback);
}

window.addEventListener('hashchange', () => {
  const hash = location.hash || '#home';
  if (replacing) {
    visited[visited.length - 1] = hash;
    replacing = false;
  } else if (visited.length > 1 && visited[visited.length - 2] === hash) {
    visited.pop();
  } else {
    visited.push(hash);
  }
  renderScreen(true);
});
