import { useState } from 'react';
import { Smartphone, Tablet, Monitor, RotateCw, Play, Square, Maximize2, RefreshCw } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { DEVICE_PRESETS } from '@/utils/constants';
import { cn } from '@/utils/cn';

export function PreviewPanel() {
  const { previewDevice, setPreviewDevice, previewOrientation, setPreviewOrientation } = useWorkspaceStore();
  const { isBuilding } = useTerminalStore();
  const [running, setRunning] = useState(false);

  const device = DEVICE_PRESETS.find((d) => d.name === previewDevice) ?? DEVICE_PRESETS[0];
  const isPortrait = previewOrientation === 'portrait';
  const width = isPortrait ? device.width : device.height;
  const height = isPortrait ? device.height : device.width;
  const scale = Math.min(1, 600 / Math.max(width, height));

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ff-border)] bg-[var(--ff-surface)] shrink-0">
        <div className="flex items-center gap-1">
          {[
            { icon: Smartphone, label: 'iPhone 15 Pro', w: 393, h: 852 },
            { icon: Tablet, label: 'iPad Pro', w: 1024, h: 1366 },
            { icon: Monitor, label: 'Desktop', w: 1440, h: 900 },
          ].map((d) => {
            const Icon = d.icon;
            const isActive = previewDevice === d.label;
            return (
              <button
                key={d.label}
                onClick={() => setPreviewDevice(d.label)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                  isActive ? 'bg-[var(--ff-primary)]/10 text-[var(--ff-primary)]' : 'text-[var(--ff-text-dim)] hover:text-[var(--ff-text-muted)]'
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{d.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewOrientation(isPortrait ? 'landscape' : 'portrait')}
            className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors"
            title="Rotate"
          >
            <RotateCw size={14} />
          </button>
          <button
            onClick={() => { setRunning(!running); }}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              running ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)]'
            )}
            title={running ? 'Stop' : 'Run'}
          >
            {running ? <Square size={14} /> : <Play size={14} />}
          </button>
          <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors" title="Reload">
            <RefreshCw size={14} />
          </button>
          <button className="p-1.5 rounded-md text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-colors" title="Fullscreen">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center bg-[var(--ff-surface-2)] overflow-hidden p-4">
        {isBuilding ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--ff-primary)] border-t-transparent rounded-full ff-spin" />
            <p className="text-sm text-[var(--ff-text-muted)]">Building Flutter Web...</p>
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-800 transition-all"
            style={{
              width: `${width * scale}px`,
              height: `${height * scale}px`,
            }}
          >
            <PreviewContent running={running} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--ff-border)] bg-[var(--ff-surface)] text-[10px] text-[var(--ff-text-dim)] shrink-0">
        <span>{device.name} · {width}×{height}</span>
        <span>{running ? 'Running' : 'Stopped'}</span>
      </div>
    </div>
  );
}

function PreviewContent({ running }: { running: boolean }) {
  if (!running) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <Play size={32} className="mb-2 opacity-50" />
        <p className="text-xs">Press Run to start preview</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="bg-blue-500 text-white px-3 py-2 text-xs font-medium">FlutterForge App</div>
      <div className="flex-1 p-3 space-y-2 overflow-hidden bg-gray-50">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-2">
            <div className="h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded mb-1.5" />
            <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
            <div className="h-2 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="bg-white border-t flex justify-around py-1.5">
        {['Home', 'Search', 'Cart', 'Profile'].map((tab, i) => (
          <span key={tab} className={`text-[8px] ${i === 0 ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>{tab}</span>
        ))}
      </div>
    </div>
  );
}
