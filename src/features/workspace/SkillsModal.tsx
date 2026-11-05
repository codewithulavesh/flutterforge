import { useState } from 'react';
import {
  Sparkles,
  X,
  Palette,
  Layers,
  Monitor,
  Database,
  CheckSquare,
  HardDrive,
  Check,
  RotateCcw,
  Info,
} from 'lucide-react';
import { SkillRegistry, type FlutterSkill, type SkillCategory } from '@/agent/skills';
import { cn } from '@/utils/cn';

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillsChanged?: (skills: FlutterSkill[]) => void;
}

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  ui: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  architecture: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  motion: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  platform: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  backend: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  data: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  custom: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

function getSkillIcon(id: string) {
  switch (id) {
    case 'modern-ui':
      return <Palette className="size-4" />;
    case 'clean-architecture':
      return <Layers className="size-4" />;
    case 'animations-motion':
      return <Sparkles className="size-4" />;
    case 'desktop-web-parity':
      return <Monitor className="size-4" />;
    case 'supabase-production':
      return <Database className="size-4" />;
    case 'clean-forms-validation':
      return <CheckSquare className="size-4" />;
    case 'offline-first-caching':
      return <HardDrive className="size-4" />;
    default:
      return <Sparkles className="size-4" />;
  }
}

export function SkillsModal({ isOpen, onClose, onSkillsChanged }: SkillsModalProps) {
  const [skills, setSkills] = useState<FlutterSkill[]>(() => SkillRegistry.getAllSkills());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeCount = skills.filter((s) => s.enabled).length;

  const handleToggle = (skillId: string) => {
    SkillRegistry.toggleSkill(skillId);
    const updated = SkillRegistry.getAllSkills();
    setSkills(updated);
    onSkillsChanged?.(updated);
  };

  const handleResetRecommended = () => {
    // Enable all recommended skills except offline-first-caching by default
    for (const skill of skills) {
      const shouldEnable = skill.id !== 'offline-first-caching';
      SkillRegistry.setSkillEnabled(skill.id, shouldEnable);
    }
    const updated = SkillRegistry.getAllSkills();
    setSkills(updated);
    onSkillsChanged?.(updated);
  };

  const handleToggleAll = (enable: boolean) => {
    for (const skill of skills) {
      SkillRegistry.setSkillEnabled(skill.id, enable);
    }
    const updated = SkillRegistry.getAllSkills();
    setSkills(updated);
    onSkillsChanged?.(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        aria-labelledby="skills-modal-title"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--fb-line)] bg-[var(--fb-card)] shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--fb-line)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[var(--fb-magenta)]/10 text-[var(--fb-magenta)] border border-[var(--fb-magenta)]/20">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--fb-ink)]" id="skills-modal-title">
                  Flutter Capability Skills
                </h2>
                <span className="inline-flex items-center rounded-full bg-[var(--fb-magenta)]/15 px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--fb-magenta)]">
                  {activeCount} of {skills.length} active
                </span>
              </div>
              <p className="text-[11px] text-[var(--fb-muted)]">
                Connect specialized modular rules, Material 3 design tokens, and packages to the agent
              </p>
            </div>
          </div>
          <button
            aria-label="Close skills dialog"
            className="grid size-8 place-items-center rounded-lg border border-transparent text-[var(--fb-muted)] hover:border-[var(--fb-line)] hover:text-[var(--fb-ink)] transition-colors"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Quick controls bar */}
        <div className="flex items-center justify-between border-b border-[var(--fb-line)] bg-[var(--fb-soft)] px-5 py-2 text-[11px]">
          <span className="text-[var(--fb-dim)] font-mono uppercase tracking-wider text-[9px]">
            Agent Generation Pipeline
          </span>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 text-[var(--fb-muted)] hover:text-[var(--fb-ink)] font-medium transition-colors"
              onClick={handleResetRecommended}
              type="button"
            >
              <RotateCcw className="size-3" />
              Reset defaults
            </button>
            <span className="text-[var(--fb-line)]">·</span>
            <button
              className="text-[var(--fb-muted)] hover:text-[var(--fb-ink)] font-medium transition-colors"
              onClick={() => handleToggleAll(activeCount < skills.length)}
              type="button"
            >
              {activeCount < skills.length ? 'Enable all' : 'Disable all'}
            </button>
          </div>
        </div>

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {skills.map((skill) => {
            const isExpanded = expandedId === skill.id;
            return (
              <div
                className={cn(
                  'rounded-xl border transition-all p-3.5',
                  skill.enabled
                    ? 'border-[var(--fb-line)] bg-[var(--fb-bg)] shadow-sm'
                    : 'border-transparent bg-[var(--fb-soft)]/50 opacity-60 hover:opacity-100',
                )}
                key={skill.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      aria-checked={skill.enabled}
                      aria-label={`Toggle skill ${skill.name}`}
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                        skill.enabled
                          ? 'border-[var(--fb-magenta)] bg-[var(--fb-magenta)] text-white'
                          : 'border-[var(--fb-line)] bg-[var(--fb-card)] text-transparent hover:border-[var(--fb-ink)]',
                      )}
                      onClick={() => handleToggle(skill.id)}
                      role="checkbox"
                      type="button"
                    >
                      <Check className="size-3 stroke-[3]" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--fb-ink)]">
                          {skill.name}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.2 text-[9px] font-mono uppercase tracking-wider',
                            CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.custom,
                          )}
                        >
                          {skill.category}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--fb-muted)]">
                        {skill.description}
                      </p>

                      {skill.requiredPackages && Object.keys(skill.requiredPackages).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-mono text-[var(--fb-dim)]">Packages:</span>
                          {Object.entries(skill.requiredPackages).map(([pkg, ver]) => (
                            <span
                              className="inline-flex items-center rounded-md border border-[var(--fb-line)] bg-[var(--fb-card)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--fb-muted)]"
                              key={pkg}
                            >
                              {pkg}: {ver}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    aria-label={`Show rules for ${skill.name}`}
                    className="shrink-0 p-1 text-[var(--fb-dim)] hover:text-[var(--fb-ink)] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                    type="button"
                  >
                    <Info className="size-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-[var(--fb-line)] pt-2.5 pl-8 space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--fb-dim)]">
                      Enforced Agent Guidelines:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-[var(--fb-muted)] leading-relaxed">
                      {skill.rules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--fb-line)] px-5 py-3 bg-[var(--fb-soft)]">
          <span className="text-[11px] text-[var(--fb-muted)] font-mono">
            {activeCount} skill{activeCount === 1 ? '' : 's'} connected to agent prompt & dependencies
          </span>
          <button
            className="rounded-full bg-[var(--fb-ink)] px-4 py-1.5 text-xs font-medium text-[var(--fb-bg)] hover:opacity-90 transition-opacity"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

