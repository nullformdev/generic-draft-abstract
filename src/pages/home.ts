import { bakeHomePage } from '../parts/home-page/baker.ts';
import { logBaker } from '../lib/logging/logger.ts';
import { mountScript, renderPartPage } from './part-page.ts';

interface HomeRenderContext {
  lang: string;
  isAdmin: boolean;
}

export function renderHomePage(ctx: HomeRenderContext): string {
  const page = logBaker('home-page', () => bakeHomePage(ctx.lang));

  return renderPartPage({
    lang: ctx.lang,
    title: page.title,
    isAdmin: ctx.isAdmin,
    baked: { [page.id]: page.state },
    body: mountScript('/parts/home-page/index.js', page.id),
  });
}
