import { useCallback } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

  const handleExportExcel = useCallback(async () => {
    if (!timesheetData || timesheetData.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Timesheet', {
      views: [{ state: 'frozen', ySplit: 2 }] // Freeze first two rows (Group Header + Column Header)
    });

    // 1. Define Columns & Widths
    sheet.columns = [
      { header: 'Employee', key: 'emp', width: 18 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Start Time', key: 'start', width: 10 },
      { header: 'End Time', key: 'end', width: 10 },
      { header: 'Total Hours', key: 'total_hrs', width: 12 },
      { header: 'Break In', key: 'b1_in', width: 10 },
      { header: 'Break Out', key: 'b1_out', width: 10 },
      { header: 'Total Break', key: 'b1_tot', width: 10 },
      { header: 'Break In', key: 'b2_in', width: 10 },
      { header: 'Break Out', key: 'b2_out', width: 10 },
      { header: 'Total Break', key: 'b2_tot', width: 10 },
      { header: 'Start Time', key: 'b3_in', width: 10 },
      { header: 'End Time', key: 'b3_out', width: 10 },
      { header: 'Total Break', key: 'b3_tot', width: 10 },
      { header: 'Total Break', key: 'tot_b', width: 12 },
      { header: 'Total W/O Break', key: 'tot_wo', width: 15 },
      { header: 'Finally Hrs', key: 'finally', width: 12 },
      { header: '8 Hours', key: 'reg8', width: 10 },
      { header: 'Over 8', key: 'ov8', width: 10 },
      { header: 'Over 12', key: 'ov12', width: 10 },
      { header: 'Pay Label', key: 'pay_lbl', width: 25 },
      { header: 'Pay Amount', key: 'pay_amt', width: 15 },
    ];

    // 2. Build the Group Header Row (Row 1)
    sheet.spliceRows(1, 0, [
      '', '', '', '', '', '', // empty above first 6 cols
      'Break 1 (not deducted)', '', '',
      'Break 2 (deducted)', '', '',
      'Break 3 (not deducted)', '', '',
      'Total Hours', '', '', '', '', '',
      'Hourly Rate', ''
    ]);

    // Merge cells for the Group Header
    sheet.mergeCells('G1:I1'); // Break 1
    sheet.mergeCells('J1:L1'); // Break 2
    sheet.mergeCells('M1:O1'); // Break 3
    sheet.mergeCells('P1:U1'); // Total Hours
    sheet.mergeCells('V1:W1'); // Hourly Rate

    // 3. Apply Colors & Styles to Headers
    const colors = {
      darkBlue: 'FF1A2744', green: 'FF2D6A4F', red: 'FFDC2626',
      lightOrange: 'FFF5E6C8', darkOrange: 'FFEA580C',
      slate: 'FF1E293B', emerald: 'FF065F46'
    };

    const applyHeaderStyle = (rowIdx) => {
      const row = sheet.getRow(rowIdx);
      row.font = { bold: true };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      
      const setColStyle = (start, end, bgHex, fontHex = 'FFFFFFFF') => {
        for (let i = start; i <= end; i++) {
          const cell = row.getCell(i);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
          cell.font = { color: { argb: fontHex }, bold: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
          };
        }
      };

      if (rowIdx === 1) {
        setColStyle(1, 6, 'FF1F2937'); // empty dark gray
        setColStyle(7, 9, colors.lightOrange, 'FF1F2937');
        setColStyle(10, 12, colors.darkOrange);
        setColStyle(13, 15, colors.lightOrange, 'FF1F2937');
        setColStyle(16, 21, colors.slate);
        setColStyle(22, 23, colors.emerald);
      } else {
        setColStyle(1, 3, colors.darkBlue);
        setColStyle(4, 5, colors.green);
        setColStyle(6, 6, colors.red);
        setColStyle(7, 9, colors.lightOrange, 'FF1F2937');
        setColStyle(10, 12, colors.darkOrange);
        setColStyle(13, 15, colors.lightOrange, 'FF1F2937');
        setColStyle(16, 17, colors.red);
        setColStyle(18, 21, colors.slate);
        setColStyle(22, 23, colors.emerald);
      }
    };

    applyHeaderStyle(1); // Group header
    applyHeaderStyle(2); // Column header

    // 4. Fill Data
    timesheetData.forEach(emp => {
      const s = emp.summary;

      const payLines = [
        { label: emp.name,           value: '', bold: true },
        { label: 'Hourly Rate',      value: '' }, // Rate injected later
        { label: 'Total 8 Hrs',      value: '' }, // Formula injected later
        { label: 'Total Over 8',     value: '' }, // Formula injected later
        { label: 'Total Over 12',    value: '' }, // Formula injected later
        { label: 'Total Payment',    value: '', bold: true }, // Formula injected later
        { label: 'Check',            value: '' },
        { label: 'Cash',             value: '' },
        { label: s?.ot_note || '',   value: '', italic: true },
      ];

      const interleavedRows = buildInterleavedRows(emp);

      // Ensure we have enough DAILY rows to render the full pay sidebar
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

      let pIdx = 0;
      const payLineRowIndices = {};

      // Light background colors matching UI
      const fillLightBlue   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slightly lighter than e2e8f0
      const fillLightGreen  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      const fillLightRed    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      const fillLightTan    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      const fillLightOrange = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
      const fillLightGray   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      interleavedRows.forEach((item, rowIdx) => {
        if (item._type === 'weekSubtotal') {
          // ── Week Subtotal Row ──
          const text = `${item.week_label}   Total: ${item.finally_hours}h   Regular (≤40h): ${item.regular_hours}h` + 
                       (item.overtime_hours > 0 ? `   Overtime (>40h): ${item.overtime_hours}h` : '');
          
          const addedRow = sheet.addRow([
            text, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            '', '', '', '', '', ''
          ]);
          sheet.mergeCells(addedRow.number, 1, addedRow.number, 21);
          
          for (let c = 1; c <= 21; c++) {
            const cell = addedRow.getCell(c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            if (c === 1) cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        } else {
          // ── Daily Row ──
          const pl = pIdx < payLines.length ? payLines[pIdx] : { label: '', value: '' };
          
          const rowData = [
            item['Date'] ? emp.name : '',
            item['Date'] || '', item['Day'] || '', item['Start Time'] || '', item['End Time'] || '', item['Total Hours'] || '',
            item['Break 1 In'] || '', item['Break 1 Out'] || '', item['Break 1 Total'] || '',
            item['Break 2 In'] || '', item['Break 2 Out'] || '', item['Break 2 Total'] || '',
            item['Break 3 In'] || '', item['Break 3 Out'] || '', item['Break 3 Total'] || '',
            item['Total Break'] || '', item['Total Without Break'] || '',
            item['Finally Hours'] ? Number(item['Finally Hours']) : '',
            item['8 Hours'] ? Number(item['8 Hours']) : '',
            item['over 8'] ? Number(item['over 8']) : '',
            item['over 12'] ? Number(item['over 12']) : '',
            pl.label, pl.value
          ];

          const addedRow = sheet.addRow(rowData);
          if (pIdx < payLines.length) {
            payLineRowIndices[pIdx] = addedRow.number;
          }

          // Apply Light Backgrounds
          for(let c=2; c<=3; c++) addedRow.getCell(c).fill = fillLightBlue;
          for(let c=4; c<=5; c++) addedRow.getCell(c).fill = fillLightGreen;
          addedRow.getCell(6).fill = fillLightRed;
          for(let c=7; c<=9; c++) addedRow.getCell(c).fill = fillLightTan;
          for(let c=10; c<=12; c++) addedRow.getCell(c).fill = fillLightOrange;
          for(let c=13; c<=15; c++) addedRow.getCell(c).fill = fillLightTan;
          for(let c=16; c<=17; c++) addedRow.getCell(c).fill = fillLightRed;
          for(let c=18; c<=21; c++) addedRow.getCell(c).fill = fillLightGray;

          // Apply Grid Borders
          for(let c=1; c<=21; c++) {
            addedRow.getCell(c).border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
          }

          // Apply basic row styling (Pay Summary Side)
          if (pl.bold) {
            addedRow.getCell(22).font = { bold: true };
            addedRow.getCell(23).font = { bold: true };
          }
          if (pl.italic) {
            addedRow.getCell(22).font = { italic: true };
          }

          pIdx++;
        }
      });

      // TOTALS row
      const tRow = sheet.addRow([
        emp.name + ' TOTALS', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        s?.total_finally_hours ?? '',
        s?.total_8_hours ?? '',
        s?.total_over_8 ?? '',
        s?.total_over_12 ?? '',
        '', ''
      ]);
      tRow.font = { bold: true };

      // ── INJECT EXCEL FORMULAS ──
      // Use the dynamically mapped row indices to support intermingled week subtotals
      const r_Rate   = payLineRowIndices[1];
      const r_Tot8   = payLineRowIndices[2];
      const r_TotO8  = payLineRowIndices[3];
      const r_TotO12 = payLineRowIndices[4];
      const r_TotPay = payLineRowIndices[5];
      
      if (r_Rate) {
        const rateCell = sheet.getCell(`W${r_Rate}`);
        rateCell.value = Number(emp.hourly_rate || 0);
        rateCell.numFmt = '"$"#,##0.00';
      }

      const regMult = s?.regular_multiplier ?? 1;
      const o8Mult  = s?.over_8_multiplier ?? 1.5;
      const o12Mult = s?.over_12_multiplier ?? 2;

      if (r_Tot8) {
        const total8Cell = sheet.getCell(`W${r_Tot8}`);
        total8Cell.value = { formula: `W${r_Rate}*${regMult}*S${tRow.number}` };
        total8Cell.numFmt = '"$"#,##0.00';
      }

      if (r_TotO8) {
        const over8Cell = sheet.getCell(`W${r_TotO8}`);
        over8Cell.value = { formula: `W${r_Rate}*${o8Mult}*T${tRow.number}` };
        over8Cell.numFmt = '"$"#,##0.00';
      }

      if (r_TotO12) {
        const over12Cell = sheet.getCell(`W${r_TotO12}`);
        over12Cell.value = { formula: `W${r_Rate}*${o12Mult}*U${tRow.number}` };
        over12Cell.numFmt = '"$"#,##0.00';
      }

      if (r_TotPay) {
        const totalPayCell = sheet.getCell(`W${r_TotPay}`);
        totalPayCell.value = { formula: `W${r_Tot8}+W${r_TotO8}+W${r_TotO12}` };
        totalPayCell.numFmt = '"$"#,##0.00';
      }
      
      // Empty spacer row between employees
      sheet.addRow([]);
    });

    // 5. Generate File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, (csvFilename || 'timesheet').replace('.csv', '.xlsx'));
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
              <button onClick={handleExportExcel} className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                <DownloadIcon className="h-4 w-4 mr-2" />Export Excel
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
