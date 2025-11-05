import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { format, parse, addDays, startOfWeek } from 'date-fns';
import { 
  DocumentArrowUpIcon, 
  XMarkIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';

const SpreadsheetImporter = ({ onImport, onClose, employees = [] }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);

  // Time parsing utilities
  const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    // Handle various time formats
    const cleanTime = timeStr.trim().toUpperCase();
    
    // Format: "08:30A - 05:30P" or "08:30A-05:30P"
    const rangeMatch = cleanTime.match(/(\d{1,2}):(\d{2})([AP])\s*-\s*(\d{1,2}):(\d{2})([AP])/);
    if (rangeMatch) {
      const [, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = rangeMatch;
      return {
        start_time: convertTo24Hour(startHour, startMin, startPeriod),
        end_time: convertTo24Hour(endHour, endMin, endPeriod)
      };
    }
    
    // Format: "1:00P - 10:00P"
    const simpleRangeMatch = cleanTime.match(/(\d{1,2}):(\d{2})([AP])\s*-\s*(\d{1,2}):(\d{2})([AP])/);
    if (simpleRangeMatch) {
      const [, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = simpleRangeMatch;
      return {
        start_time: convertTo24Hour(startHour, startMin, startPeriod),
        end_time: convertTo24Hour(endHour, endMin, endPeriod)
      };
    }
    
    // Single time format: "01:30P"
    const singleTimeMatch = cleanTime.match(/(\d{1,2}):(\d{2})([AP])/);
    if (singleTimeMatch) {
      const [, hour, min, period] = singleTimeMatch;
      return {
        single_time: convertTo24Hour(hour, min, period)
      };
    }
    
    // Special cases
    if (cleanTime.includes('UNTIL TASKS') || cleanTime.includes('TASKS ARE COMPLETED')) {
      return { flexible: true, note: cleanTime };
    }
    
    if (cleanTime.includes('WEEK OFF') || cleanTime === 'OFF') {
      return { off: true };
    }
    
    if (cleanTime.includes('PENDING')) {
      return { pending: true, note: cleanTime };
    }
    
    return null;
  };

  const convertTo24Hour = (hour, minute, period) => {
    let h = parseInt(hour);
    const m = parseInt(minute);
    
    if (period === 'P' && h !== 12) h += 12;
    if (period === 'A' && h === 12) h = 0;
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Extract week range from header
  const extractWeekRange = (worksheet) => {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    for (let R = 0; R <= Math.min(5, range.e.r); R++) {
      for (let C = 0; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.v && typeof cell.v === 'string') {
          const text = cell.v.toUpperCase();
          // Look for patterns like "ROSTER FOR THE WEEK (OCT 06'25 TO OCT 12'25)"
          const weekMatch = text.match(/(\w{3}\s+\d{2}'\d{2})\s+TO\s+(\w{3}\s+\d{2}'\d{2})/);
          if (weekMatch) {
            try {
              const startStr = weekMatch[1].replace("'", "/20");
              const endStr = weekMatch[2].replace("'", "/20");
              const startDate = parse(startStr, 'MMM dd/yyyy', new Date());
              const endDate = parse(endStr, 'MMM dd/yyyy', new Date());
              return { startDate, endDate };
            } catch (e) {
              console.warn('Could not parse week range:', weekMatch);
            }
          }
        }
      }
    }
    
    // Fallback to current week
    const today = new Date();
    return {
      startDate: startOfWeek(today, { weekStartsOn: 1 }), // Monday
      endDate: addDays(startOfWeek(today, { weekStartsOn: 1 }), 6)
    };
  };

  // Find employee data rows
  const findEmployeeRows = (worksheet) => {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const employees = [];
    let currentEmployee = null;
    
    for (let R = 0; R <= range.e.r; R++) {
      const firstCellAddress = XLSX.utils.encode_cell({ r: R, c: 0 });
      const firstCell = worksheet[firstCellAddress];
      
      if (firstCell && firstCell.v) {
        const cellValue = firstCell.v.toString().trim();
        
        // Check if this looks like an employee name (not a header or lunch break)
        if (cellValue && 
            !cellValue.toUpperCase().includes('ROSTER') &&
            !cellValue.toUpperCase().includes('SHIFT') &&
            !cellValue.toUpperCase().includes('EMPLOYEE') &&
            !cellValue.toUpperCase().includes('LUNCH BREAK') &&
            !cellValue.toUpperCase().includes('BREAK')) {
          
          // This might be an employee name
          currentEmployee = {
            name: cellValue,
            row: R,
            shifts: {},
            lunchBreaks: {}
          };
          employees.push(currentEmployee);
        } else if (cellValue.toUpperCase().includes('LUNCH BREAK') && currentEmployee) {
          // This is a lunch break row for the current employee
          currentEmployee.lunchBreakRow = R;
        }
      }
    }
    
    return employees;
  };

  // Parse shift data for each day
  const parseShiftData = (worksheet, employeeRows, weekRange) => {
    const shifts = [];
    const dayColumns = [1, 2, 3, 4, 5, 6, 7]; // Monday to Sunday columns
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    employeeRows.forEach(empData => {
      dayColumns.forEach((colIndex, dayIndex) => {
        const shiftCellAddress = XLSX.utils.encode_cell({ r: empData.row, c: colIndex });
        const shiftCell = worksheet[shiftCellAddress];
        
        let lunchBreakTime = null;
        if (empData.lunchBreakRow) {
          const lunchCellAddress = XLSX.utils.encode_cell({ r: empData.lunchBreakRow, c: colIndex });
          const lunchCell = worksheet[lunchCellAddress];
          if (lunchCell && lunchCell.v) {
            const lunchParsed = parseTime(lunchCell.v.toString());
            if (lunchParsed && lunchParsed.single_time) {
              lunchBreakTime = lunchParsed.single_time;
            }
          }
        }
        
        if (shiftCell && shiftCell.v) {
          const shiftText = shiftCell.v.toString();
          const parsedTime = parseTime(shiftText);
          
          if (parsedTime && !parsedTime.off) {
            const shiftDate = addDays(weekRange.startDate, dayIndex);
            
            const shift = {
              employee_name: empData.name,
              date: format(shiftDate, 'yyyy-MM-dd'),
              day_name: dayNames[dayIndex],
              raw_text: shiftText,
              lunch_break_time: lunchBreakTime,
              shift_type: 'REGULAR'
            };
            
            if (parsedTime.start_time && parsedTime.end_time) {
              shift.start_time = parsedTime.start_time;
              shift.end_time = parsedTime.end_time;
            } else if (parsedTime.flexible) {
              shift.flexible = true;
              shift.notes = parsedTime.note;
              shift.shift_type = 'FLEXIBLE';
            } else if (parsedTime.pending) {
              shift.pending = true;
              shift.notes = parsedTime.note;
              shift.shift_type = 'PENDING';
            }
            
            // Detect special assignments from cell styling or content
            if (shiftText.toLowerCase().includes('driver') || 
                shiftText.toLowerCase().includes('pos') ||
                shiftText.toLowerCase().includes('invoice') ||
                shiftText.toLowerCase().includes('google voice')) {
              shift.special_assignment = shiftText;
              shift.shift_type = 'SPECIAL';
            }
            
            shifts.push(shift);
          }
        }
      });
    });
    
    return shifts;
  };

  const processSpreadsheet = async (file) => {
    setIsProcessing(true);
    setErrors([]);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Extract week range
      const weekRange = extractWeekRange(worksheet);
      
      // Find employee rows
      const employeeRows = findEmployeeRows(worksheet);
      
      if (employeeRows.length === 0) {
        throw new Error('No employee data found in spreadsheet');
      }
      
      // Parse shift data
      const shifts = parseShiftData(worksheet, employeeRows, weekRange);
      
      const parsed = {
        weekRange,
        employees: employeeRows.map(emp => emp.name),
        shifts,
        totalShifts: shifts.length
      };
      
      setParsedData(parsed);
      setPreview(shifts.slice(0, 10)); // Show first 10 shifts as preview
      
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      processSpreadsheet(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const handleImport = () => {
    if (parsedData) {
      onImport(parsedData);
    }
  };

  const downloadTemplate = () => {
    // Create a sample template
    const templateData = [
      ['ROSTER FOR THE WEEK (OCT 23\'25 TO OCT 29\'25)', '', '', '', '', '', ''],
      ['MORNING SHIFT', '', '', '', '', '', ''],
      ['Employee Name', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      ['', '10/23/2025', '10/24/2025', '10/25/2025', '10/26/2025', '10/27/2025', '10/28/2025', '10/29/2025'],
      ['James', '08:30A - 05:30P', '08:30A - 05:30P', '08:30A - 05:30P', 'Regular', '08:30A - 05:30P', '08:30A - 05:30P', 'Week Off'],
      ['Lunch break', '01:30P', '01:30P', '01:30P', '', '01:30P', '01:30P', ''],
      ['Mario', '04:30A - 1:30P', '04:30A - 1:30P', '06:00A - 1:00P', 'Invoices / Customer Comms.', '04:30A - 1:30P', '04:30A - 1:30P', 'Week Off'],
      ['Lunch break', '10:00A', '10:00A', '', '', '10:00A', '10:00A', ''],
      ['Karen', '09:00A - 06:00P', '09:00A - 06:00P', '09:00A - 06:00P', 'Regular', '09:00A - 06:00P', '09:00A - 06:00P', '06:00A - 03:00P'],
      ['Lunch break', '1:30P', '1:30P', '1:30P', '', '1:30P', '1:30P', ''],
      ['Nicholas', '1:00P - 10:00P', '1:00P - Until Tasks are Completed', '1:00P - 10:00P', 'Driver Hours / PD Prices', '1:00P - 10:00P', '1:00P - 10:00P', '1:00P - Until Tasks are Completed'],
      ['Lunch break', '06:00P', '', '06:00P', '', '06:00P', '06:00P', '']
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { width: 15 }, // Employee Name
      { width: 18 }, // Monday
      { width: 18 }, // Tuesday
      { width: 18 }, // Wednesday
      { width: 20 }, // Thursday
      { width: 18 }, // Friday
      { width: 18 }, // Saturday
      { width: 18 }  // Sunday
    ];

    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Roster');

    // Save the file
    XLSX.writeFile(wb, 'weekly_roster_template.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Import Weekly Roster</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-6">
          {!file ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                  Download Template
                </button>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  {isDragActive ? 'Drop the spreadsheet here...' : 'Drag & drop a roster spreadsheet, or click to select'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Supports .xlsx, .xls, .csv files</p>
                <p className="text-xs text-gray-400 mt-2">
                  Need help? Download the template above to see the expected format.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <DocumentArrowUpIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium">{file.name}</span>
                  {isProcessing && <span className="ml-2 text-xs text-blue-600">Processing...</span>}
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Import Errors</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <ul className="list-disc pl-5 space-y-1">
                          {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {parsedData && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">Import Preview</h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Week: {format(parsedData.weekRange.startDate, 'MMM dd')} - {format(parsedData.weekRange.endDate, 'MMM dd, yyyy')}</p>
                        <p>Employees: {parsedData.employees.length}</p>
                        <p>Total Shifts: {parsedData.totalShifts}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {preview && (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h4 className="text-sm font-medium text-gray-900">Shift Preview (First 10)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {preview.map((shift, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{shift.employee_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{shift.date}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {shift.start_time && shift.end_time ? 
                                `${shift.start_time} - ${shift.end_time}` : 
                                shift.raw_text}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{shift.shift_type}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {shift.lunch_break_time && `Lunch: ${shift.lunch_break_time}`}
                              {shift.special_assignment && ` | ${shift.special_assignment}`}
                              {shift.notes && ` | ${shift.notes}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          {parsedData && (
            <button
              onClick={handleImport}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Import {parsedData.totalShifts} Shifts
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpreadsheetImporter;
