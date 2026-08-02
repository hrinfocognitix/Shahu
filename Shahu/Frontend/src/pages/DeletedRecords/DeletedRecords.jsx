import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FiClock, FiTrash2, FiUser } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';

import { apiClient } from '../../api/axios';
import { ROUTES } from '../../config/routes';

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-IN') : '—';

const getRecordLabel = (record) =>
  record.name ||
  record.title ||
  record.email ||
  record.courseCode ||
  record.subjectCode ||
  record.courseId ||
  'Untitled record';

export function DeletedRecords() {
  const user = useSelector((state) => state.auth.user);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecords, setSelectedRecords] = useState([]);

  const loadDeletedRecords = useCallback(async () => {
    try {
      const response = await apiClient.get('/deleted-records', { params: { limit: 100 } });
      setGroups(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load deleted items');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    loadDeletedRecords();
  }, [loadDeletedRecords, user?.role]);

  const records = useMemo(
    () =>
      groups.flatMap((group) =>
        (group.records || []).map((record) => ({ ...record, resource: group.resource })),
      ),
    [groups],
  );

  const selectedRecordKeys = new Set(selectedRecords);
  const areAllSelected = records.length > 0 && selectedRecords.length === records.length;

  const toggleRecord = (record) => {
    const recordKey = `${record.resource}-${record._id}`;

    setSelectedRecords((current) =>
      current.includes(recordKey)
        ? current.filter((key) => key !== recordKey)
        : [...current, recordKey],
    );
  };

  const toggleAllRecords = () => {
    setSelectedRecords(
      areAllSelected ? [] : records.map((record) => `${record.resource}-${record._id}`),
    );
  };

  const permanentlyDeleteSelected = async () => {
    const selectedItems = records
      .filter((record) => selectedRecordKeys.has(`${record.resource}-${record._id}`))
      .map((record) => ({ resource: record.resource, id: record._id }));

    if (!selectedItems.length) {
      return;
    }

    if (!window.confirm(`Permanently delete ${selectedItems.length} selected item(s)? This cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete('/deleted-records', { data: { records: selectedItems } });
      toast.success(`${selectedItems.length} item(s) permanently deleted`);
      setSelectedRecords([]);
      setLoading(true);
      await loadDeletedRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to permanently delete selected items');
    }
  };

  if (user?.role !== 'superadmin') {
    return <Navigate replace to={ROUTES.dashboard} />;
  }

  return (
    <section className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SUPER ADMIN ONLY</p>
          <h1>Deleted Items</h1>
          <p>Items deleted by administrators are retained here for review.</p>
        </div>
        <div className="deleted-items-actions">
          <span className="student-total">{records.length} deleted items</span>
          <button
            className="btn subject-delete-button"
            disabled={!selectedRecords.length}
            onClick={permanentlyDeleteSelected}
          >
            <FiTrash2 /> Permanently delete selected
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card student-empty">Loading deleted items…</div>
      ) : records.length ? (
        <div className="audit-list deleted-items-list">
          <label className="deleted-select-all">
            <input checked={areAllSelected} onChange={toggleAllRecords} type="checkbox" />
            Select all deleted items
          </label>
          {records.map((record) => (
            <article className="card" key={`${record.resource}-${record._id}`}>
              <label className="deleted-item-checkbox">
                <input
                  checked={selectedRecordKeys.has(`${record.resource}-${record._id}`)}
                  onChange={() => toggleRecord(record)}
                  type="checkbox"
                />
                <span className="sr-only">Select {getRecordLabel(record)}</span>
              </label>
              <span className="audit-icon">
                <FiTrash2 />
              </span>
              <div>
                <h3>{getRecordLabel(record)}</h3>
                <p>{record.resource}</p>
                <small>
                  <FiClock /> Deleted {formatDate(record.deletedAt)}
                </small>
                <small>
                  <FiUser /> By {record.deletedBy?.name || record.deletedBy?.email || 'Unknown user'}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card student-empty">No deleted items found.</div>
      )}
    </section>
  );
}
