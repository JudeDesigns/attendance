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
 */
const TimesheetModal = ({ visible, onClose, title, timesheetData, isLoading, csvFilename }) => {
  const handleExportCSV = useCallback(() => {
    if (!timesheetData || timesheetData.length === 0) return;
    const headers = ['Employee Name','Date','Day','Start Time','End Time','Total Hours','Break 1 In','Break 1 Out','Break 1 Total','Break 2 In','Break 2 Out','Break 2 Total','Break 3 In','Break 3 Out','Break 3 Total','Total Break','Total Without Break','Finally Hours','8 Hours','Over 8','Over 12','Hourly Rate'];
    const csvRows = [headers.join(',')];
    timesheetData.forEach(emp => {
      emp.rows.forEach(row => {
        csvRows.push(headers.map(h => {
          const key = h === 'Over 8' ? 'over 8' : h === 'Over 12' ? 'over 12' : h;
          const val = row[key] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','));
      });
      // Add totals row per employee
      if (emp.summary) {
        const totalsRow = headers.map(h => {
          if (h === 'Employee Name') return `"TOTALS - ${emp.name}"`;
          if (h === 'Finally Hours') return `"${emp.summary.total_finally_hours ?? ''}"`;
          if (h === '8 Hours') return `"${emp.summary.total_8_hours ?? ''}"`;
          if (h === 'Over 8') return `"${emp.summary.total_over_8 ?? ''}"`;
          if (h === 'Over 12') return `"${emp.summary.total_over_12 ?? ''}"`;
          return '""';
        }).join(',');
        csvRows.push(totalsRow);
        // Add pay summary row
        const payRow = headers.map(h => {
          if (h === 'Employee Name') return `"PAY SUMMARY - ${emp.name}"`;
          if (h === '8 Hours') return `"${emp.summary.total_8_hrs_pay != null ? emp.summary.total_8_hrs_pay.toFixed(2) : ''}"`;
          if (h === 'Over 8') return `"${emp.summary.total_over_8_pay != null ? emp.summary.total_over_8_pay.toFixed(2) : ''}"`;
          if (h === 'Over 12') return `"${emp.summary.total_over_12_pay != null ? emp.summary.total_over_12_pay.toFixed(2) : ''}"`;
          if (h === 'Hourly Rate') return `"${emp.summary.total_payment != null ? emp.summary.total_payment.toFixed(2) : ''}"`;
          return '""';
        }).join(',');
        csvRows.push(payRow);
      }
      // Blank separator row between employees
      csvRows.push('');
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
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
                const payLines = [
                  { label: emp.name, value: '', bold: true },
                  { label: 'Total 8 Hrs', value: emp.summary?.total_8_hrs_pay != null ? emp.summary.total_8_hrs_pay.toFixed(2) : '' },
                  { label: 'Total Over 8', value: emp.summary?.total_over_8_pay != null ? emp.summary.total_over_8_pay.toFixed(2) : '' },
                  { label: 'Total Over 12', value: emp.summary?.total_over_12_pay != null ? emp.summary.total_over_12_pay.toFixed(2) : '' },
                  { label: 'Total Payment', value: emp.summary?.total_payment != null ? emp.summary.total_payment.toFixed(2) : '', bold: true },
                  { label: 'Check', value: '' },
                  { label: 'Cash', value: '' },
                ];
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
                        {emp.rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                            <td className={`bg-[#ecfdf5] px-2 py-1 border border-gray-300 text-right text-[11px] whitespace-nowrap ${rowIdx < payLines.length && payLines[rowIdx].bold ? 'font-bold' : ''}`}>
                              {rowIdx < payLines.length ? payLines[rowIdx].label : ''}
                            </td>
                            <td className={`bg-[#ecfdf5] px-2 py-1 border border-gray-300 text-center ${rowIdx < payLines.length && payLines[rowIdx].bold ? 'font-bold' : ''}`}>
                              {rowIdx < payLines.length ? payLines[rowIdx].value : ''}
                            </td>
                          </tr>
                        ))}
                        {/* Totals Row */}
                        <tr className="font-bold">
                          <td colSpan={5} className="bg-gray-700 text-white px-2 py-1.5 border border-gray-400 text-right">TOTALS:</td>
                          <td colSpan={11} className="bg-gray-200 px-2 py-1.5 border border-gray-400"></td>
                          <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{emp.summary?.total_finally_hours}</td>
                          <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{emp.summary?.total_8_hours}</td>
                          <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{emp.summary?.total_over_8}</td>
                          <td className="bg-gray-800 text-white px-2 py-1.5 border border-gray-400 text-center">{emp.summary?.total_over_12}</td>
                          <td colSpan={2} className="bg-gray-200 px-2 py-1.5 border border-gray-400"></td>
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
