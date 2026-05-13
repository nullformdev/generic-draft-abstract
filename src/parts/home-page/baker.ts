import { t } from '../../pages/lang.ts';

export function bakeHomePage(lang: string): {
  id: string;
  title: string;
  state: Record<string, unknown>;
} {
  const title = t(lang, 'home.title');

  return {
    id: 'home-page',
    title,
    state: {
      title,
    },
  };
}
