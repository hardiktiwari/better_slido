// ---- Slide types (shared with App.tsx) ----

export interface BulletItem {
  text: string;
  icon: 'sparkles' | 'target' | 'check' | 'book' | 'star' | 'lightbulb';
}

export interface PollOption {
  text: string;
  votes: number;
}

export interface QAQuestion {
  id: string;
  text: string;
  upvotes: number;
  author: string;
  timestamp: string;
  isAnswered: boolean;
}

export type SlideType = 'title' | 'bullet' | 'poll' | 'qa';
export type SlideTheme = 'editorial' | 'modern-dark' | 'vibrant-pastel';

export interface Slide {
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

// ---- Comment field anchors ----
// The union covers every editable part of a Slide.
// Bullet/poll variants carry a numeric index after the dash.
export type CommentField =
  | 'title'
  | 'subtitle'
  | 'tag'
  | 'footerLeft'
  | 'footerRight'
  | 'slide'
  | `bullet-${number}`
  | `poll-${number}`;

// ---- Inline comment ----
export interface SlideComment {
  id: string;
  slideId: string;
  field: CommentField;
  author: string;
  body: string;
  resolved: boolean;
  createdAt: number;
  /** Lowercased mention tokens, e.g. ['@agent'] */
  mentions: string[];
}

// ---- Ops proposed by the agent ----
// Matches the schema returned by POST /api/agent/resolve (server.ts).
export type AgentOpType =
  | 'update_field'
  | 'update_bullet'
  | 'add_bullet'
  | 'remove_bullet'
  | 'update_poll'
  | 'add_poll'
  | 'remove_poll';

export interface ProposedOp {
  type: AgentOpType;
  field?: 'title' | 'subtitle' | 'tag' | 'footerLeft' | 'footerRight';
  value?: string;
  index?: number;
  text?: string;
  icon?: BulletItem['icon'];
}

// Maps a granular CommentField onto the broader targetElement the
// server's /api/agent/resolve endpoint expects.
export function toTargetElement(
  field: CommentField,
): 'title' | 'subtitle' | 'tag' | 'bullets' | 'poll' | 'footer' | 'general' {
  if (field === 'title' || field === 'subtitle' || field === 'tag') return field;
  if (field === 'footerLeft' || field === 'footerRight') return 'footer';
  if (field === 'slide') return 'general';
  if (field.startsWith('bullet-')) return 'bullets';
  if (field.startsWith('poll-')) return 'poll';
  return 'general';
}

// ---- Agent session lifecycle ----
export type AgentStatus = 'idle' | 'thinking' | 'streaming' | 'applied' | 'error';

export interface AgentSession {
  status: AgentStatus;
  /** Streamed reasoning tokens shown in the status bar */
  streamingText: string;
  /** Ops the agent proposed; populated when status reaches 'review' */
  proposedOps: ProposedOp[];
  /** Comment that fired this session (if any) */
  triggerCommentId?: string;
  errorMessage?: string;
}

export const AGENT_SESSION_IDLE: AgentSession = {
  status: 'idle',
  streamingText: '',
  proposedOps: [],
};
