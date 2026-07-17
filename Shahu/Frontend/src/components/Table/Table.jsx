import { EmptyState } from '../EmptyState/EmptyState';

export function Table({ columns, rows }) {
  if (!rows?.length) {
    return <EmptyState />;
  }
  return (
    <table className="table">
      <thead>
        <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.id || row._id}>
            {columns.map(column => <td key={column.key}>{row[column.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
