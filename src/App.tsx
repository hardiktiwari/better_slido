import React, { useState, useEffect } from 'react';
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
  Send, 
  Smartphone, 
  Tv, 
  Layers,
  Palette,
  MessageSquare,
  Terminal,
  Brain,
  Cpu,
  History,
  User,
  Code,
  ChevronRight,
  Check,
  X,
  AlertCircle
} from 'lucide-react';

// --- Types ---
interface BulletItem {
  text: string;
  icon: 'sparkles' | 'target' | 'check' | 'book' | 'star' | 'lightbulb';
}

interface PollOption {
  text: string;
  votes: number;
}

interface QAQuestion {
  id: string;
  text: string;
  upvotes: number;
  author: string;
  timestamp: string;
  isAnswered: boolean;
}

type SlideType = 'title' | 'bullet' | 'poll' | 'qa';
type SlideTheme = 'editorial' | 'modern-dark' | 'vibrant-pastel';

interface Slide {
  id: string;
  type: SlideType;
  tag: string;
  title: string;
  subtitle: string;
  bullets?: BulletItem[];
  pollOptions?: PollOption[];
  footerLeft: string;
  footerRight: string;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number; // position from left in %
  tx: number; // translation offset for bezier drift
  delay: number;
}

interface FloatingMessage {
  id: string;
  text: string;
  author: string;
  x: number;
}

interface SlideComment {
  id: string;
  slideId: string;
  targetElement: "title" | "subtitle" | "tag" | "bullets" | "poll" | "footer" | "general";
  commentText: string;
  author: string;
  resolved: boolean;
  timestamp: string;
}

// --- Icons Helper ---
const BulletIcon = ({ name, className = "w-5 height-5" }: { name: string; className?: string }) => {
  switch (name) {
    case 'sparkles': return <Sparkles className={className} />;
    case 'target': return <Target className={className} />;
    case 'check': return <CheckCircle2 className={className} />;
    case 'book': return <BookOpen className={className} />;
    case 'star': return <Star className={className} />;
    case 'lightbulb': return <Lightbulb className={className} />;
    default: return <Sparkles className={className} />;
  }
};

const ALL_ICONS = ['sparkles', 'target', 'check', 'book', 'star', 'lightbulb'] as const;

// --- Initial Default Presentation ---
const DEFAULT_DECK: Slide[] = [
  {
    id: 'slide-1',
    type: 'title',
    tag: 'CONFERENCE 2026',
    title: 'The Future of Learning',
    subtitle: 'How artificial intelligence and real-time audience synergy are reshaping the modern classroom.',
    footerLeft: 'EduAI Forum 2026',
    footerRight: 'Join at Slido.com #EduAI'
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
      { text: 'Accessible content generation for diverse learning needs.', icon: 'book' }
    ],
    footerLeft: 'EduAI Forum',
    footerRight: 'Responsible AI: human oversight, privacy, and equity first'
  },
  {
    id: 'slide-3',
    type: 'poll',
    tag: 'AUDIENCE POLL',
    title: 'How do you plan to use AI in your courses next semester?',
    subtitle: 'Cast your vote in the audience panel on the right to see live-updating results!',
    pollOptions: [
      { text: 'Personalized tutoring & student support bots', votes: 14 },
      { text: 'Automated assessment & lesson planning content', votes: 9 },
      { text: 'Interactive curriculum & live slide simulations', votes: 12 },
      { text: 'No immediate plans for AI integration', votes: 3 }
    ],
    footerLeft: 'EduAI Forum',
    footerRight: 'Interact live on your phone'
  },
  {
    id: 'slide-4',
    type: 'qa',
    tag: 'LIVE Q&A',
    title: 'Ask Us Anything!',
    subtitle: 'Submit your questions and upvote others in the panel to rank them here.',
    footerLeft: 'EduAI Forum Q&A',
    footerRight: 'Presenting Live Q&A'
  }
];

const DEFAULT_QUESTIONS: QAQuestion[] = [
  {
    id: 'q-1',
    text: 'How can we ensure academic integrity when students have full access to personalized tutoring models?',
    upvotes: 18,
    author: 'Prof. Miller',
    timestamp: '2 mins ago',
    isAnswered: false
  },
  {
    id: 'q-2',
    text: 'What is the cost model for deploying custom tutoring bots across an entire public school district?',
    upvotes: 11,
    author: 'Admin Sarah',
    timestamp: '5 mins ago',
    isAnswered: false
  },
  {
    id: 'q-3',
    text: 'Are there student data privacy risks when storing conversation histories for long-term learning analytics?',
    upvotes: 8,
    author: 'TechDept',
    timestamp: '10 mins ago',
    isAnswered: false
  }
];

const DEFAULT_COMMENTS: SlideComment[] = [
  {
    id: 'comment-1',
    slideId: 'slide-2',
    targetElement: 'title',
    commentText: 'Optimize this heading! Make it sound a bit more professional and academically engaging.',
    author: 'Dr. Evans',
    resolved: false,
    timestamp: '10m ago'
  },
  {
    id: 'comment-2',
    slideId: 'slide-3',
    targetElement: 'poll',
    commentText: 'Add an option for: "Interactive custom agent pipelines" to reflect latest advancements.',
    author: 'Chief Organizer',
    resolved: false,
    timestamp: '5m ago'
  }
];

export default function App() {
  // --- States ---
  const [deck, setDeck] = useState<Slide[]>(() => {
    const saved = localStorage.getItem('better_slido_deck');
    return saved ? JSON.parse(saved) : DEFAULT_DECK;
  });

  const [questions, setQuestions] = useState<QAQuestion[]>(() => {
    const saved = localStorage.getItem('better_slido_questions');
    return saved ? JSON.parse(saved) : DEFAULT_QUESTIONS;
  });

  const [comments, setComments] = useState<SlideComment[]>(() => {
    const saved = localStorage.getItem('better_slido_comments');
    return saved ? JSON.parse(saved) : DEFAULT_COMMENTS;
  });

  // Sidebar Tabs and Agent modes
  const [activeSidebarTab, setActiveSidebarTab] = useState<'audience' | 'agent'>('agent');
  const [agentTabMode, setAgentTabMode] = useState<'comments' | 'chat' | 'cli'>('comments');

  // Comment Target Anchors states
  const [selectedCommentTarget, setSelectedCommentTarget] = useState<SlideComment['targetElement'] | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // Agent Chat (B - Agent edit) states
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>(() => [
    { role: 'agent', text: 'Hi, I am your Slide Optimization Agent powered by Gemini! Ask me to change layout elements, add content, or refine slide messages.' }
  ]);

  // Propose Ops / Diff states
  const [proposedOps, setProposedOps] = useState<any[]>([]);
  const [agentExplanation, setAgentExplanation] = useState('');
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);

  // CLI execution simulation logs states
  const [cliLogs, setCliLogs] = useState<string[]>([]);
  const [cliRunning, setCliRunning] = useState(false);
  const [cliExplanation, setCliExplanation] = useState('');
  const [cliApplied, setCliApplied] = useState(false);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(1); // Default to our bullet list recreation slide
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [theme, setTheme] = useState<SlideTheme>('editorial');
  
  // Floating reactions & greetings
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [floatingMessages, setFloatingMessages] = useState<FloatingMessage[]>([]);
  
  // Simulated Audience state
  // @agent: resolve: change initial audienceNickname below in useState to 'Chief AI Designer'
  const [audienceNickname, setAudienceNickname] = useState('Chief AI Designer');
  const [audienceQuestionText, setAudienceQuestionText] = useState('');
  const [audienceGreetingText, setAudienceGreetingText] = useState('');
  const [userVotedSlides, setUserVotedSlides] = useState<Record<string, number>>({});
  const [userUpvotedQuestions, setUserUpvotedQuestions] = useState<Record<string, boolean>>({});

  const activeSlide = deck[currentSlideIndex] || deck[0];

  // Save deck and questions to localStorage
  useEffect(() => {
    localStorage.setItem('better_slido_deck', JSON.stringify(deck));
  }, [deck]);

  useEffect(() => {
    localStorage.setItem('better_slido_questions', JSON.stringify(questions));
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('better_slido_comments', JSON.stringify(comments));
  }, [comments]);

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return; // Ignore keys when typing
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlideIndex(prev => Math.min(deck.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Escape' && isPreviewMode) {
        setIsPreviewMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deck.length, isPreviewMode, isEditing]);

  // Cleanup emojis and messages
  useEffect(() => {
    if (floatingEmojis.length > 0) {
      const timer = setTimeout(() => {
        setFloatingEmojis(prev => prev.slice(6)); // Clear older emojis
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [floatingEmojis]);

  useEffect(() => {
    if (floatingMessages.length > 0) {
      const timer = setTimeout(() => {
        setFloatingMessages(prev => prev.slice(1));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [floatingMessages]);

  // --- Handlers ---
  // --- Agent Handlers ---
  const applyOps = (ops: any[]) => {
    setDeck(prevDeck => {
      return prevDeck.map((s, idx) => {
        if (idx !== currentSlideIndex) return s;
        let updated = { ...s };
        
        ops.forEach(op => {
          if (op.type === 'update_field' && op.field) {
            updated = { ...updated, [op.field]: op.value };
          } else if (op.type === 'update_bullet' && updated.bullets) {
            const bullets = [...updated.bullets];
            if (bullets[op.index]) {
              bullets[op.index] = {
                ...bullets[op.index],
                ...(op.text && { text: op.text }),
                ...(op.icon && { icon: op.icon })
              };
            }
            updated.bullets = bullets;
          } else if (op.type === 'add_bullet') {
            updated.bullets = [...(updated.bullets || []), { 
              text: op.text || 'New element', 
              icon: op.icon || 'sparkles' 
            }];
          } else if (op.type === 'remove_bullet' && updated.bullets) {
            updated.bullets = updated.bullets.filter((_, i) => i !== op.index);
          } else if (op.type === 'update_poll' && updated.pollOptions) {
            const options = [...updated.pollOptions];
            if (options[op.index]) {
              options[op.index] = { ...options[op.index], text: op.text };
            }
            updated.pollOptions = options;
          } else if (op.type === 'add_poll') {
            updated.pollOptions = [...(updated.pollOptions || []), { text: op.text || 'New option', votes: 0 }];
          } else if (op.type === 'remove_poll' && updated.pollOptions) {
            updated.pollOptions = updated.pollOptions.filter((_, i) => i !== op.index);
          }
        });
        return updated;
      });
    });
  };

  const handleAcceptProposedOps = () => {
    applyOps(proposedOps);
    if (activeCommentId) {
      setComments(prev => prev.map(c => c.id === activeCommentId ? { ...c, resolved: true } : c));
      setActiveCommentId(null);
    }
    setProposedOps([]);
    setAgentExplanation('');
  };

  const handleCancelProposedOps = () => {
    setProposedOps([]);
    setAgentExplanation('');
    setActiveCommentId(null);
  };

  const handleAskAgentEdit = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsGeneratingAgent(true);
    // Add prompt user message
    setChatMessages(prev => [...prev, { role: 'user', text: promptText }]);
    
    try {
      const response = await fetch("/api/agent/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide: activeSlide, prompt: promptText }),
      });
      const data = await response.json();
      
      if (data.error) {
        setChatMessages(prev => [...prev, { role: 'agent', text: `Failed: ${data.error}` }]);
      } else {
        setProposedOps(data.proposedOps || []);
        setAgentExplanation(data.explanation || "Changes proposed.");
        setChatMessages(prev => [...prev, { 
          role: 'agent', 
          text: `I've analyzed the slide and proposed ${data.proposedOps?.length || 0} optimization operations. Choose to Approve or Reject the changes below!`,
          ops: data.proposedOps,
          explanation: data.explanation
        }]);
      }
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'agent', text: `Network error: ${e.message}` }]);
    } finally {
      setIsGeneratingAgent(false);
      setChatInput('');
    }
  };

  const handleResolveComment = async (comment: SlideComment) => {
    setIsGeneratingAgent(true);
    setActiveCommentId(comment.id);
    
    try {
      const response = await fetch("/api/agent/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          slide: activeSlide, 
          comment: comment.commentText, 
          targetElement: comment.targetElement 
        }),
      });
      const data = await response.json();
      
      if (data.error) {
        setAgentExplanation(`Error: ${data.error}`);
      } else {
        setProposedOps(data.proposedOps || []);
        setAgentExplanation(data.explanation || "Comment resolution changes draft created.");
      }
    } catch (e: any) {
      setAgentExplanation(`Network Error: ${e.message}`);
    } finally {
      setIsGeneratingAgent(false);
    }
  };

  const handleAddComment = (element: SlideComment['targetElement']) => {
    if (!commentInput.trim()) return;
    const newComment: SlideComment = {
      id: `comment-${Date.now()}`,
      slideId: activeSlide.id,
      targetElement: element,
      commentText: commentInput,
      author: 'You (Organizer)',
      resolved: false,
      timestamp: 'Just now'
    };
    setComments(prev => [...prev, newComment]);
    setCommentInput('');
    setSelectedCommentTarget(null);
  };

  const handleRunCli = async () => {
    setCliRunning(true);
    setCliLogs([
      '⚡ Spawning CLI Node environment...',
      '» tsx scripts/agent-harness.ts'
    ]);
    
    try {
      const response = await fetch("/api/agent/cli-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      
      // Add incremental logs simulation
      let logDelay = 0;
      data.cliLogs?.forEach((logLine: string) => {
        setTimeout(() => {
          setCliLogs(prev => [...prev, logLine]);
        }, logDelay);
        logDelay += 350;
      });

      setTimeout(() => {
        setCliRunning(false);
        if (data.applied) {
          setCliApplied(true);
          // Auto-trigger updating nickname so user immediately realizes file changes reflect in real-time UI!
          setAudienceNickname('Chief AI Designer');
        }
      }, logDelay + 200);

    } catch (e: any) {
      setCliLogs(prev => [...prev, `[CLI ERROR] Network Request Failed: ${e.message}`]);
      setCliRunning(false);
    }
  };

  const handleUpdateSlideField = (field: keyof Slide, value: any) => {
    setDeck(prev => prev.map((s, idx) => {
      if (idx === currentSlideIndex) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleUpdateBullet = (bulletIndex: number, text: string) => {
    if (!activeSlide.bullets) return;
    const updatedBullets = [...activeSlide.bullets];
    updatedBullets[bulletIndex] = { ...updatedBullets[bulletIndex], text };
    handleUpdateSlideField('bullets', updatedBullets);
  };

  const handleUpdateBulletIcon = (bulletIndex: number, iconName: BulletItem['icon']) => {
    if (!activeSlide.bullets) return;
    const updatedBullets = [...activeSlide.bullets];
    updatedBullets[bulletIndex] = { ...updatedBullets[bulletIndex], icon: iconName };
    handleUpdateSlideField('bullets', updatedBullets);
  };

  const handleAddBulletPoint = () => {
    if (!activeSlide.bullets) return;
    const updatedBullets = [...activeSlide.bullets, { text: 'New bullet point. Click to edit.', icon: 'sparkles' as const }];
    handleUpdateSlideField('bullets', updatedBullets);
  };

  const handleRemoveBulletPoint = (index: number) => {
    if (!activeSlide.bullets || activeSlide.bullets.length <= 1) return;
    const updatedBullets = activeSlide.bullets.filter((_, i) => i !== index);
    handleUpdateSlideField('bullets', updatedBullets);
  };

  // Poll handlers
  const handleUpdatePollOption = (optionIndex: number, text: string) => {
    if (!activeSlide.pollOptions) return;
    const updatedOptions = [...activeSlide.pollOptions];
    updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], text };
    handleUpdateSlideField('pollOptions', updatedOptions);
  };

  const handleAddPollOption = () => {
    if (!activeSlide.pollOptions) return;
    const updatedOptions = [...activeSlide.pollOptions, { text: 'New Poll Option', votes: 0 }];
    handleUpdateSlideField('pollOptions', updatedOptions);
  };

  const handleRemovePollOption = (index: number) => {
    if (!activeSlide.pollOptions || activeSlide.pollOptions.length <= 2) return;
    const updatedOptions = activeSlide.pollOptions.filter((_, i) => i !== index);
    handleUpdateSlideField('pollOptions', updatedOptions);
  };

  // Reset to original presentation
  const handleResetDeck = () => {
    if (window.confirm('Reset slide deck to default "AI for Education" presentation?')) {
      setDeck(DEFAULT_DECK);
      setQuestions(DEFAULT_QUESTIONS);
      setCurrentSlideIndex(1);
      setUserVotedSlides({});
      setUserUpvotedQuestions({});
      localStorage.removeItem('better_slido_deck');
      localStorage.removeItem('better_slido_questions');
    }
  };

  // Add a new slide
  const handleAddNewSlide = (type: SlideType) => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      type,
      tag: 'NEW SLIDE',
      title: type === 'title' ? 'Click to Edit Title' : type === 'bullet' ? 'Key Insights' : type === 'poll' ? 'Audience Opinion' : 'Q&A Session',
      subtitle: 'Double click any text on the slide to edit details.',
      footerLeft: 'Better Slido Presentation',
      footerRight: 'Slido.com',
      ...(type === 'bullet' && {
        bullets: [
          { text: 'First core takeaway of this section.', icon: 'lightbulb' },
          { text: 'Second important supporting point with editable icon.', icon: 'sparkles' }
        ]
      }),
      ...(type === 'poll' && {
        pollOptions: [
          { text: 'Strongly Agree', votes: 0 },
          { text: 'Agree', votes: 0 },
          { text: 'Neutral', votes: 0 },
          { text: 'Disagree', votes: 0 }
        ]
      })
    };
    setDeck(prev => [...prev, newSlide]);
    setCurrentSlideIndex(deck.length);
  };

  // Delete current slide
  const handleDeleteSlide = () => {
    if (deck.length <= 1) {
      alert('You must keep at least one slide in your presentation.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete Slide ${currentSlideIndex + 1}?`)) {
      const remainingDeck = deck.filter((_, idx) => idx !== currentSlideIndex);
      setDeck(remainingDeck);
      setCurrentSlideIndex(prev => Math.max(0, prev - 1));
    }
  };

  // --- Audience Reactions & Submissions ---
  const handleAudienceEmojiClick = (emoji: string) => {
    const randomLeft = 15 + Math.random() * 70; // restrict from 15% to 85% to stay on slide
    const randomTX = -50 + Math.random() * 100;
    const newReaction: FloatingEmoji = {
      id: `emoji-${Date.now()}-${Math.random()}`,
      emoji,
      x: randomLeft,
      tx: randomTX,
      delay: Math.random() * 0.2
    };
    setFloatingEmojis(prev => [...prev, newReaction]);
  };

  const handleAudienceSubmitGreeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audienceGreetingText.trim()) return;
    
    const randomLeft = 20 + Math.random() * 50;
    const newGreeting: FloatingMessage = {
      id: `msg-${Date.now()}`,
      text: audienceGreetingText.trim(),
      author: audienceNickname || 'Anonymous',
      x: randomLeft
    };
    
    setFloatingMessages(prev => [...prev, newGreeting]);
    setAudienceGreetingText('');
  };

  const handleAudienceVote = (optionIndex: number) => {
    if (!activeSlide.pollOptions || userVotedSlides[activeSlide.id] !== undefined) return;
    
    // Update local voted slide
    setUserVotedSlides(prev => ({ ...prev, [activeSlide.id]: optionIndex }));

    // Update vote count in slide
    setDeck(prev => prev.map((s, idx) => {
      if (idx === currentSlideIndex && s.pollOptions) {
        const updatedOptions = [...s.pollOptions];
        updatedOptions[optionIndex] = {
          ...updatedOptions[optionIndex],
          votes: updatedOptions[optionIndex].votes + 1
        };
        return { ...s, pollOptions: updatedOptions };
      }
      return s;
    }));

    // Trigger subtle success celebration
    handleAudienceEmojiClick('🎉');
  };

  const handleAudienceSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audienceQuestionText.trim()) return;

    const newQuestion: QAQuestion = {
      id: `q-${Date.now()}`,
      text: audienceQuestionText.trim(),
      upvotes: 1,
      author: audienceNickname || 'Anonymous',
      timestamp: 'Just now',
      isAnswered: false
    };

    setQuestions(prev => [newQuestion, ...prev]);
    setAudienceQuestionText('');

    // Trigger floating feedback
    handleAudienceEmojiClick('👏');
  };

  const handleUpvoteQuestion = (qId: string) => {
    const alreadyUpvoted = userUpvotedQuestions[qId];
    
    setUserUpvotedQuestions(prev => ({
      ...prev,
      [qId]: !alreadyUpvoted
    }));

    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          upvotes: alreadyUpvoted ? q.upvotes - 1 : q.upvotes + 1
        };
      }
      return q;
    }));
  };

  const handleMarkAsAnswered = (qId: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        return { ...q, isAnswered: !q.isAnswered };
      }
      return q;
    }));
  };

  const handleDeleteQuestion = (qId: string) => {
    setQuestions(prev => prev.filter(q => q.id !== qId));
  };

  // Total votes for percentages
  const totalPollVotes = activeSlide.pollOptions?.reduce((sum, opt) => sum + opt.votes, 0) || 0;

  // --- Rendering Theme CSS ---
  const getThemeClasses = () => {
    switch (theme) {
      case 'editorial':
        return {
          wrapper: 'bg-[#faf8f5] text-[#1c1917] border border-[#e5e2da]',
          headerTag: 'text-[#854d0e] tracking-widest uppercase font-semibold text-xs',
          title: 'serif-heading text-[#1c1917] font-black leading-tight',
          subtitle: 'text-[#57534e] italic font-serif',
          bulletIcon: 'bg-[#f5f2eb] text-[#854d0e] border border-[#e5e2da]',
          bulletText: 'text-[#292524] font-medium',
          footer: 'border-t border-[#e5e2da] text-[#78716c] font-serif italic',
          pollBar: 'bg-[#d97706]',
          pollBarBg: 'bg-[#f5f2eb] border border-[#e5e2da]',
          qaCard: 'bg-[#faf8f5] border border-[#e5e2da] text-[#1c1917]',
        };
      case 'modern-dark':
        return {
          wrapper: 'bg-[#18181b] text-[#f4f4f5] border border-[#27272a]',
          headerTag: 'text-[#10b981] tracking-widest uppercase font-semibold text-xs',
          title: 'font-sans font-extrabold text-white leading-tight tracking-tight',
          subtitle: 'text-[#a1a1aa] font-sans',
          bulletIcon: 'bg-[#27272a] text-[#10b981] border border-[#3f3f46]',
          bulletText: 'text-[#e4e4e7]',
          footer: 'border-t border-[#27272a] text-[#71717a] font-sans',
          pollBar: 'bg-[#10b981]',
          pollBarBg: 'bg-[#27272a] border border-[#3f3f46]',
          qaCard: 'bg-[#27272a] border border-[#3f3f46] text-[#e4e4e7]',
        };
      case 'vibrant-pastel':
        return {
          wrapper: 'bg-gradient-to-br from-[#eff6ff] to-[#f5f3ff] text-[#1e1b4b] border border-[#dbeafe]',
          headerTag: 'text-[#6366f1] tracking-widest uppercase font-black text-xs',
          title: 'font-sans font-black text-[#1e1b4b] leading-tight',
          subtitle: 'text-[#4f46e5] opacity-90',
          bulletIcon: 'bg-[#e0e7ff] text-[#4338ca] border border-[#c7d2fe]',
          bulletText: 'text-[#312e81] font-semibold',
          footer: 'border-t border-[#dbeafe] text-[#4f46e5] font-sans',
          pollBar: 'bg-[#6366f1]',
          pollBarBg: 'bg-[#f3f4f6] border border-[#e5e7eb]',
          qaCard: 'bg-[#ffffff] border border-[#e0e7ff] shadow-sm text-[#1e1b4b]',
        };
    }
  };

  const themeStyle = getThemeClasses();

  // --- Live Propose Ops / Diff Slide Precomputation ---
  const getPreviewSlide = () => {
    if (proposedOps.length === 0) return activeSlide;
    let updated = { ...activeSlide };
    proposedOps.forEach(op => {
      if (op.type === 'update_field' && op.field) {
        updated = { ...updated, [op.field]: op.value };
      } else if (op.type === 'update_bullet' && updated.bullets) {
        const bullets = [...updated.bullets];
        if (bullets[op.index]) {
          bullets[op.index] = {
            ...bullets[op.index],
            ...(op.text && { text: op.text }),
            ...(op.icon && { icon: op.icon })
          };
        }
        updated.bullets = bullets;
      } else if (op.type === 'add_bullet') {
        updated.bullets = [...(updated.bullets || []), { text: op.text || 'New element', icon: op.icon || 'sparkles' }];
      } else if (op.type === 'remove_bullet' && updated.bullets) {
        updated.bullets = updated.bullets.filter((_, i) => i !== op.index);
      } else if (op.type === 'update_poll' && updated.pollOptions) {
        const options = [...updated.pollOptions];
        if (options[op.index]) {
          options[op.index] = { ...options[op.index], text: op.text };
        }
        updated.pollOptions = options;
      } else if (op.type === 'add_poll') {
        updated.pollOptions = [...(updated.pollOptions || []), { text: op.text || 'New option', votes: 0 }];
      } else if (op.type === 'remove_poll' && updated.pollOptions) {
        updated.pollOptions = updated.pollOptions.filter((_, i) => i !== op.index);
      }
    });
    return updated;
  };

  const displayedSlide = getPreviewSlide();

  // --- Inline Anchor Helpers ---
  const getAnchorClasses = (elementKey: "title" | "subtitle" | "tag" | "bullets" | "poll" | "footer" | "general") => {
    if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
      return `relative cursor-pointer transition p-1 rounded-xl border border-dashed border-transparent hover:border-amber-500/50 hover:bg-amber-500/5 group/anchor ${
        selectedCommentTarget === elementKey ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/40' : ''
      }`;
    }
    return 'relative';
  };

  const renderCommentBadge = (elementKey: "title" | "subtitle" | "tag" | "bullets" | "poll" | "footer" | "general") => {
    const activeCommentsOnElement = comments.filter(c => c.slideId === activeSlide.id && c.targetElement === elementKey && !c.resolved);
    if (activeCommentsOnElement.length === 0) {
      if (activeSidebarTab === 'agent' && agentTabMode === 'comments' && selectedCommentTarget === elementKey) {
        return (
          <span className="absolute -top-3 right-0 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-20 shadow animate-pulse">
            🎯 Selecting...
          </span>
        );
      }
      return null;
    }
    return (
      <div 
        className="absolute -top-3.5 right-0 flex gap-1 z-25"
        onClick={(e) => {
          e.stopPropagation();
          setActiveSidebarTab('agent');
          setAgentTabMode('comments');
          setActiveCommentId(activeCommentsOnElement[0].id);
        }}
      >
        <span 
          title={`${activeCommentsOnElement[0].author}: ${activeCommentsOnElement[0].commentText}`}
          className="bg-amber-500 hover:bg-amber-600 border border-amber-600 text-amber-950 font-black text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow cursor-pointer transition transform hover:scale-110 active:scale-95"
        >
          <MessageSquare className="w-2.5 h-2.5" />
          <span>{activeCommentsOnElement[0].author.split(' ')[0]}</span>
          {activeCommentsOnElement.length > 1 && <span className="text-[8px] bg-amber-950 text-white px-0.5 rounded">+{activeCommentsOnElement.length - 1}</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f2ee] flex flex-col font-sans selection:bg-[#d97706]/20">
      
      {/* Top Header Controls Bar */}
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

        {/* Presentation controls */}
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
            className={`btn px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
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
            className="btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1c1917] hover:bg-[#292524] text-white border-transparent flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Present (FullScreen)</span>
          </button>

          <div className="h-6 w-[1px] bg-gray-200"></div>

          <button
            onClick={handleResetDeck}
            title="Reset to default slides"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-[#faf8f5] border border-gray-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Split Screen */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Presentation Board + Deck Manager (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Responsive 16:9 Slide Display Box */}
          <div className="relative w-full aspect-ratio-[16/9] bg-white rounded-3xl shadow-xl overflow-hidden border border-[#e5e2da] group">
            
            {/* The Slide Wrapper */}
            <div className={`w-full h-full p-[5%] flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${themeStyle.wrapper}`}>
              
              {/* Floating Emojis Screen Overlay */}
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                {floatingEmojis.map((e) => (
                  <div
                    key={e.id}
                    className="absolute bottom-0 text-5xl animate-float-emoji opacity-0"
                    style={{
                      left: `${e.x}%`,
                      '--emoji-tx': `${e.tx}px`,
                      animationDelay: `${e.delay}s`,
                    } as React.CSSProperties}
                  >
                    {e.emoji}
                  </div>
                ))}

                {floatingMessages.map((m) => (
                  <div
                    key={m.id}
                    className="absolute bottom-10 bg-white/95 border border-[#e5e2da] text-[#1c1917] px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-sm flex flex-col gap-0.5 max-w-[200px] floating-msg pointer-events-none"
                    style={{ left: `${m.x}%` }}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-amber-800">{m.author}</span>
                    <p className="line-clamp-2">{m.text}</p>
                  </div>
                ))}
              </div>

              {/* Slide Content Header */}
              <div className="space-y-2">
                {/* Editable Tag */}
                <div 
                  className={getAnchorClasses('tag')}
                  onClick={() => {
                    if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
                      setSelectedCommentTarget('tag');
                    }
                  }}
                >
                  {renderCommentBadge('tag')}
                  {isEditing ? (
                    <input
                      type="text"
                      value={displayedSlide.tag}
                      onChange={(e) => handleUpdateSlideField('tag', e.target.value)}
                      className="bg-black/5 rounded px-2 py-0.5 border-none font-sans font-bold tracking-widest text-xs uppercase text-[#854d0e] focus:outline-none focus:bg-amber-100"
                    />
                  ) : (
                    <span className={themeStyle.headerTag}>{displayedSlide.tag}</span>
                  )}
                </div>

                {/* Editable Title */}
                <div 
                  className={getAnchorClasses('title')}
                  onClick={() => {
                    if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
                      setSelectedCommentTarget('title');
                    }
                  }}
                >
                  {renderCommentBadge('title')}
                  {isEditing ? (
                    <textarea
                      rows={1}
                      value={displayedSlide.title}
                      onChange={(e) => handleUpdateSlideField('title', e.target.value)}
                      className="w-full bg-black/5 rounded px-2 py-1 serif-heading text-2xl md:text-3xl font-black text-[#1c1917] focus:outline-none focus:bg-amber-100 resize-none"
                    />
                  ) : (
                    <h2 className={`${themeStyle.title} text-2xl md:text-3.5xl lg:text-4.5xl font-black`}>{displayedSlide.title}</h2>
                  )}
                </div>

                {/* Editable Subtitle */}
                <div 
                  className={getAnchorClasses('subtitle')}
                  onClick={() => {
                    if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
                      setSelectedCommentTarget('subtitle');
                    }
                  }}
                >
                  {renderCommentBadge('subtitle')}
                  {isEditing ? (
                    <textarea
                      rows={2}
                      value={displayedSlide.subtitle}
                      onChange={(e) => handleUpdateSlideField('subtitle', e.target.value)}
                      className="w-full bg-black/5 rounded px-2 py-1 font-serif italic text-sm text-[#57534e] focus:outline-none focus:bg-amber-100 resize-none"
                    />
                  ) : (
                    <p className={`${themeStyle.subtitle} text-sm md:text-base lg:text-lg`}>{displayedSlide.subtitle}</p>
                  )}
                </div>
              </div>

              {/* Dynamic Slide Content Body */}
              <div className="flex-1 flex items-center my-4 overflow-y-auto max-h-[50%]">
                
                {/* 1. Bullet Slide Layout */}
                {displayedSlide.type === 'bullet' && displayedSlide.bullets && (
                  <div 
                    className={`w-full ${getAnchorClasses('bullets')}`}
                    onClick={() => {
                      if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
                        setSelectedCommentTarget('bullets');
                      }
                    }}
                  >
                    {renderCommentBadge('bullets')}
                    <ul className="w-full space-y-3.5 md:space-y-4">
                      {displayedSlide.bullets.map((b, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-4 animate-slide-up group/bullet">
                          {/* Icon Selection Trigger */}
                          <div className="relative">
                            <div className={`p-2 rounded-xl flex-shrink-0 cursor-pointer ${themeStyle.bulletIcon} hover:scale-105 transition`}>
                              <BulletIcon name={b.icon} className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            
                            {/* Mini icon palette in Edit Mode */}
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

                          {/* Editable Bullet Text */}
                          <div className="flex-grow pt-0.5">
                            {isEditing ? (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  type="text"
                                  value={b.text}
                                  onChange={(e) => handleUpdateBullet(bIdx, e.target.value)}
                                  className="flex-1 bg-black/5 rounded px-2 py-0.5 text-sm font-sans text-stone-900 focus:outline-none focus:bg-amber-100"
                                />
                                <button
                                  onClick={() => handleRemoveBulletPoint(bIdx)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Delete Point"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p className={`${themeStyle.bulletText} text-xs md:text-sm lg:text-base`}>{b.text}</p>
                            )}
                          </div>
                        </li>
                      ))}

                      {/* Add Bullet Button in Edit Mode */}
                      {isEditing && (
                        <button
                          onClick={handleAddBulletPoint}
                          className="flex items-center gap-1.5 text-xs text-amber-800 font-bold hover:underline mt-2 border border-dashed border-amber-800/40 px-3 py-1.5 rounded-lg"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Bullet Takeaway</span>
                        </button>
                      )}
                    </ul>
                  </div>
                )}

                {/* 2. Poll Slide Layout */}
                {displayedSlide.type === 'poll' && displayedSlide.pollOptions && (
                  <div 
                    className={`w-full ${getAnchorClasses('poll')}`}
                    onClick={() => {
                      if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
                        setSelectedCommentTarget('poll');
                      }
                    }}
                  >
                    {renderCommentBadge('poll')}
                    <div className="w-full space-y-3">
                      {displayedSlide.pollOptions.map((opt, optIdx) => {
                        const votePct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                        return (
                          <div key={optIdx} className="w-full space-y-1 animate-slide-up">
                            <div className="flex justify-between items-center text-xs md:text-sm font-bold">
                              {isEditing ? (
                                <div className="flex items-center gap-2 flex-1 mr-4">
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => handleUpdatePollOption(optIdx, e.target.value)}
                                    className="flex-1 bg-black/5 rounded px-2 py-0.5 text-xs focus:outline-none focus:bg-amber-100 text-stone-900"
                                  />
                                  <button
                                    onClick={() => handleRemovePollOption(optIdx)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="opacity-90">{opt.text}</span>
                              )}
                              <span className="font-mono">{opt.votes} votes ({votePct}%)</span>
                            </div>

                            {/* Beautiful Animated Bar */}
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
                          <span>Add Poll Option</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Title Slide Layout */}
                {displayedSlide.type === 'title' && (
                  <div className="w-full text-center space-y-4 py-6">
                    <div className="w-16 h-1 bg-[#d97706] mx-auto rounded-full"></div>
                    <p className="text-stone-500 text-xs tracking-widest font-mono font-bold uppercase">Audience Code: #EduAI</p>
                  </div>
                )}

                {/* 4. Q&A Slide Layout */}
                {displayedSlide.type === 'qa' && (
                  <div className="w-full space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                    {questions.filter(q => !q.isAnswered).length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs italic">
                        No active questions yet. Submit one from the smartphone on the right!
                      </div>
                    ) : (
                      questions
                        .filter(q => !q.isAnswered)
                        .sort((a, b) => b.upvotes - a.upvotes)
                        .slice(0, 3) // show top 3 on presentation slide
                        .map((q) => (
                          <div 
                            key={q.id} 
                            className={`p-3 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-slide-up ${themeStyle.qaCard}`}
                          >
                            <div className="space-y-1">
                              <p className="text-xs md:text-sm font-bold leading-snug">{q.text}</p>
                              <div className="flex items-center gap-2 text-[10px] opacity-75">
                                <span className="font-bold text-amber-800">{q.author}</span>
                                <span>•</span>
                                <span>{q.timestamp}</span>
                              </div>
                            </div>
                            
                            {/* Upvote counter Badge */}
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

              {/* Proposed Edits Diff Action Floating Ribbon Overlay */}
              {proposedOps.length > 0 && (
                <div className="absolute bottom-16 left-4 right-4 bg-[#faf8f5]/95 backdrop-blur border-2 border-amber-300 rounded-2xl p-4 shadow-2xl z-30 flex flex-col md:flex-row items-center justify-between gap-3 animate-slide-up">
                  <div className="flex items-start gap-2.5">
                    <Brain className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-amber-950">AI Proposed Revision ({proposedOps.length} updates)</h4>
                      <p className="text-[10px] text-amber-900 font-medium leading-relaxed max-w-[420px] line-clamp-2">{agentExplanation}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end">
                    <button 
                      onClick={handleAcceptProposedOps}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md transition"
                    >
                      <Check className="w-3 h-3" /> Accept & Apply
                    </button>
                    <button 
                      onClick={handleCancelProposedOps}
                      className="bg-[#faf8f5] hover:bg-gray-100 text-stone-700 text-[10px] font-bold px-3 py-1.5 rounded-xl transition border border-stone-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Slide Content Footer */}
              <div 
                className={`pt-3 flex justify-between items-center text-[10px] md:text-xs ${themeStyle.footer} ${getAnchorClasses('footer')}`}
                onClick={() => {
                  if (activeSidebarTab === 'agent' && agentTabMode === 'comments') {
                    setSelectedCommentTarget('footer');
                  }
                }}
              >
                {renderCommentBadge('footer')}
                {isEditing ? (
                  <input
                    type="text"
                    value={displayedSlide.footerLeft}
                    onChange={(e) => handleUpdateSlideField('footerLeft', e.target.value)}
                    className="bg-black/5 rounded px-2 py-0.5 focus:outline-none focus:bg-amber-100 text-stone-900"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>{displayedSlide.footerLeft}</span>
                  </div>
                )}

                {isEditing ? (
                  <input
                    type="text"
                    value={displayedSlide.footerRight}
                    onChange={(e) => handleUpdateSlideField('footerRight', e.target.value)}
                    className="bg-black/5 rounded px-2 py-0.5 focus:outline-none focus:bg-amber-100 text-stone-900"
                  />
                ) : (
                  <span>{displayedSlide.footerRight}</span>
                )}
              </div>

            </div>

            {/* Hover overlay guides */}
            <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] text-white opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse"></span>
              <span>Slide {currentSlideIndex + 1} of {deck.length} ({activeSlide.type.toUpperCase()})</span>
            </div>
          </div>

          {/* Bottom Deck Navigation & Manager */}
          <div className="bg-white rounded-2xl border border-[#e5e2da] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1c1917] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#854d0e]" />
                <span>Presentation Slides Outline</span>
              </h3>
              
              {/* Slide manipulation actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAddNewSlide('bullet')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Bullet List</span>
                </button>
                <button
                  onClick={() => handleAddNewSlide('poll')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Live Poll</span>
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

            {/* Row of slide thumbnails */}
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
              {deck.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => {
                    setCurrentSlideIndex(idx);
                  }}
                  className={`flex-shrink-0 w-36 aspect-ratio-[16/10] rounded-xl border-2 p-2.5 text-left flex flex-col justify-between transition-all ${
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
                </button>
              ))}
            </div>

            {/* Slide Navigation footer */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <button
                onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="btn px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#cbd5e1] hover:bg-gray-50 flex items-center gap-1 text-[#1c1917] disabled:opacity-40"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Prev Slide</span>
              </button>
              
              <span className="text-xs font-semibold text-stone-500 font-mono">
                Slide {currentSlideIndex + 1} of {deck.length}
              </span>

              <button
                onClick={() => setCurrentSlideIndex(prev => Math.min(deck.length - 1, prev + 1))}
                disabled={currentSlideIndex === deck.length - 1}
                className="btn px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#cbd5e1] hover:bg-gray-50 flex items-center gap-1 text-[#1c1917] disabled:opacity-40"
              >
                <span>Next Slide</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Q&A Backstage panel for the Presenter */}
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

        {/* Right Side: Tabbed Participant Mockup or Intelligent AI Co-Creator Suite (4 cols) */}
        <div className="lg:col-span-4 flex flex-col items-center w-full space-y-4">
          
          {/* Main Coordinator Tab Switcher Navigation */}
          <div className="flex bg-[#e5e2da]/70 p-1 rounded-2xl w-full max-w-[340px] border border-stone-300 shadow-inner">
            <button
              onClick={() => setActiveSidebarTab('audience')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
                activeSidebarTab === 'audience'
                  ? 'bg-white text-stone-900 shadow'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Participant Phone</span>
            </button>
            <button
              onClick={() => setActiveSidebarTab('agent')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
                activeSidebarTab === 'agent'
                  ? 'bg-white text-stone-900 shadow'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Co-Creator</span>
            </button>
          </div>

          {activeSidebarTab === 'audience' ? (
            <div className="w-full flex flex-col items-center">
              {/* Section heading */}
              <div className="w-full text-center mb-4 lg:mb-1.5">
                <h3 className="text-xs uppercase tracking-widest font-black text-[#57534e]">Live Audience Sandbox</h3>
                <p className="text-[11px] text-stone-500">Test how audience interacts with your active slide on their phone!</p>
              </div>

              {/* Smartphone mockup */}
              <div className="relative w-full max-w-[340px] aspect-ratio-[9/19] bg-[#0c0a09] rounded-[48px] shadow-2xl border-4 border-[#292524] p-3 flex flex-col justify-between overflow-hidden ring-4 ring-black/5">
                
                {/* Top Speaker grill & notch */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-32 h-5 bg-[#0c0a09] rounded-full z-30 flex items-center justify-center gap-1.5">
                  <div className="w-8 h-1 bg-[#292524] rounded-full"></div>
                  <div className="w-2 h-2 bg-[#1c1917] rounded-full border border-gray-900"></div>
                </div>

                {/* Smartphone Inner Screen */}
                <div className="flex-1 bg-gray-50 rounded-[38px] overflow-hidden flex flex-col justify-between border border-gray-950/20 pt-6 relative">
                  
                  {/* App Status bar */}
                  <div className="px-5 pt-1.5 flex justify-between items-center text-[10px] text-gray-500 font-bold z-20">
                    <span>9:41 AM</span>
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      <span className="bg-green-500 w-1.5 h-1.5 rounded-full"></span>
                      <span>Live</span>
                    </div>
                  </div>

                  {/* Mobile App Header */}
                  <div className="bg-[#1c1917] text-white px-4 py-3 shadow-md z-10 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black tracking-widest text-[#d97706]">SLIDO LIVE</span>
                      <span className="text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded animate-pulse">#EduAI</span>
                    </div>
                    
                    {/* Profile Nickname editable */}
                    <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg text-[10px]">
                      <span className="text-gray-400">Acting as:</span>
                      <input
                        type="text"
                        value={audienceNickname}
                        onChange={(e) => setAudienceNickname(e.target.value)}
                        className="bg-transparent font-bold text-white focus:outline-none border-none max-w-[120px] placeholder-gray-500"
                        placeholder="Enter nickname..."
                      />
                    </div>
                  </div>

                  {/* Mobile App Main Area (Scrollable Sandbox Content) */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    
                    {/* Active Slide Context card helper */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-amber-800 font-bold">Currently Viewing</span>
                      <h4 className="text-xs font-extrabold text-amber-950 line-clamp-1">Slide {currentSlideIndex + 1}: {activeSlide.title}</h4>
                    </div>

                {/* --- 1. TITLE Slide Sandbox Controls --- */}
                {activeSlide.type === 'title' && (
                  <div className="space-y-4 pt-1">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-stone-500">Submit a Greeting Bubble</label>
                      <form onSubmit={handleAudienceSubmitGreeting} className="flex gap-1.5">
                        <input
                          type="text"
                          value={audienceGreetingText}
                          onChange={(e) => setAudienceGreetingText(e.target.value)}
                          placeholder="Type 'Hello!'..."
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="submit"
                          className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-xl"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>

                    <div className="text-xs text-stone-500 italic bg-stone-100 rounded-xl p-3 leading-relaxed">
                      "Send a greeting above, and watch it float up as a popup bubble on the presentation slide in real-time!"
                    </div>
                  </div>
                )}

                {/* --- 2. BULLET Takeaway Slide Sandbox Controls --- */}
                {activeSlide.type === 'bullet' && activeSlide.bullets && (
                  <div className="space-y-3 pt-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Review Slide Takeaways</span>
                    <div className="space-y-2">
                      {activeSlide.bullets.map((b, idx) => (
                        <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
                          <div className="bg-amber-100 text-amber-800 p-1.5 rounded-lg flex-shrink-0">
                            <BulletIcon name={b.icon} className="w-3.5 h-3.5" />
                          </div>
                          <p className="text-xs font-semibold text-gray-800 pt-0.5">{b.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- 3. POLL Slide Sandbox Controls --- */}
                {activeSlide.type === 'poll' && activeSlide.pollOptions && (
                  <div className="space-y-3 pt-1">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block">Submit Your Vote</span>
                    
                    {userVotedSlides[activeSlide.id] !== undefined ? (
                      <div className="bg-green-100 border border-green-200 text-green-800 rounded-2xl p-4 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                        <div>
                          <h5 className="text-xs font-black">Vote Counted!</h5>
                          <p className="text-[10px] opacity-80 mt-1">
                            You voted: <strong>{activeSlide.pollOptions[userVotedSlides[activeSlide.id]].text}</strong>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeSlide.pollOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAudienceVote(idx)}
                            className="w-full text-left bg-white border border-gray-200 hover:border-amber-500 rounded-xl p-3 text-xs font-bold text-gray-800 hover:bg-amber-50/20 flex justify-between items-center group transition"
                          >
                            <span>{opt.text}</span>
                            <span className="w-4 h-4 rounded-full border border-gray-300 group-hover:border-amber-500 flex-shrink-0"></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* --- 4. Q&A Slide Sandbox Controls --- */}
                {activeSlide.type === 'qa' && (
                  <div className="space-y-4 pt-1">
                    {/* Submit Q */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-stone-500">Ask a Question</label>
                      <form onSubmit={handleAudienceSubmitQuestion} className="flex gap-1.5">
                        <input
                          type="text"
                          value={audienceQuestionText}
                          onChange={(e) => setAudienceQuestionText(e.target.value)}
                          placeholder="Type your question..."
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="submit"
                          className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-xl"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>

                    {/* Q List in Phone */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Participant Q&A Board</span>
                      {questions.length === 0 ? (
                        <p className="text-center text-gray-400 text-[10px] italic py-3">No questions asked yet.</p>
                      ) : (
                        questions
                          .filter(q => !q.isAnswered)
                          .sort((a, b) => b.upvotes - a.upvotes)
                          .map((q) => {
                            const isUpvoted = userUpvotedQuestions[q.id];
                            return (
                              <div key={q.id} className="bg-white border border-gray-150 rounded-xl p-3 flex justify-between items-start gap-2 shadow-sm">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-gray-800 leading-tight">{q.text}</p>
                                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                                    <span className="font-bold text-amber-800">{q.author}</span>
                                    <span>•</span>
                                    <span>{q.timestamp}</span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleUpvoteQuestion(q.id)}
                                  className={`flex flex-col items-center gap-0.5 border p-1 rounded-lg min-w-[32px] transition ${
                                    isUpvoted 
                                      ? 'bg-amber-500 border-transparent text-white' 
                                      : 'bg-stone-50 border-gray-200 text-stone-500 hover:bg-gray-100'
                                  }`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  <span className="text-[9px] font-mono font-bold">{q.upvotes}</span>
                                </button>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Mobile Reactions Drawer (Always present at the bottom of the screen) */}
              <div className="bg-[#faf8f5] border-t border-gray-200 px-4 py-2.5 rounded-b-[38px] space-y-1.5">
                <span className="text-[9px] text-gray-400 uppercase font-bold block text-center tracking-wider">Tap Live Reactions</span>
                <div className="flex justify-between items-center">
                  {['🎉', '❤️', '👏', '🔥', '😮', '👍'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleAudienceEmojiClick(emoji)}
                      className="text-xl hover:scale-125 active:scale-95 duration-100 transition p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Bottom Home button bar */}
            <div className="w-24 h-1 bg-[#292524] rounded-full mx-auto my-1.5 z-30"></div>
          </div>

        </div>
          ) : (
            /* AI Co-Creator Tab Content Box */
            <div className="w-full max-w-[340px] bg-[#faf8f5] border border-[#cbd5e1] rounded-[38px] p-5 shadow-lg space-y-4">
              
              {/* Header inside the AI Panel */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-amber-600 shadow-md text-white p-1.5 rounded-xl">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider">AI Co-Creator</h3>
                    <p className="text-[9px] text-stone-500 font-bold">Gemini-Powered Workspace</p>
                  </div>
                </div>

                <div className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200/50">
                  Agent Active
                </div>
              </div>

              {/* Inner Mode Select Switches for Agent tabs */}
              <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-[10px] font-black w-full">
                <button
                  onClick={() => setAgentTabMode('comments')}
                  className={`flex-1 py-1 px-2 rounded-lg transition ${
                    agentTabMode === 'comments'
                      ? 'bg-[#1c1917] text-white shadow'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  Feedback List
                </button>
                <button
                  onClick={() => setAgentTabMode('chat')}
                  className={`flex-1 py-1 px-2 rounded-lg transition ${
                    agentTabMode === 'chat'
                      ? 'bg-[#1c1917] text-white shadow'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  Edit Chat
                </button>
                <button
                  onClick={() => setAgentTabMode('cli')}
                  className={`flex-1 py-1 px-2 rounded-lg transition ${
                    agentTabMode === 'cli'
                      ? 'bg-[#1c1917] text-white shadow'
                      : 'text-stone-600 hover:text-stone-950'
                  }`}
                >
                  CLI Watcher
                </button>
              </div>

              {/* Individual tab contents */}
              {agentTabMode === 'comments' && (
                <div className="space-y-4 text-left w-full">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-amber-900 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Feedback & Resolution Flow</span>
                    </h4>
                    <p className="text-[11px] text-amber-950 font-medium leading-relaxed font-semibold">
                      Click comments below to let the Gemini agent propose draft slide changes instantly. You can review recommendations live on the slide preview before accepting.
                    </p>
                  </div>

                  {/* Comment Creator */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-sm w-full">
                    <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block font-bold">Create Review Comment</span>
                    
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-stone-600 font-bold font-semibold">Target Element:</span>
                      <select
                        value={selectedCommentTarget || 'general'}
                        onChange={(e) => setSelectedCommentTarget(e.target.value as any)}
                        className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 focus:outline-[#f59e0b]"
                      >
                        <option value="general">Default Slide Anchor</option>
                        <option value="tag">Header Tag</option>
                        <option value="title">Slide Title</option>
                        <option value="subtitle">Slide Subtitle</option>
                        <option value="bullets">Bullet List Box</option>
                        <option value="poll">Live Poll Options</option>
                        <option value="footer">Footer Info</option>
                      </select>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Highlight critical metrics..."
                        className="flex-grow border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 text-stone-900"
                      />
                      <button
                        onClick={() => handleAddComment(selectedCommentTarget || 'general')}
                        className="bg-[#1c1917] hover:bg-[#292524] text-white px-3 py-2 rounded-xl text-xs font-bold leading-none shrink-0 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-[9px] text-[#2563eb] font-bold">
                      💡 Click dynamic elements on the slide preview to target them directly!
                    </p>
                  </div>

                  {/* Comments list */}
                  <div className="space-y-3 w-full">
                    <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block font-bold">
                      Active Slide Reviews ({comments.filter(c => c.slideId === activeSlide.id).length})
                    </span>
                    {comments.filter(c => c.slideId === activeSlide.id).length === 0 ? (
                      <div className="bg-white border border-[#cbd5e1] rounded-2xl p-6 text-center italic text-stone-400 text-xs font-medium">
                        ☕ No outstanding comments on this slide. Post review comments above, or use prompt chat to edit!
                      </div>
                    ) : (
                      comments
                        .filter(c => c.slideId === activeSlide.id)
                        .map((c) => (
                          <div 
                            key={c.id} 
                            className={`border rounded-2xl p-4 space-y-3 shadow-xs transition duration-200 w-full ${
                              c.resolved 
                                ? 'bg-stone-50 border-stone-150 opacity-60' 
                                : activeCommentId === c.id
                                  ? 'bg-amber-500/5 border-amber-500 ring-2 ring-amber-500/20'
                                  : 'bg-white border-stone-200'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-3 w-full">
                              <div className="space-y-1 text-left w-full">
                                <p className="text-xs font-black text-stone-800 leading-relaxed">{c.commentText}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-stone-400 font-bold">
                                  <span className="text-amber-800 uppercase tracking-wider">{c.author}</span>
                                  <span>•</span>
                                  <span>Anchor: {c.targetElement}</span>
                                  <span>•</span>
                                  <span>{c.timestamp}</span>
                                </div>
                              </div>
                              {c.resolved && (
                                <span className="bg-green-100 text-green-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Resolved
                                </span>
                              )}
                            </div>

                            {!c.resolved && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleResolveComment(c)}
                                  disabled={isGeneratingAgent}
                                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  {isGeneratingAgent && activeCommentId === c.id ? (
                                    <span className="mr-1 w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                  ) : (
                                    <Brain className="w-3 h-3" />
                                  )}
                                  <span>Auto-Resolve</span>
                                </button>
                                <button
                                  onClick={() => setComments(prev => prev.map(item => item.id === c.id ? { ...item, resolved: true } : item))}
                                  className="bg-stone-50 hover:bg-stone-100 text-stone-700 text-[10px] font-bold px-3 py-1.5 rounded-xl transition border border-stone-200 cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {agentTabMode === 'chat' && (
                <div className="space-y-4 text-left w-full">
                  <div className="bg-blue-500/10 border border-blue-500/15 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-blue-900 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                      <span>Prompt-Based Edits</span>
                    </h4>
                    <p className="text-[11px] text-blue-950 font-medium leading-relaxed font-semibold">
                      Instruct Gemini co-pilot to tweak bullets, revise titles, style the presentation index elements, or build comprehensive poll drafts!
                    </p>
                  </div>

                  {/* Chat Message Box */}
                  <div className="bg-stone-200/40 border border-stone-200 rounded-2xl p-3 h-[280px] overflow-y-auto flex flex-col gap-3.5 shadow-inner">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`flex flex-col max-w-[85%] ${
                          msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                        }`}
                      >
                        <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest mb-0.5">
                          {msg.role === 'user' ? 'You' : 'Gemini Co-Pilot'}
                        </span>
                        <div 
                          className={`p-2.5 rounded-2xl text-[11px] font-semibold leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-amber-600 text-white rounded-tr-none'
                              : 'bg-white border border-stone-200 text-stone-800 rounded-tl-none shadow-xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isGeneratingAgent && (
                      <div className="self-start flex items-center gap-1.5 text-[10px] text-stone-500 font-bold bg-white px-2.5 py-1.5 rounded-xl border border-stone-100 animate-pulse shadow-sm">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-ping"></span>
                        <span>Gemini is planning layout operations...</span>
                      </div>
                    )}
                  </div>

                  {/* Prompt Form */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAskAgentEdit(chatInput);
                        }
                      }}
                      placeholder="Translate key takeaways..."
                      className="flex-grow border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-semibold text-stone-900"
                    />
                    <button
                      onClick={() => handleAskAgentEdit(chatInput)}
                      disabled={isGeneratingAgent || !chatInput.trim()}
                      className="bg-[#1c1917] hover:bg-stone-800 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-xs font-black transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}

              {agentTabMode === 'cli' && (
                <div className="space-y-4 text-left w-full">
                  <div className="bg-zinc-900 border border-zinc-950 text-zinc-100 rounded-2xl p-4 space-y-2 shadow-lg w-full">
                    <h4 className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4" />
                      <span>TypeScript CLI Agent Harness</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                      Spawns the real <code className="text-amber-400 font-mono">tsx scripts/agent-harness.ts</code> watcher locally. It scans your React code, compiles inline comments, and refactors components live!
                    </p>
                  </div>

                  {/* Terminal mockup */}
                  <div className="bg-zinc-950 border-2 border-zinc-800 rounded-3xl p-4 font-mono text-[10px] text-emerald-400 h-[220px] overflow-y-auto space-y-1.5 shadow-2xl leading-normal scrollbar-thin w-full text-left">
                    {cliLogs.length === 0 ? (
                      <div className="text-zinc-650 h-full flex flex-col items-center justify-center text-center px-4 w-full">
                        <Terminal className="w-8 h-8 text-zinc-700 mb-2" />
                        <p className="font-semibold italic">Ready to engage the CLI harness.</p>
                        <p className="text-[9px] text-zinc-500 mt-1">Click "Simulate CLI Watcher" below to scan files for comments!</p>
                      </div>
                    ) : (
                      cliLogs.map((log, lIdx) => (
                        <div key={lIdx} className="whitespace-pre-wrap select-text selection:bg-emerald-850/45 text-left font-mono">
                          {log}
                        </div>
                      ))
                    )}
                    {cliRunning && (
                      <p className="text-amber-400 animate-pulse font-bold">
                        █ CLI running agent-harness.ts loop...
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <button
                      onClick={handleRunCli}
                      disabled={cliRunning}
                      className="w-full bg-[#1c1917] hover:bg-[#292524] disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span>{cliRunning ? 'Running CLI Watcher...' : 'Simulate CLI Watcher'}</span>
                    </button>

                    {cliApplied && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-2xl p-3 text-center flex items-center gap-2 shadow-sm animate-slide-up w-full text-left">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div className="text-left">
                          <h5 className="text-[11px] font-black text-emerald-950">Harness Executed Successfully!</h5>
                          <p className="text-[9px] opacity-80 mt-0.5 leading-relaxed">
                            Watcher parsed comments from React files, executed modifications via Gemini, and compiled changes. Nickname state refreshed to '<span className="font-bold text-stone-900">Chief AI Designer</span>'!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Presentation Fullscreen Modal View */}
      {isPreviewMode && (
        <div className="fixed inset-0 bg-[#0c0a09] z-50 flex items-center justify-center p-[4%]">
          
          {/* Close/Exit floating bar */}
          <div className="absolute top-6 right-6 z-50 flex gap-3">
            <span className="bg-black/60 backdrop-blur-md text-white/80 text-xs font-semibold px-4 py-2 rounded-full border border-white/10 flex items-center gap-1.5">
              <span>Exit: press <strong>Esc</strong></span>
            </span>
            <button
              onClick={() => setIsPreviewMode(false)}
              className="bg-white/90 hover:bg-white text-stone-900 p-2.5 rounded-full shadow-lg font-bold border-none cursor-pointer transition flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Large Screen Slide container */}
          <div className="w-full max-w-[1300px] aspect-ratio-[16/9] shadow-2xl relative overflow-hidden rounded-3xl">
            
            {/* Realtime Floating Reactions Canvas */}
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              {floatingEmojis.map((e) => (
                <div
                  key={e.id}
                  className="absolute bottom-0 text-7xl animate-float-emoji opacity-0"
                  style={{
                    left: `${e.x}%`,
                    '--emoji-tx': `${e.tx}px`,
                    animationDelay: `${e.delay}s`,
                  } as React.CSSProperties}
                >
                  {e.emoji}
                </div>
              ))}

              {floatingMessages.map((m) => (
                <div
                  key={m.id}
                  className="absolute bottom-16 bg-white/95 border border-[#e5e2da] text-[#1c1917] px-5 py-3 rounded-2xl shadow-xl font-bold text-base flex flex-col gap-0.5 max-w-[280px] floating-msg pointer-events-none"
                  style={{ left: `${m.x}%` }}
                >
                  <span className="text-[10px] uppercase tracking-wider text-amber-800">{m.author}</span>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>

            {/* Actual Slide Body */}
            <div className={`w-full h-full p-[6%] flex flex-col justify-between relative overflow-hidden ${themeStyle.wrapper}`}>
              
              {/* Header */}
              <div className="space-y-3">
                <span className={`${themeStyle.headerTag} text-sm tracking-widest`}>{activeSlide.tag}</span>
                <h2 className={`${themeStyle.title} text-3xl md:text-5xl lg:text-6xl font-black`}>{activeSlide.title}</h2>
                <p className={`${themeStyle.subtitle} text-base md:text-xl lg:text-2xl`}>{activeSlide.subtitle}</p>
              </div>

              {/* Content Body */}
              <div className="flex-1 flex items-center my-6 overflow-y-auto max-h-[60%]">
                
                {/* 1. Bullet Slide Layout */}
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

                {/* 2. Poll Slide Layout */}
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
                              className={`h-full rounded-full transition-all duration-750 ease-out ${themeStyle.pollBar}`}
                              style={{ width: `${votePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Title Slide Layout */}
                {activeSlide.type === 'title' && (
                  <div className="w-full text-center space-y-6 py-12">
                    <div className="w-24 h-1.5 bg-[#d97706] mx-auto rounded-full"></div>
                    <p className="text-stone-500 text-sm md:text-lg tracking-widest font-mono font-bold uppercase">
                      Join Live at Slido.com • Code: <span className="text-amber-800 bg-amber-500/10 px-3 py-1 rounded-xl font-bold">#EduAI</span>
                    </p>
                  </div>
                )}

                {/* 4. Q&A Slide Layout */}
                {activeSlide.type === 'qa' && (
                  <div className="w-full space-y-4 max-w-[900px] mx-auto">
                    {questions.filter(q => !q.isAnswered).length === 0 ? (
                      <div className="text-center py-12 text-gray-400 text-lg italic">
                        Go ahead, ask us anything! Submit your questions live.
                      </div>
                    ) : (
                      questions
                        .filter(q => !q.isAnswered)
                        .sort((a, b) => b.upvotes - a.upvotes)
                        .slice(0, 3)
                        .map((q) => (
                          <div 
                            key={q.id} 
                            className={`p-4 md:p-5 rounded-3xl flex items-center justify-between gap-6 shadow-md animate-slide-up ${themeStyle.qaCard}`}
                          >
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

              {/* Footer */}
              <div className={`pt-4 flex justify-between items-center text-xs md:text-sm ${themeStyle.footer}`}>
                <div className="flex items-center gap-2 font-bold">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>{activeSlide.footerLeft}</span>
                </div>
                <span>{activeSlide.footerRight}</span>
              </div>

            </div>

          </div>

          {/* Left/Right quick navigation overlay in Present Mode */}
          <div className="absolute bottom-6 left-6 flex items-center gap-2.5">
            <button
              onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
              disabled={currentSlideIndex === 0}
              className="bg-black/60 border border-white/10 hover:bg-black text-white p-2.5 rounded-full disabled:opacity-40"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-white/80 font-mono text-sm">
              {currentSlideIndex + 1} / {deck.length}
            </span>
            <button
              onClick={() => setCurrentSlideIndex(prev => Math.min(deck.length - 1, prev + 1))}
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
