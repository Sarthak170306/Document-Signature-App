import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import axios from 'axios';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Loader2, 
  AlertCircle, 
  Plus, 
  PenTool, 
  Trash2, 
  CheckCircle, 
  FileSignature,
  X
} from 'lucide-react';
import SignatureOverlay, { ISignaturePlacement } from './SignatureOverlay';

// Configure the pdfjs worker to resolve natively within Vite template bundler
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Import react-pdf core stylesheets
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PublicSignProps {
  token: string;
}

export default function PublicSign({ token }: PublicSignProps) {
  const [document, setDocument] = useState<any | null>(null);
  const [placements, setPlacements] = useState<ISignaturePlacement[]>([]);
  const [signerEmail, setSignerEmail] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState<boolean>(false);
  const [rejectionText, setRejectionText] = useState<string>('');
  const [isDeclining, setIsDeclining] = useState<boolean>(false);

  // Viewport resize state to force update measurements
  const [, setWindowSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Create local axios instance pre-configured with the JWT token
  const publicApi = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Verify token and load document layout metadata on mount
  useEffect(() => {
    const verifyToken = async () => {
      setIsLoading(true);
      try {
        const response = await publicApi.post('/docs/verify-token', { token });
        if (response.data && response.data.success) {
          const { document: docData, placements: placementsData, signerEmail: email } = response.data.data;
          setDocument(docData);
          setPlacements(placementsData);
          setSignerEmail(email);
        }
      } catch (err: any) {
        console.error('[PublicSign] Token verification failed:', err);
        setVerifyError(
          err.response?.data?.error?.message || 
          err.message || 
          'Invalid or expired signature link. Please contact the document owner.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  // Mode A: Draggable box click placement fallback
  const handleAddDragBox = () => {
    const newPlacement: ISignaturePlacement = {
      x: 20,
      y: 20,
      width: 25,
      height: 7.7,
      page: pageNumber,
      type: 'drag',
      signatureText: ''
    };
    setPlacements(prev => [...prev, newPlacement]);
  };

  const handleClearPlacements = () => {
    if (window.confirm('Are you sure you want to clear all signature areas?')) {
      setPlacements([]);
    }
  };

  // Submit Signature via Day 8 PDF stamping controller
  const handleSubmitSignature = async () => {
    if (placements.length === 0) {
      setToast({ message: 'Please place your signature box and type your name.', type: 'error' });
      return;
    }

    const firstPlacement = placements[0];
    const signatureText = firstPlacement.signatureText || '';

    if (!signatureText.trim()) {
      setToast({ message: 'Please click inside the signature box and type your name first.', type: 'error' });
      return;
    }

    setIsFinalizing(true);
    try {
      // Execute the coordinate conversion, font embedding, and disk saving logic on the server
      const response = await publicApi.post('/docs/finalize', {
        documentId: document._id,
        signatureText,
        x: firstPlacement.x,
        y: firstPlacement.y,
        width: firstPlacement.width,
        height: firstPlacement.height,
        pageNumber: firstPlacement.page
      });

      if (response.data && response.data.success) {
        setToast({ message: 'Signature submitted successfully!', type: 'success' });
        // Retrieve the signed document details
        setDocument(response.data.data);
        
        // Open the final signed document dynamically
        const fileUrl = `http://localhost:5000/${response.data.data.filePath}`;
        window.open(fileUrl, '_blank');
      }
    } catch (err: any) {
      console.error('[PublicSign] Failed to submit signature:', err);
      setToast({
        message: err.response?.data?.error?.message || err.message || 'Failed to submit signature.',
        type: 'error'
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDeclineDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionText.trim()) {
      setToast({ message: 'Please provide a reason for declining.', type: 'error' });
      return;
    }

    setIsDeclining(true);
    try {
      const response = await publicApi.post('/docs/decline', {
        documentId: document._id,
        reason: rejectionText,
        signerEmail
      });

      if (response.data && response.data.success) {
        setToast({ message: 'Document declined successfully.', type: 'success' });
        setDocument(response.data.data);
        setIsDeclineModalOpen(false);
        setRejectionText('');
      }
    } catch (err: any) {
      console.error('[PublicSign] Failed to decline document:', err);
      setToast({
        message: err.response?.data?.error?.message || err.message || 'Failed to decline document.',
        type: 'error'
      });
    } finally {
      setIsDeclining(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const changePage = (offset: number) => {
    setPageNumber(prev => Math.max(1, Math.min(numPages || 1, prev + offset)));
  };

  const adjustZoom = (factor: number) => {
    setScale(prev => Math.max(0.5, Math.min(2.0, prev + factor)));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans text-slate-100">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400 font-medium">Verifying secure signature link...</p>
      </div>
    );
  }

  if (verifyError || !document) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-slate-100">
        <div className="max-w-md w-full p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center flex flex-col items-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
          <h3 className="font-bold text-slate-200 text-lg">Signature Link Invalid</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {verifyError || 'This signature invitation token is invalid or has expired.'}
          </p>
          <a
            href="/"
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-md"
          >
            Go to SignFlow Home
          </a>
        </div>
      </div>
    );
  }

  const fileName = document.filePath.split(/[\\/]/).pop() || '';
  const pdfUrl = `http://localhost:5000/uploads/${fileName}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      
      {/* Toast Alert Banner */}
      {toast && (
        <div 
          className={`absolute top-6 left-1/2 -translate-x-1/2 z-55 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md transition-all duration-300 ${
            toast.type === 'success' 
              ? 'border-emerald-500/30 bg-emerald-950/85 text-emerald-200 shadow-emerald-950/20' 
              : 'border-rose-500/30 bg-rose-950/85 text-rose-200 shadow-rose-950/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Workspace Navbar */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-850 flex items-center justify-between select-none z-10 shadow-md">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-brand-500/10 border border-brand-500/30 rounded text-[9px] font-bold text-brand-400 uppercase select-none">
              Signer Mode
            </span>
            <h3 className="text-sm font-semibold text-slate-200 truncate">{document.title}</h3>
          </div>
          <span className="text-[10px] text-slate-500 truncate mt-0.5">Invited Signer: {signerEmail}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode B Toggle */}
          <button
            onClick={() => setIsDrawMode(!isDrawMode)}
            style={{
              borderColor: isDrawMode ? '#8B5CF6' : 'transparent',
              backgroundColor: isDrawMode ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: isDrawMode ? '#A78BFA' : ''
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-transparent text-slate-350 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1.5"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Draw Selection Area</span>
          </button>

          {/* Scale adjusters */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-850 rounded-lg p-0.5">
            <button
              onClick={() => adjustZoom(-0.1)}
              className="p-1 rounded text-slate-450 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] px-2 font-mono text-slate-400 select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => adjustZoom(0.1)}
              className="p-1 rounded text-slate-450 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Header Action States */}
          {document.status === 'pending' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDeclineModalOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-500/40 text-rose-450 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                Decline Document
              </button>
              <button
                onClick={handleSubmitSignature}
                disabled={isFinalizing || placements.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-650 hover:bg-emerald-600 text-white text-xs font-semibold border border-emerald-550 disabled:opacity-50 transition-all shadow-md shadow-emerald-650/15 group"
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <FileSignature className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span>Submit Signature</span>
                  </>
                )}
              </button>
            </div>
          ) : document.status === 'rejected' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold select-none animate-pulse">
              <X className="w-3.5 h-3.5 text-rose-400" />
              Document Rejected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold select-none">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Signed & Completed
            </span>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative select-none">
        
        {/* Left Toolbox */}
        <aside className="w-64 bg-slate-900 border-r border-slate-850 p-5 flex flex-col gap-5 select-none shrink-0">
          <div>
            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Signature Elements</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Place your signature onto the PDF document layer. When ready, click "Submit Signature".
            </p>
          </div>

          {document.status === 'pending' ? (
            <>
              {/* Drag Box */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-350">Mode A: Drag & Drop Box</span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Drag this template box onto the PDF page container below:
                </p>
                <div
                  draggable="true"
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', 'signature-box');
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offsetX = e.clientX - rect.left;
                    const offsetY = e.clientY - rect.top;
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      offsetX: offsetX * (150 / rect.width),
                      offsetY: offsetY * (60 / rect.height)
                    }));
                  }}
                  onClick={handleAddDragBox}
                  className="w-[150px] h-[60px] border-2 border-dashed border-brand-500/50 bg-brand-500/10 hover:bg-brand-500/20 active:scale-[0.98] cursor-grab rounded-lg flex flex-col items-center justify-center gap-1 transition-all text-brand-400 group relative"
                >
                  <Plus className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold tracking-wider uppercase select-none">Signature Box</span>
                  <span className="absolute bottom-1 right-1.5 text-[8px] text-slate-500 select-none">150x60</span>
                </div>
              </div>

              {/* Draw Box */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-850">
                <span className="text-[11px] font-semibold text-slate-350">Mode B: Draw Selection</span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Click the button below and draw your signature bounds directly on the PDF container:
                </p>
                <button
                  onClick={() => setIsDrawMode(!isDrawMode)}
                  style={{
                    borderColor: isDrawMode ? '#8B5CF6' : '#334155',
                    backgroundColor: isDrawMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                    color: isDrawMode ? '#A78BFA' : '#cbd5e1'
                  }}
                  className="w-full py-2.5 px-3 rounded-lg border text-xs font-semibold hover:border-purple-500 hover:text-purple-350 transition-all flex items-center justify-center gap-2"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{isDrawMode ? 'Drawing Mode Active' : 'Draw Selection Area'}</span>
                </button>
              </div>
            </>
          ) : document.status === 'rejected' ? (
            <div className="p-4 rounded-xl border border-rose-500/25 bg-rose-500/5 flex flex-col gap-2">
              <X className="w-8 h-8 text-rose-500 animate-pulse animate-duration-1000" />
              <h5 className="font-semibold text-xs text-slate-200">Document Declined</h5>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                This signing invitation has been declined.
              </p>
              {document.rejectionReason && (
                <div className="mt-2 pt-2 border-t border-slate-850">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Reason for rejection:</span>
                  <p className="text-[10px] text-slate-400 italic mt-0.5 whitespace-pre-wrap">"{document.rejectionReason}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 flex flex-col gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <h5 className="font-semibold text-xs text-slate-200">Signature Received</h5>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Your digital signature coordinates have been finalized on this PDF document.
              </p>
            </div>
          )}

          {/* Placements info */}
          <div className="mt-auto pt-4 border-t border-slate-850 flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <span>Active Page:</span>
              <span className="font-mono text-slate-300">Page {pageNumber}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <span>Signature Placements:</span>
              <span className="font-mono text-slate-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-850">{placements.length}</span>
            </div>
            {document.status === 'pending' && (
              <button
                onClick={handleClearPlacements}
                disabled={placements.length === 0}
                className="w-full py-2 bg-slate-950 border border-slate-850 hover:bg-slate-850 hover:border-slate-800 text-[10px] font-semibold text-slate-400 hover:text-rose-450 disabled:opacity-40 disabled:pointer-events-none rounded-lg flex items-center justify-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Elements
              </button>
            )}
          </div>
        </aside>

        {/* Viewport page container */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-start p-6 gap-4 relative bg-slate-950/15">
          {document.status === 'rejected' && (
            <div className="w-full max-w-2xl px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-950/80 backdrop-blur-md text-rose-250 text-xs font-semibold flex items-center gap-2.5 shadow-lg select-none animate-pulse">
              <X className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold">Signing Invitation Declined:</span>
                {document.rejectionReason ? ` "${document.rejectionReason}"` : ' No reason provided.'}
              </div>
            </div>
          )}
          <div className="shadow-2xl border border-slate-900 rounded-lg bg-white relative">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="p-8 text-center flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                  <span className="text-xs text-slate-400">Loading document canvas...</span>
                </div>
              }
            >
              <div className="relative">
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={null}
                />
                {document.status === 'pending' && (
                  <SignatureOverlay
                    pageNumber={pageNumber}
                    placements={placements}
                    setPlacements={setPlacements}
                    isDrawMode={isDrawMode}
                    setIsDrawMode={setIsDrawMode}
                  />
                )}
              </div>
            </Document>
          </div>
        </div>
      </div>

      {/* Pagination control footer */}
      {numPages && (
        <footer className="px-6 py-4 bg-slate-900 border-t border-slate-850 flex items-center justify-between select-none z-10 shadow-md">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-350 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span className="text-xs font-medium text-slate-400">
            Page <span className="text-slate-200">{pageNumber}</span> of <span className="text-slate-200">{numPages}</span>
          </span>

          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-350 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </footer>
      )}

      {/* Glassmorphic Decline Modal */}
      {isDeclineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl border border-slate-850 bg-slate-900/90 shadow-2xl backdrop-blur-md">
            {/* Top title */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>Decline Document Signature</span>
              </h3>
              <button
                onClick={() => {
                  setIsDeclineModalOpen(false);
                  setRejectionText('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleDeclineDocument} className="flex flex-col gap-4">
              <p className="text-xs text-slate-450 leading-relaxed">
                Are you sure you want to decline this document? Please provide a brief explanation or reason for your decision:
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                  Reason for Decline
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="E.g., Incorrect pricing terms, spelling mistake in name, etc."
                  value={rejectionText}
                  onChange={(e) => setRejectionText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-850 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors placeholder:text-slate-650 resize-none font-sans"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeclineModalOpen(false);
                    setRejectionText('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-850 text-xs font-semibold text-slate-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeclining}
                  className="flex-1 py-2.5 rounded-xl bg-rose-650 hover:bg-rose-600 text-white text-xs font-semibold border border-rose-550 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/20"
                >
                  {isDeclining ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Declining...</span>
                    </>
                  ) : (
                    <span>Decline Document</span>
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
