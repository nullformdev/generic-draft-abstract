import { listRecentLogs } from '../../lib/log-reader.ts';
import { t } from '../../pages/lang.ts';

export function bakeLogsPage(lang: string): {
  id: string;
  title: string;
  state: Record<string, unknown>;
} {
  const title = t(lang, 'logs.title');

  return {
    id: 'logs-page',
    title,
    state: {
      title,
      logs: listRecentLogs(100),
      empty: t(lang, 'logs.empty'),
      cols: {
        time: t(lang, 'logs.col.time'),
        level: t(lang, 'logs.col.level'),
        kind: t(lang, 'logs.col.kind'),
        route: t(lang, 'logs.col.route'),
        status: t(lang, 'logs.col.status'),
        userId: t(lang, 'logs.col.user_id'),
        requestId: t(lang, 'logs.col.request_id'),
        message: t(lang, 'logs.col.message'),
      },
    },
  };
}
