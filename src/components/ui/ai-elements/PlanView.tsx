import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Layout,
  Server,
  Package,
  Check,
  Loader2,
  Palette,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { AgentPlan } from '@/agent/types';

interface PlanViewProps {
  plan: AgentPlan;
  isActive?: boolean;
  className?: string;
}

export function PlanView({ plan, isActive = false, className }: PlanViewProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    schema: false,
    screens: true,
    services: false,
    deps: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        isActive
          ? 'border-indigo-500/30 bg-indigo-500/5'
          : 'border-[var(--ff-border)] bg-[var(--ff-surface)]',
        className,
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--ff-surface-2)]/50 transition-colors"
      >
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isActive ? 'bg-indigo-500/15' : 'bg-[var(--ff-primary)]/10',
        )}>
          {isActive ? (
            <Loader2 size={15} className="text-indigo-400 animate-spin" />
          ) : (
            <Check size={15} className="text-emerald-400" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <h4 className="text-[13px] font-semibold text-[var(--ff-text)] truncate">
            {plan.appName}
          </h4>
          <p className="text-[11px] text-[var(--ff-text-muted)] truncate">
            {plan.architecture} · {plan.stateManagement} · {plan.domain || 'general'}
          </p>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            'text-[var(--ff-text-dim)] transition-transform shrink-0',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--ff-border)] px-4 py-3 space-y-2">
              {/* Theme bar */}
              <div className="flex items-center gap-2 text-[11px]">
                <Palette size={11} className="text-[var(--ff-text-dim)]" />
                <span className="text-[var(--ff-text-dim)]">Theme</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span
                    className="w-3 h-3 rounded-full border border-[var(--ff-border)]"
                    style={{ backgroundColor: plan.theme.primaryColor }}
                    title={plan.theme.primaryColor}
                  />
                  <span
                    className="w-3 h-3 rounded-full border border-[var(--ff-border)]"
                    style={{ backgroundColor: plan.theme.secondaryColor }}
                    title={plan.theme.secondaryColor}
                  />
                  <span className="text-[var(--ff-text-muted)] font-mono text-[10px]">
                    {plan.theme.isDarkPreferred ? 'Dark' : 'Light'}
                  </span>
                </div>
              </div>

              {/* Schema */}
              <PlanSection
                icon={<Database size={12} />}
                label={`${plan.schema.tables.length} Tables`}
                isOpen={expandedSections.schema}
                onToggle={() => toggleSection('schema')}
              >
                {plan.schema.tables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center gap-2 py-1 text-[11px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[var(--ff-text)] font-mono truncate">
                      {table.name}
                    </span>
                    <span className="text-[var(--ff-text-dim)] ml-auto shrink-0">
                      {table.columns.length} cols
                    </span>
                    {table.enableRLS && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                        RLS
                      </span>
                    )}
                  </div>
                ))}
              </PlanSection>

              {/* Screens */}
              <PlanSection
                icon={<Layout size={12} />}
                label={`${plan.screens.length} Screens`}
                isOpen={expandedSections.screens}
                onToggle={() => toggleSection('screens')}
              >
                {plan.screens.map((screen) => (
                  <div
                    key={screen.name}
                    className="flex items-center gap-2 py-1 text-[11px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-[var(--ff-text)] truncate">
                      {screen.name}
                    </span>
                    <span className="text-[var(--ff-text-dim)] font-mono text-[10px] ml-auto truncate max-w-[80px]">
                      {screen.routePath}
                    </span>
                    {screen.isAuthProtected && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0">
                        Auth
                      </span>
                    )}
                  </div>
                ))}
              </PlanSection>

              {/* Services */}
              <PlanSection
                icon={<Server size={12} />}
                label={`${plan.services.length} Services`}
                isOpen={expandedSections.services}
                onToggle={() => toggleSection('services')}
              >
                {plan.services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center gap-2 py-1 text-[11px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="text-[var(--ff-text)] truncate">
                      {service.name}
                    </span>
                    <span className="text-[var(--ff-text-dim)] text-[10px] ml-auto shrink-0">
                      {service.methods.length} methods
                    </span>
                  </div>
                ))}
              </PlanSection>

              {/* Dependencies */}
              <PlanSection
                icon={<Package size={12} />}
                label={`${Object.keys(plan.dependencies).length} Dependencies`}
                isOpen={expandedSections.deps}
                onToggle={() => toggleSection('deps')}
              >
                <div className="flex flex-wrap gap-1">
                  {Object.entries(plan.dependencies).map(([name, version]) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--ff-surface-2)] text-[10px] font-mono text-[var(--ff-text-muted)]"
                    >
                      {name}
                      <span className="text-[var(--ff-text-dim)]">{version}</span>
                    </span>
                  ))}
                </div>
              </PlanSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PlanSection({
  icon,
  label,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--ff-border)]/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-[var(--ff-text-muted)] hover:bg-[var(--ff-surface-2)]/40 transition-colors"
      >
        <span className="text-[var(--ff-text-dim)]">{icon}</span>
        <span className="font-medium">{label}</span>
        <ChevronRight
          size={10}
          className={cn(
            'ml-auto text-[var(--ff-text-dim)] transition-transform',
            isOpen && 'rotate-90',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--ff-border)]/60 px-2.5 py-1.5 max-h-40 overflow-y-auto ff-scrollbar">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
