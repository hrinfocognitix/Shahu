import { useMemo, useState } from 'react';
import { appConfig } from '../config/appConfig';

export function usePagination(initialPage = 1, initialLimit = appConfig.pageSize) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const query = useMemo(() => ({ page, limit }), [page, limit]);
  return { page, limit, setPage, setLimit, query };
}
