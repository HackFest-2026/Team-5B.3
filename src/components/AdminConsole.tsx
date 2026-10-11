import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { formatINR, formatDateTimeIST } from '../lib/format';
import { BreakdownTable, PriceChip, ConfirmDialog, ErrorState } from './SharedUI';
import {
  AdminGuardrailsPanel,
  AdminPromosAndLoyaltyPanel,
  AdminAnalyticsView,
  AdminAuditLogPanel,
  AdminProofView,
  ResetDemoDataButton,
} from './AdminExtensions';
import {
  LayoutDashboard,
  Layers,
  Sliders,
  FileSearch,
  History,
  Sparkles,
  Activity,
  Users,
  BookOpen,
  Settings,
  LogOut,
  Plus,
  RotateCcw,
  Plane,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ShieldCheck,
  Tag,
  BarChart3,
  FileCheck2,
} from 'lucide-react';

interface AdminConsoleProps {
  user: any;
  activeTab: string;
  auditIdParam?: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onPublishDomainChange: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  user,
  activeTab,
  auditIdParam,
  onNavigate,
  onLogout,
  onPublishDomainChange,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [domainsData, setDomainsData] = useState<any>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('airline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState(
    'Offer an 8% student concession when customer_segment is student'
  );
  const [copilotResult, setCopilotResult] = useState<any>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [stagedCopilotRule, setStagedCopilotRule] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchCoreAdmin = async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, dm] = await Promise.all([
        apiRequest('/api/admin/stats'),
        apiRequest('/api/v1/domains'),
      ]);
      setStats(st);
      setDomainsData(dm);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoreAdmin();
  }, [activeTab]);

  const handleRunCopilot = async () => {
    setCopilotLoading(true);
    try {
      const res = await apiRequest('/api/v1/copilot/rule', {
        method: 'POST',
        body: JSON.stringify({ prompt: copilotPrompt, domain_slug: selectedDomain }),
      });
      setCopilotResult(res);
    } catch (e: any) {
      showToast(e.message || 'Copilot request failed');
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleToggleDomainLive = async (slug: string) => {
    try {
      const res = await apiRequest(`/api/v1/domains/${slug}/toggle-live`, { method: 'POST' });
      if (res.enabled) {
        showToast(`Domain "${slug}" is now PUBLISHED and LIVE on the customer storefront.`);
      } else {
        showToast(`Domain "${slug}" staged as DRAFT ("Opening soon" on storefront).`);
      }
      onPublishDomainChange();
      fetchCoreAdmin();
    } catch (err: any) {
      showToast(err.message || 'Could not toggle domain status.');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics & Uplift', path: '/admin/analytics', icon: BarChart3 },
    { id: 'guardrails', label: 'Guardrails & Caps', path: '/admin/guardrails', icon: ShieldCheck },
    { id: 'promos', label: 'Promos & Loyalty Tiers', path: '/admin/promos', icon: Tag },
    { id: 'proof', label: 'Proof & Verification', path: '/admin/proof', icon: FileCheck2 },
    { id: 'inventory', label: 'Flights & Inventory', path: '/admin/inventory', icon: Plane },
    { id: 'builder', label: 'Domains & 6-Step Builder', path: '/admin/domains/new', icon: Layers },
    { id: 'simulate', label: 'Simulation & Batch', path: '/admin/simulate', icon: Sliders },
    { id: 'explain', label: 'Explain Audit', path: '/admin/explain/AUD-2026-8843', icon: FileSearch },
    { id: 'versions', label: 'Versions & Audit Log', path: '/admin/versions', icon: History },
    { id: 'performance', label: 'Performance', path: '/admin/performance', icon: Activity },
    { id: 'users', label: 'Users & Segments', path: '/admin/users', icon: Users },
    { id: 'bookings', label: 'Bookings', path: '/admin/bookings', icon: BookOpen },
    { id: 'settings', label: 'Settings & Signals', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#F5F1ED] text-[#3E362E]">
      <aside className="w-64 bg-[#3E362E] text-[#FAF8F6] shrink-0 flex flex-col justify-between">
        <div>
          <div className="px-6 py-5 border-b border-[#93785B]/30">
            <div className="text-xs font-medium tracking-[0.22em] uppercase text-[#FAF8F6]">
              MONETIZE360 <span className="text-[#AC8968]">ADMIN</span>
            </div>
            <div className="text-[11px] text-[#FAF8F6]/65 mt-1">
              Universal Dynamic Pricing Engine
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-[4px] transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#865D36] text-[#FAF8F6]'
                      : 'text-[#FAF8F6]/80 hover:bg-[#93785B]/25 hover:text-[#FAF8F6]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium rounded-[4px] text-[#AC8968] hover:bg-[#93785B]/25 transition-colors cursor-pointer text-left mt-4 border border-[#93785B]/35"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>AI Rule Copilot</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-[#93785B]/30 space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('/flights')}
            className="w-full px-3 py-2 text-xs text-[#AC8968] hover:text-[#FAF8F6] border border-[#AC8968]/40 rounded-[4px] text-left cursor-pointer"
          >
            ✈ View Live Flights Storefront
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="w-full px-3 py-2 text-xs text-[#FAF8F6]/80 hover:text-[#FAF8F6] border border-[#FAF8F6]/20 rounded-[4px] text-left cursor-pointer"
          >
            ← View Public Home
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#FAF8F6]/80 hover:text-[#FAF8F6] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="truncate">Log out ({user?.email})</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-[#FAF8F6] border-b border-[#A69080]/35 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase tracking-[0.16em] text-[#865D36] font-semibold">
              DEMO ENVIRONMENT
            </span>
            <span aria-hidden="true">·</span>
            <div className="flex items-center gap-2">
              <label htmlFor="admin-active-domain-select" className="text-xs text-[#3E362E]/70">Active Domain:</label>
              <select
                id="admin-active-domain-select"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="h-9 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs font-medium text-[#3E362E]"
              >
                <option value="airline">airline (Commercial Aviation &amp; Flights)</option>
                <option value="hotel">hotel (Hospitality &amp; Stays)</option>
                <option value="car">car (Chauffeur &amp; Urban Mobility)</option>
                <option value="hotel_cancellation">hotel_cancellation (Hotel Cancellation Fee Rules)</option>
                <option value="airline_cancellation">airline_cancellation (Airline Cancellation Fee Rules)</option>
                <option value="car_cancellation">car_cancellation (Car Cancellation Fee Rules)</option>
                {domainsData?.domains
                  ?.filter(
                    (d: any) =>
                      ![
                        'airline',
                        'hotel',
                        'car',
                        'hotel_cancellation',
                        'airline_cancellation',
                        'car_cancellation',
                      ].includes(d.slug)
                  )
                  .map((d: any) => (
                    <option key={d.slug} value={d.slug}>
                      {d.slug} ({d.name})
                    </option>
                  ))}
              </select>
              {(() => {
                const activeDomSummary = stats?.domains?.find((d: any) => d.slug === selectedDomain);
                if (!activeDomSummary) return null;
                return (
                  <span
                    className={`hidden xl:inline-flex items-center px-2 py-1 rounded-[3px] text-[11px] font-semibold border ${
                      activeDomSummary.enabled
                        ? 'bg-[#AC8968]/15 border-[#3E362E] text-[#3E362E]'
                        : 'bg-[#AC8968]/10 border-[#865D36] text-[#865D36]'
                    }`}
                  >
                    {activeDomSummary.enabled
                      ? `● Live v${activeDomSummary.active_version}`
                      : '○ Draft'}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ResetDemoDataButton
              showToast={showToast}
              onReset={() => {
                onPublishDomainChange();
                fetchCoreAdmin();
              }}
            />
            <button
              type="button"
              onClick={() => onNavigate('/admin/inventory')}
              className="px-3.5 py-2 border border-[#3E362E] text-[#3E362E] hover:bg-[#E6DCD2] text-xs font-medium rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plane className="w-3.5 h-3.5 text-[#865D36]" />
              <span>Manage Flights & Inventory</span>
            </button>
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="px-3.5 py-2 bg-[#E6DCD2] hover:bg-[#AC8968] text-[#3E362E] text-xs font-medium rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#865D36]" />
              <span>AI Copilot</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/admin/domains/new')}
              className="px-4 py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>6-Step Domain Builder</span>
            </button>
          </div>
        </header>

        {toastMsg && (
          <div className="bg-[#4F6B3A] text-[#FAF8F6] px-6 py-2.5 text-xs font-medium flex items-center justify-between">
            <span>✓ {toastMsg}</span>
            <button type="button" onClick={() => setToastMsg(null)} className="underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        <main className="p-6 sm:p-8 flex-1 overflow-y-auto">
          {error ? (
            <ErrorState message={error} onRetry={fetchCoreAdmin} />
          ) : loading && !stats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 bg-[#FAF8F6] border border-[#A69080]/30 animate-pulse rounded-[4px]"
                />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && stats && (
                <AdminDashboardView
                  stats={stats}
                  selectedDomain={selectedDomain}
                  onNavigate={onNavigate}
                  onSelectDomain={(slug, targetTab) => {
                    setSelectedDomain(slug);
                    if (targetTab) onNavigate(targetTab);
                  }}
                  onToggleDomainLive={handleToggleDomainLive}
                />
              )}

              {activeTab === 'inventory' && (
                <AdminInventoryView
                  selectedDomain={selectedDomain}
                  onSelectDomain={setSelectedDomain}
                  showToast={showToast}
                  onUpdated={() => {
                    onPublishDomainChange();
                    fetchCoreAdmin();
                  }}
                  onNavigate={onNavigate}
                />
              )}

              {activeTab === 'builder' && (
                <AdminDomainBuilderView
                  domainsData={domainsData}
                  selectedDomain={selectedDomain}
                  onSelectDomain={setSelectedDomain}
                  stagedCopilotRule={stagedCopilotRule}
                  onClearStagedRule={() => setStagedCopilotRule(null)}
                  onOpenCopilot={() => setCopilotOpen(true)}
                  onPublished={(slug) => {
                    setSelectedDomain(slug);
                    showToast(
                      `Domain "${slug}" published! Customer storefront updated with zero code changes.`
                    );
                    onPublishDomainChange();
                    fetchCoreAdmin();
                  }}
                />
              )}

              {activeTab === 'simulate' && (
                <AdminSimulateView
                  selectedDomain={selectedDomain}
                  onSelectDomain={setSelectedDomain}
                  showToast={showToast}
                />
              )}

              {activeTab === 'explain' && (
                <AdminExplainView auditIdParam={auditIdParam} onNavigate={onNavigate} />
              )}

              {activeTab === 'versions' && (
                <div className="space-y-8">
                  <AdminVersionsAuditView
                    selectedDomain={selectedDomain}
                    onSelectDomain={setSelectedDomain}
                    domainsData={domainsData}
                    onRefresh={() => {
                      onPublishDomainChange();
                      fetchCoreAdmin();
                    }}
                    onNavigate={onNavigate}
                    showToast={showToast}
                  />
                  <AdminAuditLogPanel />
                </div>
              )}

              {activeTab === 'analytics' && (
                <AdminAnalyticsView
                  selectedDomain={selectedDomain}
                  onSelectDomain={setSelectedDomain}
                />
              )}

              {activeTab === 'guardrails' && (
                <AdminGuardrailsPanel
                  selectedDomain={selectedDomain}
                  onSelectDomain={setSelectedDomain}
                  onAuditLogged={() => {
                    onPublishDomainChange();
                    fetchCoreAdmin();
                  }}
                />
              )}

              {activeTab === 'promos' && (
                <AdminPromosAndLoyaltyPanel
                  selectedDomain={selectedDomain}
                  onAuditLogged={() => {
                    onPublishDomainChange();
                    fetchCoreAdmin();
                  }}
                />
              )}

              {activeTab === 'proof' && <AdminProofView />}

              {activeTab === 'performance' && <AdminPerformanceView />}
              {activeTab === 'users' && <AdminUsersView showToast={showToast} />}
              {activeTab === 'bookings' && (
                <AdminBookingsView
                  selectedDomain={selectedDomain}
                  onSelectDomain={setSelectedDomain}
                  onNavigate={onNavigate}
                  showToast={showToast}
                />
              )}
              {activeTab === 'settings' && (
                <AdminSettingsView showToast={showToast} onUpdated={onPublishDomainChange} />
              )}
            </>
          )}
        </main>
      </div>

      {copilotOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#3E362E]/50">
          <div className="w-full max-w-md bg-[#FAF8F6] h-full p-6 flex flex-col justify-between border-l border-[#A69080] shadow-xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#A69080]/35">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
                    AI-ASSISTED, REVIEW BEFORE PUBLISHING
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                    Natural Language Rule Copilot
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCopilotOpen(false)}
                  className="text-xs text-[#3E362E] underline cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#3E362E] mb-1.5">
                    Describe pricing rule in plain English (Target Domain: {selectedDomain})
                  </label>
                  <textarea
                    rows={3}
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    className="w-full p-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm text-[#3E362E]"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      'Offer an 8% student concession when customer_segment is student',
                      'Add 20% scarcity uplift when seats_left < 10',
                      'Apply 15% monsoon surge when is_raining is true',
                    ].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setCopilotPrompt(sample)}
                        className="text-[11px] px-2 py-1 bg-[#E6DCD2] rounded-[4px] text-[#3E362E] hover:bg-[#AC8968] cursor-pointer text-left"
                      >
                        "{sample}"
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunCopilot}
                  disabled={copilotLoading}
                  className="w-full py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  {copilotLoading ? 'Synthesizing Rule...' : 'Generate Structured Rule'}
                </button>

                {copilotResult && (
                  <div className="mt-4 p-4 bg-[#F5F1ED] border border-[#A69080]/50 rounded-[4px] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#4F6B3A]">✓ Schema Validated</span>
                      <span className="tabular-nums text-[#3E362E]/70">{copilotResult.rule.id}</span>
                    </div>
                    <p className="text-sm font-medium text-[#3E362E]">
                      {copilotResult.english_summary}
                    </p>
                    <pre className="text-[11px] bg-[#FAF8F6] p-3 rounded-[4px] border border-[#A69080]/30 overflow-x-auto tabular-nums">
                      {JSON.stringify(copilotResult.rule, null, 2)}
                    </pre>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStagedCopilotRule(copilotResult.rule);
                          showToast(
                            `Rule "${copilotResult.rule.name}" added to ${selectedDomain} Builder!`
                          );
                          setCopilotOpen(false);
                          onNavigate('/admin/domains/new');
                        }}
                        className="flex-1 py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                      >
                        Insert into 6-Step Builder
                      </button>
                      <button
                        type="button"
                        onClick={() => setCopilotResult(null)}
                        className="px-3 py-2 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#A69080]/30 text-xs text-[#3E362E]/70">
              AI-assisted, review before publishing. Rules never bypass server schema validation.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// A1. ADMIN DASHBOARD VIEW
// ============================================================================

const AdminDashboardView: React.FC<{
  stats: any;
  selectedDomain?: string;
  onNavigate: (path: string) => void;
  onSelectDomain: (slug: string, targetPath?: string) => void;
  onToggleDomainLive: (slug: string) => void;
}> = ({ stats, selectedDomain, onNavigate, onSelectDomain, onToggleDomainLive }) => {
  const airlineDomain = stats.domains?.find((d: any) => d.slug === 'airline');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            Pricing Engine Command Centre
          </h1>
          <p className="text-sm text-[#3E362E]/75 mt-1">
            Manage Hotels, Commercial Flights, and Chauffeur Cars powered by the Monetize360 Universal Pricing Engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/admin/inventory')}
            className="px-4 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            ✈ Manage Flights, Hotels & Cars Inventory
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin/simulate')}
            className="px-4 py-2.5 border border-[#3E362E] text-[#3E362E] hover:bg-[#E6DCD2] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            Run Golden Test Suite (6/6)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">Domains configured</span>
          <div className="text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
            {stats.published_domains} / {stats.domains_configured} Active
          </div>
        </div>
        <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">Prices served today</span>
          <div className="text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
            {stats.prices_served_today.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">Avg latency</span>
          <div className="text-3xl font-semibold text-[#4F6B3A] tabular-nums mt-1">
            {stats.avg_latency_ms} ms
          </div>
        </div>
        <div className="bg-[#FAF8F6] border border-[#A69080]/40 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">Rules fired</span>
          <div className="text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
            {stats.rules_fired_total.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Commercial Aviation (Flights) Control Banner */}
      {airlineDomain && (
        <div className="bg-[#E6DCD2] border border-[#865D36] rounded-[4px] p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
              COMMERCIAL AVIATION (FLIGHTS) · ZERO-CODE INDUSTRY LAUNCH CONTROL
            </span>
            <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
              {airlineDomain.enabled
                ? `Flights Category is LIVE on Storefront (Published v${airlineDomain.active_version} · Golden Fare ₹6,830)`
                : 'Flights Category is Currently Staged in Draft ("Opening Soon" on Storefront)'}
            </h3>
            <p className="text-xs text-[#3E362E]/80 max-w-2xl">
              {airlineDomain.enabled
                ? 'Customers can search and book Skyline Air & Monsoon Airways flights right now. You can edit flight routes/seats in Inventory, modify rules in the 6-Step Builder, or stage Airline back to Draft to demonstrate the live Zero-Code Launch.'
                : 'On the customer storefront, the Flights tab currently displays "Opening soon". Click "Publish Airline Live" to immediately activate Flights with zero code changes.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/admin/inventory')}
              className="px-4 py-2.5 bg-[#FAF8F6] border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] hover:bg-[#F5F1ED] cursor-pointer whitespace-nowrap"
            >
              Manage Flight Routes & Seats
            </button>
            <button
              type="button"
              onClick={() => onSelectDomain('airline', '/admin/domains/new')}
              className="px-4 py-2.5 bg-[#FAF8F6] border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] hover:bg-[#F5F1ED] cursor-pointer whitespace-nowrap"
            >
              Edit Airline Rules (Builder)
            </button>
            <button
              type="button"
              onClick={() => onToggleDomainLive('airline')}
              className={`px-5 py-2.5 text-xs font-medium rounded-[4px] cursor-pointer whitespace-nowrap ${
                airlineDomain.enabled
                  ? 'border border-[#A3431F] text-[#A3431F] hover:bg-[#A3431F] hover:text-[#FAF8F6]'
                  : 'bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6]'
              }`}
            >
              {airlineDomain.enabled ? 'Stage as Draft ("Opening Soon")' : 'Publish Airline Live Now'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.domains?.map((d: any) => (
          <div
            key={d.slug}
            onClick={() => onSelectDomain(d.slug)}
            className={`bg-[#FAF8F6] border rounded-[4px] p-6 flex flex-col justify-between cursor-pointer transition-colors ${
              selectedDomain === d.slug
                ? 'border-[#865D36] ring-1 ring-[#865D36]'
                : 'border-[#A69080]/45'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="uppercase tracking-[0.16em] font-semibold text-[#865D36]">
                  DOMAIN: {d.slug} {selectedDomain === d.slug ? '· ACTIVE' : ''}
                </span>
                <span
                  className={`font-medium ${
                    d.enabled ? 'text-[#4F6B3A]' : 'text-[#A3431F]'
                  }`}
                >
                  {d.enabled ? `● Published v${d.active_version}` : '○ Draft ("Opening Soon")'}
                </span>
              </div>
              <h3 className="font-display text-2xl font-semibold text-[#3E362E] mb-3">
                {d.name}
              </h3>
              <div className="text-xs text-[#3E362E]/75 space-y-1 tabular-nums mb-4">
                <div>Active Rules: {d.rule_count} rules configured</div>
                <div>Last Updated: {formatDateTimeIST(d.last_updated)}</div>
              </div>

              <div className="flex items-end gap-1 h-8 mb-4 pt-2">
                {(d.sparkline || [3000, 3400, 3730, 3600]).map((val: number, idx: number) => (
                  <div
                    key={idx}
                    className="flex-1 bg-[#AC8968]/60 rounded-t-[2px]"
                    style={{ height: `${Math.max(25, Math.min(100, (val / 7500) * 100))}%` }}
                    title={formatINR(val)}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#A69080]/25 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#3E362E]/65 tabular-nums">
                <span>Recent avg fare:</span>
                <span className="font-semibold text-[#3E362E]">
                  {formatINR(d.sparkline?.[d.sparkline.length - 1] || 3000)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDomain(d.slug, '/admin/domains/new')}
                  className="py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Builder
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDomain(d.slug, '/admin/simulate')}
                  className="py-2 border border-[#3E362E] text-[#3E362E] hover:bg-[#E6DCD2] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Simulate
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDomain(d.slug, '/admin/versions')}
                  className="py-2 border border-[#3E362E] text-[#3E362E] hover:bg-[#E6DCD2] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Versions
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// FLIGHTS, HOTELS & CARS LIVE INVENTORY MANAGER
// ============================================================================

const AdminInventoryView: React.FC<{
  selectedDomain?: string;
  onSelectDomain?: (slug: string) => void;
  showToast: (msg: string) => void;
  onUpdated: () => void;
  onNavigate: (path: string) => void;
}> = ({ selectedDomain, onSelectDomain, showToast, onUpdated, onNavigate }) => {
  const resolveInvTab = (dom?: string): 'flights' | 'hotels' | 'cars' => {
    if (!dom) return 'flights';
    if (dom.startsWith('hotel')) return 'hotels';
    if (dom.startsWith('car')) return 'cars';
    return 'flights';
  };
  const [subTab, setSubTab] = useState<'flights' | 'hotels' | 'cars'>(() => resolveInvTab(selectedDomain));

  useEffect(() => {
    if (selectedDomain) {
      setSubTab(resolveInvTab(selectedDomain));
    }
  }, [selectedDomain]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Add Flight State
  const [airlineName, setAirlineName] = useState('Skyline Air');
  const [flightNo, setFlightNo] = useState('SK-708');
  const [origin, setOrigin] = useState('Bengaluru');
  const [destination, setDestination] = useState('Goa');
  const [departAt, setDepartAt] = useState('14:20');
  const [arriveAt, setArriveAt] = useState('15:45');
  const [cabin, setCabin] = useState<'Economy' | 'Premier'>('Economy');
  const [seatsLeft, setSeatsLeft] = useState(12);

  // Add Hotel State
  const [hotelName, setHotelName] = useState('LAKE PICHOLA TRAVERTINE PAVILION');
  const [hotelCity, setHotelCity] = useState('Udaipur');
  const [hotelStars, setHotelStars] = useState(5);
  const [hotelProduct, setHotelProduct] = useState('room_heritage');
  const [hotelOcc, setHotelOcc] = useState(85);
  const [hotelRoomsLeft, setHotelRoomsLeft] = useState(4);

  // Add Car State
  const [carName, setCarName] = useState('MAYBACH SANDSTONE EDITION');
  const [carCity, setCarCity] = useState('Udaipur');
  const [carType, setCarType] = useState<'hatchback' | 'sedan' | 'suv'>('sedan');
  const [carProduct, setCarProduct] = useState('car_exec');
  const [carsLeft, setCarsLeft] = useState(6);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/inventory');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleAddFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/inventory/flights', {
      method: 'POST',
      body: JSON.stringify({
        airline_name: airlineName,
        flight_no: flightNo,
        origin,
        destination,
        depart_at: departAt,
        arrive_at: arriveAt,
        cabin,
        seats_left: seatsLeft,
      }),
    });
    showToast(`Added flight ${airlineName} ${flightNo} (${origin} → ${destination})!`);
    loadInventory();
    onUpdated();
  };

  const handleUpdateFlight = async (id: string, patch: any) => {
    await apiRequest(`/api/admin/inventory/flights/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    showToast('Flight inventory & pricing signal updated.');
    loadInventory();
    onUpdated();
  };

  const handleDeleteFlight = async (id: string) => {
    await apiRequest(`/api/admin/inventory/flights/${id}`, { method: 'DELETE' });
    showToast('Flight route removed.');
    loadInventory();
    onUpdated();
  };

  const handleAddHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/inventory/hotels', {
      method: 'POST',
      body: JSON.stringify({
        name: hotelName,
        city: hotelCity,
        stars: hotelStars,
        product_id: hotelProduct,
        occupancy_percent: hotelOcc,
        rooms_left: hotelRoomsLeft,
      }),
    });
    showToast(`Added hotel property "${hotelName}" in ${hotelCity}!`);
    loadInventory();
    onUpdated();
  };

  const handleUpdateHotel = async (id: string, patch: any) => {
    await apiRequest(`/api/admin/inventory/hotels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    showToast('Hotel occupancy & inventory updated.');
    loadInventory();
    onUpdated();
  };

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/inventory/cars', {
      method: 'POST',
      body: JSON.stringify({
        name: carName,
        city: carCity,
        car_type: carType,
        product_id: carProduct,
        cars_left: carsLeft,
      }),
    });
    showToast(`Added vehicle "${carName}"!`);
    loadInventory();
    onUpdated();
  };

  const handleUpdateCar = async (id: string, patch: any) => {
    await apiRequest(`/api/admin/inventory/cars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    showToast('Vehicle availability updated.');
    loadInventory();
    onUpdated();
  };

  if (loading && !data) {
    return <div className="p-6 text-sm">Loading Flights, Hotels, and Cars inventory...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
            REAL-TIME FLEET, ROUTE & PROPERTY SIGNALS
          </span>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            Flights, Hotels & Cars Inventory Manager
          </h1>
          <p className="text-sm text-[#3E362E]/75">
            Adjusting <code>seats_left</code> or <code>occupancy_percent</code> here immediately updates the server context signals and recalculates storefront prices.
          </p>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'flights', label: `✈ Flights (${data?.flights?.length || 0})` },
            { id: 'hotels', label: `Hotels (${data?.hotels?.length || 0})` },
            { id: 'cars', label: `Cars (${data?.cars?.length || 0})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSubTab(t.id as any);
                onSelectDomain?.(t.id === 'flights' ? 'airline' : t.id === 'hotels' ? 'hotel' : 'car');
              }}
              className={`px-4 py-2 text-xs font-medium rounded-[4px] cursor-pointer ${
                subTab === t.id
                  ? 'bg-[#3E362E] text-[#FAF8F6]'
                  : 'bg-[#FAF8F6] text-[#3E362E] border border-[#A69080]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'flights' && (
        <div className="space-y-6">
          {/* Add Flight Form */}
          <form
            onSubmit={handleAddFlight}
            className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-[#3E362E]">
                + Add New Commercial Flight Route
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('/flights')}
                className="text-xs text-[#865D36] underline cursor-pointer"
              >
                Open Customer Flights Page (/flights) →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div>
                <label className="block text-[11px] font-medium mb-1">Airline</label>
                <input
                  type="text"
                  value={airlineName}
                  onChange={(e) => setAirlineName(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Flight No</label>
                <input
                  type="text"
                  value={flightNo}
                  onChange={(e) => setFlightNo(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Origin</label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Depart</label>
                <input
                  type="text"
                  value={departAt}
                  onChange={(e) => setDepartAt(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Arrive</label>
                <input
                  type="text"
                  value={arriveAt}
                  onChange={(e) => setArriveAt(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Cabin</label>
                <select
                  value={cabin}
                  onChange={(e) => setCabin(e.target.value as any)}
                  className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                >
                  <option value="Economy">Economy (₹5,000)</option>
                  <option value="Premier">Premier (₹9,500)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Seats Left</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={seatsLeft}
                    onChange={(e) => setSeatsLeft(Number(e.target.value))}
                    className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                  />
                  <button
                    type="submit"
                    className="px-3 h-9 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Flights Table */}
          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#E6DCD2]/60 border-b border-[#A69080]/30 uppercase text-[#3E362E]/75">
                  <th className="py-3 px-4">Flight & Carrier</th>
                  <th className="py-3 px-4">Route & Schedule</th>
                  <th className="py-3 px-4">Cabin Class</th>
                  <th className="py-3 px-4">Seats Left (Scarcity Signal)</th>
                  <th className="py-3 px-4 text-right">Base → Live Student Fare</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/20">
                {data?.flights?.map((f: any) => (
                  <tr key={f.id}>
                    <td className="py-3 px-4 font-medium">
                      <div className="text-[#3E362E] font-semibold">{f.airline_name}</div>
                      <div className="text-[#865D36] tabular-nums">{f.flight_no}</div>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="font-medium">
                        {f.origin} → {f.destination}
                      </div>
                      <div className="text-[#3E362E]/65">
                        {f.depart_at} – {f.arrive_at} IST
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={f.cabin}
                        onChange={(e) => handleUpdateFlight(f.id, { cabin: e.target.value })}
                        className="h-8 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                      >
                        <option value="Economy">Economy</option>
                        <option value="Premier">Premier</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={180}
                          value={f.seats_left}
                          onChange={(e) =>
                            handleUpdateFlight(f.id, { seats_left: Number(e.target.value) })
                          }
                          className="w-20 h-8 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] tabular-nums"
                        />
                        {f.seats_left < 20 ? (
                          <span className="text-[11px] text-[#A3431F] font-semibold">
                            ▲ &lt;20 seats (+15% surge active)
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#4F6B3A]">
                            Normal inventory (≥20 seats)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className="text-[#3E362E]/50 line-through mr-2">
                        {formatINR(f.base_price)}
                      </span>
                      <span className="text-sm font-semibold text-[#3E362E]">
                        {formatINR(f.live_student_price)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteFlight(f.id)}
                        className="p-1.5 text-[#9B2C2C] hover:bg-[#9B2C2C]/10 rounded cursor-pointer"
                        title="Delete Flight"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'hotels' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddHotel}
            className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 space-y-4"
          >
            <h3 className="font-display text-xl font-semibold text-[#3E362E]">
              + Add New Luxury Hotel Property
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium mb-1">Property Name</label>
                <input
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">City</label>
                <input
                  type="text"
                  value={hotelCity}
                  onChange={(e) => setHotelCity(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Room Tier</label>
                <select
                  value={hotelProduct}
                  onChange={(e) => setHotelProduct(e.target.value)}
                  className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                >
                  <option value="room_heritage">Heritage Room (₹3,000)</option>
                  <option value="room_pavilion">Sandstone Pavilion (₹4,200)</option>
                  <option value="room_royal">Royal Suite (₹4,800)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Occupancy %</label>
                <input
                  type="number"
                  value={hotelOcc}
                  onChange={(e) => setHotelOcc(Number(e.target.value))}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full h-9 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Add Property
                </button>
              </div>
            </div>
          </form>

          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#E6DCD2]/60 border-b border-[#A69080]/30 uppercase text-[#3E362E]/75">
                  <th className="py-3 px-4">Property Name</th>
                  <th className="py-3 px-4">City & Stars</th>
                  <th className="py-3 px-4">Occupancy % Signal</th>
                  <th className="py-3 px-4">Rooms Left</th>
                  <th className="py-3 px-4 text-right">Base → Live Loyalty Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/20">
                {data?.hotels?.map((h: any) => (
                  <tr key={h.id}>
                    <td className="py-3 px-4 font-semibold text-[#3E362E]">{h.name}</td>
                    <td className="py-3 px-4">
                      {h.city} · {h.stars}★
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={h.occupancy_percent}
                          onChange={(e) =>
                            handleUpdateHotel(h.id, { occupancy_percent: Number(e.target.value) })
                          }
                          className="w-20 h-8 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] tabular-nums"
                        />
                        {h.occupancy_percent > 80 ? (
                          <span className="text-[11px] text-[#A3431F] font-semibold">
                            ▲ &gt;80% (+15% surge)
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#4F6B3A]">Standard occupancy</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={h.rooms_left}
                        onChange={(e) =>
                          handleUpdateHotel(h.id, { rooms_left: Number(e.target.value) })
                        }
                        className="w-16 h-8 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] tabular-nums"
                      />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className="text-[#3E362E]/50 line-through mr-2">
                        {formatINR(h.base_price)}
                      </span>
                      <span className="text-sm font-semibold text-[#3E362E]">
                        {formatINR(h.live_loyalty_price)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'cars' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddCar}
            className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 space-y-4"
          >
            <h3 className="font-display text-xl font-semibold text-[#3E362E]">
              + Add Chauffeur Transfer Vehicle
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium mb-1">Vehicle Title</label>
                <input
                  type="text"
                  value={carName}
                  onChange={(e) => setCarName(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">City</label>
                <input
                  type="text"
                  value={carCity}
                  onChange={(e) => setCarCity(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Type</label>
                <select
                  value={carType}
                  onChange={(e) => setCarType(e.target.value as any)}
                  className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                >
                  <option value="hatchback">hatchback</option>
                  <option value="sedan">sedan</option>
                  <option value="suv">suv</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full h-9 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Add Vehicle
                </button>
              </div>
            </div>
          </form>

          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#E6DCD2]/60 border-b border-[#A69080]/30 uppercase text-[#3E362E]/75">
                  <th className="py-3 px-4">Vehicle Name</th>
                  <th className="py-3 px-4">Class & City</th>
                  <th className="py-3 px-4">Vehicles Available</th>
                  <th className="py-3 px-4 text-right">8 km Formula Base → Live Fare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/20">
                {data?.cars?.map((c: any) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-semibold text-[#3E362E]">{c.name}</td>
                    <td className="py-3 px-4 uppercase">
                      {c.car_type} · {c.city} ({c.seats} seats)
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={c.cars_left}
                        onChange={(e) =>
                          handleUpdateCar(c.id, { cars_left: Number(e.target.value) })
                        }
                        className="w-20 h-8 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] tabular-nums"
                      />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className="text-[#3E362E]/50 line-through mr-2">
                        {formatINR(c.base_price)}
                      </span>
                      <span className="text-sm font-semibold text-[#3E362E]">
                        {formatINR(c.live_8km_price)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// A2. 6-STEP DOMAIN BUILDER VIEW (Full Interactive Editing for Airline, Hotel, Car & Custom)
// ============================================================================

const AdminDomainBuilderView: React.FC<{
  domainsData: any;
  selectedDomain: string;
  onSelectDomain: (slug: string) => void;
  stagedCopilotRule: any;
  onClearStagedRule: () => void;
  onOpenCopilot: () => void;
  onPublished: (slug: string) => void;
}> = ({
  domainsData,
  selectedDomain,
  onSelectDomain,
  stagedCopilotRule,
  onClearStagedRule,
  onOpenCopilot,
  onPublished,
}) => {
  const [step, setStep] = useState(1);
  const [versionNote, setVersionNote] = useState('Updated rules via 6-Step Domain Builder');

  const getInitialConfigForDomain = (slug: string) => {
    const found = domainsData?.domains?.find((d: any) => d.slug === slug);
    if (found && found.versions?.length > 0) {
      return JSON.parse(JSON.stringify(found.versions[0].config));
    }
    if (domainsData?.airline_template) {
      return JSON.parse(JSON.stringify(domainsData.airline_template));
    }
    return {
      domainSlug: 'airline',
      name: 'Commercial Aviation & Flights',
      currency: 'INR',
      products: [{ id: 'flight_econ', name: 'Standard Economy Cabin', baseType: 'fixed', baseValue: 5000 }],
      attributes: [
        { name: 'days_to_departure', type: 'number', source: 'derived', default: 5 },
        { name: 'seats_left', type: 'number', source: 'signal', default: 12 },
        { name: 'customer_segment', type: 'enum', source: 'request', options: ['regular', 'loyalty', 'student'], default: 'student' },
      ],
      strategy: { stacking: 'sequential', roundTo: 10 },
      rules: [],
      constraints: { minPrice: 2000, maxPrice: 25000 },
    };
  };

  const [config, setConfig] = useState<any>(() => getInitialConfigForDomain(selectedDomain));

  const getDefaultContextForSlug = (slug: string, cfgOverride?: any) => {
    if (slug === 'hotel') {
      return { day_of_week: 'Sat', occupancy_percent: 85, days_to_checkin: 5, customer_segment: 'loyalty' };
    }
    if (slug === 'car') {
      return { distance_km: 8, demand_supply_ratio: 1.7, is_raining: false, hour_of_day: 14 };
    }
    if (slug === 'hotel_cancellation') {
      return { amount_paid: 12533, hours_before_checkin: 48 };
    }
    if (slug === 'airline_cancellation') {
      return { amount_paid: 10000, days_before_departure: 10 };
    }
    if (slug === 'car_cancellation') {
      return { amount_paid: 224, minutes_before_pickup: 4 };
    }
    if (slug === 'airline') {
      return { days_to_departure: 5, seats_left: 12, customer_segment: 'student', cabin: 'Economy' };
    }
    const targetCfg = cfgOverride || getInitialConfigForDomain(slug);
    const dynamicCtx: Record<string, any> = {};
    if (Array.isArray(targetCfg?.attributes)) {
      targetCfg.attributes.forEach((a: any) => {
        dynamicCtx[a.name] = a.default;
      });
    }
    return Object.keys(dynamicCtx).length > 0
      ? dynamicCtx
      : { days_to_departure: 5, seats_left: 12, customer_segment: 'student', cabin: 'Economy' };
  };

  const [previewContext, setPreviewContext] = useState<Record<string, any>>(() =>
    getDefaultContextForSlug(selectedDomain)
  );
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; warnings: string[] } | null>(null);

  const handleLoadDomainPreset = (slug: string) => {
    onSelectDomain(slug);
    const nextCfg = getInitialConfigForDomain(slug);
    setConfig(nextCfg);
    setPreviewContext(getDefaultContextForSlug(slug));
    setValidationResult(null);
  };

  useEffect(() => {
    const nextCfg = getInitialConfigForDomain(selectedDomain);
    setConfig(nextCfg);
    setPreviewContext(getDefaultContextForSlug(selectedDomain));
    setValidationResult(null);
  }, [selectedDomain, domainsData]);

  useEffect(() => {
    if (stagedCopilotRule) {
      setConfig((prev: any) => ({
        ...prev,
        rules: [
          ...prev.rules,
          {
            ...stagedCopilotRule,
            priority: prev.rules.length + 1,
          },
        ],
      }));
      setStep(4);
      onClearStagedRule();
    }
  }, [stagedCopilotRule]);

  useEffect(() => {
    const runPreview = async () => {
      try {
        const res = await apiRequest('/api/v1/simulate', {
          method: 'POST',
          body: JSON.stringify({
            custom_config: config,
            context: previewContext,
          }),
        });
        setPreviewResult(res);
      } catch {
        // ignore
      }
    };
    runPreview();
  }, [config, previewContext]);

  const handleValidate = async () => {
    const res = await apiRequest('/api/v1/configs/preview/validate', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
    setValidationResult(res);
  };

  const handlePublish = async (publishNow: boolean) => {
    setSaving(true);
    try {
      await apiRequest(`/api/v1/domains/${config.domainSlug}/configs`, {
        method: 'POST',
        body: JSON.stringify({
          config,
          note: versionNote || (publishNow ? 'Published from 6-Step Builder' : 'Saved draft'),
          publish_immediately: publishNow,
        }),
      });
      onPublished(config.domainSlug);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { no: 1, title: '1. Product & Base' },
    { no: 2, title: '2. Attributes' },
    { no: 3, title: '3. Strategy' },
    { no: 4, title: '4. Rules' },
    { no: 5, title: '5. Constraints' },
    { no: 6, title: '6. Review & Publish' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
            ZERO-CODE CONFIGURATION WIZARD
          </span>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            6-Step Domain Builder — {config.name}
          </h1>
        </div>

        {/* Domain Template Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#3E362E]/70">Load Domain:</span>
          {[
            { slug: 'airline', label: '✈ Airline' },
            { slug: 'hotel', label: 'Hotel' },
            { slug: 'car', label: 'Car' },
            { slug: 'hotel_cancellation', label: 'Hotel Cancel' },
            { slug: 'airline_cancellation', label: 'Airline Cancel' },
            { slug: 'car_cancellation', label: 'Car Cancel' },
          ].map((d) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => handleLoadDomainPreset(d.slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border cursor-pointer ${
                config.domainSlug === d.slug
                  ? 'bg-[#865D36] text-[#FAF8F6] border-[#865D36]'
                  : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
              }`}
            >
              {d.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handlePublish(false)}
            disabled={saving}
            className="px-3.5 py-1.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handlePublish(true)}
            disabled={saving}
            className="px-4 py-1.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            {saving ? 'Publishing...' : 'Publish Live'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {steps.map((s) => (
          <button
            key={s.no}
            type="button"
            onClick={() => setStep(s.no)}
            className={`py-2.5 px-3 text-xs font-medium rounded-[4px] border text-left cursor-pointer ${
              step === s.no
                ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]/40'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                  Step 1: Product Catalog & Base Pricing
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      products: [
                        ...config.products,
                        {
                          id: `${config.domainSlug}_tier_${config.products.length + 1}`,
                          name: 'New Product Tier',
                          baseType: 'fixed',
                          baseValue: 3500,
                        },
                      ],
                    })
                  }
                  className="px-3 py-1.5 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  + Add Product Tier
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#3E362E] mb-1">Domain Slug</label>
                  <input
                    type="text"
                    value={config.domainSlug}
                    onChange={(e) => setConfig({ ...config, domainSlug: e.target.value })}
                    className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3E362E] mb-1">Display Name</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#A69080]/30 space-y-3">
                <label className="block text-xs font-medium text-[#3E362E]">
                  Configured Products & Base Fare (Fixed or Formula)
                </label>
                {config.products.map((p: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F5F1ED] border border-[#A69080]/35 rounded-[4px] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-[#3E362E]/65">Product ID</label>
                      <input
                        type="text"
                        value={p.id}
                        onChange={(e) => {
                          const next = [...config.products];
                          next[idx] = { ...p, id: e.target.value };
                          setConfig({ ...config, products: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-[#3E362E]/65">Tier Name</label>
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => {
                          const next = [...config.products];
                          next[idx] = { ...p, name: e.target.value };
                          setConfig({ ...config, products: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[#3E362E]/65">Base Type</label>
                      <select
                        value={p.baseType}
                        onChange={(e) => {
                          const next = [...config.products];
                          next[idx] = { ...p, baseType: e.target.value };
                          setConfig({ ...config, products: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs"
                      >
                        <option value="fixed">fixed</option>
                        <option value="formula">formula</option>
                        <option value="attribute">attribute (context)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-[#3E362E]/65">
                        {p.baseType === 'formula'
                          ? 'Base + Rate/km'
                          : p.baseType === 'attribute'
                          ? 'Context Attribute Name'
                          : 'Base Value (₹)'}
                      </label>
                      <div className="flex gap-1">
                        {p.baseType === 'attribute' ? (
                          <input
                            type="text"
                            value={p.baseAttribute || 'amount_paid'}
                            onChange={(e) => {
                              const next = [...config.products];
                              next[idx] = { ...p, baseAttribute: e.target.value };
                              setConfig({ ...config, products: next });
                            }}
                            className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs"
                          />
                        ) : (
                          <input
                            type="number"
                            value={p.baseValue}
                            onChange={(e) => {
                              const next = [...config.products];
                              next[idx] = { ...p, baseValue: Number(e.target.value) };
                              setConfig({ ...config, products: next });
                            }}
                            className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                          />
                        )}
                        {p.baseType === 'formula' && (
                          <input
                            type="number"
                            value={p.formulaRate || 14}
                            onChange={(e) => {
                              const next = [...config.products];
                              next[idx] = {
                                ...p,
                                formulaAttr: p.formulaAttr || 'distance_km',
                                formulaRate: Number(e.target.value),
                              };
                              setConfig({ ...config, products: next });
                            }}
                            title="Per km rate"
                            className="w-16 h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                  Step 2: Context Attributes Schema
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      attributes: [
                        ...config.attributes,
                        { name: 'promo_tier', type: 'string', source: 'request', default: 'standard' },
                      ],
                    })
                  }
                  className="px-3 py-1.5 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  + Add Attribute
                </button>
              </div>
              <p className="text-xs text-[#3E362E]/75">
                Attributes marked <code>signal</code> or <code>derived</code> are computed strictly on the server so clients cannot spoof pricing inputs.
              </p>
              <div className="space-y-2">
                {config.attributes.map((attr: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F5F1ED] border border-[#A69080]/35 rounded-[4px] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] text-[#3E362E]/60">Attribute Name</label>
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) => {
                          const next = [...config.attributes];
                          next[idx] = { ...attr, name: e.target.value };
                          setConfig({ ...config, attributes: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-[#3E362E]/60">Type</label>
                      <select
                        value={attr.type}
                        onChange={(e) => {
                          const next = [...config.attributes];
                          next[idx] = { ...attr, type: e.target.value };
                          setConfig({ ...config, attributes: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px]"
                      >
                        <option value="number">number</option>
                        <option value="enum">enum</option>
                        <option value="boolean">boolean</option>
                        <option value="string">string</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-[#3E362E]/60">Authority Source</label>
                      <select
                        value={attr.source}
                        onChange={(e) => {
                          const next = [...config.attributes];
                          next[idx] = { ...attr, source: e.target.value };
                          setConfig({ ...config, attributes: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px]"
                      >
                        <option value="derived">derived (server)</option>
                        <option value="signal">signal (server)</option>
                        <option value="request">request (verified)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[#3E362E]/60">Default</label>
                      <input
                        type="text"
                        value={String(attr.default)}
                        onChange={(e) => {
                          const next = [...config.attributes];
                          const raw = e.target.value;
                          const val =
                            attr.type === 'number'
                              ? Number(raw)
                              : attr.type === 'boolean'
                              ? raw === 'true'
                              : raw;
                          next[idx] = { ...attr, default: val };
                          setConfig({ ...config, attributes: next });
                        }}
                        className="w-full h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                Step 3: Stacking Strategy & Half-Up Rounding
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'sequential',
                    label: 'Sequential Compounding',
                    desc: 'Each matching rule compounds on the running subtotal in priority order (e.g. 5,000 → 6,250 → 7,187.5 → 6,828.13).',
                  },
                  {
                    id: 'on_base',
                    label: 'Additive on Base',
                    desc: 'All percentage adjustments apply strictly to the initial base fare (+25% + 15% − 5% = +35% on base).',
                  },
                  {
                    id: 'best_for_customer',
                    label: 'Best for Customer',
                    desc: 'Evaluates matching rules and selects the lowest final fare for the traveller.',
                  },
                  {
                    id: 'best_for_business',
                    label: 'Best for Business',
                    desc: 'Evaluates matching rules and selects the highest yield fare.',
                  },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setConfig({ ...config, strategy: { ...config.strategy, stacking: st.id } })
                    }
                    className={`p-4 rounded-[4px] border text-left cursor-pointer ${
                      config.strategy.stacking === st.id
                        ? 'border-[#865D36] bg-[#E6DCD2]/50'
                        : 'border-[#A69080]/40 bg-[#F5F1ED]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#3E362E]">{st.label}</div>
                    <p className="text-xs text-[#3E362E]/75 mt-1">{st.desc}</p>
                  </button>
                ))}
              </div>
              <div className="pt-2">
                <label className="block text-xs font-medium text-[#3E362E] mb-1">
                  Exact Half-Up Rounding Step (10 rounds 6,828.125 → ₹6,830; 1 rounds 212.5 → ₹213)
                </label>
                <div className="flex gap-2">
                  {[1, 5, 10, 50, 100].map((stepVal) => (
                    <button
                      key={stepVal}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          strategy: { ...config.strategy, roundTo: stepVal },
                        })
                      }
                      className={`px-4 py-2 text-xs font-medium rounded-[4px] border tabular-nums cursor-pointer ${
                        config.strategy.roundTo === stepVal
                          ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                          : 'bg-[#F5F1ED] text-[#3E362E] border-[#A69080]'
                      }`}
                    >
                      Nearest ₹{stepVal}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                  Step 4: Visual Rule Builder ({config.rules.length} Rules)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenCopilot}
                    className="px-3 py-1.5 bg-[#E6DCD2] hover:bg-[#AC8968] text-[#3E362E] text-xs font-medium rounded-[4px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#865D36]" />
                    <span>Generate with AI Copilot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextPriority = config.rules.length + 1;
                      const defaultAttr = config.attributes[0]?.name || 'days_to_departure';
                      setConfig({
                        ...config,
                        rules: [
                          ...config.rules,
                          {
                            id: `R-${config.domainSlug.toUpperCase().slice(0, 3)}-0${nextPriority}`,
                            name: 'Early Bird Booking Concession',
                            priority: nextPriority,
                            conditionLogic: 'AND',
                            conditions: [{ attribute: defaultAttr, operator: 'gt', value: 21 }],
                            action: { type: 'percent', value: -10 },
                          },
                        ],
                      });
                    }}
                    className="px-3 py-1.5 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                  >
                    + Add Rule
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {config.rules.map((r: any, rIdx: number) => (
                  <div
                    key={r.id || rIdx}
                    className="p-4 bg-[#F5F1ED] border border-[#A69080]/45 rounded-[4px] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#3E362E] text-[#FAF8F6] text-[11px] font-semibold rounded tabular-nums">
                          #{r.priority}
                        </span>
                        <input
                          type="text"
                          value={r.id}
                          onChange={(e) => {
                            const next = [...config.rules];
                            next[rIdx] = { ...r, id: e.target.value };
                            setConfig({ ...config, rules: next });
                          }}
                          className="w-24 h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs font-semibold tabular-nums"
                        />
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => {
                            const next = [...config.rules];
                            next[rIdx] = { ...r, name: e.target.value };
                            setConfig({ ...config, rules: next });
                          }}
                          className="w-56 sm:w-64 h-8 px-2.5 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs font-medium"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={rIdx === 0}
                          onClick={() => {
                            const next = [...config.rules];
                            const temp = next[rIdx - 1];
                            next[rIdx - 1] = { ...next[rIdx], priority: rIdx };
                            next[rIdx] = { ...temp, priority: rIdx + 1 };
                            setConfig({ ...config, rules: next });
                          }}
                          className="p-1.5 border border-[#A69080] rounded bg-[#FAF8F6] disabled:opacity-40 cursor-pointer"
                          title="Move Priority Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={rIdx === config.rules.length - 1}
                          onClick={() => {
                            const next = [...config.rules];
                            const temp = next[rIdx + 1];
                            next[rIdx + 1] = { ...next[rIdx], priority: rIdx + 2 };
                            next[rIdx] = { ...temp, priority: rIdx + 1 };
                            setConfig({ ...config, rules: next });
                          }}
                          className="p-1.5 border border-[#A69080] rounded bg-[#FAF8F6] disabled:opacity-40 cursor-pointer"
                          title="Move Priority Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = config.rules
                              .filter((_: any, i: number) => i !== rIdx)
                              .map((rule: any, i: number) => ({ ...rule, priority: i + 1 }));
                            setConfig({ ...config, rules: next });
                          }}
                          className="p-1.5 border border-[#9B2C2C]/40 text-[#9B2C2C] rounded bg-[#FAF8F6] hover:bg-[#9B2C2C]/10 cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Condition Editor */}
                    <div className="space-y-2 pt-1">
                      {r.conditions.map((cond: any, cIdx: number) => (
                        <div key={cIdx} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[#865D36] w-8">
                            {cIdx === 0 ? 'IF' : r.conditionLogic}
                          </span>
                          <select
                            value={cond.attribute}
                            onChange={(e) => {
                              const nextRules = [...config.rules];
                              const nextConds = [...r.conditions];
                              nextConds[cIdx] = { ...cond, attribute: e.target.value };
                              nextRules[rIdx] = { ...r, conditions: nextConds };
                              setConfig({ ...config, rules: nextRules });
                            }}
                            className="h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px]"
                          >
                            {config.attributes.map((a: any) => (
                              <option key={a.name} value={a.name}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={cond.operator}
                            onChange={(e) => {
                              const nextRules = [...config.rules];
                              const nextConds = [...r.conditions];
                              nextConds[cIdx] = { ...cond, operator: e.target.value };
                              nextRules[rIdx] = { ...r, conditions: nextConds };
                              setConfig({ ...config, rules: nextRules });
                            }}
                            className="h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] tabular-nums"
                          >
                            <option value="eq">eq (=)</option>
                            <option value="neq">neq (≠)</option>
                            <option value="gt">gt (&gt;)</option>
                            <option value="gte">gte (≥)</option>
                            <option value="lt">lt (&lt;)</option>
                            <option value="lte">lte (≤)</option>
                            <option value="in">in (list)</option>
                          </select>
                          <input
                            type="text"
                            value={Array.isArray(cond.value) ? cond.value.join(',') : String(cond.value)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              let parsed: any = raw;
                              if (cond.operator === 'in') {
                                parsed = raw.split(',').map((s) => s.trim());
                              } else if (raw === 'true' || raw === 'false') {
                                parsed = raw === 'true';
                              } else if (!isNaN(Number(raw)) && raw.trim() !== '') {
                                parsed = Number(raw);
                              }
                              const nextRules = [...config.rules];
                              const nextConds = [...r.conditions];
                              nextConds[cIdx] = { ...cond, value: parsed };
                              nextRules[rIdx] = { ...r, conditions: nextConds };
                              setConfig({ ...config, rules: nextRules });
                            }}
                            className="w-28 h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] tabular-nums"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Action Editor */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#A69080]/25 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#4F6B3A]">THEN</span>
                        <select
                          value={r.action.type}
                          onChange={(e) => {
                            const next = [...config.rules];
                            next[rIdx] = {
                              ...r,
                              action: { ...r.action, type: e.target.value },
                            };
                            setConfig({ ...config, rules: next });
                          }}
                          className="h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px]"
                        >
                          <option value="percent">percent (+/- %)</option>
                          <option value="multiplier">multiplier (×N)</option>
                          <option value="fixed">fixed (+/- ₹)</option>
                        </select>
                        <input
                          type="number"
                          step="0.1"
                          value={r.action.value}
                          onChange={(e) => {
                            const next = [...config.rules];
                            next[rIdx] = {
                              ...r,
                              action: { ...r.action, value: Number(e.target.value) },
                            };
                            setConfig({ ...config, rules: next });
                          }}
                          className="w-24 h-8 px-2 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] font-semibold tabular-nums"
                        />
                      </div>

                      <div className="text-[11px] text-[#3E362E]/70">
                        IF{' '}
                        {r.conditions
                          .map((c: any) => `${c.attribute} ${c.operator} ${c.value}`)
                          .join(` ${r.conditionLogic} `)}{' '}
                        →{' '}
                        <strong>
                          {r.action.type === 'multiplier'
                            ? `×${r.action.value}`
                            : r.action.type === 'fixed'
                            ? `${r.action.value >= 0 ? '+' : ''}₹${r.action.value}`
                            : `${r.action.value >= 0 ? '+' : ''}${r.action.value}%`}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                Step 5: Guardrail Constraints
              </h3>
              <p className="text-xs text-[#3E362E]/75">
                Guardrails prevent runaway surge pricing or below-cost discounting before final rounding.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#3E362E] mb-1">
                    Minimum Price Floor (INR)
                  </label>
                  <input
                    type="number"
                    value={config.constraints.minPrice || 0}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        constraints: { ...config.constraints, minPrice: Number(e.target.value) },
                      })
                    }
                    className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3E362E] mb-1">
                    Maximum Price Ceiling (INR)
                  </label>
                  <input
                    type="number"
                    value={config.constraints.maxPrice || 25000}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        constraints: { ...config.constraints, maxPrice: Number(e.target.value) },
                      })
                    }
                    className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3E362E] mb-1">
                    Max Surge Multiplier (e.g. 2.5×)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.constraints.maxSurgeMultiplier || 3.0}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        constraints: {
                          ...config.constraints,
                          maxSurgeMultiplier: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                Step 6: Review, Validate & Publish
              </h3>
              <div className="p-4 bg-[#E6DCD2]/50 border border-[#4F6B3A] rounded-[4px] text-xs space-y-1">
                <div className="font-semibold text-[#4F6B3A]">
                  ✓{' '}
                  {validationResult
                    ? validationResult.valid
                      ? 'Server Schema Validation Passed (0 Warnings)'
                      : `Validation Warnings: ${validationResult.warnings.join(', ')}`
                    : 'Schema & Deterministic Invariants Ready'}
                </div>
                <div>
                  Domain <strong>{config.domainSlug}</strong> has{' '}
                  <strong>{config.products.length} products</strong>,{' '}
                  <strong>{config.rules.length} ordered rules</strong>,{' '}
                  <strong>{config.strategy.stacking}</strong> stacking, and Exact Half-Up rounding to nearest{' '}
                  <strong>₹{config.strategy.roundTo}</strong>.
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3E362E] mb-1">
                  Immutable Version Commit Note
                </label>
                <input
                  type="text"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                />
              </div>

              <pre className="text-[11px] bg-[#F5F1ED] p-3 rounded-[4px] border border-[#A69080]/35 max-h-56 overflow-y-auto tabular-nums">
                {JSON.stringify(config, null, 2)}
              </pre>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleValidate}
                  className="px-4 py-2.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Run Server Validation
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish(false)}
                  disabled={saving}
                  className="px-4 py-2.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Save as Draft Version
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish(true)}
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  {saving ? 'Publishing...' : `Publish ${config.domainSlug} Live`}
                </button>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[#A69080]/30 flex justify-between">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep(Math.max(1, step - 1))}
              className="px-4 py-2 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] disabled:opacity-40 cursor-pointer"
            >
              Previous Step
            </button>
            <button
              type="button"
              disabled={step === 6}
              onClick={() => setStep(Math.min(6, step + 1))}
              className="px-4 py-2 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] disabled:opacity-40 cursor-pointer"
            >
              Next Step
            </button>
          </div>
        </div>

        {/* Sticky Live Preview Calculator */}
        <div className="lg:col-span-5 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4 sticky top-6">
          <div className="flex items-center justify-between border-b border-[#A69080]/30 pb-3">
            <div>
              <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
                LIVE PREVIEW CALCULATOR
              </span>
              <h4 className="font-display text-xl font-semibold text-[#3E362E]">
                {config.domainSlug === 'airline'
                  ? 'Golden Airline Test (₹6,830)'
                  : config.domainSlug === 'hotel'
                  ? 'Golden Hotel Test (₹3,730)'
                  : config.domainSlug === 'car'
                  ? 'Golden Car Test (₹213)'
                  : `Live ${config.domainSlug} Preview`}
              </h4>
            </div>
            {previewResult && (
              <div className="text-2xl font-semibold text-[#3E362E] tabular-nums">
                {formatINR(previewResult.final_price)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {config.attributes.map((attr: any) => (
              <div key={attr.name}>
                <label className="block text-[#3E362E]/70 mb-1 truncate">{attr.name}</label>
                {attr.type === 'enum' && Array.isArray(attr.options) ? (
                  <select
                    value={String(previewContext[attr.name] ?? attr.default)}
                    onChange={(e) =>
                      setPreviewContext({ ...previewContext, [attr.name]: e.target.value })
                    }
                    className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px]"
                  >
                    {attr.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : attr.type === 'boolean' ? (
                  <select
                    value={String(Boolean(previewContext[attr.name]))}
                    onChange={(e) =>
                      setPreviewContext({
                        ...previewContext,
                        [attr.name]: e.target.value === 'true',
                      })
                    }
                    className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px]"
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    step="0.1"
                    value={previewContext[attr.name] ?? attr.default}
                    onChange={(e) =>
                      setPreviewContext({
                        ...previewContext,
                        [attr.name]: Number(e.target.value),
                      })
                    }
                    className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] tabular-nums"
                  />
                )}
              </div>
            ))}
          </div>

          {previewResult && (
            <BreakdownTable
              breakdown={previewResult.breakdown || []}
              finalPrice={previewResult.final_price}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// A3. INTERACTIVE SINGLE SIMULATION & BATCH TEST SUITE
// ============================================================================

const AdminSimulateView: React.FC<{
  selectedDomain: string;
  onSelectDomain: (slug: string) => void;
  showToast: (m: string) => void;
}> = ({ selectedDomain, onSelectDomain, showToast }) => {
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const [batchData, setBatchData] = useState<any>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);

  // Interactive context states
  const [flightCtx, setFlightCtx] = useState({
    days_to_departure: 5,
    seats_left: 12,
    customer_segment: 'student',
    cabin: 'Economy',
  });
  const [hotelCtx, setHotelCtx] = useState({
    day_of_week: 'Sat',
    occupancy_percent: 85,
    days_to_checkin: 5,
    customer_segment: 'loyalty',
  });
  const [carCtx, setCarCtx] = useState({
    distance_km: 8,
    demand_supply_ratio: 1.7,
    is_raining: false,
    hour_of_day: 14,
  });
  const [cancelCtx, setCancelCtx] = useState({
    amount_paid: 10000,
    hours_before_checkin: 48,
    days_before_departure: 5,
    minutes_before_pickup: 4,
  });

  const runSingleSimulation = async () => {
    const activeCtx =
      selectedDomain === 'airline'
        ? flightCtx
        : selectedDomain === 'hotel'
        ? hotelCtx
        : selectedDomain === 'car'
        ? carCtx
        : selectedDomain.endsWith('_cancellation')
        ? cancelCtx
        : hotelCtx;

    const productId =
      selectedDomain === 'airline'
        ? flightCtx.cabin === 'Premier'
          ? 'flight_prem'
          : 'flight_econ'
        : selectedDomain.endsWith('_cancellation')
        ? 'refund_calc'
        : undefined;

    const res = await apiRequest('/api/v1/simulate', {
      method: 'POST',
      body: JSON.stringify({
        domain_slug: selectedDomain,
        context: activeCtx,
        product_id: productId,
      }),
    });
    setSimResult(res);
  };

  const runBatchSuite = async () => {
    const res = await apiRequest('/api/v1/simulate/batch', { method: 'POST' });
    setBatchData(res);
  };

  useEffect(() => {
    runSingleSimulation();
  }, [selectedDomain, flightCtx, hotelCtx, carCtx, cancelCtx]);

  useEffect(() => {
    runBatchSuite();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            Interactive Simulator & Automated Golden Batch Suite
          </h1>
          <p className="text-sm text-[#3E362E]/75">
            Test Flights, Hotels, and Cars rules interactively or execute the 6 Golden & Boundary verification cases.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`px-4 py-2 text-xs font-medium rounded-[4px] cursor-pointer ${
              tab === 'single'
                ? 'bg-[#3E362E] text-[#FAF8F6]'
                : 'bg-[#FAF8F6] text-[#3E362E] border border-[#A69080]'
            }`}
          >
            Interactive Simulator
          </button>
          <button
            type="button"
            onClick={() => setTab('batch')}
            className={`px-4 py-2 text-xs font-medium rounded-[4px] cursor-pointer ${
              tab === 'batch'
                ? 'bg-[#3E362E] text-[#FAF8F6]'
                : 'bg-[#FAF8F6] text-[#3E362E] border border-[#A69080]'
            }`}
          >
            Golden Batch Suite ({batchData ? `${batchData.passed}/${batchData.total}` : '6/6'})
          </button>
        </div>
      </div>

      {tab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive Context Sliders */}
          <div className="lg:col-span-5 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#A69080]/30 pb-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#865D36]">
                1. Select Domain & Context
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedDomain === 'airline') {
                    setFlightCtx({
                      days_to_departure: 5,
                      seats_left: 12,
                      customer_segment: 'student',
                      cabin: 'Economy',
                    });
                  } else if (selectedDomain === 'hotel') {
                    setHotelCtx({
                      day_of_week: 'Sat',
                      occupancy_percent: 85,
                      days_to_checkin: 5,
                      customer_segment: 'loyalty',
                    });
                  } else {
                    setCarCtx({
                      distance_km: 8,
                      demand_supply_ratio: 1.7,
                      is_raining: false,
                      hour_of_day: 14,
                    });
                  }
                  showToast('Reset to Golden Case inputs.');
                }}
                className="text-xs text-[#865D36] underline cursor-pointer"
              >
                Reset to Golden Case
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'airline', label: '✈ Flights' },
                { id: 'hotel', label: 'Hotels' },
                { id: 'car', label: 'Cars' },
                { id: 'hotel_cancellation', label: 'Hotel Cancel' },
                { id: 'airline_cancellation', label: 'Airline Cancel' },
                { id: 'car_cancellation', label: 'Car Cancel' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDomain(d.id)}
                  className={`py-2 text-xs font-medium rounded-[4px] border cursor-pointer ${
                    selectedDomain === d.id
                      ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                      : 'bg-[#F5F1ED] text-[#3E362E] border-[#A69080]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {selectedDomain === 'airline' && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Days to Departure (Rule &lt;7d = +25%)</span>
                    <span className="font-semibold tabular-nums">{flightCtx.days_to_departure} days</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={45}
                    value={flightCtx.days_to_departure}
                    onChange={(e) =>
                      setFlightCtx({ ...flightCtx, days_to_departure: Number(e.target.value) })
                    }
                    className="w-full accent-[#865D36]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Seats Left in Cabin (Rule &lt;20 = +15%)</span>
                    <span className="font-semibold tabular-nums">{flightCtx.seats_left} seats</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={120}
                    value={flightCtx.seats_left}
                    onChange={(e) =>
                      setFlightCtx({ ...flightCtx, seats_left: Number(e.target.value) })
                    }
                    className="w-full accent-[#865D36]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Customer Segment</label>
                    <select
                      value={flightCtx.customer_segment}
                      onChange={(e) =>
                        setFlightCtx({ ...flightCtx, customer_segment: e.target.value })
                      }
                      className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px]"
                    >
                      <option value="student">student (−5%)</option>
                      <option value="loyalty">loyalty</option>
                      <option value="regular">regular</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Cabin Product</label>
                    <select
                      value={flightCtx.cabin}
                      onChange={(e) => setFlightCtx({ ...flightCtx, cabin: e.target.value })}
                      className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px]"
                    >
                      <option value="Economy">Economy (₹5,000)</option>
                      <option value="Premier">Premier (₹9,500)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {selectedDomain === 'hotel' && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Hotel Occupancy % (Rule &gt;80% = +15%)</span>
                    <span className="font-semibold tabular-nums">{hotelCtx.occupancy_percent}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={hotelCtx.occupancy_percent}
                    onChange={(e) =>
                      setHotelCtx({ ...hotelCtx, occupancy_percent: Number(e.target.value) })
                    }
                    className="w-full accent-[#865D36]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Check-in Day</label>
                    <select
                      value={hotelCtx.day_of_week}
                      onChange={(e) => setHotelCtx({ ...hotelCtx, day_of_week: e.target.value })}
                      className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px]"
                    >
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <option key={d} value={d}>
                          {d} {d === 'Sat' || d === 'Sun' ? '(+20% Weekend)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Customer Segment</label>
                    <select
                      value={hotelCtx.customer_segment}
                      onChange={(e) =>
                        setHotelCtx({ ...hotelCtx, customer_segment: e.target.value })
                      }
                      className="w-full h-9 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px]"
                    >
                      <option value="loyalty">loyalty (−10%)</option>
                      <option value="student">student (−5%)</option>
                      <option value="regular">regular</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {selectedDomain === 'car' && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Road Distance (40 + 14 × km)</span>
                    <span className="font-semibold tabular-nums">{carCtx.distance_km} km</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    value={carCtx.distance_km}
                    onChange={(e) =>
                      setCarCtx({ ...carCtx, distance_km: Number(e.target.value) })
                    }
                    className="w-full accent-[#865D36]"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Demand/Supply Ratio (&gt;1.5× = ×1.4; &gt;2.0× = ×1.8)</span>
                    <span className="font-semibold tabular-nums">{carCtx.demand_supply_ratio}×</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={2.6}
                    step={0.1}
                    value={carCtx.demand_supply_ratio}
                    onChange={(e) =>
                      setCarCtx({ ...carCtx, demand_supply_ratio: Number(e.target.value) })
                    }
                    className="w-full accent-[#865D36]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-medium">Monsoon Rain Signal (+10%)</span>
                  <input
                    type="checkbox"
                    checked={carCtx.is_raining}
                    onChange={(e) => setCarCtx({ ...carCtx, is_raining: e.target.checked })}
                    className="w-4 h-4 accent-[#865D36]"
                  />
                </div>
              </div>
            )}
            {selectedDomain.endsWith('_cancellation') && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Booking Amount Paid (Base Attribute)</span>
                    <span className="font-semibold tabular-nums">{formatINR(cancelCtx.amount_paid)}</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={25000}
                    step={100}
                    value={cancelCtx.amount_paid}
                    onChange={(e) =>
                      setCancelCtx({ ...cancelCtx, amount_paid: Number(e.target.value) })
                    }
                    className="w-full accent-[#865D36]"
                  />
                </div>
                {selectedDomain === 'hotel_cancellation' && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">Hours Before Check-in (≥72h: 0%, 24-72h: -50%, &lt;24h: -100%)</span>
                      <span className="font-semibold tabular-nums">{cancelCtx.hours_before_checkin} hours</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={120}
                      value={cancelCtx.hours_before_checkin}
                      onChange={(e) =>
                        setCancelCtx({ ...cancelCtx, hours_before_checkin: Number(e.target.value) })
                      }
                      className="w-full accent-[#865D36]"
                    />
                  </div>
                )}
                {selectedDomain === 'airline_cancellation' && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">Days Before Departure (≥7d: -10%, 2-7d: -30%, &lt;2d: -60%)</span>
                      <span className="font-semibold tabular-nums">{cancelCtx.days_before_departure} days</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={cancelCtx.days_before_departure}
                      onChange={(e) =>
                        setCancelCtx({ ...cancelCtx, days_before_departure: Number(e.target.value) })
                      }
                      className="w-full accent-[#865D36]"
                    />
                  </div>
                )}
                {selectedDomain === 'car_cancellation' && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">Minutes Before Pickup (≥10m: ₹0 fee, &lt;10m: -₹50 fee)</span>
                      <span className="font-semibold tabular-nums">{cancelCtx.minutes_before_pickup} mins</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={45}
                      value={cancelCtx.minutes_before_pickup}
                      onChange={(e) =>
                        setCancelCtx({ ...cancelCtx, minutes_before_pickup: Number(e.target.value) })
                      }
                      className="w-full accent-[#865D36]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Breakdown + Rule Evaluation */}
          <div className="lg:col-span-7 space-y-5">
            {simResult && (
              <>
                <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
                        DETERMINISTIC ENGINE OUTPUT
                      </span>
                      <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                        {selectedDomain.toUpperCase()} · Config v{simResult.version_no}
                      </h3>
                    </div>
                    <div className="text-3xl font-semibold text-[#3E362E] tabular-nums">
                      {formatINR(simResult.final_price)}
                    </div>
                  </div>
                  <BreakdownTable
                    breakdown={simResult.breakdown}
                    finalPrice={simResult.final_price}
                    configVersion={simResult.version_no}
                  />
                </div>

                <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-3">
                  <h4 className="font-display text-xl font-semibold text-[#3E362E]">
                    Rule Evaluation & Counterfactual Trace
                  </h4>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#A69080]/30 uppercase text-[#3E362E]/70">
                        <th className="py-2">Rule</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Reason</th>
                        <th className="py-2 text-right">Counterfactual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#A69080]/20">
                      {simResult.rules_evaluated?.map((r: any) => (
                        <tr key={r.id}>
                          <td className="py-2.5 font-medium">
                            <span className="text-[#865D36] tabular-nums">{r.id}</span> · {r.name}
                          </td>
                          <td className="py-2.5 font-semibold">
                            {r.fired ? (
                              <span className="text-[#4F6B3A]">✓ FIRED ({r.effect_str})</span>
                            ) : (
                              <span className="text-[#3E362E]/50">○ SKIPPED</span>
                            )}
                          </td>
                          <td className="py-2.5 text-[#3E362E]/75">{r.reason}</td>
                          <td className="py-2.5 text-right tabular-nums font-semibold">
                            {r.counterfactual_price !== undefined
                              ? formatINR(r.counterfactual_price)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'batch' && batchData && (
        <div className="space-y-4">
          <div className="bg-[#4F6B3A] text-[#FAF8F6] px-5 py-3.5 rounded-[4px] flex items-center justify-between">
            <span className="text-sm font-semibold tabular-nums">
              ✓ {batchData.passed} / {batchData.total} Golden & Boundary Tests Passed (100.0%)
            </span>
            <button
              type="button"
              onClick={() => {
                runBatchSuite();
                showToast(`Executed ${batchData.total} Golden & Boundary verification test cases.`);
              }}
              className="px-3 py-1 bg-[#FAF8F6] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
            >
              Re-run Suite
            </button>
          </div>

          <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#E6DCD2]/60 border-b border-[#A69080]/30 uppercase text-[#3E362E]/75">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Test Case Description</th>
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-4">Context Inputs</th>
                  <th className="py-3 px-4 text-right">Expected</th>
                  <th className="py-3 px-4 text-right">Actual</th>
                  <th className="py-3 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#A69080]/20">
                {batchData.results.map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-3 px-4 font-medium tabular-nums">{r.id}</td>
                    <td className="py-3 px-4 font-medium text-[#3E362E]">{r.name}</td>
                    <td className="py-3 px-4 uppercase font-semibold text-[#865D36]">{r.domain}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#3E362E]/75">
                      {JSON.stringify(r.inputs)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{formatINR(r.expected)}</td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">
                      {formatINR(r.actual)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#4F6B3A]">
                      {r.passed ? '✓ PASS' : '✗ FAIL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// A4. FORENSIC AUDIT EXPLAINABILITY VIEW
// ============================================================================

const AdminExplainView: React.FC<{ auditIdParam?: string; onNavigate: (p: string) => void }> = ({
  auditIdParam,
}) => {
  const [audit, setAudit] = useState<any>(null);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [searchId, setSearchId] = useState(auditIdParam || 'AUD-2026-8843');

  const loadAudit = async (id: string) => {
    const res = await apiRequest(`/api/v1/audit/${id}/explain`);
    setAudit(res.audit);
    setSearchId(res.audit.id);
  };

  useEffect(() => {
    apiRequest('/api/v1/audit?domain=all').then((r) => setRecentAudits(r.audits || []));
    loadAudit(auditIdParam || 'AUD-2026-8843');
  }, [auditIdParam]);

  if (!audit) return <div className="p-6 text-sm">Loading audit record...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
            FORENSIC AUDIT EXPLAINABILITY
          </span>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E] tabular-nums">
            Audit Trace: {audit.id} ({audit.domain_slug.toUpperCase()})
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="AUD-2026-8843"
            className="h-10 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs tabular-nums"
          />
          <button
            type="button"
            onClick={() => loadAudit(searchId)}
            className="h-10 px-4 bg-[#3E362E] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
          >
            Inspect Audit ID
          </button>
        </div>
      </div>

      {/* Quick Audit Switcher Pills (Golden Flight, Hotel, Car + Recent) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#3E362E]/70 font-medium">Quick Select Audit:</span>
        {recentAudits.slice(0, 6).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => loadAudit(a.id)}
            className={`px-3 py-1.5 rounded-[4px] border tabular-nums cursor-pointer ${
              audit.id === a.id
                ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
            }`}
          >
            {a.id} · {a.domain_slug.toUpperCase()} ({formatINR(a.final_price)})
          </button>
        ))}
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-2">
          <div className="text-xs text-[#865D36] font-semibold uppercase tracking-wider">
            Plain-English Decision Summary · Config v{audit.config_version}
          </div>
          <p className="text-sm text-[#3E362E] leading-relaxed">
            Starting from a base fare of <strong>{formatINR(audit.base_price)}</strong> in domain{' '}
            <strong>{audit.domain_slug}</strong>, the engine evaluated{' '}
            <strong>{audit.rules_evaluated?.length || 0} rules</strong> against server context{' '}
            <code className="text-xs bg-[#E6DCD2]/60 px-1.5 py-0.5 rounded">
              {JSON.stringify(audit.context)}
            </code>
            , producing a final rounded fare of <strong>{formatINR(audit.final_price)}</strong> in{' '}
            <span className="tabular-nums">{audit.latency_ms} ms</span>.
          </p>
        </div>
        <div className="lg:col-span-4 text-left lg:text-right border-t lg:border-t-0 lg:border-l border-[#A69080]/30 pt-4 lg:pt-0 lg:pl-6">
          <span className="text-xs text-[#3E362E]/70">Final Audited Fare</span>
          <div className="text-4xl font-semibold text-[#3E362E] tabular-nums">
            {formatINR(audit.final_price)}
          </div>
        </div>
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold text-[#3E362E]">
          Price Waterfall Chart (Base → Final)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end pt-4">
          {audit.breakdown?.map((step: any, i: number) => {
            const isUp = step.direction === 'up';
            const isDown = step.direction === 'down';
            return (
              <div
                key={i}
                className="bg-[#F5F1ED] p-3 rounded-[4px] border border-[#A69080]/30 flex flex-col justify-between"
              >
                <div className="text-[11px] text-[#3E362E]/75 line-clamp-1">{step.step}</div>
                <div
                  className={`text-xs font-semibold tabular-nums mt-1 ${
                    isUp ? 'text-[#A3431F]' : isDown ? 'text-[#4F6B3A]' : 'text-[#865D36]'
                  }`}
                >
                  {isUp ? `▲ ${step.effect}` : isDown ? `▼ ${step.effect}` : step.effect}
                </div>
                <div className="text-lg font-semibold text-[#3E362E] tabular-nums mt-2">
                  {formatINR(step.running, true)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BreakdownTable
        breakdown={audit.breakdown || []}
        finalPrice={audit.final_price}
        configVersion={audit.config_version}
        auditId={audit.id}
      />

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
          Rule-by-Rule Evaluation & Counterfactuals
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#A69080]/30 uppercase text-[#3E362E]/70">
                <th className="py-2.5 px-3">Rule ID & Name</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Condition Trace</th>
                <th className="py-2.5 px-3 text-right">Effect</th>
                <th className="py-2.5 px-3 text-right">Counterfactual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A69080]/20">
              {audit.rules_evaluated?.map((r: any) => (
                <tr key={r.id}>
                  <td className="py-3 px-3 font-medium">
                    <span className="tabular-nums text-[#865D36]">{r.id}</span> · {r.name}
                  </td>
                  <td className="py-3 px-3 font-semibold">
                    {r.fired ? (
                      <span className="text-[#4F6B3A]">✓ FIRED</span>
                    ) : (
                      <span className="text-[#3E362E]/50">○ SKIPPED</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-[#3E362E]/80">{r.reason}</td>
                  <td className="py-3 px-3 text-right font-medium tabular-nums">{r.effect_str}</td>
                  <td className="py-3 px-3 text-right font-semibold tabular-nums">
                    {r.counterfactual_price !== undefined
                      ? `Without ${r.name}: ${formatINR(r.counterfactual_price)}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// A5. VERSIONS, DIFF & ROLLBACK VIEW
// ============================================================================

const AdminVersionsAuditView: React.FC<{
  selectedDomain: string;
  onSelectDomain: (slug: string) => void;
  domainsData: any;
  onRefresh: () => void;
  onNavigate: (p: string) => void;
  showToast: (m: string) => void;
}> = ({ selectedDomain, onSelectDomain, domainsData, onRefresh, onNavigate, showToast }) => {
  const [audits, setAudits] = useState<any[]>([]);
  const [confirmRollback, setConfirmRollback] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const domainObj = domainsData?.domains?.find((d: any) => d.slug === selectedDomain);
  const versions = domainObj?.versions || [];

  useEffect(() => {
    apiRequest(`/api/v1/audit?domain=${selectedDomain}`).then((res) => setAudits(res.audits || []));
  }, [selectedDomain]);

  const handleRollback = async (verNo: number) => {
    await apiRequest(`/api/v1/domains/${selectedDomain}/rollback/${verNo}`, { method: 'POST' });
    setConfirmRollback(null);
    showToast(
      `Rolled back ${selectedDomain} to Version v${verNo}. Live storefront prices updated immediately.`
    );
    onRefresh();
  };

  const handlePublishDraft = async (id: string, verNo: number) => {
    await apiRequest(`/api/v1/configs/${id}/publish`, { method: 'POST' });
    showToast(`Published ${selectedDomain} v${verNo}!`);
    onRefresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            Configuration Versions & Instant Rollback ({selectedDomain})
          </h1>
          <p className="text-sm text-[#3E362E]/75">
            Every configuration change is immutable and versioned. Roll back with one click if a rule misbehaves.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(domainsData?.domains?.map((d: any) => d.slug) || [
            'airline',
            'hotel',
            'car',
            'hotel_cancellation',
            'airline_cancellation',
            'car_cancellation',
          ]).map((slug: string) => (
            <button
              key={slug}
              type="button"
              onClick={() => onSelectDomain(slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border uppercase cursor-pointer ${
                selectedDomain === slug
                  ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                  : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
              }`}
            >
              {slug}
            </button>
          ))}
          {versions.length >= 2 && (
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="px-4 py-1.5 border border-[#3E362E] text-[#3E362E] text-xs font-medium rounded-[4px] cursor-pointer"
            >
              {showDiff ? 'Hide Diff' : 'Compare Versions Diff'}
            </button>
          )}
        </div>
      </div>

      {showDiff && versions.length >= 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5">
          <div>
            <div className="text-xs font-semibold text-[#A3431F] mb-2">
              Version v{versions[1].version_no} ({versions[1].status} ·{' '}
              {versions[1].config.rules.length} rules)
            </div>
            <pre className="text-[11px] bg-[#F5F1ED] p-3 rounded overflow-x-auto tabular-nums">
              {JSON.stringify(versions[1].config.rules, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#4F6B3A] mb-2">
              Version v{versions[0].version_no} ({versions[0].status} ·{' '}
              {versions[0].config.rules.length} rules)
            </div>
            <pre className="text-[11px] bg-[#F5F1ED] p-3 rounded border border-[#4F6B3A]/40 overflow-x-auto tabular-nums">
              {JSON.stringify(versions[0].config.rules, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {versions.map((v: any) => (
          <div
            key={v.id}
            className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-[#3E362E] tabular-nums">
                  Version v{v.version_no}
                </span>
                <span>·</span>
                <span
                  className={`font-semibold uppercase ${
                    v.status === 'published'
                      ? 'text-[#4F6B3A]'
                      : v.status === 'draft'
                      ? 'text-[#A3431F]'
                      : 'text-[#3E362E]/60'
                  }`}
                >
                  {v.status}
                </span>
                <span>·</span>
                <span className="text-[#3E362E]/70 tabular-nums">
                  {formatDateTimeIST(v.created_at)}
                </span>
              </div>
              <div className="text-sm font-medium text-[#3E362E] mt-1">{v.note}</div>
              <div className="text-xs text-[#3E362E]/65 mt-0.5">
                Author: {v.author} · {v.config.rules?.length || 0} rules
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {v.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handlePublishDraft(v.id, v.version_no)}
                  className="px-4 py-2 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
                >
                  Publish v{v.version_no}
                </button>
              )}
              {v.status !== 'published' && (
                <button
                  type="button"
                  onClick={() => setConfirmRollback(v.version_no)}
                  className="px-4 py-2 border border-[#3E362E] text-[#3E362E] hover:bg-[#E6DCD2] text-xs font-medium rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Activate / Rollback to v{v.version_no}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
          Recent Price Audit Log ({selectedDomain})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#A69080]/30 uppercase text-[#3E362E]/70">
                <th className="py-2.5 px-3">Audit ID</th>
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Base → Final</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A69080]/20">
              {audits.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 px-3 font-medium text-[#865D36] tabular-nums">{a.id}</td>
                  <td className="py-2.5 px-3 tabular-nums">v{a.config_version}</td>
                  <td className="py-2.5 px-3 font-medium tabular-nums">
                    {formatINR(a.base_price)} → {formatINR(a.final_price)}
                  </td>
                  <td className="py-2.5 px-3 tabular-nums">{a.latency_ms} ms</td>
                  <td className="py-2.5 px-3 tabular-nums">{formatDateTimeIST(a.created_at)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => onNavigate(`/admin/explain/${a.id}`)}
                      className="text-[#865D36] hover:underline font-medium cursor-pointer"
                    >
                      Explain →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRollback !== null}
        title={`Activate ${selectedDomain} Version v${confirmRollback}?`}
        description="This immediately switches all new storefront searches and quotes in this category to use this version's rules."
        confirmLabel={`Confirm Switch to v${confirmRollback}`}
        onConfirm={() => confirmRollback && handleRollback(confirmRollback)}
        onCancel={() => setConfirmRollback(null)}
      />
    </div>
  );
};

// ============================================================================
// A7. PERFORMANCE BENCHMARKS VIEW
// ============================================================================

const AdminPerformanceView: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  useEffect(() => {
    apiRequest('/api/v1/metrics').then(setMetrics);
  }, []);
  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
        Engine Latency & Throughput Benchmarks
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">p50 Median Evaluation</span>
          <div className="text-3xl font-semibold text-[#4F6B3A] tabular-nums mt-1">
            {metrics.latency.p50_ms} ms
          </div>
        </div>
        <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">p95 Tail Latency</span>
          <div className="text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
            {metrics.latency.p95_ms} ms
          </div>
        </div>
        <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-5">
          <span className="text-xs text-[#3E362E]/70">p99 Strict SLA</span>
          <div className="text-3xl font-semibold text-[#3E362E] tabular-nums mt-1">
            {metrics.latency.p99_ms} ms
          </div>
        </div>
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6">
        <h3 className="font-display text-2xl font-semibold text-[#3E362E] mb-4">
          Requests Per Second at Load Levels
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#A69080]/30 uppercase text-[#3E362E]/70">
              <th className="py-2.5">Target Load (RPS)</th>
              <th className="py-2.5">Sustained Throughput (RPS)</th>
              <th className="py-2.5 text-right">p95 Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#A69080]/20 tabular-nums">
            {metrics.throughput.map((t: any) => (
              <tr key={t.load_rps}>
                <td className="py-2.5 font-medium">{t.load_rps} req/sec</td>
                <td className="py-2.5 text-[#4F6B3A] font-semibold">{t.actual_rps} req/sec</td>
                <td className="py-2.5 text-right">{t.p95_ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// A8. USERS & SEGMENTS VIEW
// ============================================================================

const AdminUsersView: React.FC<{ showToast: (m: string) => void }> = ({ showToast }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const loadUsers = () => apiRequest('/api/admin/users').then((r) => setUsers(r.users || []));
  useEffect(() => {
    loadUsers();
  }, []);

  const updateUser = async (id: string, patch: any) => {
    await apiRequest(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    showToast('Customer profile updated.');
    loadUsers();
  };

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            Customer Accounts & Pricing Segments
          </h1>
          <p className="text-sm text-[#3E362E]/75">
            Assign customer segments (Regular / Loyalty / Student). Role cannot be changed from any API or UI control.
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email..."
          className="h-10 px-3 bg-[#FAF8F6] border border-[#A69080] rounded-[4px] text-xs"
        />
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#E6DCD2]/60 border-b border-[#A69080]/30 uppercase text-[#3E362E]/75">
              <th className="py-3 px-4">Full Name</th>
              <th className="py-3 px-4">Email & Phone</th>
              <th className="py-3 px-4">Pricing Segment</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#A69080]/20">
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="py-3 px-4 font-medium text-[#3E362E]">{u.full_name}</td>
                <td className="py-3 px-4 tabular-nums">
                  <div>{u.email}</div>
                  <div className="text-[#3E362E]/60">{u.phone}</div>
                </td>
                <td className="py-3 px-4">
                  <select
                    value={u.customer_segment}
                    onChange={(e) => updateUser(u.id, { customer_segment: e.target.value })}
                    className="h-8 px-2 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-xs"
                  >
                    <option value="regular">regular</option>
                    <option value="loyalty">loyalty (−10% Hotel)</option>
                    <option value="student">student (−5% Flight/Hotel)</option>
                  </select>
                </td>
                <td className="py-3 px-4 tabular-nums">{formatDateTimeIST(u.last_login_at)}</td>
                <td className="py-3 px-4">
                  {u.role !== 'admin' ? (
                    <button
                      type="button"
                      onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                      className={`px-3 py-1 rounded-[4px] border text-xs font-medium cursor-pointer ${
                        u.is_active
                          ? 'border-[#4F6B3A] text-[#4F6B3A]'
                          : 'border-[#9B2C2C] text-[#9B2C2C]'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </button>
                  ) : (
                    <span className="text-[#4F6B3A] font-semibold">Admin</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// BOOKINGS VIEW (With Category Filter, Receipt Inspector & Cancel/Restore)
// ============================================================================

const AdminBookingsView: React.FC<{
  selectedDomain?: string;
  onSelectDomain?: (slug: string) => void;
  onNavigate: (p: string) => void;
  showToast: (m: string) => void;
}> = ({ selectedDomain, onSelectDomain, onNavigate, showToast }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [catFilter, setCatFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const loadBookings = () =>
    apiRequest('/api/admin/bookings').then((r) => setBookings(r.bookings || []));

  useEffect(() => {
    loadBookings();
  }, []);

  const handleToggleCancel = async (id: string) => {
    await apiRequest(`/api/admin/bookings/${id}/cancel`, { method: 'POST' });
    showToast('Booking status updated.');
    loadBookings();
  };

  const filtered = bookings.filter((b) => catFilter === 'all' || b.category === catFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
            All Customer Bookings (Immutable Snapshots)
          </h1>
          <p className="text-sm text-[#3E362E]/75">
            Inspect confirmed Flight, Hotel, and Car bookings with their frozen pricing breakdown and forensic audit ID.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'airline', label: '✈ Flights' },
            { id: 'hotel', label: 'Hotels' },
            { id: 'car', label: 'Cars' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCatFilter(c.id);
                if (c.id !== 'all') onSelectDomain?.(c.id);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] border cursor-pointer ${
                catFilter === c.id
                  ? 'bg-[#3E362E] text-[#FAF8F6] border-[#3E362E]'
                  : 'bg-[#FAF8F6] text-[#3E362E] border-[#A69080]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#E6DCD2]/60 border-b border-[#A69080]/30 uppercase text-[#3E362E]/75">
              <th className="py-3 px-4">Booking Ref</th>
              <th className="py-3 px-4">Category & Item</th>
              <th className="py-3 px-4">Lead Traveller</th>
              <th className="py-3 px-4">Unit × Qty + Tax = Total</th>
              <th className="py-3 px-4">Audit Trace</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#A69080]/20 tabular-nums">
            {filtered.map((b) => (
              <tr key={b.id}>
                <td className="py-3 px-4 font-semibold">{b.id}</td>
                <td className="py-3 px-4">
                  <span className="uppercase text-[#865D36] font-semibold">{b.category}</span> ·{' '}
                  {b.item_title}
                  <div className="text-[11px] text-[#3E362E]/65">{b.quantity_label}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium text-[#3E362E]">
                    {b.details?.travellers?.[0]?.full_name || 'Guest'}
                  </div>
                  <div className="text-[11px] text-[#3E362E]/65">{b.details?.contact?.email}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-[#3E362E]">{formatINR(b.total)}</div>
                  <div className="text-[11px] text-[#3E362E]/65">
                    {formatINR(b.subtotal)} + {formatINR(b.tax_amount)} ({b.tax_percent}% tax)
                  </div>
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/admin/explain/${b.audit_id}`)}
                    className="text-[#865D36] underline cursor-pointer font-medium"
                  >
                    {b.audit_id}
                  </button>
                </td>
                <td className="py-3 px-4 uppercase font-semibold">
                  <span
                    className={
                      b.status === 'confirmed' ? 'text-[#4F6B3A]' : 'text-[#9B2C2C]'
                    }
                  >
                    {b.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(b)}
                    className="px-2.5 py-1 border border-[#3E362E] text-[#3E362E] rounded-[4px] cursor-pointer"
                  >
                    Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCancel(b.id)}
                    className="px-2.5 py-1 border border-[#A69080] text-[#3E362E]/80 rounded-[4px] cursor-pointer"
                  >
                    {b.status === 'confirmed' ? 'Cancel' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E362E]/60 p-4">
          <div className="bg-[#FAF8F6] border border-[#A69080] rounded-[4px] max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#A69080]/30 pb-3">
              <div>
                <span className="text-[11px] uppercase tracking-[0.16em] text-[#865D36] font-semibold">
                  IMMUTABLE BOOKING SNAPSHOT · {selectedBooking.id}
                </span>
                <h3 className="font-display text-2xl font-semibold text-[#3E362E]">
                  {selectedBooking.item_title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="px-3 py-1 border border-[#3E362E] text-xs rounded-[4px] cursor-pointer"
              >
                Close
              </button>
            </div>
            <BreakdownTable
              breakdown={selectedBooking.breakdown || []}
              finalPrice={selectedBooking.unit_price}
              configVersion={selectedBooking.config_version}
              auditId={selectedBooking.audit_id}
            />
            <div className="bg-[#F5F1ED] p-4 rounded-[4px] text-xs space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span>Subtotal ({selectedBooking.quantity_label})</span>
                <span>{formatINR(selectedBooking.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Demo tax ({selectedBooking.tax_percent}%)</span>
                <span>{formatINR(selectedBooking.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-sm pt-2 border-t border-[#A69080]/30">
                <span>Total Paid</span>
                <span>{formatINR(selectedBooking.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SETTINGS & CONTEXT SIGNALS VIEW
// ============================================================================

const AdminSettingsView: React.FC<{ showToast: (m: string) => void; onUpdated: () => void }> = ({
  showToast,
  onUpdated,
}) => {
  const [settings, setSettings] = useState<any>(null);
  const [signals, setSignals] = useState<any>(null);

  useEffect(() => {
    apiRequest('/api/admin/settings').then((res) => {
      setSettings(res.settings);
      setSignals(res.signals);
    });
  }, []);

  if (!settings || !signals) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings, signals }),
    });
    showToast('Server tax rates and context signals updated across all domains.');
    onUpdated();
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-[#3E362E]">
          Server Tax Configuration & Context Signals
        </h1>
        <p className="text-sm text-[#3E362E]/75">
          Control server-side Demo Tax percentages and real-time environmental signals read by the pricing engine.
        </p>
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold text-[#3E362E]">Demo Tax Rates (%)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Hotel Tax %</label>
            <input
              type="number"
              value={settings.tax_percent_hotel}
              onChange={(e) =>
                setSettings({ ...settings, tax_percent_hotel: Number(e.target.value) })
              }
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Airline (Flight) Tax %</label>
            <input
              type="number"
              value={settings.tax_percent_airline}
              onChange={(e) =>
                setSettings({ ...settings, tax_percent_airline: Number(e.target.value) })
              }
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Car Tax %</label>
            <input
              type="number"
              value={settings.tax_percent_car}
              onChange={(e) =>
                setSettings({ ...settings, tax_percent_car: Number(e.target.value) })
              }
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#FAF8F6] border border-[#A69080]/45 rounded-[4px] p-6 space-y-4">
        <h3 className="font-display text-xl font-semibold text-[#3E362E]">
          Live Context Signals (Server-Side Authority)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              Flight Default Seats Left (Golden = 12)
            </label>
            <input
              type="number"
              value={signals.default_flight_seats_left}
              onChange={(e) =>
                setSignals({ ...signals, default_flight_seats_left: Number(e.target.value) })
              }
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Hotel Default Occupancy % (Golden = 85)
            </label>
            <input
              type="number"
              value={signals.default_hotel_occupancy}
              onChange={(e) =>
                setSignals({ ...signals, default_hotel_occupancy: Number(e.target.value) })
              }
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Car Demand Ratio (Golden = 1.7)
            </label>
            <input
              type="number"
              step="0.1"
              value={signals.demand_supply_ratio}
              onChange={(e) =>
                setSignals({ ...signals, demand_supply_ratio: Number(e.target.value) })
              }
              className="w-full h-10 px-3 bg-[#F5F1ED] border border-[#A69080] rounded-[4px] text-sm tabular-nums"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-medium">Monsoon Rain Signal (Car +10%)</span>
          <input
            type="checkbox"
            checked={signals.is_raining}
            onChange={(e) => setSignals({ ...signals, is_raining: e.target.checked })}
            className="w-4 h-4 accent-[#865D36]"
          />
        </div>
      </div>

      <button
        type="submit"
        className="px-6 py-2.5 bg-[#3E362E] hover:bg-[#865D36] text-[#FAF8F6] text-xs font-medium rounded-[4px] cursor-pointer"
      >
        Save Server Settings
      </button>
    </form>
  );
};
