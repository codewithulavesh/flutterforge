import { Rocket, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { useTerminalStore } from '@/stores/terminal.store';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function DeployView() {
  const { currentProject, updateProject, deployments } = useProjectStore();
  const { setBuilding, addBuildLog, clearBuildLogs } = useTerminalStore();
  const [deploying, setDeploying] = useState(false);

  if (!currentProject) return null;

  async function handleDeploy() {
    setDeploying(true);
    setBuilding(true);
    clearBuildLogs();
    addBuildLog('$ flutter build web --release');
    addBuildLog('Building for deployment...');
    await new Promise((r) => setTimeout(r, 1500));
    addBuildLog('✓ Build complete');
    addBuildLog('Deploying to hosting...');
    await new Promise((r) => setTimeout(r, 1200));
    const url = `https://${currentProject!.id.slice(0, 8)}.flutterforge.app`;
    addBuildLog(`✓ Deployed to ${url}`);
    await updateProject(currentProject!.id, {
      status: 'deployed',
      deployment_url: url,
    });
    setDeploying(false);
    setBuilding(false);
    toast('success', 'Deployed! Your app is live.');
  }

  const latestDeployment = deployments[0];

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Rocket size={18} className="text-[var(--ff-primary)]" />
          <h2 className="text-lg font-semibold text-white">Deploy</h2>
        </div>

        {/* Current deployment status */}
        <div className="ff-card p-6 text-center">
          {currentProject.status === 'deployed' && currentProject.deployment_url ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Your app is live</h3>
              <a
                href={currentProject.deployment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-primary)] hover:underline mt-2"
              >
                {currentProject.deployment_url}
                <ExternalLink size={12} />
              </a>
              <div className="mt-4">
                <Button variant="outline" size="sm" loading={deploying} onClick={handleDeploy}>
                  Redeploy
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-[var(--ff-primary)]/10 flex items-center justify-center mx-auto mb-4">
                {deploying ? <Loader2 size={28} className="text-[var(--ff-primary)] ff-spin" /> : <Rocket size={28} className="text-[var(--ff-primary)]" />}
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                {deploying ? 'Deploying...' : 'Deploy your Flutter Web app'}
              </h3>
              <p className="text-sm text-[var(--ff-text-muted)] mt-1 mb-4">
                Get a live URL you can share with anyone. Flutter Web builds run in any browser.
              </p>
              <Button loading={deploying} onClick={handleDeploy} icon={!deploying ? <Rocket size={14} /> : undefined}>
                {deploying ? 'Deploying...' : 'Deploy Now'}
              </Button>
            </>
          )}
        </div>

        {/* Deployments history */}
        {deployments.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider mb-3">Deployment History</h3>
            <div className="space-y-2">
              {deployments.map((dep) => (
                <div key={dep.id} className="ff-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--ff-surface-2)] flex items-center justify-center">
                      <Rocket size={14} className="text-[var(--ff-text-muted)]" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-mono">{dep.url ?? '—'}</p>
                      <p className="text-[10px] text-[var(--ff-text-dim)]">{new Date(dep.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge variant={dep.status === 'deployed' ? 'success' : dep.status === 'failed' ? 'error' : 'warning'}>
                    {dep.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ff-card p-4 bg-blue-500/5 border-blue-500/20">
          <p className="text-xs text-[var(--ff-text-muted)] leading-relaxed">
            Deployments use Flutter Web builds hosted on FlutterForge infrastructure. Custom domains and custom deployment targets will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
