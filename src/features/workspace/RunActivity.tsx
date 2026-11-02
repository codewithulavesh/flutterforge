import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleIcon,
  Loader2Icon,
} from 'lucide-react';
import {
  useActivityStore,
  type CheckpointActivity,
  type ErrorActivity,
  type FileActivity,
  type PhaseActivity,
  type ReasoningActivity,
  type TerminalActivity,
  type ToolActivity,
} from '@/stores/activity.store';
import { Agent, AgentContent, AgentHeader } from '@/components/ai-elements/agent';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import {
  Terminal,
  TerminalActions,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalStatus,
  TerminalTitle,
} from '@/components/ai-elements/terminal';
import { Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
  InlineCitationText,
} from '@/components/ai-elements/inline-citation';
import { Checkpoint, CheckpointIcon } from '@/components/ai-elements/checkpoint';
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueItemDescription,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from '@/components/ai-elements/queue';
import {
  TestResults,
  TestResultsHeader,
  TestResultsProgress,
  TestResultsSummary,
} from '@/components/ai-elements/test-results';
import {
  StackTrace,
  StackTraceActions,
  StackTraceContent,
  StackTraceCopyButton,
  StackTraceError,
  StackTraceErrorMessage,
  StackTraceErrorType,
  StackTraceExpandButton,
  StackTraceHeader,
} from '@/components/ai-elements/stack-trace';
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from '@/components/ai-elements/plan';
import { Task, TaskContent, TaskTrigger } from '@/components/ai-elements/task';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import ThoughtLine from '@/components/ui/ThoughtLine';

function humanizePhase(phase: string | null): string {
  if (!phase) return 'Working…';
  const value = phase.toLowerCase();
  if (/planning|architect|design|schema/.test(value)) return 'Designing the app architecture';
  if (/writing|creating|generat|batch|file/.test(value)) return 'Writing Flutter files';
  if (/valid|analyz|fix|heal|test/.test(value)) return 'Validating Dart code';
  if (/build|preview|compil|saving/.test(value)) return 'Building the preview';
  if (/connect|model|openrouter|harness|route/.test(value)) return 'Connecting to the model';
  return phase.replace(/^\[[^\]]*\]\s*/, '').slice(0, 90);
}

function shortModel(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined;
  return (modelId.split('/').pop() || modelId).replace(/:free$/, '').replace(/-/g, ' ');
}

function toolState(status: ToolActivity['status']): 'input-available' | 'output-available' | 'output-error' {
  if (status === 'done') return 'output-available';
  if (status === 'error') return 'output-error';
  return 'input-available';
}

function validationSummary(validation: { issues: Array<{ severity: string }> } | null) {
  if (!validation) return null;
  const issues = validation.issues ?? [];
  const failed = issues.filter((issue) => issue.severity === 'error').length;
  const skipped = issues.filter((issue) => issue.severity === 'warning').length;
  const total = Math.max(1, issues.length);
  const passed = Math.max(0, total - failed - skipped);
  return { failed, passed, skipped, total };
}

function FileSources({ files, onOpen }: { files: FileActivity[]; onOpen: (path: string) => void }) {
  if (files.length === 0) return null;
  return (
    <Sources>
      <SourcesTrigger count={files.length}>
        <InlineCitation>
          <InlineCitationText>Used {files.length} project sources</InlineCitationText>
        </InlineCitation>
        <ChevronDownIcon className="size-4" />
      </SourcesTrigger>
      <SourcesContent>
        {files.map((file) => (
          <InlineCitation key={file.path}>
            <InlineCitationCard>
              <InlineCitationCardTrigger
                onClick={() => file.action !== 'deleted' && onOpen(file.path)}
                sources={[file.path]}
                title={file.path}
              />
              <InlineCitationCardBody>
                <div className="space-y-2 p-3">
                  <InlineCitationSource
                    description={`${file.action} · ${file.language ?? 'dart'}`}
                    title={file.path}
                  />
                  {file.action !== 'deleted' && (
                    <Button onClick={() => onOpen(file.path)} size="sm" variant="outline">
                      Open file
                    </Button>
                  )}
                </div>
              </InlineCitationCardBody>
            </InlineCitationCard>
          </InlineCitation>
        ))}
      </SourcesContent>
    </Sources>
  );
}

export function RunActivity({
  page = false,
  onOpen,
}: {
  page?: boolean;
  onOpen: (path: string) => void;
}) {
  const run = useActivityStore((state) => state.run);
  const events = useActivityStore((state) => state.events);
  const filesMap = useActivityStore((state) => state.files);
  const plan = useActivityStore((state) => state.plan);
  const validation = useActivityStore((state) => state.validation);
  const [now, setNow] = useState(() => Date.now());

  const running = run?.status === 'running';

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const phases = useMemo(
    () => events.filter((event): event is PhaseActivity => event.kind === 'phase'),
    [events],
  );
  const reasoning = useMemo(
    () => events.filter((event): event is ReasoningActivity => event.kind === 'reasoning').slice(-3),
    [events],
  );
  const tools = useMemo(
    () => events.filter((event): event is ToolActivity => event.kind === 'tool'),
    [events],
  );
  const checkpoints = useMemo(
    () => events.filter((event): event is CheckpointActivity => event.kind === 'checkpoint').slice(-5),
    [events],
  );
  const terminalLines = useMemo(
    () => events
      .filter((event): event is TerminalActivity => event.kind === 'terminal')
      .slice(-200)
      .map((event) => event.text),
    [events],
  );
  const errors = useMemo(
    () => events.filter((event): event is ErrorActivity => event.kind === 'error'),
    [events],
  );
  const files = useMemo(
    () => Object.values(filesMap).sort((left, right) => left.at - right.at),
    [filesMap],
  );
  const summary = useMemo(() => validationSummary(validation), [validation]);

  const pendingFiles = useMemo(() => {
    if (!plan) return [];
    const produced = new Set(Object.keys(filesMap));
    return plan.filesToCreate.filter((path) => !produced.has(path));
  }, [plan, filesMap]);

  const runningTools = useMemo(
    () => tools.filter((tool) => tool.status === 'running'),
    [tools],
  );

  if (!run && events.length === 0) return null;

  const elapsed = run
    ? Math.max(1, Math.floor(((run.endedAt ?? now) - run.startedAt) / 1000))
    : 0;
  const latestPhase = phases.length > 0 ? phases[phases.length - 1].message : run?.phase ?? null;
  const lastError = errors.length > 0 ? errors[errors.length - 1] : null;
  const thoughtSteps = phases.slice(-5).map((phase) => phase.message);

  return (
    <Message className="max-w-full" from="assistant">
      <MessageContent className="w-full">
        <Agent className="w-full">
          <AgentHeader
            model={shortModel(run?.model)}
            name={run ? 'FlutterForge Agent' : 'FlutterForge Build'}
          />
          <AgentContent className="space-y-4">
            {!page && run && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <ThoughtLine
                  collapseOnSettle={false}
                  color="var(--ff-text)"
                  elapsed={elapsed}
                  fontSize={12}
                  glyphColor="var(--ff-primary)"
                  label={humanizePhase(latestPhase)}
                  showTimer
                  steps={thoughtSteps}
                  working={Boolean(running)}
                />
              </div>
            )}

            {phases.length > 0 && (
              <ChainOfThought defaultOpen={page || Boolean(running)}>
                <ChainOfThoughtHeader>
                  Agent timeline · {phases.length} step{phases.length === 1 ? '' : 's'}
                </ChainOfThoughtHeader>
                <ChainOfThoughtContent>
                  {phases.slice(-60).map((phase, index, list) => {
                    const isLast = index === list.length - 1;
                    const status = running && isLast ? 'active' : 'complete';
                    return (
                      <ChainOfThoughtStep
                        description={phase.step ? `Step ${phase.step}${phase.totalSteps ? ` of ${phase.totalSteps}` : ''} · ${phase.phase}` : phase.phase}
                        icon={status === 'active' ? Loader2Icon : CheckCircle2Icon}
                        key={phase.id}
                        label={phase.message}
                        status={status}
                      />
                    );
                  })}
                </ChainOfThoughtContent>
              </ChainOfThought>
            )}

            {reasoning.map((event) => (
              <Reasoning
                defaultOpen={false}
                isStreaming={false}
                key={event.id}
              >
                <ReasoningTrigger />
                <ReasoningContent>{event.text}</ReasoningContent>
              </Reasoning>
            ))}

            {tools.slice(-12).map((tool) => (
              <Tool defaultOpen={tool.status === 'running'} key={tool.id}>
                <ToolHeader
                  state={toolState(tool.status)}
                  title={tool.title}
                  toolName={tool.tool}
                  type="dynamic-tool"
                />
                <ToolContent>
                  <ToolInput input={tool.input ?? {}} />
                  <ToolOutput
                    errorText={tool.status === 'error' ? tool.output : undefined}
                    output={tool.status === 'error' ? undefined : tool.output}
                  />
                </ToolContent>
              </Tool>
            ))}

            {checkpoints.map((checkpoint) => (
              <Checkpoint key={checkpoint.id}>
                <CheckpointIcon />
                <span className="truncate text-xs">{checkpoint.label}</span>
              </Checkpoint>
            ))}

            {plan && (
              <Plan defaultOpen={false}>
                <PlanHeader>
                  <div className="min-w-0">
                    <PlanTitle>{plan.appName}</PlanTitle>
                    <PlanDescription>{plan.appDescription}</PlanDescription>
                  </div>
                  <PlanAction>
                    <PlanTrigger />
                  </PlanAction>
                </PlanHeader>
                <PlanContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{plan.architecture.replaceAll('_', ' ')}</Badge>
                    <Badge variant="outline">{plan.stateManagement.replaceAll('_', ' ')}</Badge>
                    <Badge variant="outline">{plan.screens.length} screens</Badge>
                    <Badge variant="outline">{plan.filesToCreate.length} files</Badge>
                  </div>
                  {plan.screens.length > 0 && (
                    <div className="space-y-1">
                      {plan.screens.slice(0, 8).map((screen) => (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs" key={screen.routePath}>
                          <CircleIcon className="size-2" />
                          <span className="text-foreground">{screen.name}</span>
                          <span className="truncate font-mono">{screen.filePath}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </PlanContent>
              </Plan>
            )}

            {summary && (
              <TestResults summary={summary}>
                <TestResultsHeader>
                  <TestResultsSummary />
                </TestResultsHeader>
                <TestResultsProgress />
              </TestResults>
            )}

            {lastError && (
              <StackTrace
                defaultOpen={false}
                onFilePathClick={(path) => onOpen(path)}
                trace={lastError.stack || lastError.message}
              >
                <StackTraceHeader>
                  <StackTraceError>
                    <StackTraceErrorType />
                    <StackTraceErrorMessage />
                  </StackTraceError>
                  <StackTraceActions>
                    <StackTraceCopyButton />
                    <StackTraceExpandButton />
                  </StackTraceActions>
                </StackTraceHeader>
                <StackTraceContent>
                  <pre className="whitespace-pre-wrap p-3 font-mono text-xs">{lastError.stack || lastError.message}</pre>
                </StackTraceContent>
              </StackTrace>
            )}

            {files.length > 0 && <FileSources files={files} onOpen={onOpen} />}

            {running && (runningTools.length > 0 || pendingFiles.length > 0) && (
              <Queue>
                <QueueSection defaultOpen>
                  <QueueSectionTrigger>
                    <QueueSectionLabel
                      count={runningTools.length + pendingFiles.length}
                      label="in progress"
                    />
                  </QueueSectionTrigger>
                  <QueueSectionContent>
                    <QueueList>
                      {runningTools.map((tool) => (
                        <QueueItem key={tool.id}>
                          <div className="flex items-start gap-2">
                            <QueueItemIndicator />
                            <div className="min-w-0 flex-1">
                              <QueueItemContent>{tool.title}</QueueItemContent>
                              <QueueItemDescription>{tool.tool}</QueueItemDescription>
                            </div>
                          </div>
                        </QueueItem>
                      ))}
                      {pendingFiles.slice(0, 20).map((path) => (
                        <QueueItem key={path}>
                          <div className="flex items-start gap-2">
                            <QueueItemIndicator />
                            <div className="min-w-0 flex-1">
                              <QueueItemContent className="font-mono text-xs">{path}</QueueItemContent>
                              <QueueItemDescription>Queued file</QueueItemDescription>
                            </div>
                          </div>
                        </QueueItem>
                      ))}
                    </QueueList>
                  </QueueSectionContent>
                </QueueSection>
              </Queue>
            )}

            {terminalLines.length > 0 && (
              <Task defaultOpen={page}>
                <TaskTrigger title={`Live logs · ${terminalLines.length} lines`} />
                <TaskContent>
                  <Terminal className="max-h-80" isStreaming={Boolean(running)} output={terminalLines.join('\n')}>
                    <TerminalHeader>
                      <TerminalTitle>Agent output</TerminalTitle>
                      <div className="flex items-center gap-1">
                        <TerminalStatus />
                        <TerminalActions>
                          <TerminalCopyButton />
                        </TerminalActions>
                      </div>
                    </TerminalHeader>
                    <TerminalContent className="max-h-64" />
                  </Terminal>
                </TaskContent>
              </Task>
            )}
          </AgentContent>
        </Agent>
      </MessageContent>
    </Message>
  );
}
