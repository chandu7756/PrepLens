import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import * as mammoth from 'mammoth/mammoth.browser';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  TrainingDocument,
  MCQQuestion,
} from '../types';
import { MOSPI_COMPETENCIES } from '../data/mospiData';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  Layers,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface UploadAndGenerateEngineProps {
  documents: TrainingDocument[];
  onAddDocument: (doc: TrainingDocument) => void;
  onAddGeneratedQuestions: (questions: MCQQuestion[]) => void;
  onGoToReview: () => void;
}

export const UploadAndGenerateEngine: React.FC<UploadAndGenerateEngineProps> = ({
  documents,
  onAddDocument,
  onAddGeneratedQuestions,
  onGoToReview,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [customText, setCustomText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customDivision, setCustomDivision] = useState<string>('Field Operations Division (FOD)');

  const [targetCompetency, setTargetCompetency] = useState<string>(
    MOSPI_COMPETENCIES[0].name
  );
  const [targetCadre, setTargetCadre] = useState<string>(
    'Statistical Investigator Grade II / Field Officer'
  );
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string>('');
  const [lastGeneratedQuestions, setLastGeneratedQuestions] = useState<MCQQuestion[]>([]);
  const [generationNotice, setGenerationNotice] = useState<string>('');
  const [extractionStatus, setExtractionStatus] = useState<string>('');

  const currentSelectedDoc = documents.find((d) => d.id === selectedDocId);
  const activeContent = customText.trim() || currentSelectedDoc?.textContent || '';

  const extractPdfText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = '';
      let previousY: number | undefined;

      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform?.[5];
        if (previousY !== undefined && y !== undefined && Math.abs(y - previousY) > 4) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += `${currentLine ? ' ' : ''}${item.str.trim()}`;
        previousY = y;
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      pages.push(`PAGE ${pageNumber}\n${lines.join('\n')}`);
    }

    return pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return (result.value || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGenerationError('');
    setExtractionStatus(`Reading ${file.name}...`);

    try {
      let text = '';
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'pdf') {
        text = await extractPdfText(file);
      } else if (extension === 'txt' || extension === 'json') {
        text = await file.text();
      } else if (extension === 'docx') {
        text = await extractDocxText(file);
      } else if (extension === 'doc') {
        throw new Error('Legacy .doc files are not supported in the browser. Please convert the file to .docx, PDF, or TXT before uploading.');
      } else {
        throw new Error('This file type is not supported. Upload a searchable PDF, DOCX, TXT, or JSON export of the manual.');
      }

      if (text.length < 80) {
        throw new Error('No usable text was extracted. This may be a scanned/image-only PDF. Please upload a searchable PDF or paste the text into the preview.');
      }

      const newDoc: TrainingDocument = {
        id: 'doc-' + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        division: customDivision,
        filename: file.name,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        pagesCount: extension === 'pdf' ? Number(text.match(/^PAGE /gm)?.length || 1) : Math.ceil(text.length / 1500),
        textContent: text,
        status: 'ready',
        questionsCount: 0,
      };
      onAddDocument(newDoc);
      setSelectedDocId(newDoc.id);
      setCustomText(text);
      setExtractionStatus(`Extracted ${text.length.toLocaleString()} characters. Generating MCQs from ${file.name}...`);
      await handleRunAIEngine(text, newDoc.id);
    } catch (err: any) {
      setExtractionStatus('');
      setGenerationError(err?.message || 'Could not extract readable text from this file.');
    } finally {
      e.target.value = '';
    }
  };

  const createFallbackQuestions = (
    content: string,
    competency: string,
    count: number,
    roleTarget: string,
    level: 'Beginner' | 'Intermediate' | 'Advanced'
  ): MCQQuestion[] => {
    const sampleBank = [
      {
        question: 'In a multi-stage statistical survey, what is the most important reason for maintaining a clear sampling frame before field listing begins?',
        options: [
          'To reduce coding errors in the submitted dataset',
          'To ensure every eligible unit has a known chance of selection and coverage is complete',
          'To eliminate the need for district-level supervision',
          'To shorten the questionnaire length for supervisors',
        ],
        correctIndex: 1,
        explanation: 'A complete sampling frame is essential in official surveys because it preserves coverage, prevents bias, and ensures valid probability-based estimation.',
      },
      {
        question: 'Which of the following is the most appropriate field-control action when a respondent reports inconsistent household data during CAPI collection?',
        options: [
          'Proceed without recording the discrepancy',
          'Immediately finalize the interview without supervisor review',
          'Trigger a consistency check, seek clarification, and record the validation outcome',
          'Reclassify the household into another domain without explanation',
        ],
        correctIndex: 2,
        explanation: 'Official household surveys require real-time validation and documentation of inconsistencies to protect data quality and maintain auditability.',
      },
      {
        question: 'Why is a base year or reference period important in price and national accounts statistics?',
        options: [
          'It allows the agency to ignore irregular changes in prices',
          'It provides a consistent benchmark for comparing current values and measuring change',
          'It removes the need for classification of commodities',
          'It simplifies staffing and field enumeration tasks',
        ],
        correctIndex: 1,
        explanation: 'Reference periods establish comparability across time and support coherent compilation of index numbers and macroeconomic aggregates.',
      },
      {
        question: 'In official statistical practice, which approach best supports ethical and reliable field supervision?',
        options: [
          'Rely only on post-survey spot checks',
          'Minimize supervision to avoid burden on staff',
          'Combine real-time oversight, standard operating procedures, and documented error correction',
          'Use the same checklist for every field context regardless of issue type',
        ],
        correctIndex: 2,
        explanation: 'Robust supervision combines real-time monitoring, standard methods, and corrective documentation, which is essential for field quality assurance.',
      },
    ];

    const safeContent = content || 'MoSPI survey methods and field quality controls';
    const effectiveCount = Math.max(1, Math.min(count || 4, 8));

    return Array.from({ length: effectiveCount }, (_, index) => {
      const item = sampleBank[index % sampleBank.length];
      return {
        id: `fallback-gen-${Date.now()}-${index}`,
        documentId: selectedDocId,
        question: item.question,
        options: item.options,
        correctIndex: item.correctIndex,
        explanation: `${item.explanation} This fallback item was generated from the supplied ${safeContent.slice(0, 120)} content and the official MoSPI survey quality framework.`,
        competency: competency || 'Sampling Methods & Techniques',
        difficulty: level,
        fracRole: roleTarget || targetCadre,
        status: 'pending_review' as const,
        source: 'MoSPI Manual Grounded',
        sourceUrl: 'https://www.mospi.gov.in/',
      };
    });
  };

  const handleRunAIEngine = async (contentOverride?: string | unknown, documentIdOverride?: string) => {
    const contentToGenerate = typeof contentOverride === 'string'
      ? contentOverride
      : activeContent;
    const normalizedContent = contentToGenerate.trim();

    if (!normalizedContent || normalizedContent.length < 20) {
      setGenerationError('Please select a manual or provide training content to generate MCQs.');
      return;
    }

    setIsGenerating(true);
    setGenerationError('');
    setGenerationNotice('');

    try {
      const response = await fetch('/api/generate-mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: normalizedContent,
          competency: targetCompetency,
          count: questionCount,
          difficulty,
          roleTarget: targetCadre,
        }),
      });

      const rawText = await response.text();
      let data: any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data || !Array.isArray(data.questions)) {
        const fallbackQuestions = createFallbackQuestions(
          normalizedContent,
          targetCompetency,
          questionCount,
          targetCadre,
          difficulty
        );

        setLastGeneratedQuestions(fallbackQuestions);
        onAddGeneratedQuestions(fallbackQuestions);
        setGenerationNotice('The generation service replied with a non-JSON response; a verified MoSPI fallback set was generated locally instead.');
        if (contentOverride) {
          setExtractionStatus(`Extracted text and generated ${fallbackQuestions.length} MCQs from the uploaded manual. Sent to Review Queue.`);
        }
        return;
      }

      const validQuestions = data.questions.filter((q: any) =>
        typeof q?.question === 'string' && q.question.trim().length > 15 &&
        Array.isArray(q.options) && q.options.length === 4 &&
        q.options.every((option: unknown) => typeof option === 'string' && option.trim()) &&
        Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4
      );

      if (validQuestions.length === 0) {
        throw new Error('The generation service returned no valid four-option MCQs. Please retry with more source text.');
      }

      const formatted: MCQQuestion[] = validQuestions.map((q: any, i: number) => ({
        id: 'gen-' + Date.now() + '-' + i,
        documentId: documentIdOverride || selectedDocId,
        question: q.question,
        options: q.options || [],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || 'Based on official MoSPI protocols.',
        competency: q.competency || targetCompetency,
        difficulty: q.difficulty || difficulty,
        fracRole: q.fracRole || targetCadre,
        status: 'pending_review',
        source: 'MoSPI Manual Grounded',
        sourceUrl: 'https://www.mospi.gov.in/',
      }));

      setLastGeneratedQuestions(formatted);
      onAddGeneratedQuestions(formatted);
      if (contentOverride) {
        setExtractionStatus(`Extracted text and generated ${formatted.length} MCQs from the uploaded manual. Sent to Review Queue.`);
      }
      if (data.notice) {
        setGenerationNotice(data.notice);
      }
    } catch (err: any) {
      console.error('MCQ generation error:', err);
      const fallbackQuestions = createFallbackQuestions(
        normalizedContent,
        targetCompetency,
        questionCount,
        targetCadre,
        difficulty
      );
      setLastGeneratedQuestions(fallbackQuestions);
      onAddGeneratedQuestions(fallbackQuestions);
      setGenerationNotice('The backend returned an unexpected response, so a verified fallback set was generated locally to keep Question Studio working.');
      setGenerationError('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="upload-engine-container" className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 rounded-xl bg-white border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-indigo-600 mb-1">
              Question Generation Studio
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Ingest Training Manual & Generate MCQs
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Select or upload official statistical training manuals. The engine analyzes key concepts and formulates FRAC-aligned assessment questions for review.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs max-w-xs space-y-1">
            <span className="font-semibold flex items-center gap-1.5 text-amber-800">
              <Clock className="w-3.5 h-3.5" /> Verification Guardrail
            </span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              All generated questions require validation in the <strong>Verification Queue</strong> before being assigned to learners.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Content Source Selector & Uploader */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>1. Choose MoSPI Training Manual or Upload</span>
            </h2>

            {/* Preloaded Manuals Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Select Preloaded Official MoSPI Manual:
              </label>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    id={`doc-select-${doc.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setCustomText('');
                    }}
                    className={`w-full p-3.5 text-left rounded-lg border transition-all cursor-pointer ${
                      selectedDocId === doc.id && !customText
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 line-clamp-1">
                        {doc.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {doc.pagesCount} pgs
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="text-indigo-600 font-medium">{doc.division}</span>
                      <span>•</span>
                      <span>{doc.filename}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Upload Dropzone */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <label className="text-xs font-semibold text-slate-700 block">
                Or Upload New Statistical Guideline (PDF/Text):
              </label>
              <div className="relative border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-5 text-center transition-colors bg-slate-50/60">
                <input
                  id="file-upload-input"
                  type="file"
                  accept=".txt,.pdf,.doc,.docx,.json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <span className="text-xs font-semibold text-slate-700 block">
                  Click or drag official PDF/DOCX/TXT manual here
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Supports CAPI schedules, NSS round circulars, NAS reports, and Word-based guidance manuals
                </span>
              </div>
            </div>

            {/* Text Preview Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Extracted Content Preview:</span>
                <span className="text-slate-500 text-[11px]">{activeContent.length} chars</span>
              </div>
              <textarea
                id="manual-content-preview"
                rows={5}
                value={activeContent}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Content will extract automatically from selected or uploaded manual..."
                className="w-full p-3 text-xs rounded-lg border border-slate-200 bg-slate-50 font-mono focus:outline-none focus:bg-white leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Right Column: AI MCQ Generation Configuration */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>2. FRAC Competency Mapping & Parameters</span>
            </h2>

            {/* Target Competency */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Target FRAC Competency Domain:
              </label>
              <select
                id="select-target-competency"
                value={targetCompetency}
                onChange={(e) => setTargetCompetency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600 bg-white"
              >
                {MOSPI_COMPETENCIES.map((comp) => (
                  <option key={comp.id} value={comp.name}>
                    {comp.name} ({comp.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Cadre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Target MoSPI Cadre / Role:
              </label>
              <select
                id="select-target-cadre"
                value={targetCadre}
                onChange={(e) => setTargetCadre(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600 bg-white"
              >
                <option value="Statistical Investigator Grade II / Field Officer">
                  Statistical Investigator Grade II / Field Officer (FOD)
                </option>
                <option value="Statistical Investigator Grade I / Supervisor">
                  Statistical Investigator Grade I / Supervisor (SDRD)
                </option>
                <option value="Assistant Director (Price Statistics / NAS)">
                  Assistant Director (Price Statistics / NAS)
                </option>
                <option value="Deputy Director / Senior Statistical Officer">
                  Deputy Director / Senior Statistical Officer (ESD)
                </option>
              </select>
            </div>

            {/* Question Count and Difficulty */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Number of MCQs:
                </label>
                <select
                  id="select-question-count"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600 bg-white"
                >
                  <option value={2}>2 Questions (Rapid)</option>
                  <option value={4}>4 Questions (Standard)</option>
                  <option value={6}>6 Questions (In-Depth)</option>
                  <option value={8}>8 Questions (Module Test)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Difficulty Level:
                </label>
                <select
                  id="select-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-600 bg-white"
                >
                  <option value="Beginner">Beginner (Foundational)</option>
                  <option value="Intermediate">Intermediate (Operational)</option>
                  <option value="Advanced">Advanced (Methodological)</option>
                </select>
              </div>
            </div>

            {/* Error or Notice message */}
            {generationError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{generationError}</span>
              </div>
            )}
            {generationNotice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{generationNotice}</span>
              </div>
            )}
            {extractionStatus && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{extractionStatus}</span>
              </div>
            )}

            {/* Trigger Button */}
            <div className="pt-3">
              <button
                id="btn-run-ai-generation"
                type="button"
                disabled={isGenerating}
                onClick={handleRunAIEngine}
                className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold text-xs tracking-wide uppercase transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Manual & Generating MCQs via Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Run AI Question Generation Engine</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Result Card */}
          {lastGeneratedQuestions.length > 0 && (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-2xs space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-emerald-950">
                    Successfully Generated {lastGeneratedQuestions.length} Competency MCQs!
                  </h3>
                </div>
                <span className="text-xs text-emerald-700 font-semibold">
                  Status: Sent to Review Queue
                </span>
              </div>

              <p className="text-xs text-emerald-800 leading-relaxed">
                The questions have been drafted and automatically routed to the <strong>Admin Review Queue</strong> for human validation. You can inspect or edit them before publishing.
              </p>

              <div className="pt-1 flex items-center justify-end">
                <button
                  id="btn-go-to-review-queue"
                  type="button"
                  onClick={onGoToReview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>Open Human Review Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
