import { FileCode2, Plus, Minus } from 'lucide-react';

const CODE_LINES = [
  { num: 1, content: "import 'package:flutter/material.dart';", type: 'normal' },
  { num: 2, content: "import '../../core/theme/app_theme.dart';", type: 'normal' },
  { num: 3, content: '', type: 'normal' },
  { num: 4, content: 'class HomeScreen extends StatelessWidget {', type: 'normal' },
  { num: 5, content: '  const HomeScreen({super.key});', type: 'added' },
  { num: 6, content: '', type: 'normal' },
  { num: 7, content: '  @override', type: 'normal' },
  { num: 8, content: '  Widget build(BuildContext context) {', type: 'normal' },
  { num: 9, content: '    return Scaffold(', type: 'normal' },
  { num: 10, content: '      appBar: AppBar(title: const Text(\'Home\')),', type: 'normal' },
  { num: 11, content: '      body: Padding(', type: 'added' },
  { num: 12, content: '        padding: const EdgeInsets.all(16),', type: 'added' },
  { num: 13, content: '        child: Column(', type: 'added' },
  { num: 14, content: '          children: [', type: 'added' },
  { num: 15, content: '            TextField(', type: 'added' },
  { num: 16, content: '              decoration: InputDecoration(', type: 'added' },
  { num: 17, content: '                hintText: \'Search...\',', type: 'added' },
  { num: 18, content: '                prefixIcon: const Icon(Icons.search),', type: 'added' },
  { num: 19, content: '              ),', type: 'added' },
  { num: 20, content: '            ),', type: 'added' },
  { num: 21, content: '          ],', type: 'added' },
  { num: 22, content: '        ),', type: 'added' },
  { num: 23, content: '      ),', type: 'added' },
  { num: 24, content: '    );', type: 'normal' },
  { num: 25, content: '  }', type: 'normal' },
  { num: 26, content: '}', type: 'normal' },
];

export function CodeGenDemo() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Production-ready Dart code</h2>
          <p className="text-base sm:text-lg text-[var(--ff-text-muted)]">
            Every file is real, compilable Flutter code with proper architecture and null safety.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="ff-card overflow-hidden">
            {/* Editor header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--ff-border)]">
              <div className="flex items-center gap-1.5">
                <FileCode2 size={14} className="text-blue-400" />
                <span className="text-xs text-[var(--ff-text-muted)] font-mono">lib/screens/home/home_screen.dart</span>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-400"><Plus size={12} /> 14 lines</span>
                <span className="flex items-center gap-1 text-red-400"><Minus size={12} /> 0 lines</span>
              </div>
            </div>

            {/* Code */}
            <div className="bg-[var(--ff-surface-2)] p-4 overflow-x-auto ff-scrollbar">
              <pre className="text-xs font-mono leading-relaxed">
                {CODE_LINES.map((line) => (
                  <div
                    key={line.num}
                    className={`flex ${line.type === 'added' ? 'bg-emerald-500/5' : ''}`}
                  >
                    <span className="text-[var(--ff-text-dim)] w-8 shrink-0 text-right pr-3 select-none">{line.num}</span>
                    <span className={`${
                      line.type === 'added' ? 'text-emerald-300' : 'text-[var(--ff-text-muted)]'
                    } whitespace-pre`}>{line.content || ' '}</span>
                  </div>
                ))}
              </pre>
            </div>

            {/* Diff controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--ff-border)]">
              <span className="text-xs text-[var(--ff-text-dim)]">AI generated changes — review before applying</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs rounded-md border border-[var(--ff-border)] text-[var(--ff-text-muted)] hover:text-white hover:border-red-400 transition-colors">Reject</button>
                <button className="px-3 py-1.5 text-xs rounded-md ff-btn-primary">Accept</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
