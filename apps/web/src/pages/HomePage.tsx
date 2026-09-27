import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useProducts, useCategories } from '@/hooks/useProducts';
import ProductCard from '@/components/product/ProductCard';
import Spinner from '@/components/ui/Spinner';
import type { Locale } from '@mkelectric/shared';

type TrendingTab = 'newest' | 'price_desc' | 'price_asc';

const TABS: Array<{ key: TrendingTab; label: string }> = [
  { key: 'newest', label: 'Trending' },
  { key: 'price_desc', label: 'Premium' },
  { key: 'price_asc', label: 'Budget picks' },
];

function ListingGrid({ sort, limit }: { sort: TrendingTab; limit: number }) {
  const { data, isLoading } = useProducts({ limit, sort });
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }
  const products = data?.data ?? [];
  if (!products.length) {
    return <p className="text-center py-12 text-gray-400">No listings yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {products.map((product: any) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TrendingTab>('newest');

  const { data: categories } = useCategories();

  // Show a toast after returning from the email-verification link.
  useEffect(() => {
    if (searchParams.get('verified') === 'success') {
      toast.success('Email verified! Thanks for confirming your address.');
      const next = new URLSearchParams(searchParams);
      next.delete('verified');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-10">
      {/* Hero banner with clickable zones over the image (image-map style).
          The banner art already contains a "Shop Now" button on the lower-left;
          we place an invisible Shop link over it, and a "Become a Seller" link
          in the empty space to its right. Positions are % so they scale. */}
      <section className="rounded-2xl overflow-hidden shadow-sm relative">
        <img
          src="/hero-banner.png"
          alt="KinamNepal — Shop anything, delivered to Pokhara. Electronics, Fashion, Accessories, Home & more."
          className="w-full h-auto block"
          loading="eager"
        />

        {/* Shop Now — clickable zone over the "Shop Now" button in the art */}
        <Link
          to="/products"
          aria-label="Shop now"
          className="absolute"
          style={{ left: '3.5%', top: '62%', width: '20%', height: '13%' }}
        />
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Browse by category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {categories.map((cat: any) => (
              <Link
                key={cat.id}
                to={`/products?categoryId=${cat.id}`}
                className="flex flex-col items-center gap-2 text-center p-3 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all"
              >
                <div className="h-11 w-11 bg-primary-50 rounded-full flex items-center justify-center">
                  <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700 leading-tight line-clamp-2">
                  {locale === 'ne' ? cat.nameNe : cat.nameEn}
                </span>
                {typeof cat.adCount === 'number' && (
                  <span className="text-[11px] text-gray-400">{cat.adCount} Ads</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trending (tabbed) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors min-h-0 min-w-0 ${
                  tab === tb.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>
          <Link to="/products" className="text-primary-600 font-medium hover:text-primary-700 text-sm">
            {t('common.viewAll')} →
          </Link>
        </div>
        <ListingGrid sort={tab} limit={10} />
      </section>

      {/* Latest uploads */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Latest uploads</h2>
          <Link to="/products?sort=newest" className="text-primary-600 font-medium hover:text-primary-700 text-sm">
            {t('common.viewAll')} →
          </Link>
        </div>
        <ListingGrid sort="newest" limit={15} />
      </section>
    </div>
  );
}
