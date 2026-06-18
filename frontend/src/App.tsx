import { useState, useEffect, useRef } from 'react';
import { 
  SignedIn, 
  SignedOut, 
  SignIn, 
  SignUp, 
  UserButton, 
  useUser 
} from '@clerk/clerk-react';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  Plus, 
  Search, 
  Shield, 
  Users, 
  Layers,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  Lock,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import UserSync from './components/UserSync';
import { useApi } from './hooks/useApi';
import UploadZone from './components/UploadZone';
import PDFViewerModal from './components/PDFViewerModal';
import PublicSign from './components/PublicSign';

export default function App() {
  const { user } = useUser();
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin');
  const [searchQuery, setSearchQuery] = useState('');
  const api = useApi();

  // Simple state-based path router fallback for public signer invites
  const pathname = window.location.pathname;
  const publicSignMatch = pathname.match(/^\/public\/sign\/(.+)$/);
  if (publicSignMatch) {
    const token = publicSignMatch[1];
    return <PublicSign token={token} />;
  }

  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [sharingDoc, setSharingDoc] = useState<any | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isUploadingButton, setIsUploadingButton] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'signed' | 'rejected'>('all');
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  const fetchUserDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await api.getDocuments();
      if (res.success) {
        setDocuments(res.data);
      }
    } catch (error) {
      console.error('[App] Failed to fetch documents:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleHeaderFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('Invalid file format. Only PDF documents are allowed.');
        return;
      }

      setIsUploadingButton(true);
      try {
        const response = await api.uploadDocument(file);
        console.log('[Header Upload] Successful:', response.data);
        alert(`"${file.name}" uploaded successfully!`);
        fetchUserDocuments(); // Refresh document list
      } catch (error: any) {
        console.error('[Header Upload] failed:', error);
        alert(error.response?.data?.error?.message || error.message || 'Failed to upload document.');
      } finally {
        setIsUploadingButton(false);
        if (headerFileInputRef.current) {
          headerFileInputRef.current.value = ''; // Reset file input
        }
      }
    }
  };

  const triggerHeaderFileSelect = () => {
    if (!isUploadingButton && headerFileInputRef.current) {
      headerFileInputRef.current.click();
    }
  };

  const handleShareDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingDoc || !signerName.trim() || !signerEmail.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    setIsSharing(true);
    try {
      const response = await api.shareDocument(sharingDoc._id, signerEmail, signerName);
      if (response.success) {
        alert(`Invitation sent successfully to ${signerName}!`);
        setSharingDoc(null);
        setSignerName('');
        setSignerEmail('');
        fetchUserDocuments();
      }
    } catch (error: any) {
      console.error('[Share Document] failed:', error);
      alert(error.response?.data?.error?.message || error.message || 'Failed to share document.');
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchUserDocuments();
    }
  }, [user?.id]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Background Decorative Glow Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full glow-bg-primary pointer-events-none opacity-40 animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full glow-bg-secondary pointer-events-none opacity-30"></div>

      {/* ==================== SIGNED OUT VIEW ==================== */}
      <SignedOut>
        {/* Header */}
        <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-xl shadow-lg shadow-brand-500/20">
              <FileCheck2 className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent">
              SignFlow
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAuthView(authView === 'signin' ? 'signup' : 'signin')}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              {authView === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
            <a 
              href="#features" 
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-slate-300"
            >
              Documentation
            </a>
          </div>
        </header>

        {/* Hero & Auth Portal */}
        <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full px-6 py-12 lg:py-20 flex flex-col lg:flex-row items-center justify-between gap-12">
          
          {/* Hero text & Product highlights */}
          <div className="flex-1 text-left max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-medium mb-6">
              <Lock className="w-3.5 h-3.5" />
              Enterprise-Grade & Legally Compliant
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              The secure way to <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-indigo-400 bg-clip-text text-transparent">sign</span> documents.
            </h1>
            <p className="text-slate-400 text-base md:text-lg mb-8 leading-relaxed">
              Accelerate approvals and streamline agreements with SignFlow. Seamlesly request legal signatures, drag-and-drop form fields, and trace document audit trails in real-time.
            </p>

            {/* Benefit cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl glass-card border-slate-800 flex gap-3">
                <div className="p-2 h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-200">Cryptographically Sealed</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Tamper-evident hashing protects every contract.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl glass-card border-slate-800 flex gap-3">
                <div className="p-2 h-10 w-10 flex items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-200">Multi-party Signatures</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Define custom workflows and sequential signers.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl glass-card border-slate-800 flex gap-3">
                <div className="p-2 h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-200">Audit Logs & History</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Track sign actions, IP logs, and digital receipts.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl glass-card border-slate-800 flex gap-3">
                <div className="p-2 h-10 w-10 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-200">Drag-and-Drop Editor</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Place signatures, fields, and text areas instantly.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Clerk Auth Centered Wrapper */}
          <div className="flex-1 flex justify-center lg:justify-end w-full">
            <div className="relative p-6 rounded-2xl glass-card glass-card-hover border-slate-800/80 shadow-2xl max-w-md w-full flex flex-col items-center">
              <div className="absolute -top-3 left-6 px-3 py-0.5 bg-gradient-to-r from-brand-600 to-indigo-600 text-[10px] font-bold tracking-widest uppercase rounded-full text-white">
                SaaS Portal
              </div>
              
              <div className="text-center mt-3 mb-6">
                <h3 className="text-xl font-bold text-white">
                  {authView === 'signin' ? 'Welcome Back' : 'Create Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Access your secure workspace and sign flow pipelines.
                </p>
              </div>

              {/* Clerk Sign In / Sign Up container */}
              <div className="w-full flex justify-center">
                {authView === 'signin' ? (
                  <SignIn 
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        card: "bg-transparent shadow-none border-none p-0 w-full",
                        headerTitle: "hidden",
                        headerSubtitle: "hidden",
                        socialButtonsBlockButton: "bg-slate-900 border border-slate-850 hover:bg-slate-800 text-white rounded-xl",
                        formButtonPrimary: "bg-brand-650 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl",
                        formFieldInput: "bg-slate-900 border border-slate-800 text-white rounded-xl focus:border-brand-500",
                        footerActionText: "text-slate-400 text-xs",
                        footerActionLink: "text-brand-400 hover:text-brand-300 text-xs font-semibold"
                      }
                    }} 
                  />
                ) : (
                  <SignUp 
                    appearance={{
                      elements: {
                        rootBox: "w-full",
                        card: "bg-transparent shadow-none border-none p-0 w-full",
                        headerTitle: "hidden",
                        headerSubtitle: "hidden",
                        socialButtonsBlockButton: "bg-slate-900 border border-slate-850 hover:bg-slate-850 text-white rounded-xl",
                        formButtonPrimary: "bg-brand-650 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl",
                        formFieldInput: "bg-slate-900 border border-slate-800 text-white rounded-xl focus:border-brand-500",
                        footerActionText: "text-slate-400 text-xs",
                        footerActionLink: "text-brand-400 hover:text-brand-300 text-xs font-semibold"
                      }
                    }} 
                  />
                )}
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setAuthView(authView === 'signin' ? 'signup' : 'signin')}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors inline-flex items-center gap-1"
                >
                  {authView === 'signin' ? "Create an account instead" : "Sign in to existing account"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 w-full px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-500 bg-slate-950/20">
          <p>© 2026 SignFlow Inc. All rights reserved. Secure SaaS Document Signing platform.</p>
        </footer>
      </SignedOut>

      {/* ==================== SIGNED IN VIEW ==================== */}
      <SignedIn>
        <UserSync />
        <div className="flex-1 flex flex-col relative z-10 w-full px-4 md:px-8 py-6 mx-auto max-w-7xl">
          {/* Top Brand & Actions Header */}
          <header className="flex items-center justify-between gap-4 pb-6 border-b border-slate-900">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-gradient-to-tr from-brand-650 to-brand-450 rounded-lg shadow-md shadow-brand-500/10">
                <FileCheck2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">SignFlow</span>
            </div>

            {/* Header Actions & Profile */}
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                ref={headerFileInputRef} 
                className="hidden" 
                accept="application/pdf" 
                onChange={handleHeaderFileChange} 
              />

              <button 
                onClick={triggerHeaderFileSelect}
                disabled={isUploadingButton}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/10 hover:shadow-brand-500/20 border border-brand-550 transition-all disabled:opacity-50"
              >
                {isUploadingButton ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Upload & Sign
                  </>
                )}
              </button>

              <div className="pl-3 border-l border-slate-900 flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                    {user?.fullName || 'User Account'}
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content View */}
          <main className="flex-1 flex flex-col min-w-0 mt-8">
            {/* Welcome banner */}
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Welcome back, {user?.firstName || 'User'}!
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage and monitor your digital sign flows and pending legal approvals.
              </p>
            </div>
            {/* Key Metrics Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-5 rounded-2xl glass-card border-slate-900 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Total Documents</p>
                  <h3 className="text-2xl font-extrabold text-white mt-1.5">{documents.length}</h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium mt-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Real-time upload counter
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 rounded-2xl glass-card border-slate-900 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Completed</p>
                  <h3 className="text-2xl font-extrabold text-white mt-1.5">
                    {documents.filter(doc => doc.status === 'signed').length}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium mt-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Signed agreements
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="p-5 rounded-2xl glass-card border-slate-900 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">Pending Actions</p>
                  <h3 className="text-2xl font-extrabold text-white mt-1.5">
                    {documents.filter(doc => doc.status === 'pending').length}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    Pending signatures
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-amber-450">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </section>

            {/* Quick Upload Sandbox */}
            <section className="mt-6">
              <UploadZone onUploadSuccess={fetchUserDocuments} />
            </section>

            {/* Documents List & Filters */}
            <section className="mt-8 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h3 className="text-lg font-bold text-white">Recent Documents</h3>
                
                {/* Search Bar */}
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                  <input 
                    type="text" 
                    placeholder="Search documents..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-850 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Glassmorphic Tabs Bar Selection */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-slate-850 backdrop-blur-md self-start mb-5 w-full sm:w-auto">
                {[
                  { id: 'all', label: 'All Documents' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'signed', label: 'Signed' },
                  { id: 'rejected', label: 'Rejected' }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                        isActive
                          ? 'bg-brand-500/10 border border-brand-500/20 text-brand-400 shadow-sm'
                          : 'text-slate-400 hover:text-slate-250 border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Document List Table */}
              <div className="rounded-2xl border border-slate-900 overflow-hidden bg-slate-950">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/40 border-b border-slate-900 text-[11px] font-bold tracking-widest text-slate-450 uppercase">
                        <th className="py-3 px-4">Document Title</th>
                        <th className="py-3 px-4">Date Uploaded</th>
                        <th className="py-3 px-4">Signers</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                      {isLoadingDocs ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 animate-pulse">
                            Loading documents...
                          </td>
                        </tr>
                      ) : documents
                        .filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .filter(doc => activeTab === 'all' || doc.status === activeTab)
                        .map((doc) => (
                          <tr key={doc._id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="py-3.5 px-4 font-medium text-slate-200">
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-4.5 h-4.5 text-brand-400 animate-pulse-slow" />
                                <div>
                                  <p>{doc.title}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">PDF Document</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {new Date(doc.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                                Self (Owner)
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {doc.status === 'signed' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  Signed
                                </span>
                              ) : doc.status === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                  Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button 
                                  onClick={() => setSharingDoc(doc)}
                                  className="text-xs font-semibold text-purple-400 hover:text-purple-350 transition-colors"
                                >
                                  Share
                                </button>
                                <button 
                                  onClick={() => setSelectedDoc(doc)}
                                  className="text-xs font-semibold text-brand-400 hover:text-brand-350 transition-colors"
                                >
                                  Open
                                </button>
                              </div>
                            </td>
                          </tr>
                      ))}
                      {!isLoadingDocs && documents
                        .filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .filter(doc => activeTab === 'all' || doc.status === activeTab).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No documents found under this view. Upload a PDF above to get started!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </main>
        </div>
      </SignedIn>



      {/* PDF Document Preview Modal */}
      {selectedDoc && (
        <PDFViewerModal 
          document={selectedDoc} 
          onClose={() => setSelectedDoc(null)} 
          onFinalize={fetchUserDocuments}
        />
      )}

      {/* Glassmorphic Share Modal */}
      {sharingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-md">
            {/* Top title */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <span>Request Signature</span>
              </h3>
              <button
                onClick={() => {
                  setSharingDoc(null);
                  setSignerName('');
                  setSignerEmail('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document details brief */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 mb-6 flex items-center gap-3">
              <FileText className="w-8 h-8 text-brand-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{sharingDoc.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">External secure invitation link</p>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleShareDocument} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Signer's Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter signer's name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-850 text-slate-200 focus:border-brand-500 transition-colors placeholder:text-slate-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Signer's Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-850 text-slate-200 focus:border-brand-500 transition-colors placeholder:text-slate-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSharingDoc(null);
                    setSignerName('');
                    setSignerEmail('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-850 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSharing}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold border border-brand-550 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-brand-600/10"
                >
                  {isSharing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <span>Send Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
