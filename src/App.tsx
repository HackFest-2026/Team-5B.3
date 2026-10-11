import React, { useState, useEffect } from 'react';
import { apiRequest, setMemorySessionToken } from './api/client';
import { formatINR } from './lib/format';
import {
  ImageWithFallback,
  PriceChip,
  PriceCapBadge,
  LoyaltyTierBadge,
  BreakdownTable,
  PriceCountdown,
} from './components/SharedUI';
import { HowWePricePage } from './components/HowWePricePage';
import {
  GlassFeatureCarousel,
  SearchCard,
  PricingPlaygroundSection,
  CategoryStatus,
  PlaceOption,
} from './components/HomeComponents';
import {
  ResultsPage,
  CheckoutPage,
  ConfirmationPage,
  MyBookingsPage,
  ProfilePage,
  HowPricingWorksPage,
} from './components/CustomerPages';
import { AdminConsole } from './components/AdminConsole';
import {
  LogOut,
  Menu,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

export function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname || '/');
  const [searchStr, setSearchStr] = useState<string>(() => window.location.search || '');
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [categories, setCategories] = useState<CategoryStatus[]>([]);
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [whyPriceModal, setWhyPriceModal] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const navigate = (nextUrl: string) => {
    const [p, q] = nextUrl.split('?');
    window.history.pushState({}, '', nextUrl);
    setPath(p || '/');
    setSearchStr(q ? `?${q}` : '');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname || '/');
      setSearchStr(window.location.search || '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchInitialData = async () => {
    try {
      const [catData, plcData, statData] = await Promise.all([
        apiRequest('/api/shop/categories'),
        apiRequest('/api/shop/places'),
        apiRequest('/api/shop/stats'),
      ]);
      setCategories(catData || []);
      setPlaces(plcData?.places || []);
      setStats(statData || null);

      const [htlSearch, airSearch, carSearch] = await Promise.all([
        apiRequest('/api/shop/search/hotel', {
          method: 'POST',
          body: JSON.stringify({ city: 'Udaipur', check_in: '2026-10-17', check_out: '2026-10-20', rooms: 1 }),
        }),
        apiRequest('/api/shop/search/airline', {
          method: 'POST',
          body: JSON.stringify({ origin: 'Bengaluru', destination: 'Udaipur', date: '2026-10-15', passengers: 2, cabin: 'Economy' }),
        }),
        apiRequest('/api/shop/search/car', {
          method: 'POST',
          body: JSON.stringify({ pickup_id: 'plc-udp-01', drop_id: 'plc-udp-02', pickup_at: '14:00' }),
        }),
      ]);
      const combinedDeals = [
        ...(htlSearch?.results?.slice(0, 2).map((r: any) => ({ ...r, category: 'hotel' })) || []),
        ...(airSearch?.results?.slice(0, 1).map((r: any) => ({ ...r, category: 'airline' })) || []),
        ...(carSearch?.results?.slice(0, 1).map((r: any) => ({ ...r, category: 'car' })) || []),
      ];
      setDeals(combinedDeals);
    } catch {
      // Quiet fallback
    }
  };

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then((res) => setUser(res?.user || null))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
    fetchInitialData();
  }, []);

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setMemorySessionToken(null);
    setUser(null);
    showToast('Signed out.');
    navigate('/');
  };

  const queryParams = Object.fromEntries(new URLSearchParams(searchStr).entries());

  if (path === '/admin/login') {
    return (
      <AdminLoginPage
        onSuccess={(u) => {
          setUser(u);
          navigate('/admin');
        }}
        onNavigate={navigate}
      />
    );
  }

  if (path.startsWith('/admin')) {
    if (!authChecked) {
      return (
        <div className="min-h-screen bg-[#3E362E] text-[#FAF8F6] flex items-center justify-center p-6 text-xs uppercase tracking-[0.2em]">
          Loading Monetize360 Admin Console...
        </div>
      );
    }
    if (!user || user.role !== 'admin') {
      return (
        <AdminLoginPage
          onSuccess={(u) => {
            setUser(u);
          }}
          onNavigate={navigate}
        />
      );
    }

    let adminTab = 'dashboard';
    let auditIdParam: string | undefined = undefined;
    if (path.startsWith('/admin/domains/new')) adminTab = 'builder';
    else if (path.startsWith('/admin/analytics')) adminTab = 'analytics';
    else if (path.startsWith('/admin/guardrails')) adminTab = 'guardrails';
    else if (path.startsWith('/admin/promos')) adminTab = 'promos';
    else if (path.startsWith('/admin/proof')) adminTab = 'proof';
    else if (path.startsWith('/admin/inventory')) adminTab = 'inventory';
    else if (path.startsWith('/admin/simulate')) adminTab = 'simulate';
    else if (path.startsWith('/admin/explain')) {
      adminTab = 'explain';
      auditIdParam = path.split('/admin/explain/')[1] || 'AUD-2026-8841';
    } else if (path.startsWith('/admin/versions')) adminTab = 'versions';
    else if (path.startsWith('/admin/performance')) adminTab = 'performance';
    else if (path.startsWith('/admin/users')) adminTab = 'users';
    else if (path.startsWith('/admin/bookings')) adminTab = 'bookings';
    else if (path.startsWith('/admin/settings')) adminTab = 'settings';

    return (
      <AdminConsole
        user={user}
        activeTab={adminTab}
        auditIdParam={auditIdParam}
        onNavigate={navigate}
        onLogout={handleLogout}
        onPublishDomainChange={fetchInitialData}
      />
    );
  }

  const isHome = path === '/';

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F1ED] text-[#3E362E]">
      {/* Strict 3-Zone Top Bar Contract (No admin links in public navbar) */}
      <header
        className={`no-print sticky top-0 z-40 transition-colors duration-200 ${
          scrolled || !isHome
            ? 'bg-[#3E362E] text-[#FAF8F6] border-b border-[#93785B]/30 shadow-sm'
            : 'bg-[#3E362E] text-[#FAF8F6]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-medium tracking-[0.22em] uppercase text-[#FAF8F6] whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            MONETIZE360 <span className="text-[#AC8968]">TRAVEL</span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#FAF8F6]/85">
            <button
              type="button"
              onClick={() => navigate('/hotels?city=Udaipur&check_in=2026-10-17&check_out=2026-10-20&guests=2&rooms=1')}
              className="hover:text-[#FAF8F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Hotels
            </button>
            <button
              type="button"
              onClick={() => navigate('/flights?origin=Bengaluru&destination=Udaipur&date=2026-10-15&passengers=2&cabin=Economy')}
              className="hover:text-[#FAF8F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Flights
            </button>
            <button
              type="button"
              onClick={() => navigate('/cars?pickup_id=plc-udp-01&drop_id=plc-udp-02&pickup_at=14:00&car_type=all')}
              className="hover:text-[#FAF8F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Cars
            </button>
            <button
              type="button"
              onClick={() => navigate('/how-we-price')}
              className="hover:text-[#FAF8F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              How we price
            </button>
            <button
              type="button"
              onClick={() => navigate('/how-pricing-works')}
              className="hover:text-[#FAF8F6] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              How pricing works
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="px-2.5 py-1.5 rounded-[4px] border border-[#AC8968] text-[#AC8968] hover:bg-[#AC8968] hover:text-[#3E362E] text-xs font-medium whitespace-nowrap cursor-pointer transition-colors"
                  >
                    Admin Console
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/account/bookings')}
                  className="text-xs text-[#FAF8F6]/85 hover:text-[#FAF8F6] hover:underline whitespace-nowrap cursor-pointer hidden sm:inline"
                >
                  My bookings
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/account')}
                  className="px-3 py-1.5 rounded-[4px] bg-[#865D36] text-[#FAF8F6] text-xs font-medium whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{user.full_name.split(' ')[0]} ({user.customer_segment})</span>
                  {user.loyalty?.tier && (
                    <span className="px-1.5 py-0.5 rounded-[2px] bg-[#3E362E] text-[#FAF8F6] text-[10px] uppercase tracking-wider">
                      {user.loyalty.tier}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 text-[#FAF8F6]/75 hover:text-[#FAF8F6] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs font-medium text-[#FAF8F6]/90 hover:text-[#FAF8F6] whitespace-nowrap cursor-pointer"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="px-4 py-2 bg-[#FAF8F6] text-[#3E362E] hover:bg-[#AC8968] hover:text-[#3E362E] text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Sign up
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#FAF8F6] cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#3E362E] border-t border-[#93785B]/30 px-4 py-4 space-y-3 text-sm">
            <button
              type="button"
              onClick={() => navigate('/hotels')}
              className="block w-full text-left py-2 text-[#FAF8F6]"
            >
              Hotels
            </button>
            <button
              type="button"
              onClick={() => navigate('/flights')}
              className="block w-full text-left py-2 text-[#FAF8F6]"
            >
              Flights
            </button>
            <button
              type="button"
              onClick={() => navigate('/cars')}
              className="block w-full text-left py-2 text-[#FAF8F6]"
            >
              Cars
            </button>
            <button
              type="button"
              onClick={() => navigate('/how-pricing-works')}
              className="block w-full text-left py-2 text-[#FAF8F6]"
            >
              How pricing works
            </button>
          </div>
        )}
      </header>

      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#3E362E] text-[#FAF8F6] border border-[#AC8968] px-5 py-3 rounded-[4px] shadow-lg text-xs font-medium flex items-center gap-3">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="text-[#AC8968] underline cursor-pointer">
            Close
          </button>
        </div>
      )}

      <main className="flex-1">
        {path === '/' && (
          <HomePageView
            categories={categories}
            places={places}
            stats={stats}
            deals={deals}
            userSegment={user?.customer_segment}
            onNavigate={navigate}
            onOpenWhyPrice={(deal) => setWhyPriceModal(deal)}
          />
        )}

        {path === '/hotels' && (
          <ResultsPage
            category="hotel"
            categories={categories}
            places={places}
            queryParams={queryParams}
            onNavigate={navigate}
            showToast={showToast}
          />
        )}

        {path === '/flights' && (
          <ResultsPage
            category="airline"
            categories={categories}
            places={places}
            queryParams={queryParams}
            onNavigate={navigate}
            showToast={showToast}
          />
        )}

        {path === '/cars' && (
          <ResultsPage
            category="car"
            categories={categories}
            places={places}
            queryParams={queryParams}
            onNavigate={navigate}
            showToast={showToast}
          />
        )}

        {path.startsWith('/checkout/') && (
          <CheckoutPage
            quoteId={path.split('/checkout/')[1]}
            user={user}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onNavigate={navigate}
            showToast={showToast}
          />
        )}

        {path.startsWith('/booking/') && (
          <ConfirmationPage
            bookingId={path.split('/booking/')[1]}
            onNavigate={navigate}
          />
        )}

        {path === '/account/bookings' && (
          user ? (
            <MyBookingsPage onNavigate={navigate} showToast={showToast} />
          ) : (
            <AuthSplitPage
              mode="login"
              onSuccess={(u) => {
                setUser(u);
                fetchInitialData();
              }}
              onNavigate={navigate}
            />
          )
        )}

        {path === '/account' && (
          user ? (
            <ProfilePage
              user={user}
              onUserUpdated={(u) => {
                setUser(u);
                fetchInitialData();
              }}
              showToast={showToast}
            />
          ) : (
            <AuthSplitPage
              mode="login"
              onSuccess={(u) => {
                setUser(u);
                fetchInitialData();
              }}
              onNavigate={navigate}
            />
          )
        )}

        {path === '/login' && (
          <AuthSplitPage
            mode="login"
            onSuccess={(u) => {
              setUser(u);
              fetchInitialData();
              navigate(u.role === 'admin' ? '/admin' : '/');
            }}
            onNavigate={navigate}
          />
        )}

        {path === '/register' && (
          <AuthSplitPage
            mode="register"
            onSuccess={(u) => {
              setUser(u);
              fetchInitialData();
              showToast('Account created');
              navigate('/');
            }}
            onNavigate={navigate}
          />
        )}

        {path === '/how-we-price' && (
          <HowWePricePage onNavigate={navigate} />
        )}

        {path === '/how-pricing-works' && (
          <HowPricingWorksPage userSegment={user?.customer_segment} />
        )}

        {![
          '/',
          '/hotels',
          '/flights',
          '/cars',
          '/account/bookings',
          '/account',
          '/login',
          '/register',
          '/how-we-price',
          '/how-pricing-works',
        ].includes(path) &&
          !path.startsWith('/checkout/') &&
          !path.startsWith('/booking/') && <NotFoundPage onNavigate={navigate} />}
      </main>

      {whyPriceModal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#3E362E]/60">
          <div className="w-full max-w-lg bg-[#FAF8F6] h-full p-6 sm:p-8 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#A69080]/35 pb-4">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
                    TRANSPARENT CALCULATION TRACE
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                    {whyPriceModal.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWhyPriceModal(null)}
                  className="px-3 py-1.5 border border-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-[#3E362E]/80 leading-relaxed">
                Every price on Monetize360 Travel is produced by our deterministic domain-agnostic engine. Below is the exact step-by-step calculation from the active configuration version:
              </p>

              <BreakdownTable
                breakdown={whyPriceModal.quote.breakdown}
                finalPrice={whyPriceModal.quote.unit_price}
                configVersion={whyPriceModal.quote.config_version}
                auditId={whyPriceModal.quote.audit_id}
                capApplied={whyPriceModal.quote.cap_applied}
                capDetails={whyPriceModal.quote.cap_details}
                onNavigate={(url: string) => {
                  setWhyPriceModal(null);
                  navigate(url);
                }}
              />
            </div>

            <div className="pt-6 border-t border-[#A69080]/30 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const qId = whyPriceModal.quote.quote_id;
                  setWhyPriceModal(null);
                  navigate(`/checkout/${qId}`);
                }}
                className="px-5 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
              >
                Proceed to Checkout ({formatINR(whyPriceModal.quote.total)})
              </button>
            </div>
          </div>
        </div>
      )}

      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E362E]/60 p-4">
          <div className="bg-[#FAF8F6] border border-[#A69080] rounded-[4px] max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-xs underline cursor-pointer"
            >
              Close
            </button>
            <AuthQuickForm
              onSuccess={(u) => {
                setUser(u);
                setAuthModalOpen(false);
                fetchInitialData();
                showToast(`Signed in as ${u.full_name}`);
              }}
            />
          </div>
        </div>
      )}

      <footer className="no-print bg-[#3E362E] text-[#FAF8F6] border-t border-[#93785B]/30 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <div className="text-sm font-medium tracking-[0.22em] uppercase text-[#FAF8F6]">
              MONETIZE360 <span className="text-[#AC8968]">TRAVEL</span>
            </div>
            <p className="text-xs text-[#FAF8F6]/75 max-w-sm leading-relaxed">
              Powered by Monetize360 Dynamic Pricing Engine. Every hotel room, flight seat, and chauffeur transfer is priced deterministically with a verifiable step-by-step audit trail.
            </p>
            <p className="text-[11px] text-[#AC8968] pt-1">
              Demo data. All hotels, airlines and cars are fictional.
            </p>
          </div>

          <div className="md:col-span-4 space-y-2 text-xs">
            <div className="uppercase tracking-[0.16em] text-[#AC8968] font-semibold mb-2">
              Categories & Architecture
            </div>
            <button type="button" onClick={() => navigate('/hotels')} className="block text-[#FAF8F6]/80 hover:text-[#FAF8F6] cursor-pointer">
              Hospitality & Courtyard Stays
            </button>
            <button type="button" onClick={() => navigate('/flights')} className="block text-[#FAF8F6]/80 hover:text-[#FAF8F6] cursor-pointer">
              Commercial Aviation (Skyline Air & Monsoon Airways)
            </button>
            <button type="button" onClick={() => navigate('/cars')} className="block text-[#FAF8F6]/80 hover:text-[#FAF8F6] cursor-pointer">
              Chauffeur & Urban Mobility
            </button>
            <button type="button" onClick={() => navigate('/how-we-price')} className="block text-[#FAF8F6]/80 hover:text-[#FAF8F6] cursor-pointer font-semibold">
              How we price (Live Rules & Caps)
            </button>
            <button type="button" onClick={() => navigate('/how-pricing-works')} className="block text-[#FAF8F6]/80 hover:text-[#FAF8F6] cursor-pointer">
              How pricing works
            </button>
          </div>

          <div className="md:col-span-3 space-y-2 text-xs">
            <div className="uppercase tracking-[0.16em] text-[#AC8968] font-semibold mb-2">
              Demo Credentials (Hackfest 2026)
            </div>
            <div className="text-[#FAF8F6]/80 space-y-1 tabular-nums">
              <div>Loyalty Customer: loyalty@demo.travel</div>
              <div>Student Customer: student@demo.travel</div>
              <div>Password: TravelDemo@2026</div>
              <div className="pt-2 text-[#FAF8F6]/65">
                Admins reach{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin/login')}
                  className="underline text-[#AC8968] hover:text-[#FAF8F6] cursor-pointer font-mono"
                >
                  /admin/login
                </button>{' '}
                by typing or clicking the URL.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const HomePageView: React.FC<{
  categories: CategoryStatus[];
  places: PlaceOption[];
  stats: any;
  deals: any[];
  userSegment?: string;
  onNavigate: (path: string) => void;
  onOpenWhyPrice: (deal: any) => void;
}> = ({ categories, places, stats, deals, userSegment, onNavigate, onOpenWhyPrice }) => {
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);

  const hotelCat = categories.find((c) => c.category === 'hotel');
  const flightCat = categories.find((c) => c.category === 'airline');
  const carCat = categories.find((c) => c.category === 'car');

  return (
    <div>
      {/* 1. Full Viewport Editorial Split Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[580px]">
        <div className="lg:col-span-5 bg-[#AC8968] p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
          <div className="text-xs font-medium tracking-[0.22em] uppercase text-[#3E362E]">
            MONETIZE360 · UNIVERSAL PRICING
          </div>

          <div className="my-8 space-y-6">
            <h1
              className="font-light text-[#3E362E] tracking-[-0.02em] leading-[1.05]"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 4.25rem)', textWrap: 'balance' } as any}
            >
              Every fare, explained.
            </h1>

            <div className="bg-[#FAF8F6] border border-[#3E362E]/15 rounded-[4px] p-5 space-y-3 shadow-sm">
              <p className="text-sm text-[#3E362E] leading-relaxed">
                Hotels, commercial airlines, and chauffeur transfers powered by one domain-agnostic pricing engine. Inspect the exact rules, occupancy signals, and rounding behind every rupee.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/hotels?city=Udaipur&check_in=2026-10-17&check_out=2026-10-20&guests=2&rooms=1')}
                  className="px-4 py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] transition-colors cursor-pointer"
                >
                  Explore Golden Stays (₹3,730)
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/how-pricing-works')}
                  className="px-4 py-2 border border-[#3E362E] text-[#3E362E] hover:bg-[#E6DCD2] text-xs font-medium rounded-[4px] transition-colors cursor-pointer"
                >
                  How pricing works
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#3E362E]">
            ↓ SCROLL
          </div>
        </div>

        <div className="lg:col-span-7">
          <GlassFeatureCarousel categories={categories} onNavigate={onNavigate} />
        </div>
      </section>

      {/* 2. Search Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <SearchCard
          categories={categories}
          places={places}
          onSearchSubmit={(cat, params) => {
            const qs = new URLSearchParams(params).toString();
            const route = cat === 'hotel' ? '/hotels' : cat === 'airline' ? '/flights' : '/cars';
            onNavigate(`${route}?${qs}`);
          }}
        />
      </section>

      {/* 3. Live Stats Strip */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
              <div className="text-xs text-[#3E362E]/70">Prices served today</div>
              <div className="text-2xl sm:text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
                {stats.prices_served_today.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
              <div className="text-xs text-[#3E362E]/70">Avg response time in ms</div>
              <div className="text-2xl sm:text-3xl font-semibold text-[#4F6B3A] tabular-nums mt-1">
                {stats.avg_latency_ms} ms
              </div>
            </div>
            <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
              <div className="text-xs text-[#3E362E]/70">Rules applied</div>
              <div className="text-2xl sm:text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
                {stats.rules_fired_total.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
              <div className="text-xs text-[#3E362E]/70">Industries supported</div>
              <div className="text-2xl sm:text-3xl font-semibold text-[#865D36] tabular-nums mt-1">
                {stats.industries_supported} Domains
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Three Category Panels */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-12">
        <div className="max-w-2xl">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
            THREE INDUSTRIES · ONE PRICING ENGINE
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#3E362E] mt-1">
            Configured by JSON, Never Hardcoded
          </h2>
        </div>

        <div className="space-y-8">
          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6 h-64 lg:h-auto">
              <ImageWithFallback imageKey="suite_hotel" alt="Architectural Hotels" className="w-full h-full min-h-[260px]" />
            </div>
            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
                  01 · HOSPITALITY DOMAIN (ACTIVE v{hotelCat?.config_version || 2})
                </span>
                <h3 className="font-display text-3xl font-medium text-[#3E362E]">
                  Hotels & Courtyard Sanctuaries
                </h3>
                <p className="text-sm text-[#3E362E]/80 leading-relaxed">
                  Sequential rule stacking combines weekend demand (+20%), real-time room occupancy above 80% (+15%), and loyalty member concessions (−10%), rounded half-up to the nearest ₹10.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[#A69080]/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#3E362E]/65 block">Live Starting Fare</span>
                  <span className="text-2xl font-semibold text-[#3E362E] tabular-nums">
                    From {formatINR(hotelCat?.from_price ?? 3730)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {deals[0] && (
                    <button
                      type="button"
                      onClick={() => onOpenWhyPrice(deals[0])}
                      className="px-4 py-2.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] hover:bg-[#E6DCD2] cursor-pointer"
                    >
                      Why this price?
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('/hotels')}
                    className="px-5 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                  >
                    Browse Hotels
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between order-2 lg:order-1">
              <div className="space-y-3">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
                  02 · COMMERCIAL AVIATION DOMAIN ({flightCat?.enabled ? `ACTIVE v${flightCat.config_version}` : 'OPENING SOON'})
                </span>
                <h3 className="font-display text-3xl font-medium text-[#3E362E]">
                  Flights — Skyline Air & Monsoon Airways
                </h3>
                <p className="text-sm text-[#3E362E]/80 leading-relaxed">
                  Demonstrating zero-code extensibility: publish the Airline domain in the Admin Console to activate departure window uplifts (&lt;7 days +25%), seat scarcity (&lt;20 seats +15%), and student scholar discounts (−5%).
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[#A69080]/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#3E362E]/65 block">Status</span>
                  <span className="text-2xl font-semibold text-[#3E362E] tabular-nums">
                    {flightCat?.enabled && flightCat.from_price
                      ? `From ${formatINR(flightCat.from_price)}`
                      : 'Opening soon'}
                  </span>
                </div>
                <div>
                  {flightCat?.enabled ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('/flights')}
                      className="px-5 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                    >
                      Search Flights
                    </button>
                  ) : (
                    <span className="px-4 py-2.5 bg-[#E6DCD2] text-[#3E362E]/70 text-xs font-medium rounded-[4px] inline-block">
                      Opening soon
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 h-64 lg:h-auto order-1 lg:order-2">
              <ImageWithFallback imageKey="airliner_sunset" alt="Commercial Aviation" className="w-full h-full min-h-[260px]" />
            </div>
          </div>

          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6 h-64 lg:h-auto">
              <ImageWithFallback imageKey="exec_sedan" alt="Chauffeur Transfers" className="w-full h-full min-h-[260px]" />
            </div>
            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
                  03 · URBAN MOBILITY DOMAIN (ACTIVE v{carCat?.config_version || 1})
                </span>
                <h3 className="font-display text-3xl font-medium text-[#3E362E]">
                  Cars — Chauffeur & Point-to-Point Transfers
                </h3>
                <p className="text-sm text-[#3E362E]/80 leading-relaxed">
                  Formula-driven base pricing (₹40 + ₹14 × km) paired with mutually exclusive demand-ratio surge tiers (1.4× above 1.5 ratio; 1.8× above 2.0 ratio) and a 2.5× maximum surge cap.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[#A69080]/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[#3E362E]/65 block">8.0 km Golden Transfer</span>
                  <span className="text-2xl font-semibold text-[#3E362E] tabular-nums">
                    From {formatINR(carCat?.from_price ?? 213)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {deals[2] && (
                    <button
                      type="button"
                      onClick={() => onOpenWhyPrice(deals[2])}
                      className="px-4 py-2.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] hover:bg-[#E6DCD2] cursor-pointer"
                    >
                      Why this price?
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('/cars')}
                    className="px-5 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                  >
                    Book a Transfer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Today's Deals */}
      {deals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
          <div>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#865D36] font-semibold">
              LIVE SERVER QUOTES
            </span>
            <h2 className="font-display text-3xl font-medium text-[#3E362E] mt-1">
              Today’s Deals
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {deals.map((d) => {
              const q = d.quote;
              const isExp = expandedDealId === d.item_id;
              return (
                <div
                  key={d.item_id}
                  className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#3E362E]/70 mb-2">
                      <span className="uppercase tracking-wider font-semibold text-[#865D36]">
                        {d.category}
                      </span>
                      <PriceCountdown expiresAt={q.expires_at} />
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-[#3E362E] uppercase">
                      {d.title}
                    </h3>
                    <p className="text-xs text-[#3E362E]/75 mt-0.5">{d.subtitle}</p>
                  </div>

                  <div className="pt-4 border-t border-[#A69080]/25 flex items-end justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {q.base_price !== q.unit_price && (
                          <span className="text-xs text-[#3E362E]/50 line-through tabular-nums">
                            {formatINR(q.base_price)}
                          </span>
                        )}
                        <PriceChip
                          direction={q.headline_adjustment.direction}
                          effect={q.headline_adjustment.effect}
                          label={q.headline_adjustment.label}
                        />
                        {q.cap_applied && q.cap_details && (
                          <PriceCapBadge capDetails={q.cap_details} />
                        )}
                      </div>
                      <div className="text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
                        {formatINR(q.unit_price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedDealId(isExp ? null : d.item_id)}
                        className="px-3 py-2 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
                      >
                        {isExp ? 'Hide calculation' : 'See calculation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate(`/checkout/${q.quote_id}`)}
                        className="px-4 py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  </div>

                  {isExp && (
                    <div className="pt-3">
                      <BreakdownTable
                        breakdown={q.breakdown}
                        finalPrice={q.unit_price}
                        configVersion={q.config_version}
                        auditId={q.audit_id}
                        capApplied={q.cap_applied}
                        capDetails={q.cap_details}
                        compact
                        onNavigate={onNavigate}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Interactive How Pricing Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <PricingPlaygroundSection userSegment={userSegment} />
      </section>

      {/* 7. Why Choose Us (4 Tiles — Page C1.9) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              title: 'Transparent calculation',
              desc: 'Every fare displays its base price, ordered rules fired, constraints, and half-up rounding.',
            },
            {
              title: 'Price valid with a countdown',
              desc: 'Quotes lock in your server-computed price for 10 minutes with live expiry protection.',
            },
            {
              title: 'Every price auditable',
              desc: 'Each quote and booking carries a unique Audit ID traceable in the forensic Explain console.',
            },
            {
              title: 'Loyalty and student pricing',
              desc: 'Verified member segments apply −10% loyalty or −5% student concessions automatically on the server.',
            },
          ].map((tile, i) => (
            <div key={i} className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5 space-y-1.5">
              <div className="text-xs font-semibold text-[#865D36] tabular-nums">0{i + 1}</div>
              <h3 className="font-display text-xl font-semibold text-[#3E362E]">{tile.title}</h3>
              <p className="text-xs text-[#3E362E]/75 leading-relaxed">{tile.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const AuthSplitPage: React.FC<{
  mode: 'login' | 'register';
  onSuccess: (user: any) => void;
  onNavigate: (path: string) => void;
}> = ({ mode, onSuccess, onNavigate }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-12 items-stretch">
      <div className="lg:col-span-5 bg-[#AC8968] p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div className="text-xs uppercase tracking-[0.22em] font-medium text-[#3E362E]">
          MONETIZE360 MEMBER ACCESS
        </div>
        <div className="my-8 space-y-4">
          <h1 className="font-light text-4xl sm:text-5xl text-[#3E362E] tracking-tight leading-tight">
            {mode === 'login' ? 'Welcome back to transparent travel.' : 'Create your verified travel account.'}
          </h1>
          <div className="bg-[#FAF8F6] p-4 rounded-[4px] text-xs text-[#3E362E] space-y-1.5">
            <div className="font-semibold text-[#865D36] uppercase tracking-wider">
              Quick Demo Accounts (One-Click Fill Available)
            </div>
            <div>Loyalty (−10% Hotels): loyalty@demo.travel / TravelDemo@2026</div>
            <div>Student (−5% Flights): student@demo.travel / TravelDemo@2026</div>
            <div className="pt-2 border-t border-[#A69080]/30 flex items-center justify-between">
              <span>Operator Admin: admin@monetize360.travel</span>
              <button
                type="button"
                onClick={() => onNavigate('/admin/login')}
                className="px-2.5 py-1 bg-[#3E362E] text-[#FAF8F6] rounded-[4px] font-medium hover:bg-[#865D36] cursor-pointer"
              >
                Go to /admin/login →
              </button>
            </div>
          </div>
        </div>
        <div className="text-xs text-[#3E362E]">
          Account segments are verified server-side on every quote.
        </div>
      </div>

      <div className="lg:col-span-7 bg-[#F5F1ED] p-6 sm:p-12 flex items-center justify-center">
        <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] max-w-md w-full p-6 sm:p-8 shadow-sm">
          <AuthQuickForm
            initialMode={mode}
            onSuccess={onSuccess}
            onSwitchMode={(m) => onNavigate(m === 'login' ? '/login' : '/register')}
          />
        </div>
      </div>
    </div>
  );
};

const AuthQuickForm: React.FC<{
  initialMode?: 'login' | 'register';
  onSuccess: (user: any) => void;
  onSwitchMode?: (m: 'login' | 'register') => void;
}> = ({ initialMode = 'login', onSuccess, onSwitchMode }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('loyalty@demo.travel');
  const [phone, setPhone] = useState('9820123456');
  const [password, setPassword] = useState('TravelDemo@2026');
  const [confirmPassword, setConfirmPassword] = useState('TravelDemo@2026');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const isAdminEmail = email.trim().toLowerCase() === 'admin@monetize360.travel';
        const endpoint = isAdminEmail ? '/api/auth/admin/login' : '/api/auth/login';
        const res = await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (res.session_token) setMemorySessionToken(res.session_token);
        onSuccess(res.user);
      } else {
        const res = await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone,
            password,
            confirm_password: confirmPassword,
          }),
        });
        if (res.session_token) setMemorySessionToken(res.session_token);
        onSuccess(res.user);
      }
    } catch (err: any) {
      if (err.code === 'ACCOUNT_LOCKED' && err.details?.retry_after_seconds) {
        setLockoutSeconds(err.details.retry_after_seconds);
      }
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-[#A69080]/30 pb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-[#3E362E]">
          {mode === 'login' ? 'Customer Sign In' : 'Create Customer Account'}
        </h2>
        <div className="flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setEmail('loyalty@demo.travel');
              setPassword('TravelDemo@2026');
            }}
            className="px-2 py-1 bg-[#E6DCD2] rounded text-[#3E362E] cursor-pointer"
          >
            Fill Loyalty
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('student@demo.travel');
              setPassword('TravelDemo@2026');
            }}
            className="px-2 py-1 bg-[#E6DCD2] rounded text-[#3E362E] cursor-pointer"
          >
            Fill Student
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@monetize360.travel');
              setPassword('AdminPassword2026!');
            }}
            className="px-2 py-1 bg-[#3E362E] rounded text-[#FAF8F6] cursor-pointer"
          >
            Fill Admin
          </button>
        </div>
      </div>

      {mode === 'register' && (
        <div>
          <label className="block text-xs font-medium mb-1">Full Name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-10 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium mb-1">Email Address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-10 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm"
        />
      </div>

      {mode === 'register' && (
        <div>
          <label className="block text-xs font-medium mb-1">10-Digit Mobile Phone</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-10 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium mb-1">Password</label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-10 px-3 pr-10 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-2.5 text-[#3E362E]/60 cursor-pointer"
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mode === 'register' && (
        <>
          <div className="text-[11px] text-[#3E362E]/75 space-y-0.5 bg-[#F5F1ED] p-2.5 rounded-[4px]">
            <div className={password.length >= 8 ? 'text-[#4F6B3A]' : ''}>✓ At least 8 characters</div>
            <div className={/[A-Z]/.test(password) && /[a-z]/.test(password) ? 'text-[#4F6B3A]' : ''}>
              ✓ Uppercase and lowercase letters
            </div>
            <div className={/\d/.test(password) && /[^A-Za-z0-9]/.test(password) ? 'text-[#4F6B3A]' : ''}>
              ✓ At least one digit and one symbol
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-sm"
            />
          </div>
        </>
      )}

      {lockoutSeconds > 0 && (
        <div className="p-3 bg-[#9B2C2C]/10 border border-[#9B2C2C] rounded-[4px] text-xs text-[#9B2C2C] tabular-nums">
          Account locked. Retry in {lockoutSeconds} seconds.
        </div>
      )}

      {error && <div className="text-xs text-[#9B2C2C] font-medium">▲ {error}</div>}

      <button
        type="submit"
        disabled={loading || lockoutSeconds > 0}
        className="w-full h-11 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer disabled:opacity-50"
      >
        {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
      </button>

      <div className="flex items-center justify-between text-xs pt-2">
        <button
          type="button"
          onClick={() => {
            const next = mode === 'login' ? 'register' : 'login';
            setMode(next);
            if (onSwitchMode) onSwitchMode(next);
          }}
          className="text-[#865D36] hover:underline cursor-pointer"
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already registered? Sign in'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => setForgotNotice(!forgotNotice)}
            className="text-[#3E362E]/70 hover:underline cursor-pointer"
          >
            Forgot password?
          </button>
        )}
      </div>

      {forgotNotice && (
        <div className="text-xs text-[#3E362E]/80 bg-[#E6DCD2]/50 p-2.5 rounded-[4px]">
          Contact the administrator.
        </div>
      )}
    </form>
  );
};

const AdminLoginPage: React.FC<{
  onSuccess: (user: any) => void;
  onNavigate: (path: string) => void;
}> = ({ onSuccess, onNavigate }) => {
  const [email, setEmail] = useState('admin@monetize360.travel');
  const [password, setPassword] = useState('AdminPassword2026!');
  const [showPwd, setShowPwd] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.session_token) setMemorySessionToken(res.session_token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#3E362E] text-[#FAF8F6] flex items-center justify-center p-4">
      <div className="bg-[#FAF8F6] text-[#3E362E] border border-[#A69080] rounded-[4px] max-w-md w-full p-8 space-y-5 shadow-2xl">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#865D36] font-semibold">
            RESTRICTED OPERATOR ACCESS
          </span>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E] mt-1">
            Monetize360 Admin Console
          </h1>
          <div className="mt-3 p-3 bg-[#E6DCD2]/65 border border-[#A69080]/50 rounded-[4px] text-xs space-y-1 tabular-nums">
            <div className="font-semibold text-[#865D36] uppercase tracking-wider">
              Demo Operator Credentials
            </div>
            <div>
              Email: <strong>admin@monetize360.travel</strong>
            </div>
            <div>
              Password: <strong>AdminPassword2026!</strong>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Admin Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Admin Password</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-2.5 text-[#3E362E]/60 cursor-pointer"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <div className="text-xs text-[#9B2C2C] font-medium">▲ {error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Enter Admin Console'}
          </button>
        </form>

        <div className="pt-3 border-t border-[#A69080]/30 flex justify-between text-xs">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-[#865D36] hover:underline cursor-pointer"
          >
            ← Return to Public Storefront
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@monetize360.travel');
              setPassword('AdminPassword2026!');
            }}
            className="text-[#3E362E] underline cursor-pointer"
          >
            Fill Default Credentials
          </button>
        </div>
      </div>
    </div>
  );
};

const NotFoundPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
    <span className="text-xs uppercase tracking-[0.2em] text-[#865D36] font-semibold tabular-nums">
      HTTP 404 · PAGE NOT FOUND
    </span>
    <h1 className="font-display text-4xl font-semibold text-[#3E362E]">
      This destination could not be found.
    </h1>
    <p className="text-sm text-[#3E362E]/75">
      The page you requested does not exist or has been moved.
    </p>
    <div className="pt-2">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="px-6 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
      >
        Return to Home
      </button>
    </div>
  </div>
);

export default App;
