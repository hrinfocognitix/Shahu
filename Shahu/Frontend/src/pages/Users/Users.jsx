import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Pagination } from '../../components/Pagination/Pagination';
import { Search } from '../../components/Search/Search';
import { SkeletonBlock } from '../../components/Skeleton/Skeleton';
import { Table } from '../../components/Table/Table';
import { usePagination } from '../../hooks/usePagination';
import { userService } from '../../services/user.service';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' }
];

export function Users() {
  const user = useSelector(state => state.auth.user);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1 });
  const pagination = usePagination();

  useEffect(() => {
    setLoading(true);
    userService
      .list({ ...pagination.query, search })
      .then(response => {
        setRows(response.data || []);
        setMeta(response.meta || { totalPages: 1 });
      })
      .finally(() => setLoading(false));
  }, [pagination.page, pagination.limit, search]);

  const tableColumns = user?.role === 'superadmin' ? [...columns, { key: 'initialPassword', label: 'Initial password' }] : columns;

  return (
    <section className="stack">
      <Search value={search} onChange={setSearch} />
      {loading ? <SkeletonBlock /> : <Table columns={tableColumns} rows={rows} />}
      <Pagination page={pagination.page} totalPages={meta.totalPages} onPageChange={pagination.setPage} />
    </section>
  );
}
