import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Target,
  CheckCircle2,
  BookOpen,
  Star,
  Lightbulb,
  Play,
  Edit3,
  Plus,
  Trash2,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ThumbsUp,
  Tv,
  Layers,
  Palette,
  MessageSquare,
} from 'lucide-react';
import type {
  Slide,
  SlideType,
  SlideTheme,
  BulletItem,
  QAQuestion,
  SlideComment,
  CommentField,
  ProposedOp,
  AgentSession,
} from './types';
import { AGENT_SESSION_IDLE, toTargetElement } from './types';
import { CommentAnchor } from './components/InlineComment';
import { AgentStatusBar } from './components/AgentStatusBar';

// ---- Icons helper ----

const BulletIcon = ({ name, className = 'w-5 h-5' }: { name: string; className?: string }) => {
  switch (name) {
    case 'sparkles': return <Sparkles className={className} />;
    case 'target':   return <Target className={className} />;
    case 'check':    return <CheckCircle2 className={className} />;
    case 'book':     return <BookOpen className={className} />;
    case 'star':     return <Star className={className} />;
    case 'lightbulb':return <Lightbulb className={className} />;
    default:         return <Sparkles className={className} />;
  }
};

const ALL_ICONS = ['sparkles', 'target', 'check', 'book', 'star', 'lightbulb'] as const;

// ---- Default deck & questions ----

const DEFAULT_DECK: Slide[] = [
  {
    id: 'slide-1',
    type: 'title',
    tag: 'CONFERENCE 2026',
    title: 'The Future of Learning',
    subtitle: 'How artificial intelligence and real-time audience synergy are reshaping the modern classroom.',
    footerLeft: 'EduAI Forum 2026',
    footerRight: 'Join at Slido.com #EduAI',
  },
  {
    id: 'slide-2',
    type: 'bullet',
    tag: 'AI in Education',
    title: 'AI for Education',
    subtitle: 'Personalizing learning at scale',
    bullets: [
      { text: 'Adaptive tutoring that meets each learner where they are.', icon: 'target' },
      { text: 'Automated feedback and grading to free teachers for mentorship.', icon: 'check' },
      { text: 'Accessible content generation for diverse learning needs.', icon: 'book' },
    ],
    footerLeft: 'EduAI Forum',
    footerRight: 'Responsible AI: human oversight, privacy, and equity first',
  },
  {
    id: 'slide-3',
    type: 'poll',
    tag: 'AUDIENCE POLL',
    title: 'How do you plan to use AI in your courses next semester?',
    subtitle: 'Live-updating results from your audience appear here in real time.',
    pollOptions: [
      { text: 'Personalized tutoring & student support bots', votes: 14 },
      { text: 'Automated assessment & lesson planning content', votes: 9 },
      { text: 'Interactive curriculum & live slide simulations', votes: 12 },
      { text: 'No immediate plans for AI integration', votes: 3 },
    ],
    footerLeft: 'EduAI Forum',
    footerRight: 'Interact live on your phone',
  },
  {
    id: 'slide-4',
    type: 'qa',
    tag: 'LIVE Q&A',
    title: 'Ask Us Anything!',
    subtitle: 'Submit your questions and upvote others in the panel to rank them here.',
    footerLeft: 'EduAI Forum Q&A',
    footerRight: 'Presenting Live Q&A',
  },
];

const DEFAULT_QUESTIONS: QAQuestion[] = [
  {
    id: 'q-1',
    text: 'How can we ensure academic integrity when students have full access to personalized tutoring models?',
    upvotes: 18,
    author: 'Prof. Miller',
    timestamp: '2 mins ago',
    isAnswered: false,
  },
  {
    id: 'q-2',
    text: 'What is the cost model for deploying custom tutoring bots across an entire public school district?',
    upvotes: 11,
    author: 'Admin Sarah',
    timestamp: '5 mins ago',
    isAnswered: false,
  },
  {
    id: 'q-3',
    text: 'Are there student data privacy risks when storing conversation histories for long-term learning analytics?',
    upvotes: 8,
    author: 'TechDept',
    timestamp: '10 mins ago',
    isAnswered: false,
  },
];

// ---- Op helpers ----
// Server returns Hardik's op schema: { type, field?, value?, index?, text?, icon? }

function applyOpToSlide(slide: Slide, op: ProposedOp): Slide {
  let updated: Slide = { ...slide };

  if (op.type === 'update_field' && op.field && op.value !== undefined) {
    return { ...updated, [op.field]: op.value };
  }

  if (op.type === 'update_bullet' && updated.bullets && op.index !== undefined) {
    const bullets = [...updated.bullets];
    if (bullets[op.index]) {
      bullets[op.index] = {
        ...bullets[op.index],
        ...(op.text !== undefined && { text: op.text }),
        ...(op.icon !== undefined && { icon: op.icon }),
      };
    }
    return { ...updated, bullets };
  }

  if (op.type === 'add_bullet') {
    const bullets = [...(updated.bullets ?? [])];
    bullets.push({ text: op.text ?? 'New point', icon: op.icon ?? 'sparkles' });
    return { ...updated, bullets };
  }

  if (op.type === 'remove_bullet' && updated.bullets && op.index !== undefined) {
    return { ...updated, bullets: updated.bullets.filter((_, i) => i !== op.index) };
  }

  if (op.type === 'update_poll' && updated.pollOptions && op.index !== undefined) {
    const pollOptions = [...updated.pollOptions];
    if (pollOptions[op.index] && op.text !== undefined) {
      pollOptions[op.index] = { ...pollOptions[op.index], text: op.text };
    }
    return { ...updated, pollOptions };
  }

  if (op.type === 'add_poll') {
    const pollOptions = [...(updated.pollOptions ?? [])];
    pollOptions.push({ text: op.text ?? 'New option', votes: 0 });
    return { ...updated, pollOptions };
  }

  if (op.type === 'remove_poll' && updated.pollOptions && op.index !== undefined) {
    return { ...updated, pollOptions: updated.pollOptions.filter((_, i) => i !== op.index) };
  }

  return updated;
}

// Applies a list of ops to a specific slide in the deck, by id.
function applyOpsToDeck(
  deckToUpdate: Slide[],
  slideId: string,
  ops: ProposedOp[],
): Slide[] {
  return deckToUpdate.map((slide) =>
    slide.id !== slideId ? slide : ops.reduce(applyOpToSlide, slide),
  );
}

// ---- App ----

export default function App() {

  // ---- Core presentation state ----
  const [deck, setDeck] = useState<Slide[]>(() => {
    const saved = localStorage.getItem('better_slido_deck');
    return saved ? JSON.parse(saved) : DEFAULT_DECK;
  });

  const [questions, setQuestions] = useState<QAQuestion[]>(() => {
    const saved = localStorage.getItem('better_slido_questions');
    return saved ? JSON.parse(saved) : DEFAULT_QUESTIONS;
  });

  const [currentSlideIndex, setCurrentSlideIndex] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [theme, setTheme] = useState<SlideTheme>('editorial');

  // ---- Comments & agent state ----
  const [comments, setComments] = useState<SlideComment[]>(() => {
    const saved = localStorage.getItem('better_slido_comments');
    return saved ? JSON.parse(saved) : [];
  });
  const [agentSession, setAgentSession] = useState<AgentSession>(AGENT_SESSION_IDLE);
  const sseAbortRef = useRef<AbortController | null>(null);

  // ---- Derived state ----

  // Real deck slide for editing operations
  const activeSlide = deck[currentSlideIndex] ?? deck[0];
  const displaySlide = activeSlide;

  // ---- Persistence ----
  useEffect(() => { localStorage.setItem('better_slido_deck', JSON.stringify(deck)); }, [deck]);
  useEffect(() => { localStorage.setItem('better_slido_questions', JSON.stringify(questions)); }, [questions]);
  useEffect(() => { localStorage.setItem('better_slido_comments', JSON.stringify(comments)); }, [comments]);

  // ---- Keyboard navigation ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlideIndex((prev) => Math.min(deck.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape' && isPreviewMode) {
        setIsPreviewMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deck.length, isPreviewMode, isEditing]);

  // Auto-dismiss 'applied' status after 3 s
  useEffect(() => {
    if (agentSession.status !== 'applied') return;
    const t = setTimeout(() => setAgentSession(AGENT_SESSION_IDLE), 3000);
    return () => clearTimeout(t);
  }, [agentSession.status]);

  // ---- Slide edit handlers ----

  const handleUpdateSlideField = (field: keyof Slide, value: unknown) => {
    setDeck((prev) => prev.map((s, idx) => idx === currentSlideIndex ? { ...s, [field]: value } : s));
  };

  const handleUpdateBullet = (bulletIndex: number, text: string) => {
    if (!activeSlide.bullets) return;
    const updated = [...activeSlide.bullets];
    updated[bulletIndex] = { ...updated[bulletIndex], text };
    handleUpdateSlideField('bullets', updated);
  };

  const handleUpdateBulletIcon = (bulletIndex: number, iconName: BulletItem['icon']) => {
    if (!activeSlide.bullets) return;
    const updated = [...activeSlide.bullets];
    updated[bulletIndex] = { ...updated[bulletIndex], icon: iconName };
    handleUpdateSlideField('bullets', updated);
  };

  const handleAddBulletPoint = () => {
    if (!activeSlide.bullets) return;
    handleUpdateSlideField('bullets', [
      ...activeSlide.bullets,
      { text: 'New bullet point. Click to edit.', icon: 'sparkles' as const },
    ]);
  };

  const handleRemoveBulletPoint = (index: number) => {
    if (!activeSlide.bullets || activeSlide.bullets.length <= 1) return;
    handleUpdateSlideField('bullets', activeSlide.bullets.filter((_, i) => i !== index));
  };

  const handleUpdatePollOption = (optionIndex: number, text: string) => {
    if (!activeSlide.pollOptions) return;
    const updated = [...activeSlide.pollOptions];
    updated[optionIndex] = { ...updated[optionIndex], text };
    handleUpdateSlideField('pollOptions', updated);
  };

  const handleAddPollOption = () => {
    if (!activeSlide.pollOptions) return;
    handleUpdateSlideField('pollOptions', [...activeSlide.pollOptions, { text: 'New Poll Option', votes: 0 }]);
  };

  const handleRemovePollOption = (index: number) => {
    if (!activeSlide.pollOptions || activeSlide.pollOptions.length <= 2) return;
    handleUpdateSlideField('pollOptions', activeSlide.pollOptions.filter((_, i) => i !== index));
  };

  const handleResetDeck = () => {
    if (window.confirm('Reset slide deck to default "AI for Education" presentation?')) {
      setDeck(DEFAULT_DECK);
      setQuestions(DEFAULT_QUESTIONS);
      setComments([]);
      setCurrentSlideIndex(1);
      setAgentSession(AGENT_SESSION_IDLE);
      localStorage.removeItem('better_slido_deck');
      localStorage.removeItem('better_slido_questions');
      localStorage.removeItem('better_slido_comments');
    }
  };

  const handleAddNewSlide = (type: SlideType) => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      type,
      tag: 'NEW SLIDE',
      title:
        type === 'title' ? 'Click to Edit Title' :
        type === 'bullet' ? 'Key Insights' :
        type === 'poll' ? 'Audience Opinion' : 'Q&A Session',
      subtitle: 'Double click any text on the slide to edit details.',
      footerLeft: 'Better Slido Presentation',
      footerRight: 'Slido.com',
      ...(type === 'bullet' && {
        bullets: [
          { text: 'First core takeaway of this section.', icon: 'lightbulb' as const },
          { text: 'Second important supporting point with editable icon.', icon: 'sparkles' as const },
        ],
      }),
      ...(type === 'poll' && {
        pollOptions: [
          { text: 'Strongly Agree', votes: 0 },
          { text: 'Agree', votes: 0 },
          { text: 'Neutral', votes: 0 },
          { text: 'Disagree', votes: 0 },
        ],
      }),
    };
    setDeck((prev) => [...prev, newSlide]);
    setCurrentSlideIndex(deck.length);
  };

  const handleDeleteSlide = () => {
    if (deck.length <= 1) { alert('You must keep at least one slide.'); return; }
    if (window.confirm(`Delete Slide ${currentSlideIndex + 1}?`)) {
      setDeck((prev) => prev.filter((_, i) => i !== currentSlideIndex));
      setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
    }
  };

  // ---- Comment handlers ----

  const handleAddComment = (comment: Omit<SlideComment, 'id' | 'createdAt'>) => {
    const newComment: SlideComment = {
      ...comment,
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    };
    setComments((prev) => [newComment, ...prev]);
  };

  const handleResolveComment = (id: string) => {
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, resolved: true } : c));
  };

  // ---- Agent handlers ----
  // POSTs to Hardik's /api/agent/resolve endpoint (one-shot JSON, schema-validated by Gemini).
  // Autonomous: ops are applied immediately, no review step.

  const triggerAgent = async (slideId: string, field: CommentField, commentText: string) => {
    sseAbortRef.current?.abort();
    const abort = new AbortController();
    sseAbortRef.current = abort;

    const targetSlide = deck.find((s) => s.id === slideId) ?? deck[currentSlideIndex];
    setAgentSession({ status: 'thinking', streamingText: '', proposedOps: [] });

    try {
      const res = await fetch('/api/agent/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide: targetSlide,
          comment: commentText,
          targetElement: toTargetElement(field),
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        setAgentSession((p) => ({ ...p, status: 'error', errorMessage: `Server ${res.status}: ${text}` }));
        return;
      }

      const data = (await res.json()) as { proposedOps?: ProposedOp[]; explanation?: string; error?: string };

      if (data.error) {
        setAgentSession((p) => ({ ...p, status: 'error', errorMessage: data.error! }));
        return;
      }

      const ops = data.proposedOps ?? [];
      if (ops.length > 0) {
        setDeck((prev) => applyOpsToDeck(prev, slideId, ops));
      }
      setAgentSession({
        status: 'applied',
        streamingText: data.explanation ?? '',
        proposedOps: ops,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setAgentSession((p) => ({ ...p, status: 'error', errorMessage: msg }));
    }
  };

  const handleCancelAgent = () => {
    sseAbortRef.current?.abort();
    setAgentSession(AGENT_SESSION_IDLE);
  };

  // Helper: get comments for a specific slide field
  const getFieldComments = (slideId: string, field: CommentField) =>
    comments.filter((c) => c.slideId === slideId && c.field === field);

  // Helper: unresolved comment count for a slide
  const slideCommentCount = (slideId: string) =>
    comments.filter((c) => c.slideId === slideId && !c.resolved).length;

  // ---- Q&A handlers (presenter-side only) ----

  const handleMarkAsAnswered = (qId: string) => {
    setQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, isAnswered: !q.isAnswered } : q));
  };

  const handleDeleteQuestion = (qId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  const totalPollVotes = activeSlide.pollOptions?.reduce((sum, opt) => sum + opt.votes, 0) ?? 0;

  // ---- Theme CSS ----

  const getThemeClasses = () => {
    switch (theme) {
      case 'editorial':
        return {
          wrapper:    'bg-[#faf8f5] text-[#1c1917] border border-[#e5e2da]',
          headerTag:  'text-[#854d0e] tracking-widest uppercase font-semibold text-xs',
          title:      'serif-heading text-[#1c1917] font-black leading-tight',
          subtitle:   'text-[#57534e] italic font-serif',
          bulletIcon: 'bg-[#f5f2eb] text-[#854d0e] border border-[#e5e2da]',
          bulletText: 'text-[#292524] font-medium',
          footer:     'border-t border-[#e5e2da] text-[#78716c] font-serif italic',
          pollBar:    'bg-[#d97706]',
          pollBarBg:  'bg-[#f5f2eb] border border-[#e5e2da]',
          qaCard:     'bg-[#faf8f5] border border-[#e5e2da] text-[#1c1917]',
        };
      case 'modern-dark':
        return {
          wrapper:    'bg-[#18181b] text-[#f4f4f5] border border-[#27272a]',
          headerTag:  'text-[#10b981] tracking-widest uppercase font-semibold text-xs',
          title:      'font-sans font-extrabold text-white leading-tight tracking-tight',
          subtitle:   'text-[#a1a1aa] font-sans',
          bulletIcon: 'bg-[#27272a] text-[#10b981] border border-[#3f3f46]',
          bulletText: 'text-[#e4e4e7]',
          footer:     'border-t border-[#27272a] text-[#71717a] font-sans',
          pollBar:    'bg-[#10b981]',
          pollBarBg:  'bg-[#27272a] border border-[#3f3f46]',
          qaCard:     'bg-[#27272a] border border-[#3f3f46] text-[#e4e4e7]',
        };
      case 'vibrant-pastel':
        return {
          wrapper:    'bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] text-[#1e1b4b] border border-[#dbeafe]',
          headerTag:  'text-[#6366f1] tracking-widest uppercase font-black text-xs',
          title:      'font-sans font-black text-[#1e1b4b] leading-tight',
          subtitle:   'text-[#4f46e5] opacity-90',
          bulletIcon: 'bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]',
          bulletText: 'text-[#312e81] font-semibold',
          footer:     'border-t border-[#dbeafe] text-[#4f46e5] font-sans',
          pollBar:    'bg-[#6366f1]',
          pollBarBg:  'bg-[#f3f4f6] border border-[#e5e7eb]',
          qaCard:     'bg-[#ffffff] border border-[#e0e7ff] shadow-sm text-[#1e1b4b]',
        };
    }
  };

  const themeStyle = getThemeClasses();

  // ---- JSX ----

  return (
    <div className="min-h-screen bg-[#f3f2ee] flex flex-col font-sans selection:bg-[#d97706]/20">

      {/* ── Header ── */}
      <header className="bg-white border-b border-[#e5e2da] px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-[#1c1917] text-white p-2 rounded-lg">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1c1917] tracking-tight">Better Slido</h1>
            <p className="text-xs text-[#78716c]">Interactive Presentation & Audience Co-Creation Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme selector */}
          <div className="flex items-center gap-1.5 bg-[#faf8f5] border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#57534e]">
            <Palette className="w-3.5 h-3.5" />
            <span>Theme:</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as SlideTheme)}
              className="bg-transparent font-bold text-[#1c1917] focus:outline-none cursor-pointer"
            >
              <option value="editorial">Editorial Ivory</option>
              <option value="modern-dark">Modern Obsidian</option>
              <option value="vibrant-pastel">Vibrant Pastel</option>
            </select>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
              isEditing
                ? 'bg-[#10b981] text-white border-transparent'
                : 'bg-white hover:bg-[#faf8f5] text-[#1c1917] border-[#cbd5e1]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Editing Mode Active' : 'Enable Editor'}</span>
          </button>

          <button
            onClick={() => setIsPreviewMode(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1c1917] hover:bg-[#292524] text-white border-transparent flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Present (FullScreen)</span>
          </button>

          <div className="h-6 w-[1px] bg-gray-200" />

          <button
            onClick={handleResetDeck}
            title="Reset to default slides"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-[#faf8f5] border border-gray-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── Presentation Board (full width) ── */}
        <div className="lg:col-span-12 max-w-[1100px] mx-auto w-full flex flex-col gap-6">

          {/* Slide canvas */}
          <div className="relative w-full aspect-[16/9] bg-white rounded-3xl shadow-xl overflow-hidden border border-[#e5e2da] group">
            <div className={`w-full h-full p-[5%] flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${themeStyle.wrapper}`}>

              {/* ── Slide header: tag, title, subtitle ── */}
              <div className="space-y-2">

                {/* Tag */}
                <CommentAnchor
                  slideId={activeSlide.id} field="tag"
                  comments={getFieldComments(activeSlide.id, 'tag')}
                  onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                  onTriggerAgent={triggerAgent}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={activeSlide.tag}
                      onChange={(e) => handleUpdateSlideField('tag', e.target.value)}
                      className="bg-black/5 rounded px-2 py-0.5 border-none font-sans font-bold tracking-widest text-xs uppercase text-[#854d0e] focus:outline-none focus:bg-amber-100"
                    />
                  ) : (
                    <span className={themeStyle.headerTag}>{displaySlide.tag}</span>
                  )}
                </CommentAnchor>

                {/* Title */}
                <CommentAnchor
                  slideId={activeSlide.id} field="title"
                  comments={getFieldComments(activeSlide.id, 'title')}
                  onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                  onTriggerAgent={triggerAgent}
                >
                  {isEditing ? (
                    <textarea
                      rows={1}
                      value={activeSlide.title}
                      onChange={(e) => handleUpdateSlideField('title', e.target.value)}
                      className="w-full bg-black/5 rounded px-2 py-1 serif-heading text-2xl md:text-3xl font-black text-[#1c1917] focus:outline-none focus:bg-amber-100 resize-none"
                    />
                  ) : (
                    <h2 className={`${themeStyle.title} text-2xl md:text-3xl lg:text-4xl font-black`}>
                      {displaySlide.title}
                    </h2>
                  )}
                </CommentAnchor>

                {/* Subtitle */}
                <CommentAnchor
                  slideId={activeSlide.id} field="subtitle"
                  comments={getFieldComments(activeSlide.id, 'subtitle')}
                  onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                  onTriggerAgent={triggerAgent}
                >
                  {isEditing ? (
                    <textarea
                      rows={2}
                      value={activeSlide.subtitle}
                      onChange={(e) => handleUpdateSlideField('subtitle', e.target.value)}
                      className="w-full bg-black/5 rounded px-2 py-1 font-serif italic text-sm text-[#57534e] focus:outline-none focus:bg-amber-100 resize-none"
                    />
                  ) : (
                    <p className={`${themeStyle.subtitle} text-sm md:text-base lg:text-lg`}>
                      {displaySlide.subtitle}
                    </p>
                  )}
                </CommentAnchor>
              </div>

              {/* ── Slide body ── */}
              <div className="flex-1 flex items-center my-4 overflow-y-auto max-h-[50%]">

                {/* 1. Bullet slide */}
                {activeSlide.type === 'bullet' && activeSlide.bullets && (
                  <ul className="w-full space-y-3.5 md:space-y-4">
                    {activeSlide.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-4 animate-slide-up group/bullet">
                        {/* Icon */}
                        <div className="relative">
                          <div className={`p-2 rounded-xl flex-shrink-0 cursor-pointer ${themeStyle.bulletIcon} hover:scale-105 transition`}>
                            <BulletIcon name={b.icon} className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          {isEditing && (
                            <div className="absolute top-10 left-0 bg-white border border-[#cbd5e1] rounded-lg shadow-lg p-1.5 z-20 flex gap-1 hidden group-hover/bullet:flex">
                              {ALL_ICONS.map((iName) => (
                                <button
                                  key={iName}
                                  onClick={() => handleUpdateBulletIcon(bIdx, iName)}
                                  className={`p-1 rounded hover:bg-amber-50 text-[#1c1917] ${b.icon === iName ? 'bg-amber-100' : ''}`}
                                >
                                  <BulletIcon name={iName} className="w-3.5 h-3.5" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Bullet text with comment anchor */}
                        <div className="flex-grow pt-0.5">
                          <CommentAnchor
                            slideId={activeSlide.id}
                            field={`bullet-${bIdx}` as CommentField}
                            comments={getFieldComments(activeSlide.id, `bullet-${bIdx}` as CommentField)}
                            onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                            onTriggerAgent={triggerAgent}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  type="text"
                                  value={b.text}
                                  onChange={(e) => handleUpdateBullet(bIdx, e.target.value)}
                                  className="flex-1 bg-black/5 rounded px-2 py-0.5 text-sm font-sans text-stone-900 focus:outline-none focus:bg-amber-100"
                                />
                                <button onClick={() => handleRemoveBulletPoint(bIdx)} className="text-red-500 hover:text-red-700 p-1">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p className={`${themeStyle.bulletText} text-xs md:text-sm lg:text-base`}>
                                {displaySlide.bullets?.[bIdx]?.text ?? b.text}
                              </p>
                            )}
                          </CommentAnchor>
                        </div>
                      </li>
                    ))}

                    {isEditing && (
                      <button
                        onClick={handleAddBulletPoint}
                        className="flex items-center gap-1.5 text-xs text-amber-800 font-bold hover:underline mt-2 border border-dashed border-amber-800/40 px-3 py-1.5 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Bullet Takeaway
                      </button>
                    )}
                  </ul>
                )}

                {/* 2. Poll slide */}
                {activeSlide.type === 'poll' && activeSlide.pollOptions && (
                  <div className="w-full space-y-3">
                    {activeSlide.pollOptions.map((opt, optIdx) => {
                      const displayOpt = displaySlide.pollOptions?.[optIdx] ?? opt;
                      const votePct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                      return (
                        <div key={optIdx} className="w-full space-y-1 animate-slide-up">
                          <div className="flex justify-between items-center text-xs md:text-sm font-bold">
                            <CommentAnchor
                              slideId={activeSlide.id}
                              field={`poll-${optIdx}` as CommentField}
                              comments={getFieldComments(activeSlide.id, `poll-${optIdx}` as CommentField)}
                              onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                              onTriggerAgent={triggerAgent}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2 flex-1 mr-4">
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => handleUpdatePollOption(optIdx, e.target.value)}
                                    className="flex-1 bg-black/5 rounded px-2 py-0.5 text-xs focus:outline-none focus:bg-amber-100 text-stone-900"
                                  />
                                  <button onClick={() => handleRemovePollOption(optIdx)} className="text-red-500 hover:text-red-700 p-1">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="opacity-90">{displayOpt.text}</span>
                              )}
                            </CommentAnchor>
                            <span className="font-mono ml-4 flex-shrink-0">{opt.votes} votes ({votePct}%)</span>
                          </div>
                          <div className={`w-full h-2.5 rounded-full overflow-hidden ${themeStyle.pollBarBg}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${themeStyle.pollBar}`}
                              style={{ width: `${votePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {isEditing && (
                      <button
                        onClick={handleAddPollOption}
                        className="flex items-center gap-1.5 text-xs text-amber-800 font-bold hover:underline mt-2 border border-dashed border-amber-800/40 px-3 py-1.5 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Poll Option
                      </button>
                    )}
                  </div>
                )}

                {/* 3. Title slide */}
                {activeSlide.type === 'title' && (
                  <div className="w-full text-center space-y-4 py-6">
                    <div className="w-16 h-1 bg-[#d97706] mx-auto rounded-full" />
                    <p className="text-stone-500 text-xs tracking-widest font-mono font-bold uppercase">Audience Code: #EduAI</p>
                  </div>
                )}

                {/* 4. Q&A slide */}
                {activeSlide.type === 'qa' && (
                  <div className="w-full space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                    {questions.filter((q) => !q.isAnswered).length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs italic">
                        No active questions yet.
                      </div>
                    ) : (
                      questions
                        .filter((q) => !q.isAnswered)
                        .sort((a, b) => b.upvotes - a.upvotes)
                        .slice(0, 3)
                        .map((q) => (
                          <div key={q.id} className={`p-3 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-slide-up ${themeStyle.qaCard}`}>
                            <div className="space-y-1">
                              <p className="text-xs md:text-sm font-bold leading-snug">{q.text}</p>
                              <div className="flex items-center gap-2 text-[10px] opacity-75">
                                <span className="font-bold text-amber-800">{q.author}</span>
                                <span>•</span>
                                <span>{q.timestamp}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 bg-amber-500/10 text-amber-900 border border-amber-500/20 px-2.5 py-1.5 rounded-xl">
                              <ThumbsUp className="w-3 h-3 fill-amber-700/20" />
                              <span className="text-xs font-mono font-black">{q.upvotes}</span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className={`pt-3 flex justify-between items-center text-[10px] md:text-xs ${themeStyle.footer}`}>
                <CommentAnchor
                  slideId={activeSlide.id} field="footerLeft"
                  comments={getFieldComments(activeSlide.id, 'footerLeft')}
                  onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                  onTriggerAgent={triggerAgent}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={activeSlide.footerLeft}
                      onChange={(e) => handleUpdateSlideField('footerLeft', e.target.value)}
                      className="bg-black/5 rounded px-2 py-0.5 focus:outline-none focus:bg-amber-100 text-stone-900"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 font-bold">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                      <span>{displaySlide.footerLeft}</span>
                    </div>
                  )}
                </CommentAnchor>

                <CommentAnchor
                  slideId={activeSlide.id} field="footerRight"
                  comments={getFieldComments(activeSlide.id, 'footerRight')}
                  onAddComment={handleAddComment} onResolveComment={handleResolveComment}
                  onTriggerAgent={triggerAgent}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={activeSlide.footerRight}
                      onChange={(e) => handleUpdateSlideField('footerRight', e.target.value)}
                      className="bg-black/5 rounded px-2 py-0.5 focus:outline-none focus:bg-amber-100 text-stone-900"
                    />
                  ) : (
                    <span>{displaySlide.footerRight}</span>
                  )}
                </CommentAnchor>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />
              <span>Slide {currentSlideIndex + 1} of {deck.length} ({activeSlide.type.toUpperCase()})</span>
            </div>
          </div>

          {/* ── Slide-level tag strip ── */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-stone-400 font-medium">
              Hover any field to comment on it, or tag the whole slide:
            </span>
            <CommentAnchor
              slideId={activeSlide.id}
              field="slide"
              comments={getFieldComments(activeSlide.id, 'slide')}
              onAddComment={handleAddComment}
              onResolveComment={handleResolveComment}
              onTriggerAgent={triggerAgent}
              trigger="children"
            >
              <button className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
                getFieldComments(activeSlide.id, 'slide').filter(c => !c.resolved).length > 0
                  ? 'bg-violet-50 border-violet-200 text-violet-700'
                  : 'bg-white border-stone-200 text-stone-500 hover:border-violet-300 hover:text-violet-600'
              }`}>
                <MessageSquare className="w-3.5 h-3.5" />
                Tag entire slide
                {getFieldComments(activeSlide.id, 'slide').filter(c => !c.resolved).length > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {getFieldComments(activeSlide.id, 'slide').filter(c => !c.resolved).length}
                  </span>
                )}
              </button>
            </CommentAnchor>
          </div>

          {/* ── Agent status bar ── */}
          <AgentStatusBar session={agentSession} onCancel={handleCancelAgent} />

          {/* ── Deck navigation & manager ── */}
          <div className="bg-white rounded-2xl border border-[#e5e2da] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1c1917] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#854d0e]" />
                Presentation Slides Outline
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAddNewSlide('bullet')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Bullet List
                </button>
                <button
                  onClick={() => handleAddNewSlide('poll')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Live Poll
                </button>
                <button
                  onClick={handleDeleteSlide}
                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200"
                  title="Delete current slide"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slide thumbnails */}
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
              {deck.map((slide, idx) => {
                const commentCount = slideCommentCount(slide.id);
                return (
                  <button
                    key={slide.id}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`relative flex-shrink-0 w-36 aspect-[16/10] rounded-xl border-2 p-2.5 text-left flex flex-col justify-between transition-all ${
                      idx === currentSlideIndex
                        ? 'border-[#2563eb] bg-[#eff6ff] ring-2 ring-blue-600/10'
                        : 'border-[#cbd5e1] bg-[#faf8f5] hover:border-gray-400 hover:bg-white'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase font-bold text-blue-800 tracking-wider">Slide {idx + 1}</span>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{slide.title || 'Untitled'}</h4>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200/60 font-semibold uppercase text-gray-600 self-start">
                      {slide.type}
                    </span>
                    {/* Comment count badge */}
                    {commentCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center shadow">
                        {commentCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slide navigation footer */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <button
                onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#cbd5e1] hover:bg-gray-50 flex items-center gap-1 text-[#1c1917] disabled:opacity-40"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Prev Slide
              </button>
              <span className="text-xs font-semibold text-stone-500 font-mono">
                Slide {currentSlideIndex + 1} of {deck.length}
              </span>
              <button
                onClick={() => setCurrentSlideIndex((prev) => Math.min(deck.length - 1, prev + 1))}
                disabled={currentSlideIndex === deck.length - 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#cbd5e1] hover:bg-gray-50 flex items-center gap-1 text-[#1c1917] disabled:opacity-40"
              >
                Next Slide
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Q&A presenter control deck ── */}
          {activeSlide.type === 'qa' && (
            <div className="bg-white rounded-2xl border border-[#e5e2da] p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900">Presenter Q&A Control Deck</h3>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {questions.length} Total Questions
                </span>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {questions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">No audience questions submitted yet.</p>
                ) : (
                  questions
                    .sort((a, b) => b.upvotes - a.upvotes)
                    .map((q) => (
                      <div
                        key={q.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                          q.isAnswered ? 'bg-gray-50/60 border-gray-100 opacity-60' : 'bg-white border-gray-200 shadow-sm'
                        }`}
                      >
                        <div className="space-y-1">
                          <p className={`text-xs font-semibold ${q.isAnswered ? 'line-through text-gray-400' : 'text-gray-900'}`}>{q.text}</p>
                          <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                            <span className="font-bold text-stone-600">{q.author}</span>
                            <span>•</span>
                            <span>{q.timestamp}</span>
                            {q.isAnswered && <span className="bg-green-100 text-green-700 text-[8px] font-extrabold px-1 rounded">ANSWERED</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMarkAsAnswered(q.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                              q.isAnswered
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {q.isAnswered ? 'Reopen' : 'Mark Answered'}
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 hover:bg-red-50 text-red-500 rounded border border-transparent hover:border-red-100"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Present (fullscreen) mode ── */}
      {isPreviewMode && (
        <div className="fixed inset-0 bg-[#0c0a09] z-50 flex items-center justify-center p-[4%]">
          <div className="absolute top-6 right-6 z-50 flex gap-3">
            <span className="bg-black/60 backdrop-blur-md text-white/80 text-xs font-semibold px-4 py-2 rounded-full border border-white/10 flex items-center gap-1.5">
              Exit: press <strong>Esc</strong>
            </span>
            <button
              onClick={() => setIsPreviewMode(false)}
              className="bg-white/90 hover:bg-white text-stone-900 p-2.5 rounded-full shadow-lg font-bold border-none cursor-pointer transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="w-full max-w-[1300px] aspect-[16/9] shadow-2xl relative overflow-hidden rounded-3xl">
            <div className={`w-full h-full p-[6%] flex flex-col justify-between relative overflow-hidden ${themeStyle.wrapper}`}>
              <div className="space-y-3">
                <span className={`${themeStyle.headerTag} text-sm tracking-widest`}>{activeSlide.tag}</span>
                <h2 className={`${themeStyle.title} text-3xl md:text-5xl lg:text-6xl font-black`}>{activeSlide.title}</h2>
                <p className={`${themeStyle.subtitle} text-base md:text-xl lg:text-2xl`}>{activeSlide.subtitle}</p>
              </div>

              <div className="flex-1 flex items-center my-6 overflow-y-auto max-h-[60%]">
                {activeSlide.type === 'bullet' && activeSlide.bullets && (
                  <ul className="w-full space-y-4 md:space-y-5 lg:space-y-6">
                    {activeSlide.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-5 animate-slide-up">
                        <div className={`p-3.5 rounded-2xl flex-shrink-0 ${themeStyle.bulletIcon}`}>
                          <BulletIcon name={b.icon} className="w-6 h-6 md:w-7 md:h-7" />
                        </div>
                        <div className="flex-grow pt-1">
                          <p className={`${themeStyle.bulletText} text-sm md:text-lg lg:text-2xl`}>{b.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {activeSlide.type === 'poll' && activeSlide.pollOptions && (
                  <div className="w-full space-y-4 max-w-[900px] mx-auto">
                    {activeSlide.pollOptions.map((opt, optIdx) => {
                      const votePct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                      return (
                        <div key={optIdx} className="w-full space-y-1.5 animate-slide-up">
                          <div className="flex justify-between items-center text-xs md:text-lg font-bold">
                            <span className="opacity-90">{opt.text}</span>
                            <span className="font-mono">{opt.votes} votes ({votePct}%)</span>
                          </div>
                          <div className={`w-full h-4 rounded-full overflow-hidden ${themeStyle.pollBarBg}`}>
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${themeStyle.pollBar}`}
                              style={{ width: `${votePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeSlide.type === 'title' && (
                  <div className="w-full text-center space-y-6 py-12">
                    <div className="w-24 h-1.5 bg-[#d97706] mx-auto rounded-full" />
                    <p className="text-stone-500 text-sm md:text-lg tracking-widest font-mono font-bold uppercase">
                      Join Live at Slido.com • Code:{' '}
                      <span className="text-amber-800 bg-amber-500/10 px-3 py-1 rounded-xl font-bold">#EduAI</span>
                    </p>
                  </div>
                )}

                {activeSlide.type === 'qa' && (
                  <div className="w-full space-y-4 max-w-[900px] mx-auto">
                    {questions.filter((q) => !q.isAnswered).length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-lg italic">
                        Go ahead, ask us anything! Submit your questions live.
                      </div>
                    ) : (
                      questions
                        .filter((q) => !q.isAnswered)
                        .sort((a, b) => b.upvotes - a.upvotes)
                        .slice(0, 3)
                        .map((q) => (
                          <div key={q.id} className={`p-4 md:p-5 rounded-3xl flex items-center justify-between gap-6 shadow-md animate-slide-up ${themeStyle.qaCard}`}>
                            <div className="space-y-1.5">
                              <p className="text-sm md:text-lg lg:text-xl font-bold leading-snug">{q.text}</p>
                              <div className="flex items-center gap-2 text-xs opacity-75">
                                <span className="font-bold text-amber-800">{q.author}</span>
                                <span>•</span>
                                <span>{q.timestamp}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1 bg-amber-500/10 text-amber-900 border border-amber-500/20 px-3 py-2 rounded-2xl min-w-[50px]">
                              <ThumbsUp className="w-4 h-4 fill-amber-700/20" />
                              <span className="text-sm md:text-base font-mono font-black">{q.upvotes}</span>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              <div className={`pt-4 flex justify-between items-center text-xs md:text-sm ${themeStyle.footer}`}>
                <div className="flex items-center gap-2 font-bold">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>{activeSlide.footerLeft}</span>
                </div>
                <span>{activeSlide.footerRight}</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-6 flex items-center gap-2.5">
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentSlideIndex === 0}
              className="bg-black/60 border border-white/10 hover:bg-black text-white p-2.5 rounded-full disabled:opacity-40"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-white/80 font-mono text-sm">{currentSlideIndex + 1} / {deck.length}</span>
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.min(deck.length - 1, prev + 1))}
              disabled={currentSlideIndex === deck.length - 1}
              className="bg-black/60 border border-white/10 hover:bg-black text-white p-2.5 rounded-full disabled:opacity-40"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
