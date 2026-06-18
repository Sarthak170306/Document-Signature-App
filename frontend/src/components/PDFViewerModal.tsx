import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertCircle, Plus, PenTool, Trash2, Save, CheckCircle, FileSignature } from 'lucide-react';
import SignatureOverlay, { ISignaturePlacement } from './SignatureOverlay';
import { useApi } from '../hooks/useApi';

// Configure the pdfjs worker to resolve natively within Vite template bundler
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Import react-pdf core stylesheets to support text-selection and annotations
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFViewerModalProps {
  document: {
    _id: string;
    title: string;
    filePath: string;
    status: 'pending' | 'signed' | 'rejected';
  } | null;
  onClose: () => void;
  onFinalize?: () => void;
}

export default function PDFViewerModal({ document, onClose, onFinalize }: PDFViewerModalProps) {
  const api = useApi();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Signature placement states
  const [placements, setPlacements] = useState<ISignaturePlacement[]>([]);
  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Audit Logs timeline states
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Viewport resize state to force update overlays/measurements on dimension alterations
  const [, setWindowSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight
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

  // Dismiss toast notification automatically after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!document) return null;

  // Retrieve saved anchors when document opens
  useEffect(() => {
    const fetchAnchors = async () => {
      try {
        const response = await api.get(`/signatures/${document._id}`);
        if (response.data && response.data.success) {
          setPlacements(response.data.data);
        }
      } catch (error) {
        console.error('[PDFViewerModal] Failed to fetch placements:', error);
      }
    };
    fetchAnchors();
  }, [document._id]);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      setIsLoadingAudit(true);
      try {
        const response = await api.get(`/audit/${document._id}`);
        if (response.data && response.data.success) {
          setAuditLogs(response.data.data);
        }
      } catch (error) {
        console.error('[PDFViewerModal] Failed to fetch audit logs:', error);
      } finally {
        setIsLoadingAudit(false);
      }
    };
    fetchAuditLogs();
  }, [document._id]);

  // Mode A: Place Fixed-Size drag box
  const handleAddDragBox = () => {
    const newPlacement: ISignaturePlacement = {
      x: 20, // default page placements percentage offsets
      y: 20,
      width: 25, // maps to ~150px on standard viewport width 600px
      height: 8,  // maps to ~60px on standard viewport height 750px
      page: pageNumber,
      type: 'drag'
    };
    setPlacements(prev => [...prev, newPlacement]);
  };

  // Clear placements
  const handleClearPlacements = () => {
    if (window.confirm('Are you sure you want to clear all signature areas?')) {
      setPlacements([]);
    }
  };

  // Save Placements to MongoDB
  const handleSavePlacements = async () => {
    setIsSaving(true);
    try {
      const response = await api.post('/signatures', {
        documentId: document._id,
        placements
      });
      if (response.data && response.data.success) {
        setToast({ message: 'Anchor layout saved successfully in MongoDB!', type: 'success' });
      }
    } catch (error: any) {
      console.error('[PDFViewerModal] Failed to save placements:', error);
      setToast({
        message: error.response?.data?.error?.message || error.message || 'Failed to save placements.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Finalize & Sign Document Action
  const handleFinalizeDocument = async () => {
    if (placements.length === 0) {
      setToast({ message: 'Please add at least one signature box first.', type: 'error' });
      return;
    }

    const firstPlacement = placements[0];
    const signatureText = firstPlacement.signatureText || 'Signed Document';

    setIsFinalizing(true);
    try {
      const response = await api.post('/docs/finalize', {
        documentId: document._id,
        signatureText,
        x: firstPlacement.x,
        y: firstPlacement.y,
        width: firstPlacement.width,
        height: firstPlacement.height,
        pageNumber: firstPlacement.page
      });

      if (response.data && response.data.success) {
        setToast({ message: 'Document signed and finalized successfully!', type: 'success' });
        try {
          const logsResponse = await api.get(`/audit/${document._id}`);
          if (logsResponse.data && logsResponse.data.success) {
            setAuditLogs(logsResponse.data.data);
          }
        } catch (err) {
          console.error('[PDFViewerModal] Failed to refresh audit logs after finalizing:', err);
        }
        if (onFinalize) {
          onFinalize(); // Refresh dashboard counts & list
        }
        // Instantly open/download the completed file path from the backend static directory
        const fileUrl = `http://localhost:5000/${response.data.data.filePath}`;
        window.open(fileUrl, '_blank');
      }
    } catch (error: any) {
      console.error('[PDFViewerModal] Failed to finalize document:', error);
      setToast({
        message: error.response?.data?.error?.message || error.message || 'Failed to finalize document.',
        type: 'error'
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  // Extract the filename from the backend filePath
  const fileName = document.filePath.split(/[\\/]/).pop() || '';
  const pdfUrl = `http://localhost:5000/uploads/${fileName}`;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setIsLoading(false);
    setLoadError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('[PDFViewerModal] Failed to load PDF:', err);
    setLoadError('Failed to render PDF document. Verify that the file exists and is accessible.');
    setIsLoading(false);
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const nextPage = prevPageNumber + offset;
      if (numPages) {
        return Math.max(1, Math.min(numPages, nextPage));
      }
      return prevPageNumber;
    });
  };

  const adjustZoom = (factor: number) => {
    setScale(prevScale => Math.max(0.5, Math.min(2.0, prevScale + factor)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      {/* Crisp Glassmorphic Toast Alerts */}
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

      {/* Modal Container */}
      <div className="w-full max-w-6xl h-[90vh] rounded-2xl glass-card flex flex-col overflow-hidden shadow-2xl relative border border-slate-800">
        
        {/* Modal Header (Layout Toolbar) */}
        <header className="px-6 py-4 bg-slate-950/70 border-b border-slate-900 flex items-center justify-between z-10">
          <div className="flex flex-col min-w-0">
            <h3 className="text-sm font-semibold text-slate-200 truncate">{document.title}</h3>
            <span className="text-[10px] text-slate-500 truncate mt-0.5">{fileName}</span>
          </div>

          {/* Quick PDF Zoom, Draw Selection Toggle & Close Actions */}
          <div className="flex items-center gap-3">
            {/* Mode B: Draw Selection Area Toggle Button */}
            <button
              onClick={() => setIsDrawMode(!isDrawMode)}
              title="Toggle Custom Mouse Selection Area Draw Mode"
              style={{
                borderColor: isDrawMode ? '#8B5CF6' : 'transparent',
                backgroundColor: isDrawMode ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: isDrawMode ? '#A78BFA' : ''
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-transparent text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1.5"
            >
              <PenTool className={`w-3.5 h-3.5 ${isDrawMode ? 'text-purple-400' : 'text-slate-400'}`} />
              <span>Draw Selection Area</span>
            </button>

            {/* Scale Adjusters */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => adjustZoom(-0.1)}
                title="Zoom Out"
                className="p-1 rounded text-slate-450 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] px-2 font-mono text-slate-400 select-none">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => adjustZoom(0.1)}
                title="Zoom In"
                className="p-1 rounded text-slate-450 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Clear Action Button */}
            <button
              onClick={handleClearPlacements}
              disabled={placements.length === 0}
              title="Clear All Signature Areas"
              className="p-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>

            {/* Save Anchor Layout Button */}
            <button
              onClick={handleSavePlacements}
              disabled={isSaving}
              title="Save Anchor Layout to MongoDB"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-650 hover:bg-brand-600 text-white text-xs font-semibold border border-brand-550 disabled:opacity-50 transition-all shadow-md shadow-brand-650/10"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Layout...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Anchor Layout</span>
                </>
              )}
            </button>

            {/* Finalize & Sign Document Button */}
            <button
              onClick={handleFinalizeDocument}
              disabled={isFinalizing || placements.length === 0}
              title="Finalize placements and sign PDF permanently"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-650 hover:bg-emerald-600 text-white text-xs font-semibold border border-emerald-550 disabled:opacity-50 transition-all shadow-md shadow-emerald-650/10"
            >
              {isFinalizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Finalizing...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-3.5 h-3.5" />
                  <span>Finalize & Sign Document</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-450 hover:text-white hover:bg-slate-850 transition-all"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        {/* Modal PDF Render Body with Side Panel */}
        <div className="flex-1 flex bg-slate-950/40 relative overflow-hidden select-none">
          
          {/* Sidebar Toolkit */}
          <aside className="w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col gap-5 select-none shrink-0 z-10">
            <div>
              <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Signature Tools</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Add signature areas using either of the two modes below. When finished, save your changes.
              </p>
            </div>

            {/* Mode A Container */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-300">Mode A: Drag & Drop Box</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Drag the fixed box template onto the PDF page container below:
              </p>
              
              <div
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', 'signature-box');
                  // Track cursor click relative offset inside the element to align nicely on drop
                  const rect = e.currentTarget.getBoundingClientRect();
                  const offsetX = e.clientX - rect.left;
                  const offsetY = e.clientY - rect.top;
                  e.dataTransfer.setData('application/json', JSON.stringify({
                    offsetX: offsetX * (150 / rect.width),
                    offsetY: offsetY * (60 / rect.height)
                  }));
                }}
                onClick={handleAddDragBox}
                title="Drag this template box onto the PDF page, or click to place"
                className="w-[150px] h-[60px] border-2 border-dashed border-brand-500/50 bg-brand-500/10 hover:bg-brand-500/20 active:scale-[0.98] cursor-grab rounded-lg flex flex-col items-center justify-center gap-1 transition-all text-brand-400 group relative select-none"
              >
                <Plus className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold tracking-wider uppercase select-none">Signature Box</span>
                <span className="absolute bottom-1 right-1.5 text-[8px] text-slate-500 select-none">150x60</span>
              </div>
            </div>

            {/* Mode B Container */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-300">Mode B: Mouse Draw Box</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Click below (or use the toolbar button) and click-drag custom selection shapes directly on the PDF.
              </p>
              <button
                onClick={() => setIsDrawMode(!isDrawMode)}
                style={{
                  borderColor: isDrawMode ? '#8B5CF6' : '#334155',
                  backgroundColor: isDrawMode ? 'rgba(139, 92, 246, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                  color: isDrawMode ? '#A78BFA' : '#cbd5e1'
                }}
                className="w-full py-2.5 px-3 rounded-lg border text-xs font-semibold hover:border-purple-500 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{isDrawMode ? 'Drawing Mode Active' : 'Draw Selection Area'}</span>
              </button>
            </div>

            {/* Summary Details */}
            <div className="mt-auto pt-4 border-t border-slate-800 flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Active Page:</span>
                <span className="font-mono text-slate-200">Page {pageNumber}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Total Anchors:</span>
                <span className="font-mono text-slate-200 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{placements.length}</span>
              </div>
              <button
                onClick={handleClearPlacements}
                disabled={placements.length === 0}
                className="w-full py-2 bg-slate-950 border border-slate-850 hover:bg-slate-850 hover:border-slate-800 text-[10px] font-semibold text-slate-400 hover:text-rose-400 disabled:opacity-40 disabled:pointer-events-none rounded-lg flex items-center justify-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Areas
              </button>
            </div>
          </aside>

          {/* PDF Page Viewport Container */}
          <div className="flex-1 overflow-auto flex justify-center p-6 items-start relative select-none bg-slate-950/10">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/30 backdrop-blur-xs z-20">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
                <p className="text-xs text-slate-400">Loading document view...</p>
              </div>
            )}

            {loadError ? (
              <div className="max-w-md p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center flex flex-col items-center mt-12 z-20">
                <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
                <h4 className="font-semibold text-slate-200 text-sm">Preview Unavailable</h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{loadError}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <div className="shadow-2xl border border-slate-900 rounded-lg bg-white relative">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={null}
                >
                  <div className="relative">
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={null}
                    />
                    {/* Signature Placings Overlay Layer */}
                    <SignatureOverlay
                      pageNumber={pageNumber}
                      placements={placements}
                      setPlacements={setPlacements}
                      isDrawMode={isDrawMode}
                      setIsDrawMode={setIsDrawMode}
                    />
                  </div>
                </Document>
              </div>
            )}

            {/* Temporary Floating Action Button (FAB) for Save Anchors */}
            {numPages && !loadError && (
              <button
                onClick={handleSavePlacements}
                disabled={isSaving}
                title="Save Anchors to Backend Database"
                className="absolute bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-full bg-brand-650 hover:bg-brand-600 text-white text-xs font-bold border border-brand-550 disabled:opacity-50 transition-all shadow-xl shadow-brand-650/25 z-30 group"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Anchors...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Save Anchors</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Right Sidebar: Activity Log Timeline */}
          <aside className="w-72 bg-slate-900 border-l border-slate-800 p-5 flex flex-col gap-5 select-none shrink-0 z-10 overflow-y-auto">
            <div>
              <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Document Audit Trail</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Chronological audit logs tracking actions, performers, and IP/UA stamps.
              </p>
            </div>

            {isLoadingAudit ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                <span className="text-[10px] text-slate-550">Loading activity trail...</span>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-650 text-[10px]">
                No audit logs recorded yet.
              </div>
            ) : (
              <div className="relative border-l border-slate-850 ml-2.5 pl-4 flex flex-col gap-6 py-2">
                {auditLogs.map((log) => {
                  let dotColor = 'bg-brand-500 ring-brand-500/20';
                  if (log.action.includes('REJECTED')) {
                    dotColor = 'bg-rose-500 ring-rose-500/20';
                  } else if (log.action.includes('SIGNED') || log.action.includes('FINALIZED')) {
                    dotColor = 'bg-emerald-500 ring-emerald-500/20';
                  } else if (log.action.includes('SHARED')) {
                    dotColor = 'bg-purple-500 ring-purple-500/20';
                  }

                  const actionLabel = log.action.replace(/_/g, ' ');

                  return (
                    <div key={log._id} className="relative text-left">
                      {/* Vertical timeline dot indicator */}
                      <span className={`absolute -left-[22.5px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ${dotColor}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-950"></span>
                      </span>

                      {/* Event Content */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-200 capitalize tracking-wide">
                          {actionLabel.toLowerCase()}
                        </h5>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate" title={log.performedBy}>
                          {log.performedBy}
                        </p>
                        
                        {/* Meta details */}
                        <div className="flex flex-col gap-0.5 mt-1 text-[9px] text-slate-550 font-mono">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          {log.ipAddress && (
                            <span className="opacity-80">IP: {log.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>

        {/* Modal Pagination Footer */}
        {numPages && !loadError && (
          <footer className="px-6 py-4 bg-slate-950/70 border-t border-slate-900 flex items-center justify-between z-10">
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-xs font-medium text-slate-400 select-none">
              Page <span className="text-slate-200">{pageNumber}</span> of <span className="text-slate-200">{numPages}</span>
            </span>

            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
