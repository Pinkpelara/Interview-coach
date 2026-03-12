export type UUID = string;

export type PlanTier = "free" | "prep" | "pro" | "crunch";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";
export type BillingCycle = "monthly" | "annual";

export type InterviewStage =
  | "phone_screen"
  | "first_round"
  | "panel"
  | "final_round"
  | "case"
  | "stress";

export type InterviewIntensity = "warmup" | "standard" | "high_pressure";

export type CharacterArchetype =
  | "skeptic"
  | "friendly_champion"
  | "technical_griller"
  | "distracted_senior"
  | "culture_fit"
  | "silent_observer";

export type CharacterExpression =
  | "neutral"
  | "listening"
  | "thinking"
  | "nodding"
  | "skeptical"
  | "writing_notes"
  | "distracted"
  | "speaking";

export type QuestionType =
  | "behavioral"
  | "technical"
  | "situational"
  | "company_specific"
  | "curveball"
  | "opening"
  | "closing";

export interface CharacterPanelMember {
  character_id: string;
  archetype: CharacterArchetype;
  name: string;
  title: string;
  voice_id: string;
  portrait_url: string;
  portrait_open_url: string;
}

export interface UnexpectedEvent {
  type: "late_join" | "video_freeze" | "curveball_question" | "one_more_question" | "long_silence";
  trigger_time_ms: number;
}

export interface MomentMapSegment {
  start_ms: number;
  end_ms: number;
  rating: "green" | "yellow" | "red";
  coaching_note: string;
  interviewer_reaction?: string;
}

export interface NextTarget {
  title: string;
  description: string;
  action: string;
  success_metric: string;
}

export interface SessionScoreSet {
  answer_quality: number;
  delivery_confidence: number;
  pressure_recovery: number;
  company_fit_language: number;
  listening_accuracy: number;
}

export interface InterviewSessionEnvelope {
  id: UUID;
  user_id: UUID;
  application_id: UUID;
  stage: InterviewStage;
  intensity: InterviewIntensity;
  target_duration_min: number;
  status: "pending" | "briefing" | "in_progress" | "completed" | "abandoned";
  characters: CharacterPanelMember[];
  unexpected_events: UnexpectedEvent[];
}

export interface RelayInterviewSpeakingMessage {
  type: "interviewer_speaking";
  character_id: string;
  expression_state: CharacterExpression;
  audio_base64: string;
}

export interface RelayExpressionUpdateMessage {
  type: "expression_update";
  character_id: string;
  state: CharacterExpression;
}

export interface RelaySessionEventMessage {
  type: "session_start" | "session_end" | "video_freeze";
  character_id?: string;
  duration_ms?: number;
}
