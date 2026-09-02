import { Smartphone, Tablet, Monitor, RotateCw, Play, Square, Maximize2 } from 'lucide-react';

export function LivePreviewDemo() {
  return (
    <section className="py-12 sm:py-12 sm:py-24 bg-[var(--ff-surface)]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">See your app come to life</h2>
          <p className="text-base sm:text-base sm:text-lg text-[var(--ff-text-muted)] px-2">
            Real Flutter Web builds running in an isolated preview. Switch devices, rotate, and interact.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="ff-card p-2 sm:p-4 overflow-hidden">
            {/* Preview toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1 sm:px-2">
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { icon: Smartphone, label: 'iPhone' },
                  { icon: Tablet, label: 'iPad' },
                  { icon: Monitor, label: 'Desktop' },
                ].map((device, i) => {
                  const Icon = device.icon;
                  return (
                    <button
                      key={device.label}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs transition-colors ${i === 0 ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'}`}
                    >
                      <Icon size={12} className="sm:w-[14px] sm:h-[14px]" />
                      {device.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="p-1 sm:p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]"><RotateCw size={12} className="sm:w-[14px] sm:h-[14px]" /></button>
                <button className="p-1 sm:p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"><Play size={12} className="sm:w-[14px] sm:h-[14px]" /></button>
                <button className="p-1 sm:p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]"><Square size={12} className="sm:w-[14px] sm:h-[14px]" /></button>
                <button className="p-1 sm:p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]"><Maximize2 size={12} className="sm:w-[14px] sm:h-[14px]" /></button>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex items-center justify-center py-4 sm:py-8 bg-[var(--ff-surface-2)] rounded-lg overflow-hidden">
              <div className="w-[260px] h-[520px] sm:w-[280px] sm:h-[560px] max-w-[90vw] max-h-[70vh] bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-900 shrink-0">
                <div className="h-full flex flex-col">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3">
                    <div className="text-sm font-bold">FoodDelivery</div>
                    <div className="text-xs opacity-80">Deliver to: 123 Main St</div>
                  </div>
                  <div className="p-3 space-y-3 flex-1 overflow-hidden bg-gray-50">
                    <div className="bg-white rounded-xl p-2 shadow-sm">
                      <div className="h-20 bg-gradient-to-br from-orange-200 to-red-200 rounded-lg mb-2" />
                      <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
                      <div className="h-2 bg-gray-200 rounded w-1/2" />
                    </div>
                    <div className="bg-white rounded-xl p-2 shadow-sm">
                      <div className="h-20 bg-gradient-to-br from-green-200 to-teal-200 rounded-lg mb-2" />
                      <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
                      <div className="h-2 bg-gray-200 rounded w-1/2" />
                    </div>
                    <div className="bg-white rounded-xl p-2 shadow-sm">
                      <div className="h-20 bg-gradient-to-br from-purple-200 to-pink-200 rounded-lg mb-2" />
                      <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
                      <div className="h-2 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="bg-white border-t flex justify-around py-2">
                    {['Home', 'Search', 'Cart', 'Orders', 'Profile'].map((tab, i) => (
                      <div key={tab} className={`text-[10px] ${i === 0 ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>{tab}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
