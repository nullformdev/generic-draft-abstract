export default {
  events: {
    'click [data-ref="summary"]': (part) => {
      queueMicrotask(() => part.set('dropdownOpen', part.refs.dropdown.open));
    },
    'toggle [data-ref="dropdown"]': (part) => {
      part.set('dropdownOpen', part.refs.dropdown.open);
    },
  },
  state: {
    dropdownOpen: (part, value) => {
      if (!part.refs.dropdown || !part.refs.summary) return;
      part.refs.dropdown.open = value;
      part.refs.summary.setAttribute('aria-expanded', value ? 'true' : 'false');
    },
  },
  onMount: (part) => {
    part.private.onDocClick = (event) => {
      if (!part.refs.dropdown) return;
      if (!part.refs.dropdown.open) return;
      if (event.target instanceof Node && part.refs.dropdown.contains(event.target)) return;
      part.set('dropdownOpen', false);
    };
    part.private.onKey = (event) => {
      if (!part.refs.dropdown) return;
      if (event.key !== 'Escape') return;
      part.set('dropdownOpen', false);
    };
    document.addEventListener('click', part.private.onDocClick);
    document.addEventListener('keydown', part.private.onKey);
  },
  onDestroy: (part) => {
    document.removeEventListener('click', part.private.onDocClick);
    document.removeEventListener('keydown', part.private.onKey);
  },
};
