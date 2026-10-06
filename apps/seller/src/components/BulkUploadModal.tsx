import { useState } from 'react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import Modal from '@/components/ui/Modal';
import { useBulkUpload, useCategories, toCategoryOptions, type BulkUploadResult } from '@/hooks/useSellerInventory';

interface Props { open: boolean; onClose: () => void; }

// Columns the seller fills. Order matters for the template header.
// `price` = selling price. `mrp` (optional) = original price and `discount`
// (optional %) drive the strike-through discount display.
// Variants: rows that share the same `group` value merge into ONE product;
// each such row becomes a variant defined by `option1` / `option2` with its own
// price / mrp / stock. Leave `group`/`option1`/`option2` blank for a plain item.
const COLUMNS = ['group', 'title', 'description', 'category', 'brand', 'sku', 'price', 'mrp', 'discount', 'unit', 'stock', 'condition', 'option1', 'option2'] as const;
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
    // Hierarchical labels so sellers can pick a subcategory, e.g.
    // "Electrical & Lighting → Switches". Top-levels appear on their own.
    const catOptions = toCategoryOptions(categories as any);
    const catNames: string[] = catOptions.map((c) => c.label);
    // A default example category — prefer a subcategory if one exists.
    const exampleCat = (catOptions.find((c) => c.isChild) ?? catOptions[0])?.label ?? '';
    if (catNames.length === 0) { toast.error('Categories not loaded yet — try again in a moment'); return; }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');

    // Header row.
    ws.addRow(COLUMNS as unknown as string[]);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE7E9' } };

    // Column widths for readability.
    // group,title,description,category,brand,sku,price,mrp,discount,unit,stock,condition,option1,option2
    ws.columns = [
      { width: 18 }, { width: 26 }, { width: 30 }, { width: 20 }, { width: 14 }, { width: 12 },
      { width: 10 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 8 }, { width: 12 },
      { width: 20 }, { width: 16 },
    ];

    // Example rows. Category uses the hierarchical label (pick a subcategory
    // like "Electrical & Lighting → Switches" from the dropdown).
    // 1) A plain discounted product (no group/options): MRP 30000, 20% off.
    ws.addRow(['', 'Samsung Galaxy A15', '128GB blue', exampleCat, 'Samsung', '', 24000, 30000, 20, 'piece', 10, 'brand_new', '', '']);
    // 2) A plain product, no discount.
    ws.addRow(['', 'Office Chair', 'Ergonomic mesh chair', exampleCat, '', '', 4500, '', '', 'piece', 5, 'like_new', '', '']);
    // 3-5) A VARIANT product: three rows sharing group "LED-Bulb-Combo". Each row
    //      is one option (option1 = spec, option2 = colour) with its own price/stock.
    ws.addRow(['LED-Bulb-Combo', 'Himstar LED Bulb', 'Energy-efficient LED bulb', exampleCat, 'Himstar', '', 95, 120, 20, 'piece', 500, 'brand_new', '3W B22', 'White']);
    ws.addRow(['LED-Bulb-Combo', 'Himstar LED Bulb', 'Energy-efficient LED bulb', exampleCat, 'Himstar', '', 95, 120, 20, 'piece', 500, 'brand_new', '3W B22', 'Warm White']);
    ws.addRow(['LED-Bulb-Combo', 'Himstar LED Bulb', 'Energy-efficient LED bulb', exampleCat, 'Himstar', '', 160, 200, 20, 'piece', 500, 'brand_new', '9W E27', 'White']);

    // A hidden sheet holding the category list for the dropdown source.
    const listSheet = wb.addWorksheet('Lists');
    catNames.forEach((name, i) => { listSheet.getCell(`A${i + 1}`).value = name; });
    listSheet.state = 'veryHidden';

    // Apply dropdown (data validation) to rows 2..501.
    // Columns: A group, B title, C description, D category, E brand, F sku,
    // G price, H mrp, I discount, J unit, K stock, L condition, M option1, N option2.
    const catRef = `Lists!$A$1:$A$${catNames.length}`;
    for (let r = 2; r <= 501; r++) {
      ws.getCell(`D${r}`).dataValidation = {
        type: 'list', allowBlank: false, formulae: [catRef],
        showErrorMessage: true, errorTitle: 'Pick a category', error: 'Please choose a category from the list.',
      };
      ws.getCell(`I${r}`).dataValidation = {
        type: 'whole', operator: 'between', allowBlank: true, formulae: [0, 100],
        showErrorMessage: true, errorTitle: 'Discount %', error: 'Discount must be a whole number between 0 and 100.',
      };
      ws.getCell(`J${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [`"${UNITS.join(',')}"`],
      };
      ws.getCell(`L${r}`).dataValidation = {
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
            Fill it in Excel — one row per product (or per variant). The
            <span className="font-medium"> Category</span> column has a dropdown that includes
            subcategories shown as <span className="font-medium">Parent → Child</span> (e.g.
            “Electrical &amp; Lighting → Switches”) — pick the most specific one.
            Required: <span className="font-medium">title, category, price, stock</span>.
          </p>
          <ul className="text-gray-500 text-xs mb-2 list-disc pl-4 space-y-0.5">
            <li><span className="font-medium">Discount:</span> put the original price in <span className="font-medium">mrp</span> and the <span className="font-medium">discount</span> % (0–100). <span className="font-medium">price</span> is what the customer pays. Leave blank for no discount.</li>
            <li><span className="font-medium">Variants:</span> give several rows the same <span className="font-medium">group</span> value to merge them into ONE product the customer picks options on. Put the option in <span className="font-medium">option1</span> (e.g. size or spec) and <span className="font-medium">option2</span> (e.g. colour); each row keeps its own price/mrp/stock. Leave <span className="font-medium">group</span> blank for a plain single product.</li>
            <li>Photos are added later by editing each product.</li>
          </ul>
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
