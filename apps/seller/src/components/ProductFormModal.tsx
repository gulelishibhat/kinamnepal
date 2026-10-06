import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import {
  useMyProduct, useCreateMyProduct, useUpdateMyProduct, useCategories, toCategoryOptions,
} from '@/hooks/useSellerInventory';

interface Props { open: boolean; onClose: () => void; editId: string | null; }

const UNITS = ['piece', 'meter', 'pack', 'set', 'roll', 'box'] as const;
const CONDITIONS = [
  { v: 'brand_new', l: 'Brand New' },
  { v: 'like_new', l: 'Like New' },
  { v: 'used', l: 'Used' },
] as const;

const MAX_IMAGES = 3;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

// Uploads one image file to a product. Used for both create and edit flows.
async function uploadProductImage(productId: string, file: File) {
  const fd = new FormData();
  fd.append('image', file);
  await api.post(`/products/seller/mine/${productId}/images`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export default function ProductFormModal({ open, onClose, editId }: Props) {
  const isEdit = !!editId;
  const { data: existing, isLoading } = useMyProduct(editId ?? '');
  const { data: categories } = useCategories();
  const categoryOptions = toCategoryOptions(categories as any);
  const create = useCreateMyProduct();
  const update = useUpdateMyProduct(editId ?? '');

  const empty = {
    nameEn: '', descriptionEn: '', categoryId: '', brand: '', sku: '',
    price: '' as unknown as number, mrp: '' as unknown as number, discountPercent: 0,
    unit: 'piece' as const, stockQuantity: 1, condition: 'brand_new' as const,
  };
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState<File[]>([]);
  // Optional size/colour variants with per-combo stock and (optional) price.
  type VariantRow = { size: string; color: string; stock: number; price: number | ''; mrp: number | '' };
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [uploading, setUploading] = useState(false);
  // How many images the listing already has (edit mode) — counts toward the max of 3.
  const existingImageCount = isEdit ? (existing?.images?.length ?? 0) : 0;
  const remainingSlots = Math.max(0, MAX_IMAGES - existingImageCount - images.length);

  useEffect(() => {
    if (existing && isEdit) {
      setForm({
        nameEn: existing.nameEn, descriptionEn: existing.descriptionEn,
        categoryId: existing.categoryId, brand: existing.brand, sku: existing.sku,
        price: Number(existing.price),
        mrp: (existing as any).mrp != null ? Number((existing as any).mrp) : ('' as unknown as number),
        discountPercent: Number((existing as any).discountPercent ?? 0),
        unit: existing.unit,
        stockQuantity: existing.stockQuantity, condition: existing.condition ?? 'brand_new',
      });
      setVariants(Array.isArray(existing.variants) ? existing.variants.map((v: any) => ({
        size: v.size ?? '', color: v.color ?? '', stock: Number(v.stock) || 0,
        price: v.price != null ? Number(v.price) : '', mrp: v.mrp != null ? Number(v.mrp) : '',
      })) : []);
    } else if (!isEdit) {
      setForm(empty);
      setVariants([]);
    }
    setImages([]);
  }, [existing, isEdit, open]);

  const usingVariants = variants.length > 0;
  const variantTotal = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  function addVariant() { setVariants((v) => [...v, { size: '', color: '', stock: 0, price: '', mrp: '' }]); }
  function removeVariant(i: number) { setVariants((v) => v.filter((_, idx) => idx !== i)); }
  function updateVariant(i: number, key: keyof VariantRow, val: string | number) {
    setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const picked = Array.from(fileList);
    const valid: File[] = [];
    for (const file of picked) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG or WebP allowed`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`${file.name}: must be under 5MB`);
        continue;
      }
      valid.push(file);
    }
    setImages((prev) => {
      const room = MAX_IMAGES - existingImageCount - prev.length;
      if (valid.length > room) {
        toast.error(`You can add at most ${MAX_IMAGES} images per listing`);
      }
      return [...prev, ...valid.slice(0, Math.max(0, room))];
    });
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Client-side guard: catch the two most common validation failures early
    // so the seller sees a clear message rather than a generic API error.
    if (!form.nameEn.trim()) { toast.error('Title is required'); return; }
    if (!form.categoryId) { toast.error('Please select a category'); return; }
    const priceNum = Number(form.price);
    if (!priceNum || priceNum <= 0) { toast.error('Price must be greater than 0 (Rs.)'); return; }
    // NE fields reuse EN for simplicity in the seller UI.
    const cleanVariants = variants
      .filter((v) => v.size.trim() || v.color.trim() || v.stock > 0)
      .map((v) => {
        const row: any = { size: v.size.trim(), color: v.color.trim(), stock: Number(v.stock) || 0 };
        if (v.price !== '' && Number(v.price) > 0) row.price = Number(v.price);
        if (v.mrp !== '' && Number(v.mrp) > 0) row.mrp = Number(v.mrp);
        return row;
      });
    const mrpNum = form.mrp !== ('' as any) && Number(form.mrp) > 0 ? Number(form.mrp) : null;
    const payload = {
      name: { en: form.nameEn, ne: form.nameEn },
      description: { en: form.descriptionEn || form.nameEn, ne: form.descriptionEn || form.nameEn },
      categoryId: form.categoryId, brand: form.brand || '—', sku: form.sku,
      price: priceNum,
      mrp: mrpNum,
      discountPercent: Number(form.discountPercent) || 0,
      unit: form.unit,
      // When variants exist, the API sums their stock into the total.
      stockQuantity: cleanVariants.length > 0 ? cleanVariants.reduce((s, v) => s + v.stock, 0) : form.stockQuantity,
      condition: form.condition,
      variants: cleanVariants,
    };
    try {
      let productId = editId;
      if (isEdit) {
        await update.mutateAsync(payload as any);
      } else {
        const created = await create.mutateAsync(payload as any);
        productId = created.id;
      }
      // Upload any selected images to the product (works for both create + edit).
      if (productId && images.length > 0) {
        setUploading(true);
        for (const file of images) {
          await uploadProductImage(productId, file);
        }
        toast.success(`${images.length} image${images.length > 1 ? 's' : ''} uploaded`);
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Something went wrong');
    } finally {
      setUploading(false);
    }
  }

  function f(k: string, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }
  const busy = create.isPending || update.isPending || uploading;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Listing' : 'Add Listing'}>
      {isEdit && isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input className="input" required value={form.nameEn} onChange={(e) => f('nameEn', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea className="input resize-none" rows={2} value={form.descriptionEn} onChange={(e) => f('descriptionEn', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select className="input" required value={form.categoryId} onChange={(e) => f('categoryId', e.target.value)}>
                <option value="">Select…</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.isChild ? `\u00A0\u00A0\u00A0↳ ${c.nameEn}` : c.nameEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
              <select className="input" value={form.condition} onChange={(e) => f('condition', e.target.value)}>
                {CONDITIONS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SKU (optional)</label>
              <input className="input" value={form.sku} onChange={(e) => f('sku', e.target.value)} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (Rs.) *</label>
              <input
                className="input"
                type="number"
                required
                min={1}
                placeholder="e.g. 500"
                value={form.price === ('' as any) ? '' : form.price}
                onChange={(e) => f('price', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => f('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {/* Discount — MRP (original price) + % off. Optional. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Original price / MRP (Rs.) <span className="text-gray-400">optional</span>
              </label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="e.g. 500"
                value={form.mrp === ('' as any) ? '' : form.mrp}
                onChange={(e) => {
                  const mrpVal = e.target.value === '' ? '' : Number(e.target.value);
                  setForm((p) => {
                    // If a discount % is set, keep the selling price in sync with MRP.
                    const disc = Number(p.discountPercent) || 0;
                    const next: any = { ...p, mrp: mrpVal };
                    if (mrpVal !== '' && disc > 0) next.price = Math.round(Number(mrpVal) * (1 - disc / 100) * 100) / 100;
                    return next;
                  });
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Discount % <span className="text-gray-400">optional</span>
              </label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 20"
                value={form.discountPercent || ''}
                onChange={(e) => {
                  const disc = e.target.value === '' ? 0 : Number(e.target.value);
                  setForm((p) => {
                    const next: any = { ...p, discountPercent: disc };
                    // If MRP is known, recompute selling price from the discount.
                    if (p.mrp !== ('' as any) && Number(p.mrp) > 0 && disc > 0) {
                      next.price = Math.round(Number(p.mrp) * (1 - disc / 100) * 100) / 100;
                    }
                    return next;
                  });
                }}
              />
            </div>
          </div>
          {form.mrp !== ('' as any) && Number(form.mrp) > 0 && Number(form.discountPercent) > 0 && (
            <p className="text-xs text-green-600 -mt-2">
              Customer sees Rs. {Number(form.price).toLocaleString('en-IN')} (was Rs. {Number(form.mrp).toLocaleString('en-IN')}, {form.discountPercent}% off).
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
              <input className="input" value={form.brand} onChange={(e) => f('brand', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Quantity {usingVariants && <span className="text-gray-400">(from variants)</span>}
              </label>
              <input
                className="input disabled:bg-gray-100"
                type="number"
                min={0}
                disabled={usingVariants}
                value={usingVariants ? variantTotal : form.stockQuantity}
                onChange={(e) => f('stockQuantity', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Variants — optional size/colour with per-combo stock */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">
                Options / Variants <span className="text-gray-400">(optional)</span>
              </label>
              <button type="button" onClick={addVariant} className="text-xs font-medium text-primary-700 hover:underline min-h-0 min-w-0">
                + Add variant
              </button>
            </div>
            {variants.length === 0 ? (
              <p className="text-xs text-gray-400">
                Add variants if your product comes in options the customer selects (e.g. size/colour, or a spec). Each variant can have its own price and stock. Leave empty for a single-stock item.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_70px_80px_80px_28px] gap-2 text-[11px] text-gray-500 px-1">
                  <span>Option 1</span><span>Option 2</span><span>Stock</span><span>Price</span><span>MRP</span><span />
                </div>
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_70px_80px_80px_28px] gap-2 items-center">
                    <input className="input py-1.5 text-sm" placeholder="e.g. M / spec" value={v.size} onChange={(e) => updateVariant(i, 'size', e.target.value)} />
                    <input className="input py-1.5 text-sm" placeholder="e.g. Red" value={v.color} onChange={(e) => updateVariant(i, 'color', e.target.value)} />
                    <input className="input py-1.5 text-sm" type="number" min={0} value={v.stock} onChange={(e) => updateVariant(i, 'stock', Number(e.target.value))} />
                    <input className="input py-1.5 text-sm" type="number" min={0} placeholder="—" value={v.price === '' ? '' : v.price} onChange={(e) => updateVariant(i, 'price', e.target.value === '' ? '' : Number(e.target.value))} />
                    <input className="input py-1.5 text-sm" type="number" min={0} placeholder="—" value={v.mrp === '' ? '' : v.mrp} onChange={(e) => updateVariant(i, 'mrp', e.target.value === '' ? '' : Number(e.target.value))} />
                    <button type="button" onClick={() => removeVariant(i)} className="h-8 w-8 min-h-0 min-w-0 flex items-center justify-center text-gray-400 hover:text-red-500" aria-label="Remove variant">×</button>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Total stock from variants: <span className="font-semibold">{variantTotal}</span>.
                  Leave Price blank to use the product price for that option.
                </p>
              </div>
            )}
          </div>

          {/* Images — available in BOTH add and edit. Up to 3, each under 5MB. */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Photos (JPEG/PNG/WebP, up to {MAX_IMAGES}, max 5MB each)
            </label>
            {isEdit && existingImageCount > 0 && (
              <p className="text-xs text-gray-400 mb-1">{existingImageCount} photo(s) already on this listing.</p>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={remainingSlots === 0}
              className="block w-full text-sm text-gray-600 disabled:opacity-50"
              onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }}
            />
            {remainingSlots === 0 && (
              <p className="text-xs text-amber-600 mt-1">Maximum of {MAX_IMAGES} photos reached.</p>
            )}

            {/* Selected previews */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((file, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(file)} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 h-5 w-5 min-h-0 min-w-0 flex items-center justify-center bg-red-600 text-white rounded-full text-xs"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary btn-sm px-4 py-2">
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Listing'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
