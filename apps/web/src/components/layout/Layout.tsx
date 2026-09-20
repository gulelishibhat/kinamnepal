import type { ReactNode } from 'react';
import Header from './Header';
import VerifyBanner from './VerifyBanner';

// KinamNepal support contact details.
const SUPPORT_PHONE = '9762623759';
const SUPPORT_WHATSAPP = `977${SUPPORT_PHONE}`; // Nepal country code 977, no leading 0
const WHATSAPP_MESSAGE = encodeURIComponent('Hi, I need help with my order on KinamNepal.');
const WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${WHATSAPP_MESSAGE}`;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <VerifyBanner />
      {/* Extra bottom padding on mobile for bottom nav */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-10 mt-auto pb-20 md:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            {/* Brand */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="KinamNepal" className="h-8 w-8 rounded-lg" />
                <span className="font-bold text-white">KinamNepal</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Local Shopping. Stronger Pokhara.<br />
                Shop • Click • Deliver
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
              <div>
                <p className="text-white font-semibold text-sm mb-2">Shop</p>
                <ul className="space-y-1.5 text-sm">
                  <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
                  <li><a href="/products" className="hover:text-white transition-colors">All listings</a></li>
                </ul>
              </div>
              <div>
                <p className="text-white font-semibold text-sm mb-2">Sell</p>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <a href={import.meta.env.VITE_SELLER_URL ?? '#'} className="hover:text-white transition-colors">
                      Sell on KinamNepal
                    </a>
                  </li>
                  <li>
                    <a href={`${import.meta.env.VITE_SELLER_URL ?? '#'}/login`} className="hover:text-white transition-colors">
                      Seller login
                    </a>
                  </li>
                </ul>
              </div>
              {/* Contact & Support */}
              <div>
                <p className="text-white font-semibold text-sm mb-2">Contact & Support</p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Ujjwal Bhattarai</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${SUPPORT_PHONE}`} className="hover:text-white transition-colors">
                      {SUPPORT_PHONE}
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    {/* WhatsApp icon */}
                    <svg className="h-3.5 w-3.5 shrink-0 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.112 1.532 5.836L.057 23.186a.5.5 0 00.613.637l5.532-1.448A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.953 9.953 0 01-5.065-1.378l-.363-.215-3.761.985.998-3.667-.237-.378A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      WhatsApp us
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Pokhara-9, Nepal</span>
                  </li>
                  <li className="flex items-start gap-2 mt-1">
                    <svg className="h-3.5 w-3.5 shrink-0 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs leading-relaxed">
                      Sun–Fri: 9:00am – 6:00pm<br />
                      Saturday: 10:00am – 4:00pm
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-6 text-sm text-center md:text-left">
            © {new Date().getFullYear()} KinamNepal. Buy &amp; sell across Nepal. · Pokhara-9, Nepal
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp chat button ── */}
      {/* Fixed bottom-right; sits above the mobile bottom nav (z-50, bottom-20 on mobile) */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg transition-all hover:shadow-xl"
        style={{ padding: '12px 16px' }}
      >
        {/* WhatsApp logo */}
        <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.112 1.532 5.836L.057 23.186a.5.5 0 00.613.637l5.532-1.448A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.953 9.953 0 01-5.065-1.378l-.363-.215-3.761.985.998-3.667-.237-.378A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
        <span className="text-sm font-semibold hidden sm:block">Chat with us</span>
      </a>
    </div>
  );
}
