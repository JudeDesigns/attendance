import { useCallback } from 'react';
import {
  ArrowDownTrayIcon as DownloadIcon,
  XMarkIcon,
  DocumentChartBarIcon as DocumentReportIcon,
} from '@heroicons/react/24/outline';

/**
 * TimesheetModal — shared full-screen modal that renders grouped timesheet data
 * with color-coded columns, overtime buckets, and pay summaries.
 *
 * Props:
 *  - visible        (bool)    whether the modal is open
 *  - onClose        (fn)      called when user clicks backdrop / X
 *  - title          (string)  header text
 *  - timesheetData  (array)   grouped data from get_grouped_data()
 *  - isLoading      (bool)    show spinner while fetching
 *  - csvFilename    (string)  download filename for CSV export
 *
 * Overtime rule: Sun→Sat payroll weeks; first 40 h = regular, >40 h = OT.
 * Per-row daily columns (8 Hrs, Over 8, Over 12) still show the daily split.
 * Week subtotal rows are inserted automatically between calendar weeks.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

/** Return the date string (YYYY-MM-DD) of the Sunday starting the payroll week. */
function getWeekSunday(dateStr) {
  // dateStr is MM/DD/YYYY
  const [m, d, y] = dateStr.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0=Sun … 6=Sat → 0 means already Sunday
  date.setDate(date.getDate() - dayOfWeek);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function fmtWeekLabel(weekStartISO) {
  const sun  = new Date(weekStartISO + 'T00:00:00');
  const sat  = new Date(sun); sat.setDate(sun.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${sun.toLocaleDateString('en-US', opts)} – ${sat.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

/**
 * Given an employee object (with .rows and .summary.weeks), return an
 * interleaved array of:
 *   { _type: 'row',          ...originalRow }
 *   { _type: 'weekSubtotal', week_label, finally_hours, regular_hours, overtime_hours }
 */
function buildInterleavedRows(emp) {
  if (!emp.rows || emp.rows.length === 0) return [];

  // Group rows by payroll-week Sunday
  const weekMap  = {};
  const weekOrder = [];
  emp.rows.forEach(row => {
    const wk = getWeekSunday(row['Date']);
    if (!weekMap[wk]) { weekMap[wk] = []; weekOrder.push(wk); }
    weekMap[wk].push(row);
  });

  const result = [];
  weekOrder.forEach(wkKey => {
    weekMap[wkKey].forEach(r => result.push({ _type: 'row', ...r }));

    // Find pre-computed summary from backend; fall back to computing it here
    const backendWeek = emp.summary?.weeks?.find(w => w.week_start === wkKey);
    if (backendWeek) {
      result.push({ _type: 'weekSubtotal', ...backendWeek });
    } else {
      const wkFinally  = weekMap[wkKey].reduce((s, r) => s + (r['Finally Hours'] || 0), 0);
      result.push({
        _type:          'weekSubtotal',
        week_start:     wkKey,
        week_label:     fmtWeekLabel(wkKey),
        finally_hours:  Math.round(wkFinally * 100) / 100,
        regular_hours:  Math.round(Math.min(wkFinally, 40) * 100) / 100,
        overtime_hours: Math.round(Math.max(0, wkFinally - 40) * 100) / 100,
      });
    }
  });

  return result;
}

// ── component ────────────────────────────────────────────────────────────────

const TimesheetModal = ({ visible, onClose, title, timesheetData, isLoading, csvFilename }) => {

  const handleExportCSV = useCallback(() => {
    if (!timesheetData || timesheetData.length === 0) return;

    const headers = [
      'Employee', 'Date', 'Day', 'Start Time', 'End Time', 'Total Hours',
      'Break 1 In', 'Break 1 Out', 'Break 1 Total',
      'Break 2 In', 'Break 2 Out', 'Break 2 Total',
      'Break 3 In', 'Break 3 Out', 'Break 3 Total',
      'Total Break', 'Total Without Break', 'Finally Hours',
      '8 Hours', 'Over 8', 'Over 12',
      'Pay Label', 'Pay Amount'
    ];
    const csvRows = [headers.join(',')];

    timesheetData.forEach(emp => {
      const s = emp.summary;

      const payLines = [
        { label: emp.name,           value: '' },
        { label: 'Total 8 Hrs',      value: s?.total_8_hrs_pay   != null ? s.total_8_hrs_pay.toFixed(2)   : '' },
        { label: 'Total Over 8',     value: s?.total_over_8_pay  != null ? s.total_over_8_pay.toFixed(2)  : '' },
        { label: 'Total Over 12',    value: s?.total_over_12_pay != null ? s.total_over_12_pay.toFixed(2) : '' },
        { label: 'Total Payment',    value: s?.total_payment     != null ? s.total_payment.toFixed(2)     : '' },
        { label: 'Check',            value: '' },
        { label: 'Cash',             value: '' },
        { label: s?.ot_note || '',   value: '' },
      ];

      // Pad rows so the payline sidebar can fully render
      const exportRows = [...(emp.rows || [])];
      while (exportRows.length < payLines.length) {
        exportRows.push({});
      }

      // Daily rows alongside Pay Summary sidebar
      exportRows.forEach((row, idx) => {
        const pl = payLines[idx] || { label: '', value: '' };

        const vals = [
          row['Date'] ? emp.name : '', // Only show name if it's a real row
          row['Date'] || '', row['Day'] || '', row['Start Time'] || '', row['End Time'] || '', row['Total Hours'] || '',
          row['Break 1 In'] || '', row['Break 1 Out'] || '', row['Break 1 Total'] || '',
          row['Break 2 In'] || '', row['Break 2 Out'] || '', row['Break 2 Total'] || '',
          row['Break 3 In'] || '', row['Break 3 Out'] || '', row['Break 3 Total'] || '',
          row['Total Break'] || '', row['Total Without Break'] || '', row['Finally Hours'] || '',
          row['8 Hours'] || '', row['over 8'] || '', row['over 12'] || '',
          pl.label, pl.value
        ];
        csvRows.push(vals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      });

      // TOTALS row (using weekly OT summary values from backend)
      const totalsVals = [
        emp.name + ' TOTALS', '', '', '', '', '',
        '', '', '', '', '', '', '', '', '',
        '', '',
        s?.total_finally_hours ?? '',
        s?.total_8_hours ?? '',    // weekly regular (<=40h/wk)
        s?.total_over_8  ?? '',    // weekly OT <=8h
        s?.total_over_12 ?? '',    // weekly OT >8h
        '', '' // Empty Pay Label/Amount for total row
      ];
      csvRows.push(totalsVals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      csvRows.push('');
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = csvFilename || 'timesheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [timesheetData, csvFilename]);


  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: '95vw', height: '90vh', maxWidth: '1800px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <div className="flex items-center gap-3">
            {timesheetData && timesheetData.length > 0 && (
              <button onClick={handleExportCSV} className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                <DownloadIcon className="h-4 w-4 mr-2" />Export CSV
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-60">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
            </div>
          ) : timesheetData && timesheetData.length > 0 ? (
            <div className="space-y-8">
              {timesheetData.map((emp, empIdx) => {
                const s = emp.summary;

                // Pay sidebar — original format (weekly OT basis)
                const payLines = [
                  { label: emp.name,           value: '',                                                                      bold: true },
                  { label: 'Total 8 Hrs',      value: s?.total_8_hrs_pay   != null ? s.total_8_hrs_pay.toFixed(2)   : '' },
                  { label: 'Total Over 8',     value: s?.total_over_8_pay  != null ? s.total_over_8_pay.toFixed(2)  : '' },
                  { label: 'Total Over 12',    value: s?.total_over_12_pay != null ? s.total_over_12_pay.toFixed(2) : '' },
                  { label: 'Total Payment',    value: s?.total_payment     != null ? s.total_payment.toFixed(2)     : '', bold: true },
                  { label: 'Check',            value: '' },
                  { label: 'Cash',             value: '' },
                  // Brief note explaining the weekly OT rule applied
                  { label: s?.ot_note || '',   value: '', italic: true },
                ];

                const interleavedRows = buildInterleavedRows(emp);

                // Ensure we have at least enough daily rows to render the full pay sidebar (8 lines long)
                // Otherwise the sidebar gets abruptly cut off.
                const dailyCount = interleavedRows.filter(r => r._type !== 'weekSubtotal').length;
                if (dailyCount < payLines.length) {
                  const needed = payLines.length - dailyCount;
                  for (let i = 0; i < needed; i++) {
                    interleavedRows.push({
                      _type: 'row',
                      Date: '', Day: '', 'Start Time': '', 'End Time': '', 'Total Hours': '',
                      'Break 1 In': '', 'Break 1 Out': '', 'Break 1 Total': '',
                      'Break 2 In': '', 'Break 2 Out': '', 'Break 2 Total': '',
                      'Break 3 In': '', 'Break 3 Out': '', 'Break 3 Total': '',
                      'Total Break': '', 'Total Without Break': '',
                      'Finally Hours': '', '8 Hours': '', 'over 8': '', 'over 12': ''
                    });
                  }
                }

                return (
                  <div key={empIdx} className="border border-gray-300 rounded-lg overflow-hidden">
                    {/* Employee Header */}
                    <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
                      <span className="font-bold text-sm">{emp.name}</span>
                      {emp.hourly_rate != null && (
                        <span className="text-xs bg-gray-600 px-2 py-1 rounded">Rate: ${Number(emp.hourly_rate).toFixed(2)}/hr</span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse min-w-[1800px]">
                        <thead>
                          {/* Group header row */}
                          <tr>
                            <th colSpan={5} className="bg-gray-800 text-white px-2 py-1 border border-gray-400"></th>
                            <th colSpan={3} className="bg-[#f5e6c8] text-gray-800 px-2 py-1 text-center font-semibold border border-gray-400">Break 1 (not deducted)</th>
                            <th colSpan={3} className="bg-[#ea580c] text-white px-2 py-1 text-center font-semibold border border-gray-400">Break 2 (deducted)</th>
                            <th colSpan={3} className="bg-[#f5e6c8] text-gray-800 px-2 py-1 text-center font-semibold border border-gray-400">Break 3 (not deducted)</th>
                            <th colSpan={6} className="bg-[#1e293b] text-white px-2 py-1 text-center font-semibold border border-gray-400">Total Hours</th>
                            <th colSpan={2} className="bg-[#065f46] text-white px-2 py-1 text-center font-semibold border border-gray-400">Hourly Rate</th>
                          </tr>
                          {/* Column header row */}
                          <tr>
                            <th className="bg-[#1a2744] text-white px-2 py-1.5 text-left font-semibold border border-gray-400">Date</th>
                            <th className="bg-[#1a2744] text-white px-2 py-1.5 text-left font-semibold border border-gray-400">Day</th>
                            <th className="bg-[#2d6a4f] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Start Time</th>
                            <th className="bg-[#2d6a4f] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">End Time</th>
                            <th className="bg-[#dc2626] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Total Hours</th>
                            <th className="bg-[#f5e6c8] text-gray-800 px-2 py-1.5 text-center font-semibold border border-gray-400">Break In</th>
                            <th className="bg-[#f5e6c8] text-gray-800 px-2 py-1.5 text-center font-semibold border border-gray-400">Break Out</th>
                            <th className="bg-[#f5e6c8] text-gray-800 px-2 py-1.5 text-center font-semibold border border-gray-400">Total Break</th>
                            <th className="bg-[#ea580c] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Break In</th>
                            <th className="bg-[#ea580c] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Break Out</th>
                            <th className="bg-[#ea580c] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Total Break</th>
                            <th className="bg-[#f5e6c8] text-gray-800 px-2 py-1.5 text-center font-semibold border border-gray-400">Start Time</th>
                            <th className="bg-[#f5e6c8] text-gray-800 px-2 py-1.5 text-center font-semibold border border-gray-400">End Time</th>
                            <th className="bg-[#f5e6c8] text-gray-800 px-2 py-1.5 text-center font-semibold border border-gray-400">Total Break</th>
                            <th className="bg-[#dc2626] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Total Break</th>
                            <th className="bg-[#dc2626] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Total W/O Break</th>
                            <th className="bg-[#1e293b] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Finally Hrs</th>
                            <th className="bg-[#1e293b] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">8 Hours</th>
                            <th className="bg-[#1e293b] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Over 8</th>
                            <th className="bg-[#1e293b] text-white px-2 py-1.5 text-center font-semibold border border-gray-400">Over 12</th>
                            <th colSpan={2} className="bg-[#065f46] text-white px-2 py-1.5 text-center font-semibold border border-gray-400"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Use a separate counter so payLines always render on daily rows
                            // regardless of how many week subtotal rows are interspersed.
                            let pIdx = 0;
                            return interleavedRows.map((item, rowIdx) => {

                              /* ── Week Subtotal Row ───────────────────────── */
                              if (item._type === 'weekSubtotal') {
                                return (
                                  <tr key={`wk-${item.week_start}-${rowIdx}`} className="bg-[#1e293b] text-white font-semibold text-[11px]">
                                    <td colSpan={16} className="px-3 py-1.5 border border-gray-500 text-left">
                                      <span className="text-yellow-300">{item.week_label}</span>
                                      <span className="ml-4 text-gray-300">Total: <span className="text-white">{item.finally_hours}h</span></span>
                                      <span className="ml-4 text-green-300">Regular (≤40h): <span className="text-white">{item.regular_hours}h</span></span>
                                      {item.overtime_hours > 0 && (
                                        <span className="ml-4 text-orange-300">Overtime (&gt;40h): <span className="text-white">{item.overtime_hours}h</span></span>
                                      )}
                                    </td>
                                    <td colSpan={4} className="px-2 py-1.5 border border-gray-500"></td>
                                  </tr>
                                );
                              }

                              /* ── Regular Daily Row ─────────────────────── */
                              const row    = item;
                              const pl     = payLines[pIdx] || { label: '', value: '', bold: false, italic: false };
                              const isEven = pIdx % 2 === 0;
                              pIdx++;
                              return (
                                <tr key={rowIdx} className={isEven ? 'bg-white' : 'bg-gray-50'}>
                                 <td className="bg-[#d1dce8] px-2 py-1 border border-gray-300 font-medium">{row['Date']}</td>
                                 <td className="bg-[#d1dce8] px-2 py-1 border border-gray-300">{row['Day']}</td>
                                 <td className="bg-[#d4edda] px-2 py-1 border border-gray-300 text-center">{row['Start Time']}</td>
                                 <td className="bg-[#d4edda] px-2 py-1 border border-gray-300 text-center">{row['End Time']}</td>
                                 <td className="bg-[#f8d7da] px-2 py-1 border border-gray-300 text-center font-medium">{row['Total Hours']}</td>
                                 <td className="bg-[#fef9e7] px-2 py-1 border border-gray-300 text-center">{row['Break 1 In']}</td>
                                 <td className="bg-[#fef9e7] px-2 py-1 border border-gray-300 text-center">{row['Break 1 Out']}</td>
                                 <td className="bg-[#fef9e7] px-2 py-1 border border-gray-300 text-center">{row['Break 1 Total']}</td>
                                 <td className="bg-[#fde8d0] px-2 py-1 border border-gray-300 text-center">{row['Break 2 In']}</td>
                                 <td className="bg-[#fde8d0] px-2 py-1 border border-gray-300 text-center">{row['Break 2 Out']}</td>
                                <td className="bg-[#fde8d0] px-2 py-1 border border-gray-300 text-center">{row['Break 2 Total']}</td>
                                <td className="bg-[#fef9e7] px-2 py-1 border border-gray-300 text-center">{row['Break 3 In']}</td>
                                <td className="bg-[#fef9e7] px-2 py-1 border border-gray-300 text-center">{row['Break 3 Out']}</td>
                                <td className="bg-[#fef9e7] px-2 py-1 border border-gray-300 text-center">{row['Break 3 Total']}</td>
                                <td className="bg-[#f8d7da] px-2 py-1 border border-gray-300 text-center font-medium">{row['Total Break']}</td>
                                <td className="bg-[#f8d7da] px-2 py-1 border border-gray-300 text-center">{row['Total Without Break']}</td>
                                <td className="bg-[#e2e8f0] px-2 py-1 border border-gray-300 text-center font-bold">{row['Finally Hours']}</td>
                                <td className="bg-[#e2e8f0] px-2 py-1 border border-gray-300 text-center">{row['8 Hours']}</td>
                                <td className="bg-[#e2e8f0] px-2 py-1 border border-gray-300 text-center">{row['over 8']}</td>
                                <td className="bg-[#e2e8f0] px-2 py-1 border border-gray-300 text-center">{row['over 12']}</td>
                                  {/* Pay sidebar — 4 columns after Over 12 */}
                                  <td className={`bg-[#ecfdf5] px-2 py-1 border border-gray-300 text-right text-[11px] whitespace-nowrap ${
                                    pl.bold ? 'font-bold' : ''
                                  } ${pl.italic ? 'italic text-gray-500' : ''}`}>
                                    {pl.label}
                                  </td>
                                  <td className={`bg-[#ecfdf5] px-2 py-1 border border-gray-300 text-center ${ pl.bold ? 'font-bold' : ''}`}>
                                    {pl.value}
                                  </td>
                                </tr>
                              );
                            });
                          })()}

                          {/* Totals Row — daily column sums (unchanged display) */}
                          <tr className="font-bold">
                            <td colSpan={5} className="bg-gray-700 text-white px-2 py-1.5 border border-gray-400 text-right">TOTALS:</td>
                            <td colSpan={11} className="bg-gray-200 px-2 py-1.5 border border-gray-400"></td>
                            <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{s?.total_finally_hours}</td>
                            <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{s?.total_8_hours}</td>
                            <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{s?.total_over_8}</td>
                            <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{s?.total_over_12}</td>
                            {/* Week OT note in the pay columns */}
                            <td className="bg-[#064e3b] text-green-100 px-2 py-1.5 border border-gray-400 text-right text-[11px] font-normal whitespace-nowrap">
                              {s?.ot_note || ''}
                            </td>
                            <td className="bg-[#064e3b] text-white px-2 py-1.5 border border-gray-400 text-center text-[11px]">
                              {s?.total_payment != null ? `$${s.total_payment.toFixed(2)}` : ''}
                            </td>
                          </tr>

                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <DocumentReportIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p>No timesheet data found for the selected date range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimesheetModal;
