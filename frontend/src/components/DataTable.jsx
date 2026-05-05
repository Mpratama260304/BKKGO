// Generic data table with column sorting, text filter, and pagination.
// `columns`: [{ key, label, render?, sortable?, accessor? }]
import { useMemo, useState } from 'react';

export default function DataTable({
  columns,
  rows,
  pageSize = 10,
  searchPlaceholder = 'Search…',
  emptyText = 'No data',
}) {
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  function getValue(row, col) {
    if (col.accessor) return col.accessor(row);
    return row[col.key];
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      columns.some((c) => {
        const v = getValue(r, c);
        return v != null && String(v).toLowerCase().includes(s);
      })
    );
  }, [rows, q, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const arr = [...filtered].sort((a, b) => {
      const av = getValue(a, col);
      const bv = getValue(b, col);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(col) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(col.key); setSortDir('asc'); }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <input
          className="input sm:max-w-xs"
          placeholder={searchPlaceholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <div className="text-xs text-slate-500">{sorted.length} result(s)</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={`p-3 ${c.sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''}`}
                >
                  {c.label}
                  {sortKey === c.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={row.id ?? i} className="border-t border-slate-100 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className="p-3 align-top">
                    {c.render ? c.render(row) : getValue(row, c)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} className="p-8 text-center text-slate-500">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-200 flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {safePage} of {totalPages}</span>
        <div className="flex gap-2">
          <button className="btn-outline text-xs" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <button className="btn-outline text-xs" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
