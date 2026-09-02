import { useState } from 'react';
import { Plug, Plus, Trash2, ExternalLink, CheckCircle2, XCircle, Settings, Database, Shield, HardDrive, Brain, CreditCard, BarChart3, MessageSquare, MoreHorizontal } from 'lucide-react';
import type { Connector, ConnectorStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  database: <Database size={14} />,
  auth: <Shield size={14} />,
  storage: <HardDrive size={14} />,
  ai: <Brain size={14} />,
  payment: <CreditCard size={14} />,
  analytics: <BarChart3 size={14} />,
  messaging: <MessageSquare size={14} />,
  other: <MoreHorizontal size={14} />,
};

const AVAILABLE_CONNECTORS: (Omit<Connector, 'status'> & { fields: Connector['fields'] })[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with Postgres, Auth, Edge Functions, and Realtime',
    icon: 'Database',
    color: '#3ECF8E',
    category: 'database',
    docsUrl: 'https://supabase.com/docs',
    fields: [
      { key: 'url', label: 'Project URL', type: 'url', placeholder: 'https://xyzcompany.supabase.co', required: true, value: '' },
      { key: 'anon_key', label: 'Anon Key', type: 'password', placeholder: 'eyJhbGciOiJIUzI1NiIs...', required: true, value: '' },
      { key: 'service_role_key', label: 'Service Role Key (optional)', type: 'password', placeholder: 'eyJhbGciOiJIUzI1NiIs...', required: false, value: '' },
    ],
  },
  {
    id: 'firebase',
    name: 'Firebase',
    description: "Google's app development platform with Authentication, Firestore, and Cloud Functions",
    icon: 'Flame',
    color: '#FFCA28',
    category: 'database',
    docsUrl: 'https://firebase.google.com/docs',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIzaSy...', required: true, value: '' },
      { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'my-project-id', required: true, value: '' },
      { key: 'auth_domain', label: 'Auth Domain', type: 'text', placeholder: 'my-project.firebaseapp.com', required: false, value: '' },
      { key: 'storage_bucket', label: 'Storage Bucket', type: 'text', placeholder: 'my-project.appspot.com', required: false, value: '' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, DALL-E, and Whisper APIs for AI-powered features',
    icon: 'Brain',
    color: '#10A37F',
    category: 'ai',
    docsUrl: 'https://platform.openai.com/docs',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true, value: '' },
      { key: 'org_id', label: 'Organization ID (optional)', type: 'text', placeholder: 'org-...', required: false, value: '' },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing for internet businesses',
    icon: 'CreditCard',
    color: '#635BFF',
    category: 'payment',
    docsUrl: 'https://stripe.com/docs',
    fields: [
      { key: 'publishable_key', label: 'Publishable Key', type: 'password', placeholder: 'pk_live_...', required: true, value: '' },
      { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true, value: '' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...', required: false, value: '' },
    ],
  },
  {
    id: 'google_maps',
    name: 'Google Maps',
    description: 'Maps, Geocoding, and Places APIs',
    icon: 'MapPin',
    color: '#4285F4',
    category: 'other',
    docsUrl: 'https://developers.google.com/maps',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIzaSy...', required: true, value: '' },
    ],
  },
  {
    id: 'algolia',
    name: 'Algolia',
    description: 'Hosted search API with instant results and typo-tolerance',
    icon: 'Search',
    color: '#003DFF',
    category: 'other',
    docsUrl: 'https://www.algolia.com/doc/',
    fields: [
      { key: 'app_id', label: 'Application ID', type: 'text', placeholder: '...', required: true, value: '' },
      { key: 'search_api_key', label: 'Search API Key', type: 'password', placeholder: '...', required: true, value: '' },
      { key: 'admin_api_key', label: 'Admin API Key', type: 'password', placeholder: '...', required: false, value: '' },
    ],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, Voice, and Video communications APIs',
    icon: 'Phone',
    color: '#F22F46',
    category: 'messaging',
    docsUrl: 'https://www.twilio.com/docs',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true, value: '' },
      { key: 'auth_token', label: 'Auth Token', type: 'password', placeholder: '...', required: true, value: '' },
      { key: 'phone_number', label: 'Twilio Phone Number', type: 'text', placeholder: '+1234567890', required: false, value: '' },
    ],
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Product analytics and user behavior tracking',
    icon: 'BarChart3',
    color: '#1C71FF',
    category: 'analytics',
    docsUrl: 'https://www.docs.developers.amplitude.com',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: '...', required: true, value: '' },
      { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: '...', required: false, value: '' },
    ],
  },
];

export function ConnectorsView() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const connectedCount = connectors.filter((c) => c.status === 'connected').length;

  const availableToAdd = AVAILABLE_CONNECTORS.filter((ac) =>
    !connectors.some((c) => c.id === ac.id) &&
    (ac.name.toLowerCase().includes(search.toLowerCase()) ||
     ac.description.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === 'all' || ac.category === categoryFilter)
  );

  const categories = ['all', ...new Set(AVAILABLE_CONNECTORS.map((c) => c.category))];

  function handleAddConnector(connector: Omit<Connector, 'status'> & { fields: Connector['fields'] }) {
    const existing = connectors.find((c) => c.id === connector.id);
    if (existing) {
      toast('error', `${connector.name} is already added`);
      return;
    }
    const newConnector: Connector = {
      ...connector,
      status: 'configuring',
      fields: connector.fields.map((f) => ({ ...f, value: '' })),
    };
    setConnectors([...connectors, newConnector]);
    setSelectedConnector(newConnector);
    setAddOpen(false);
    setConfigOpen(true);
    toast('success', `Added ${connector.name} — configure it below`);
  }

  function handleRemoveConnector(id: string) {
    const connector = connectors.find((c) => c.id === id);
    setConnectors(connectors.filter((c) => c.id !== id));
    toast('success', `Removed ${connector?.name ?? 'connector'}`);
  }

  function handleUpdateField(connectorId: string, fieldKey: string, value: string) {
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === connectorId
          ? { ...c, fields: c.fields.map((f) => (f.key === fieldKey ? { ...f, value } : f)) }
          : c
      )
    );
  }

  function handleTestConnection(connectorId: string) {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) return;

    const requiredFields = connector.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => !f.value.trim());

    if (missingFields.length > 0) {
      toast('error', `Missing required fields: ${missingFields.map((f) => f.label).join(', ')}`);
      return;
    }

    setConnectors((prev) =>
      prev.map((c) => (c.id === connectorId ? { ...c, status: 'connected' as ConnectorStatus, connectedAt: new Date().toISOString() } : c))
    );
    toast('success', `${connector.name} connected successfully!`);
    setConfigOpen(false);
  }

  function handleDisconnect(connectorId: string) {
    setConnectors((prev) =>
      prev.map((c) => (c.id === connectorId ? { ...c, status: 'disconnected' as ConnectorStatus, connectedAt: undefined } : c))
    );
    toast('success', 'Disconnected');
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ff-bg)] overflow-y-auto ff-scrollbar">
      <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plug size={18} className="text-[var(--ff-primary)]" />
            <h2 className="text-lg font-semibold text-white">Connectors</h2>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Add Connector
          </Button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="ff-card px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-[var(--ff-text-muted)]">
              <span className="font-semibold text-white">{connectedCount}</span> connected
            </span>
          </div>
          <div className="ff-card px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-xs text-[var(--ff-text-muted)]">
              <span className="font-semibold text-white">{connectors.filter((c) => c.status === 'configuring').length}</span> configuring
            </span>
          </div>
          <div className="ff-card px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--ff-text-dim)]" />
            <span className="text-xs text-[var(--ff-text-muted)]">
              <span className="font-semibold text-white">{connectors.filter((c) => c.status === 'disconnected').length}</span> disconnected
            </span>
          </div>
        </div>

        {/* Active connectors */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider mb-3">
            Active ({connectors.length})
          </h3>
          {connectors.length === 0 ? (
            <div className="ff-card p-6 sm:p-8 text-center">
              <Plug size={28} className="text-[var(--ff-text-dim)] mx-auto mb-2" />
              <p className="text-sm text-[var(--ff-text-muted)]">No connectors added yet</p>
              <p className="text-xs text-[var(--ff-text-dim)] mt-1">Add services like Supabase, Firebase, or OpenAI to integrate with your app</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connectors.map((connector) => (
                <div key={connector.id} className="ff-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${connector.color}15` }}
                    >
                      <span style={{ color: connector.color }}>{CATEGORY_ICONS[connector.category]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{connector.name}</p>
                      <p className="text-xs text-[var(--ff-text-dim)] truncate">{connector.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        connector.status === 'connected'
                          ? 'success'
                          : connector.status === 'configuring'
                          ? 'warning'
                          : connector.status === 'error'
                          ? 'error'
                          : 'default'
                      }
                    >
                      {connector.status === 'connected' && <CheckCircle2 size={10} />}
                      {connector.status === 'error' && <XCircle size={10} />}
                      {connector.status}
                    </Badge>
                    <button
                      onClick={() => {
                        setSelectedConnector(connector);
                        setConfigOpen(true);
                      }}
                      className="p-1.5 rounded text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all"
                      title="Configure"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      onClick={() => handleRemoveConnector(connector.id)}
                      className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available connectors */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-[var(--ff-text-dim)] uppercase tracking-wider">Available Connectors</h3>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="ff-input px-2 py-1 text-xs flex-1 sm:flex-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search connectors..."
                className="ff-input px-2 py-1 text-xs flex-1 sm:flex-none sm:w-40"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableToAdd.map((connector) => {
              const isAdded = connectors.some((c) => c.id === connector.id);
              return (
                <div key={connector.id} className="ff-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${connector.color}15` }}
                    >
                      <span style={{ color: connector.color }}>{CATEGORY_ICONS[connector.category]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{connector.name}</p>
                        <span className="text-[10px] text-[var(--ff-text-dim)] capitalize">{connector.category}</span>
                      </div>
                      <p className="text-xs text-[var(--ff-text-muted)] truncate">{connector.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {connector.docsUrl && (
                      <a
                        href={connector.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded text-[var(--ff-text-dim)] hover:text-white hover:bg-[var(--ff-surface-2)] transition-all"
                        title="Documentation"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {isAdded ? (
                      <Badge variant="success">Added</Badge>
                    ) : (
                      <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => handleAddConnector(connector)}>
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {availableToAdd.length === 0 && (
              <div className="col-span-1 sm:col-span-2 ff-card p-6 text-center">
                <p className="text-sm text-[var(--ff-text-muted)]">No connectors match your search</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add connector selection modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Connector" size="sm">
        <div className="space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connectors..."
            className="ff-input w-full px-2.5 py-1.5 text-xs"
            autoFocus
          />
          <div className="space-y-0.5 max-h-60 overflow-y-auto ff-scrollbar">
            {AVAILABLE_CONNECTORS.filter(
              (ac) =>
                !connectors.some((c) => c.id === ac.id) &&
                (ac.name.toLowerCase().includes(search.toLowerCase()) ||
                 ac.description.toLowerCase().includes(search.toLowerCase()))
            ).map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleAddConnector(connector)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--ff-surface-2)] transition-colors text-left"
              >
                <div
                  className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${connector.color}15` }}
                >
                  <span style={{ color: connector.color }}>{CATEGORY_ICONS[connector.category]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{connector.name}</p>
                  <p className="text-[10px] text-[var(--ff-text-muted)] truncate">{connector.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Configure connector modal */}
      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title={selectedConnector ? `Configure ${selectedConnector.name}` : 'Configure'}
        size="sm"
      >
        {selectedConnector && (
          <div className="space-y-3">
            {selectedConnector.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[11px] font-medium text-[var(--ff-text-dim)] mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
                  value={field.value}
                  onChange={(e) => handleUpdateField(selectedConnector.id, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="ff-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 pt-1">
              {selectedConnector.docsUrl ? (
                <a
                  href={selectedConnector.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[var(--ff-primary)] hover:underline"
                >
                  <ExternalLink size={10} />
                  Docs
                </a>
              ) : <div />}
              <div className="flex gap-1.5 ml-auto">
                {selectedConnector.status === 'connected' && (
                  <button
                    onClick={() => {
                      handleDisconnect(selectedConnector.id);
                      setConfigOpen(false);
                    }}
                    className="px-2 py-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  onClick={() => setConfigOpen(false)}
                  className="px-2.5 py-1 text-[11px] text-[var(--ff-text-muted)] hover:text-white rounded hover:bg-[var(--ff-surface-2)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTestConnection(selectedConnector.id)}
                  className="px-3 py-1 text-[11px] font-medium text-white bg-[var(--ff-primary)] hover:bg-[var(--ff-primary)]/80 rounded transition-colors"
                >
                  {selectedConnector.status === 'connected' ? 'Update' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
