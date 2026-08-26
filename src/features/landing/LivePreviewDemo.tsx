import { Smartphone, Tablet, Monitor, RotateCw, Play, Square, Maximize2 } from 'lucide-react';

export function LivePreviewDemo() {
  return (
    <section className="py-24 bg-[var(--ff-surface)]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">See your app come to life</h2>
          <p className="text-lg text-[var(--ff-text-muted)]">
            Real Flutter Web builds running in an isolated preview. Switch devices, rotate, and interact.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="ff-card p-4">
            {/* Preview toolbar */}
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-1">
                {[
                  { icon: Smartphone, label: 'iPhone' },
                  { icon: Tablet, label: 'iPad' },
                  { icon: Monitor, label: 'Desktop' },
                ].map((device, i) => {
                  const Icon = device.icon;
                  return (
                    <button
                      key={device.label}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${i === 0 ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'}`}
                    >
                      <Icon size={14} />
                      {device.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]"><RotateCw size={14} /></button>
                <button className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"><Play size={14} /></button>
                <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]"><Square size={14} /></button>
                <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]"><Maximize2 size={14} /></button>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="flex items-center justify-center py-8 bg-[var(--ff-surface-2)] rounded-lg">
              <div className="w-[280px] h-[560px] bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-900">
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
