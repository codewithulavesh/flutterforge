import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

type LegalDocument = 'terms' | 'privacy' | 'permissions';

const DOCUMENTS: Record<LegalDocument, { title: string; intro: string; sections: { title: string; body: string }[] }> = {
  terms: {
    title: 'Terms of use',
    intro: 'Draft project terms for FlutterForge, an academic software project by OnUs devs. These terms have not been reviewed by legal counsel and are not ready to be treated as a final commercial agreement.',
    sections: [
      { title: 'Using the software', body: 'Use FlutterForge lawfully and do not use it to create, distribute, or operate content or software that violates another person’s rights or applicable rules. You are responsible for the prompts, source files, credentials, and other material you submit.' },
      { title: 'Generated output', body: 'AI-generated code can be incomplete, inaccurate, insecure, or subject to third-party package and model terms. Review, test, and secure all generated code before using it. Check the licenses and obligations of dependencies and services included in an exported project.' },
      { title: 'Third-party services and requirements', body: 'Sign-in and cloud project records use the configured Supabase service. AI requests may be processed by the configured DeepSeek account/API or OpenRouter route. Preview compilation uses the configured local or remote harness service. Those services have their own terms, availability, and policies.' },
      { title: 'Availability and responsibility', body: 'The software is provided as an academic project and may change or be unavailable. No support service, service-level commitment, or commercial warranty is represented by this draft. Keep independent backups of important work.' },
      { title: 'Ownership and final review', body: 'This draft does not assign ownership of user-provided material or generated output. Applicable rights can depend on the material, model, dependencies, and jurisdiction; obtain appropriate advice before relying on generated work commercially.' },
    ],
  },
  privacy: {
    title: 'Privacy notice',
    intro: 'This draft describes data flows visible in the current FlutterForge code. It is not a complete legal privacy notice: the deployment operator, retention configuration, and applicable jurisdiction must be confirmed before release.',
    sections: [
      { title: 'Account information', body: 'When Supabase authentication is configured, sign-up and sign-in use an email address and account credentials. A full name may be submitted as profile metadata. Authentication sessions are persisted in the app’s local storage and authentication data is handled by the configured Supabase project.' },
      { title: 'Project and workspace data', body: 'The app stores project metadata, source files, chat messages, dependencies, version snapshots, build records, and deployment records through its configured Supabase project. The local harness can also read and write project files in its workspace. Local storage and retention depend on the installation and server configuration.' },
      { title: 'AI processing', body: 'Prompts and relevant project context are sent from the local harness to the configured model route. The code supports a signed-in DeepSeek account, a DeepSeek API key, or an OpenRouter route. This means AI requests and included context may leave the device and be processed under the selected provider’s terms and privacy practices.' },
      { title: 'Preview builds', body: 'When a preview is built, project source files and configured Supabase build values are sent to the preview compiler. The default desktop setup uses the local harness; deployments can configure a separate preview API. The operator and retention period of a remote service must be checked for that deployment.' },
      { title: 'Storage, deletion, and contact', body: 'The app stores theme and authentication preferences locally. Project removal is available in the product, but deletion of related records, backups, or copies already processed by third-party providers depends on the configured services. No public support or privacy email has been supplied; users should contact the distributor or project owner through the channel used to obtain the software.' },
      { title: 'Tracking and children', body: 'The repository does not establish a complete analytics, advertising, retention, or age policy. Those matters require confirmation by the operators before this notice is used as a final policy.' },
    ],
  },
  permissions: {
    title: 'Permissions and device access',
    intro: 'FlutterForge is designed to work with local project files and a local development toolchain. The desktop app does not grant Electron web permission requests. The generated app preview is separate from the FlutterForge interface.',
    sections: [
      { title: 'Camera, microphone, and location', body: 'FlutterForge’s desktop Electron shell rejects web permission requests. The preview iframe no longer declares camera, microphone, or geolocation capabilities. Generated apps may contain code that requests these permissions when built and run independently; inspect that code and the target platform’s permission prompts.' },
      { title: 'Files and folders', body: 'The desktop bridge exposes explicit folder selection and open/reveal actions. The local harness and Flutter tools need access to the project workspace to read, generate, compile, and export files. This is not unrestricted filesystem access from the renderer; desktop operations are exposed through a limited IPC bridge.' },
      { title: 'Network access', body: 'Network access is used for Supabase authentication and project data, configured model-provider requests, and preview/compiler APIs. The actual endpoints depend on the environment and deployment configuration.' },
      { title: 'Clipboard and browser storage', body: 'Some user-triggered interface actions copy text to the clipboard. The app uses browser local storage for authentication/theme state and session storage for an in-progress landing-page prompt. These are browser or app-origin storage features, not camera, microphone, or location permissions.' },
      { title: 'Preview sandbox', body: 'The embedded Flutter web preview runs in a sandboxed iframe. It is allowed to run scripts and use selected form, popup, download, and modal behaviors required by the preview. Do not treat generated preview code as trusted; only open projects you intend to run.' },
    ],
  },
};

export function LegalInfoPage() {
  const { document } = useParams<{ document: string }>();
  const page = document && document in DOCUMENTS ? DOCUMENTS[document as LegalDocument] : null;

  if (!page) {
    return (
      <main className="min-h-screen bg-[var(--ff-bg)] px-6 py-20 text-center text-[var(--ff-text)]">
        <h1 className="text-xl font-semibold">Information page not found</h1>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--ff-brand-teal)]"><ArrowLeft size={14} /> Back to FlutterForge</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ff-bg)] px-4 py-8 text-[var(--ff-text)] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-[var(--ff-text-muted)] transition-colors hover:text-[var(--ff-text)]">
          <ArrowLeft size={14} /> FlutterForge
        </Link>
        <header className="mt-10 border-b border-[var(--ff-border)] pb-8">
          <Link to="/" className="inline-flex items-center gap-2"><BrandLogo size={28} /><span className="text-xs font-semibold">OnUs devs · FlutterForge</span></Link>
          <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">{page.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ff-text-muted)]">{page.intro}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            <ShieldCheck size={14} /> Draft for project review · Updated October 30, 2026
          </div>
        </header>

        <div className="divide-y divide-[var(--ff-border)]">
          {page.sections.map((section, index) => (
            <section key={section.title} className="grid gap-3 py-6 sm:grid-cols-[180px_1fr] sm:gap-8">
              <h2 className="text-sm font-semibold">{String(index + 1).padStart(2, '0')} <span className="ml-2">{section.title}</span></h2>
              <p className="text-[13px] leading-7 text-[var(--ff-text-muted)]">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="mt-8 border-t border-[var(--ff-border)] pt-5 text-[11px] leading-relaxed text-[var(--ff-text-dim)]">
          Project team: Shradha Takkekar, Srushti Churamari, Vijeta Kotnikallamath, and Ulavayya Karaguppi. Guided by Mrs. Sahana Bisalapur. S. G. Balekundri Institute of Technology, Belagavi · Visvesvaraya Technological University · 2026–2027.
        </footer>
      </div>
    </main>
  );
}