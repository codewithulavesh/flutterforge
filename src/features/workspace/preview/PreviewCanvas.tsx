import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ProjectFile } from '@/types';

interface PreviewCanvasProps {
  files: ProjectFile[];
  projectName?: string;
  activeScreen?: string;
  onScreenChange?: (screen: string) => void;
  inspectMode?: boolean;
}

interface ParsedWidget {
  type: string;
  text?: string;
  children?: ParsedWidget[];
  color?: string;
  isInput?: boolean;
  isButton?: boolean;
  isList?: boolean;
  itemCount?: number;
}

function parseDartCode(files: ProjectFile[]): {
  appName: string;
  screens: { name: string; widgets: ParsedWidget[] }[];
  primaryColor: string;
  isDark: boolean;
} {
  const dartFiles = files.filter((f) => !f.is_directory && f.path.endsWith('.dart'));
  const combinedCode = dartFiles.map((f) => f.content || '').join('\n');

  // Extract app name
  const appNameMatch = combinedCode.match(/title:\s*['"]([^'"]+)['"]/);
  const appName = appNameMatch?.[1] || 'Flutter App';

  // Extract primary color
  const colorMatch = combinedCode.match(/primaryColor:\s*(?:Color\(0x([0-9A-Fa-f]+)\)|Color\(0xFF([0-9A-Fa-f]+)\))/);
  const primaryColor = colorMatch ? `#${colorMatch[1] || colorMatch[2]}` : '#3B82F6';

  // Detect dark mode
  const isDark = /brightness:\s*Brightness\.dark/i.test(combinedCode) ||
    /ThemeData\.dark/i.test(combinedCode) ||
    /darkTheme/i.test(combinedCode);

  // Parse screens
  const screens: { name: string; widgets: ParsedWidget[] }[] = [];
  const screenFiles = dartFiles.filter((f) =>
    f.path.includes('/screens/') || f.path.includes('/pages/') || f.path === 'lib/main.dart'
  );

  for (const file of screenFiles) {
    const content = file.content || '';
    const widgets = extractWidgets(content);
    const screenName = file.path.split('/').pop()?.replace('_screen.dart', '').replace('_page.dart', '').replace('.dart', '') || 'Screen';
    screens.push({
      name: screenName.charAt(0).toUpperCase() + screenName.slice(1),
      widgets,
    });
  }

  // If no screens found, create a default
  if (screens.length === 0) {
    screens.push({ name: 'Home', widgets: extractWidgets(combinedCode) });
  }

  return { appName, screens, primaryColor, isDark };
}

function extractWidgets(code: string): ParsedWidget[] {
  const widgets: ParsedWidget[] = [];

  // Extract Text widgets
  const textMatches = code.matchAll(/Text\(\s*['"]([^'"]+)['"]/g);
  for (const match of textMatches) {
    widgets.push({ type: 'text', text: match[1] });
  }

  // Extract TextField/Input widgets
  if (/TextField|TextFormField|TextInput/i.test(code)) {
    const hintMatch = code.match(/hintText:\s*['"]([^'"]+)['"]/);
    widgets.push({ type: 'input', text: hintMatch?.[1] || 'Enter text...', isInput: true });
  }

  // Extract ElevatedButton/RaisedButton
  if (/ElevatedButton|RaisedButton|TextButton|IconButton/i.test(code)) {
    const labelMatch = code.match(/(?:ElevatedButton|RaisedButton|TextButton)[\s\S]*?child:\s*Text\(\s*['"]([^'"]+)['"]/);
    widgets.push({ type: 'button', text: labelMatch?.[1] || 'Button', isButton: true });
  }

  // Extract ListView/GridView
  if (/ListView|GridView|LazyColumn|StaggeredGrid/i.test(code)) {
    const countMatch = code.match(/itemCount:\s*(\d+)/);
    widgets.push({ type: 'list', isList: true, itemCount: parseInt(countMatch?.[1] || '10') });
  }

  // Extract AppBar
  const appBarTitle = code.match(/AppBar[\s\S]*?title:\s*(?:Text\(\s*['"]([^'"]+)['"]\)|(\w+))/);
  if (appBarTitle) {
    widgets.unshift({ type: 'appbar', text: appBarTitle[1] || 'App' });
  }

  // Extract Cards
  if (/Card|Container[\s\S]*?decoration/i.test(code)) {
    widgets.push({ type: 'card' });
  }

  // Extract images/network images
  if (/NetworkImage|Image\.network|AsyncImage/i.test(code)) {
    widgets.push({ type: 'image' });
  }

  // Extract FloatingActionButton
  if (/FloatingActionButton/i.test(code)) {
    widgets.push({ type: 'fab' });
  }

  return widgets.length > 0 ? widgets : [{ type: 'text', text: 'App Content' }];
}

export function PreviewCanvas({
  files,
  projectName = 'Flutter App',
  activeScreen,
  onScreenChange,
  inspectMode = false,
}: PreviewCanvasProps) {
  const [activeTab, setActiveTab] = useState(0);

  const parsed = useMemo(() => parseDartCode(files), [files]);
  const tabs = parsed.screens.map((s) => s.name);
  const currentScreen = parsed.screens[activeTab] || parsed.screens[0];

  useEffect(() => {
    if (activeScreen) {
      const idx = tabs.findIndex((t) => t.toLowerCase() === activeScreen.toLowerCase());
      if (idx >= 0) setActiveTab(idx);
    }
  }, [activeScreen, tabs.length]);

  const bgColor = parsed.isDark ? '#1a1a2e' : '#F8FAFC';
  const cardBg = parsed.isDark ? '#2d2d44' : '#ffffff';
  const textColor = parsed.isDark ? '#ffffff' : '#111827';
  const mutedColor = parsed.isDark ? '#9ca3af' : '#6b7280';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none font-sans relative" style={{ backgroundColor: bgColor }}>
      {/* Status Bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0" style={{ backgroundColor: bgColor }}>
        <span className="text-[10px] font-bold" style={{ color: textColor }}>9:41</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-2 rounded-[2px]" style={{ backgroundColor: textColor, opacity: 0.8 }} />
          <div className="w-3 h-2 rounded-[2px]" style={{ backgroundColor: textColor, opacity: 0.5 }} />
          <div className="w-2.5 h-2 rounded-[2px]" style={{ backgroundColor: textColor, opacity: 0.3 }} />
        </div>
      </div>

      {/* App Bar */}
      <div
        className="px-4 py-3 shrink-0 flex items-center justify-between text-white shadow-sm"
        style={{ backgroundColor: parsed.primaryColor }}
      >
        <div className="flex items-center gap-2">
          {activeTab > 0 && (
            <button onClick={() => setActiveTab(0)} className="p-1 -ml-1 rounded hover:bg-white/20">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-xs font-black tracking-tight">{projectName}</h2>
            <p className="text-[9px] text-white/80 capitalize">{currentScreen?.name || 'Home'}</p>
          </div>
        </div>
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
          {projectName.charAt(0)}
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ backgroundColor: bgColor }}>
        {inspectMode && (
          <div className="p-2 rounded-lg text-[10px] font-mono border" style={{
            backgroundColor: parsed.isDark ? '#312e81' : '#eef2ff',
            borderColor: parsed.isDark ? '#4338ca' : '#c7d2fe',
            color: parsed.isDark ? '#a5b4fc' : '#3730a3',
          }}>
            Inspect Mode: Hover over elements to see widget properties.
          </div>
        )}

        {currentScreen?.widgets.map((widget, i) => (
          <WidgetRenderer key={i} widget={widget} primaryColor={parsed.primaryColor} cardBg={cardBg} textColor={textColor} mutedColor={mutedColor} isDark={parsed.isDark} />
        ))}
      </div>

      {/* Bottom Nav */}
      {tabs.length > 0 && (
        <div className="flex items-center border-t shrink-0 pb-3 pt-2" style={{ backgroundColor: cardBg, borderColor: parsed.isDark ? '#374151' : '#f3f4f6' }}>
          {tabs.map((tab, i) => {
            const isActive = activeTab === i;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(i);
                  onScreenChange?.(tab);
                }}
                className="flex-1 flex flex-col items-center gap-1 transition-all"
              >
                <div
                  className="w-4 h-4 rounded-md transition-all flex items-center justify-center"
                  style={{ backgroundColor: isActive ? parsed.primaryColor : 'transparent' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? 'white' : mutedColor }} />
                </div>
                <span
                  className="text-[9px] font-medium truncate max-w-full px-1"
                  style={{ color: isActive ? parsed.primaryColor : mutedColor, fontWeight: isActive ? 700 : 500 }}
                >
                  {tab}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WidgetRenderer({
  widget,
  primaryColor,
  cardBg,
  textColor,
  mutedColor,
  isDark,
}: {
  widget: ParsedWidget;
  primaryColor: string;
  cardBg: string;
  textColor: string;
  mutedColor: string;
  isDark: boolean;
}) {
  switch (widget.type) {
    case 'appbar':
      return null; // Already rendered above

    case 'text':
      return (
        <div className="px-1">
          <p className="text-[11px] font-semibold" style={{ color: textColor }}>{widget.text}</p>
        </div>
      );

    case 'input':
      return (
        <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 border" style={{
          backgroundColor: cardBg,
          borderColor: isDark ? '#4b5563' : '#e5e7eb',
        }}>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: mutedColor, opacity: 0.4 }} />
          <span className="text-[10px]" style={{ color: mutedColor }}>{widget.text}</span>
        </div>
      );

    case 'button':
      return (
        <button
          className="w-full py-2.5 rounded-xl text-white text-[11px] font-bold shadow-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {widget.text}
        </button>
      );

    case 'list':
      return (
        <div className="space-y-2">
          {Array.from({ length: Math.min(widget.itemCount || 5, 6) }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 flex items-center gap-3 border" style={{
              backgroundColor: cardBg,
              borderColor: isDark ? '#374151' : '#f3f4f6',
            }}>
              <div className="w-10 h-10 rounded-lg shrink-0" style={{ backgroundColor: `${primaryColor}20` }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 rounded w-2/3" style={{ backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }} />
                <div className="h-2 rounded w-1/2" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }} />
              </div>
              <div className="h-2 rounded w-12" style={{ backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }} />
            </div>
          ))}
        </div>
      );

    case 'card':
      return (
        <div className="rounded-xl p-4 border space-y-2" style={{
          backgroundColor: cardBg,
          borderColor: isDark ? '#374151' : '#f3f4f6',
        }}>
          <div className="h-3 rounded w-3/4" style={{ backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }} />
          <div className="h-2 rounded w-1/2" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }} />
          <div className="h-8 rounded-lg mt-2" style={{ backgroundColor: `${primaryColor}15` }} />
        </div>
      );

    case 'image':
      return (
        <div className="rounded-xl overflow-hidden h-32 flex items-center justify-center" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
          <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: `${primaryColor}30` }} />
        </div>
      );

    case 'fab':
      return (
        <div className="flex justify-end">
          <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: primaryColor }}>
            <span className="text-white text-lg font-bold">+</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
