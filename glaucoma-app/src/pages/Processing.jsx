import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Loader2, AlertCircle, AlertTriangle, Activity, Eye, Info } from "lucide-react";
import { predictImage, slimResult } from "../api/client";
import { PROCESSING_STAGES } from "../data/docsContent";

function saveReportHistory(entry) {
  try {
    const raw = sessionStorage.getItem("glaucoma_report_history");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    sessionStorage.setItem("glaucoma_report_history", JSON.stringify(list.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

const STAGE_SUBTEXTS = {
  "Upload": "Reading retinal image data...",
  "Preprocessing": "Enhancing green channel contrast...",
  "Vessel Extraction": "Suppressing blood vessel channels...",
  "Disc Localization": "Locating brightest disc region (ROI)...",
  "Enhanced K-Strange Clustering": "Calculating Stage 1 K-Strange anchors...",
  "Cup Segmentation": "Refining optic cup boundaries...",
  "CDR Calculation": "Measuring vertical CDR ratio...",
  "ResNet-50 Classification": "Running ResNet-50 CNN forward pass...",
  "Report Generation": "Compiling diagnostic PDF report...",
  "Complete": "Analysis complete! Loading report..."
};

export default function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { file, preview, patient } = location.state || {};
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState(null);

  // Fallback for image preview if not passed in state
  const previewUrl = preview || (file ? URL.createObjectURL(file) : null);

  useEffect(() => {
    if (!file) {
      navigate("/upload", { replace: true });
      return;
    }

    let cancelled = false;
    let stageTimer;

    const run = async () => {
      stageTimer = setInterval(() => {
        setActiveIdx((i) => Math.min(i + 1, PROCESSING_STAGES.length - 2));
      }, 950);

      try {
        const result = await predictImage(file, patient || {});
        if (cancelled) return;
        clearInterval(stageTimer);
        setActiveIdx(PROCESSING_STAGES.length - 1);

        sessionStorage.setItem("glaucoma_job_id", result.job_id);
        sessionStorage.setItem("glaucoma_result_meta", JSON.stringify(slimResult(result)));
        saveReportHistory({
          report_id: result.report_id,
          job_id: result.job_id,
          prediction: result.prediction,
          date: new Date().toISOString(),
          pdf_url: result.pdf_url,
        });

        await new Promise((r) => setTimeout(r, 600));
        navigate("/results", { state: { result }, replace: true });
      } catch (e) {
        if (cancelled) return;
        clearInterval(stageTimer);
        setError(e.message);
      }
    };

    run();
    return () => {
      cancelled = true;
      clearInterval(stageTimer);
    };
  }, [file, patient, navigate]);

  const progressPercent = Math.round((activeIdx / (PROCESSING_STAGES.length - 1)) * 100);

  if (error) {
    const isValidationError = error.includes("Invalid image");
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 text-center mt-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="hospital-card-lg p-8 bg-white border-t-4 border-[#ef4444] shadow-2xl relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#ef4444]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-[#f59e0b]/5 blur-3xl pointer-events-none" />

          {/* Pulsing Icon */}
          <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-6 border border-[#ef4444]/20">
            <AlertCircle className="w-8 h-8 text-[#ef4444] animate-pulse" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-[#0a2540] mb-2">
            {isValidationError ? "Retinal Scan Validation Failure" : "Pipeline Execution Error"}
          </h2>
          
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 font-mono-data">
            {isValidationError ? "Diagnostic Safety Check Triggered" : "System Communication Failure"}
          </p>

          {/* Uploaded Image Preview with REJECTED Overlay */}
          {isValidationError && previewUrl && (
            <div className="relative w-full max-w-[280px] aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 mx-auto mb-6 shadow-md">
              <img src={previewUrl} alt="Rejected scan" className="w-full h-full object-cover grayscale opacity-80" />
              <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[1px] flex items-center justify-center">
                <span className="bg-[#ef4444] text-white text-[10px] font-black tracking-widest px-4 py-1.5 rounded-full shadow-lg border border-white/25 uppercase">
                  Scan Rejected
                </span>
              </div>
            </div>
          )}

          {/* Error Description Box */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-left mb-6">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Detailed Findings</p>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed">
              {isValidationError 
                ? error.replace("Invalid image: ", "") 
                : "An unexpected error occurred during the analysis pipeline. Please check your network connection and try again."}
            </p>
          </div>

          {/* Valid Scan Requirements Checklist */}
          {isValidationError && (
            <div className="border-t border-slate-100 pt-6 mb-8 text-left">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#00C2FF] mb-3">
                Retinal Scan Requirements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "Color fundus photograph (RGB)",
                  "Clear view of the Optic Nerve Head (ONH)",
                  "Orange/red/yellow retinal color profile",
                  "No text, documents, or grayscale charts"
                ].map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF] shrink-0" />
                    <span>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={() => navigate("/upload")} 
              className="btn-navy py-3 px-8 text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#0a2540]/10 flex items-center justify-center gap-2"
            >
              Upload New Scan
            </button>
            <button 
              onClick={() => navigate("/")} 
              className="btn-navy-outline py-3 px-8 text-xs font-bold uppercase tracking-wider flex items-center justify-center"
            >
              Return to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 text-[#0a2540] flex flex-col justify-center flex-1 overflow-y-auto lg:overflow-visible">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0a2540]">Clinical Processing Pipeline</h1>
        <p className="text-xs text-slate-500 mt-1">Analyzing fundus image via hybrid computer vision & deep learning...</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* ==========================================
            LEFT COLUMN — SCANNER & VISUALIZATION
            ========================================== */}
        <div className="hospital-card p-5 flex flex-col justify-between bg-white relative overflow-hidden min-h-[380px]">
          <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a2540] flex items-center gap-1.5">
              <Eye size={13} className="text-[#00C2FF]" />
              Retinal Fundus Scanner
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping" />
              Live Scanner
            </span>
          </div>

          <div className="relative w-full aspect-square max-h-[220px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner mx-auto">
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Retinal scan preview" className="w-full h-full object-cover" />
                
                {/* Horizontal Scanning laser bar */}
                <motion.div 
                  className="absolute left-0 right-0 h-1 bg-[#00C2FF] shadow-[0_0_15px_#00C2FF,0_0_5px_#00C2FF] z-10"
                  animate={{ top: ["2%", "96%", "2%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
                
                {/* Scanner Target crosshairs */}
                <div className="absolute inset-0 border-[1.5px] border-dashed border-[#00C2FF]/25 rounded-full m-8 pointer-events-none animate-[spin_40s_linear_infinite]" />
                <div className="absolute inset-0 border border-dashed border-[#00C2FF]/15 rounded-full m-14 pointer-events-none animate-[spin_20s_linear_reverse_infinite]" />
              </>
            ) : (
              <div className="text-center p-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF] mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading scan...</p>
              </div>
            )}
          </div>

          {/* Diagnostic Telemetry details */}
          <div className="w-full grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-slate-500 font-semibold mt-4 border-t border-slate-100 pt-3">
            <div>
              <span className="text-slate-400">TARGET:</span> ONH (Optic Nerve Head)
            </div>
            <div>
              <span className="text-slate-400">IMAGE SIZE:</span> 224 × 224 px
            </div>
            <div>
              <span className="text-slate-400">PATIENT ID:</span> {patient?.id || "ANONYMOUS"}
            </div>
            <div>
              <span className="text-slate-400">STAGE STATE:</span> <span className="text-[#00C2FF] uppercase tracking-wide">{PROCESSING_STAGES[activeIdx]}</span>
            </div>
          </div>
        </div>

        {/* ==========================================
            RIGHT COLUMN — PIPELINE CHECKLIST
            ========================================== */}
        <div className="hospital-card p-5 flex flex-col justify-between bg-white min-h-[380px]">
          <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0a2540] flex items-center gap-1.5">
              <Activity size={13} className="text-[#00C2FF]" />
              Pipeline Analysis Progress
            </span>
            <span className="text-xs font-mono-data font-bold text-[#00C2FF] bg-[#00C2FF]/10 px-2 py-0.5 rounded">
              {progressPercent}%
            </span>
          </div>

          <div className="flex-1 space-y-1.5 flex flex-col justify-center md:max-h-[260px] md:overflow-hidden py-2">
            {PROCESSING_STAGES.map((stage, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              const pending = i > activeIdx;

              return (
                <div
                  key={stage}
                  className="flex items-center gap-3 py-1 px-2.5 rounded-lg transition-colors"
                  style={{
                    background: active ? "rgba(0, 194, 255, 0.05)" : "transparent",
                  }}
                >
                  <div className="relative flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {done && (
                      <span className="w-5 h-5 rounded-full bg-[#10B981]/15 flex items-center justify-center border border-[#10B981]/30">
                        <Check className="w-3 h-3 text-[#10B981]" strokeWidth={3.5} />
                      </span>
                    )}
                    {active && (
                      <span className="w-5 h-5 rounded-full border border-[#00C2FF] flex items-center justify-center bg-[#00C2FF]/10">
                        <Loader2 className="w-2.5 h-2.5 text-[#00C2FF] animate-spin" />
                      </span>
                    )}
                    {pending && (
                      <span className="w-5 h-5 rounded-full border border-slate-200 bg-slate-50" />
                    )}
                  </div>
                  <div>
                    <p
                      className="text-xs font-bold transition-colors duration-300"
                      style={{ 
                        color: pending ? "#94a3b8" : "#0a2540", 
                        opacity: done ? 0.6 : 1 
                      }}
                    >
                      {stage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active step subtext */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 mt-3 flex items-start gap-2">
            <Info size={14} className="text-[#00C2FF] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Current Task</p>
              <p className="text-xs font-semibold text-[#0a2540] mt-0.5 truncate">
                {STAGE_SUBTEXTS[PROCESSING_STAGES[activeIdx]] || "Running analysis..."}
              </p>
            </div>
          </div>
        </div>

      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-xs text-[#ef4444] text-center flex flex-col items-center gap-2">
          <AlertCircle className="w-6 h-6 text-[#ef4444]" />
          <p className="font-bold">{error}</p>
          <button onClick={() => navigate("/upload")} className="btn-navy-outline text-[11px] py-1.5 px-4 mt-1 font-bold uppercase tracking-wide">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

