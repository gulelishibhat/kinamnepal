import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '@/hooks/useProducts';
import ProductCard from '@/components/product/ProductCard';
import Spinner from '@/components/ui/Spinner';
import type { Locale } from '@mkelectric/shared';

const CONDITIONS: Array<{ value: string; label: string }> = [
  { value: 'brand_new', label: 'Brand New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'used', label: 'Used' },
];

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const params = {
    page: Number(searchParams.get('page') ?? 1),
    categoryId: searchParams.get('categoryId') ?? undefined,
    brand: searchParams.get('brand') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    inStock: searchParams.get('inStock') === 'true' ? true : undefined,
    condition: (searchParams.get('condition') as any) ?? undefined,
    sort: (searchParams.get('sort') as any) ?? 'newest',
  };

  const { data, isLoading } = useProducts(params);
  const { data: categories } = useCategories();

  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  }

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => updateParam('search', val || undefined), 300);
    setDebounceTimer(timer);
  }, [searchParams, debounceTimer]);

  const products = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="flex flex-row gap-3 sm:gap-6 md:gap-8 items-start">
        {/* Filters sidebar — stays on the left on every screen size */}
        <aside className="w-36 sm:w-56 md:w-64 shrink-0 sticky top-4 self-start">
          <div className="card p-2.5 sm:p-4 space-y-4 sm:space-y-6">
            <h2 className="font-semibold text-gray-900">{t('search.filters.title')}</h2>

            {/* Search */}
            <div>
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('search.placeholder')}
                className="input"
              />
            </div>

            {/* Categories (top-level → subcategories) */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('search.filters.category')}</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => { updateParam('categoryId', undefined); setExpandedCat(null); }}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                    !params.categoryId ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Categories
                </button>
                {categories?.map((cat: any) => {
                  const name = locale === 'ne' ? cat.nameNe : cat.nameEn;
                  const children: any[] = cat.children ?? [];
                  const isExpanded = expandedCat === cat.id || children.some((ch) => ch.id === params.categoryId);
                  const isActiveTop = params.categoryId === cat.id;
                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => {
                          // Clicking a top category filters by it AND reveals its subcategories.
                          updateParam('categoryId', cat.id);
                          setExpandedCat(isExpanded && isActiveTop ? null : cat.id);
                        }}
                        className={`w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                          isActiveTop ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {children.length > 0 && (
                            <svg
                              className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                            >
                              <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>{name}</span>
                        </span>
                        {typeof cat.totalAdCount === 'number' && (
                          <span className="text-xs text-gray-400">{cat.totalAdCount}</span>
                        )}
                      </button>

                      {/* Subcategory list — revealed when the top category is expanded */}
                      {isExpanded && children.length > 0 && (
                        <div className="ml-3 pl-2 border-l border-gray-200 mt-0.5 mb-1 space-y-0.5">
                          {children.map((sub: any) => {
                            const subName = locale === 'ne' ? sub.nameNe : sub.nameEn;
                            const isActiveSub = params.categoryId === sub.id;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => updateParam('categoryId', sub.id)}
                                className={`w-full flex items-center justify-between text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                                  isActiveSub ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                                }`}
                              >
                                <span>{subName}</span>
                                {typeof sub.adCount === 'number' && sub.adCount > 0 && (
                                  <span className="text-xs text-gray-400">{sub.adCount}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Condition */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Condition</p>
              <div className="space-y-1">
                <button
                  onClick={() => updateParam('condition', undefined)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                    !params.condition ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Any condition
                </button>
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateParam('condition', c.value)}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded-lg transition-colors ${
                      params.condition === c.value ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* In stock only */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.inStock === true}
                onChange={(e) => updateParam('inStock', e.target.checked ? 'true' : undefined)}
                className="rounded border-gray-300 text-primary-700 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{t('search.filters.inStockOnly')}</span>
            </label>

            {/* Price range */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('search.filters.priceRange')}</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder={t('search.filters.minPrice')}
                  value={params.minPrice ?? ''}
                  onChange={(e) => updateParam('minPrice', e.target.value || undefined)}
                  className="input text-sm"
                  min={0}
                />
                <input
                  type="number"
                  placeholder={t('search.filters.maxPrice')}
                  value={params.maxPrice ?? ''}
                  onChange={(e) => updateParam('maxPrice', e.target.value || undefined)}
                  className="input text-sm"
                  min={0}
                />
              </div>
            </div>

            <button
              onClick={() => { setSearch(''); setSearchParams(new URLSearchParams()); }}
              className="btn-secondary w-full text-sm"
            >
              {t('search.filters.reset')}
            </button>
          </div>
        </aside>

        {/* Products grid */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-xs sm:text-sm text-gray-500">
              {meta ? t('search.results', { count: meta.total, query: search || 'all' }) : ''}
            </p>
            <select
              value={params.sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="input w-auto text-xs sm:text-sm py-1.5"
            >
              <option value="newest">{t('search.sort.newest')}</option>
              <option value="price_asc">{t('search.sort.priceAsc')}</option>
              <option value="price_desc">{t('search.sort.priceDesc')}</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg">{t('common.noResults')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {products.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <button
                    disabled={!meta.hasPrevPage}
                    onClick={() => updateParam('page', String(params.page - 1))}
                    className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    ← Prev
                  </button>
                  <span className="flex items-center px-4 text-sm text-gray-600">
                    {params.page} / {meta.totalPages}
                  </span>
                  <button
                    disabled={!meta.hasNextPage}
                    onClick={() => updateParam('page', String(params.page + 1))}
                    className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
