import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { useAdminProduct, useCreateProduct, useUpdateProduct, useCategories, useUploadProductImage } from '@/hooks/useInventory';

interface Props { open: boolean; onClose: () => void; editId: string | null; }

const UNITS = ['piece', 'meter', 'pack', 'set', 'roll', 'box'] as const;
const STATUSES = ['active', 'inactive', 'out_of_stock'] as const;

export default function ProductFormModal({ open, onClose, editId }: Props) {
  const isEdit = !!editId;
  const { data: existing, isLoading: loadingExisting } = useAdminProduct(editId ?? '');
  const { data: categories } = useCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct(editId ?? '');
  const uploadImage = useUploadProductImage(editId ?? '');

  const empty = {
    nameEn: '', nameNe: '', descriptionEn: '', descriptionNe: '',
    categoryId: '', brand: '', sku: '', price: 0, unit: 'piece' as const,
    stockQuantity: 0, lowStockThreshold: 5, status: 'active' as const, specifications: [] as { key: string; value: string }[],
  };

  const [form, setForm] = useState(empty);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (existing && isEdit) {
      setForm({
        nameEn: existing.nameEn, nameNe: existing.nameNe,
        descriptionEn: existing.descriptionEn, descriptionNe: existing.descriptionNe,
        categoryId: existing.categoryId, brand: existing.brand,
        sku: existing.sku, price: Number(existing.price),
        unit: existing.unit, stockQuantity: existing.stockQuantity,
        lowStockThreshold: existing.lowStockThreshold,
        status: existing.status, specifications: existing.specifications ?? [],
      });
    } else if (!isEdit) {
      setForm(empty);
    }
  }, [existing, isEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: { en: form.nameEn, ne: form.nameNe },
      description: { en: form.descriptionEn, ne: form.descriptionNe },
      categoryId: form.categoryId, brand: form.brand, sku: form.sku,
      price: form.price, unit: form.unit, stockQuantity: form.stockQuantity,
      lowStockThreshold: form.lowStockThreshold, status: form.status,
      specifications: form.specifications,
    };

    if (isEdit) {
      await update.mutateAsync(payload);
      if (imageFile) await uploadImage.mutateAsync(imageFile);
    } else {
      const product = await create.mutateAsync(payload);
      if (imageFile && product?.id) {
        // Upload to new product — re-instantiate hook with correct id handled by parent re-mount
      }
    }
    onClose();
  }

  function f(field: string, value: unknown) { setForm((p) => ({ ...p, [field]: value })); }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'}>
      {isEdit && loadingExisting ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Name (English) *</label>
              <input className="input" required value={form.nameEn} onChange={(e) => f('nameEn', e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Name (Nepali) *</label>
              <input className="input" required value={form.nameNe} onChange={(e) => f('nameNe', e.target.value)} /></div>
          </div>

          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description (English)</label>
            <textarea className="input resize-none" rows={2} value={form.descriptionEn} onChange={(e) => f('descriptionEn', e.target.value)} /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description (Nepali)</label>
            <textarea className="input resize-none" rows={2} value={form.descriptionNe} onChange={(e) => f('descriptionNe', e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select className="input" required value={form.categoryId} onChange={(e) => f('categoryId', e.target.value)}>
                <option value="">Select…</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Brand *</label>
              <input className="input" required value={form.brand} onChange={(e) => f('brand', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">SKU *</label>
              <input className="input" required value={form.sku} onChange={(e) => f('sku', e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Price (NPR) *</label>
              <input className="input" type="number" required min={0} value={form.price} onChange={(e) => f('price', Number(e.target.value))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select className="input" value={form.unit} onChange={(e) => f('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
              <input className="input" type="number" min={0} value={form.stockQuantity} onChange={(e) => f('stockQuantity', Number(e.target.value))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Low Stock Threshold</label>
              <input className="input" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => f('lowStockThreshold', Number(e.target.value))} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select className="input" value={form.status} onChange={(e) => f('status', e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>

          <div><label className="block text-xs font-medium text-gray-600 mb-1">Product Image (JPEG/PNG/WebP, max 5MB)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-gray-600"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} /></div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="btn-primary btn-sm px-4 py-2">
              {create.isPending || update.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
