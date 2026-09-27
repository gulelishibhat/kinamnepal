import { useState } from 'react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import Modal from '@/components/ui/Modal';
import { useBulkUpload, useCategories, type BulkUploadResult } from '@/hooks/useSellerInventory';

interface Props { open: boolean; onClose: () => void; }

// Columns the seller fills. Order matters for the template header.
const COLUMNS = ['title', 'description', 'category', 'brand', 'sku', 'price', 'unit', 'stock', 'condition'] as const;
const UNITS = ['piece', 'meter', 'pack', 'set', 'roll', 'box'];
const CONDITIONS = ['brand_new', 'like_new', 'used'];

// Minimal CSV parser: handles quoted fields, escaped quotes ("") and commas.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== '')) // skip blank lines
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
      return obj;
    });
}

export default function BulkUploadModal({ open, onClose }: Props) {
  const bulk = useBulkUpload();
  const { data: categories } = useCategories();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<BulkUploadResult | null>(null);

  async function downloadTemplate() {
    const catNames: string[] = (categories ?? []).map((c: any) => c.nameEn);
    if (catNames.length === 0) { toast.error('Categories not loaded yet — try again in a moment'); return; }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');

    // Header row.
    ws.addRow(COLUMNS as unknown as string[]);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE7E9' } };

    // Column widths for readability.
    ws.columns = [
      { width: 28 }, { width: 34 }, { width: 22 }, { width: 16 },
      { width: 14 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 12 },
    ];

    // Two example rows.
    ws.addRow(['Samsung Galaxy A15', '128GB blue, brand new', catNames[0], 'Samsung', '', 25000, 'piece', 10, 'brand_new']);
    ws.addRow(['Office Chair', 'Ergonomic mesh chair', catNames[0], '', '', 4500, 'piece', 5, 'like_new']);

    // A hidden sheet holding the category list for the dropdown source.
    const listSheet = wb.addWorksheet('Lists');
    catNames.forEach((name, i) => { listSheet.getCell(`A${i + 1}`).value = name; });
    listSheet.state = 'veryHidden';

    // Apply dropdown (data validation) to rows 2..501 for category / unit / condition.
    const catRef = `Lists!$A$1:$A$${catNames.length}`;
    for (let r = 2; r <= 501; r++) {
      ws.getCell(`C${r}`).dataValidation = {
        type: 'list', allowBlank: false, formulae: [catRef],
        showErrorMessage: true, errorTitle: 'Pick a category', error: 'Please choose a category from the list.',
      };
      ws.getCell(`G${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${UNITS.join(',')}"`],
      };
      ws.getCell(`I${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${CONDITIONS.join(',')}"`],
      };
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kinamnepal-bulk-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function parseXlsx(file: File): Promise<Record<string, string>[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((s) => s.name === 'Products') ?? wb.worksheets[0];
    if (!ws) return [];
    const header: string[] = [];
    ws.getRow(1).eachCell((cell, col) => { header[col] = String(cell.value ?? '').trim().toLowerCase(); });
    const out: Record<string, string>[] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // header
      const obj: Record<string, string> = {};
      let hasData = false;
      row.eachCell((cell, col) => {
        const key = header[col];
        if (!key) return;
        let v = cell.value;
        // ExcelJS may return rich objects for some cells — coerce to text.
        if (v && typeof v === 'object' && 'text' in (v as any)) v = (v as any).text;
        if (v && typeof v === 'object' && 'result' in (v as any)) v = (v as any).result;
        const str = v === null || v === undefined ? '' : String(v).trim();
        if (str !== '') hasData = true;
        obj[key] = str;
      });
      if (hasData) out.push(obj);
    });
    return out;
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const isExcel = /\.xlsx$/i.test(file.name);
    if (isExcel) {
      parseXlsx(file)
        .then((parsed) => {
          if (parsed.length === 0) { toast.error('No data rows found in the file'); setRows([]); return; }
          setRows(parsed);
        })
        .catch(() => toast.error('Could not read that Excel file.'));
      return;
    }
    // CSV fallback.
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ''));
        if (parsed.length === 0) { toast.error('No data rows found in the file'); setRows([]); return; }
        setRows(parsed);
      } catch {
        toast.error('Could not read that file. Make sure it is a CSV or Excel file.');
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (rows.length === 0) { toast.error('Please choose a CSV file first'); return; }
    const res = await bulk.mutateAsync(rows);
    setResult(res);
    if (res.created > 0) toast.success(`${res.created} product${res.created > 1 ? 's' : ''} added`);
  }

  function reset() {
    setRows([]); setFileName(''); setResult(null);
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Bulk Upload Products">
      <div className="space-y-4">
        {/* Step 1: template */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
          <p className="font-medium text-gray-800 mb-1">1. Download the Excel template</p>
          <p className="text-gray-500 text-xs mb-2">
            Fill it in Excel — one product per row. The <span className="font-medium">Category</span> column
            has a dropdown — just pick from the list (no typing).
            Required: <span className="font-medium">title, category, price, stock</span>.
            Photos are added later by editing each product.
          </p>
          <button onClick={downloadTemplate} className="btn-secondary btn-sm px-3 py-1.5 text-xs">
            ↓ Download Excel template (.xlsx)
          </button>
        </div>

        {/* Step 2: upload */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
          <p className="font-medium text-gray-800 mb-2">2. Upload your filled file (.xlsx or .csv)</p>
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm text-gray-600"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {fileName && !result && (
            <p className="text-xs text-gray-600 mt-2">
              <span className="font-medium">{fileName}</span> — {rows.length} row{rows.length !== 1 ? 's' : ''} ready to upload
            </p>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="rounded-lg border p-3 text-sm space-y-2 border-gray-200">
            <p className="font-medium text-green-700">✓ {result.created} product{result.created !== 1 ? 's' : ''} added successfully</p>
            {result.failedCount > 0 && (
              <div>
                <p className="font-medium text-red-600 mb-1">{result.failedCount} row{result.failedCount !== 1 ? 's' : ''} skipped:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.failed.map((f, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      Row {f.row} <span className="text-gray-400">({f.title})</span>: <span className="text-red-600">{f.error}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => { reset(); onClose(); }} className="btn-secondary btn-sm px-4 py-2">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={rows.length === 0 || bulk.isPending}
              className="btn-primary btn-sm px-4 py-2"
            >
              {bulk.isPending ? 'Uploading…' : `Upload ${rows.length || ''} product${rows.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
