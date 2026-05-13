import { escape as htmlEscape } from '../../engine/core.js';

export default function template(state) {
  return `<section class="home-page">
    <div class="topbar">
      <span class="topbar-label">${htmlEscape(state.title)}</span>
    </div>
  </section>`;
}
