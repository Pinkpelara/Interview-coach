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
  avatar_color: string;
  initials: string;
}

export interface UnexpectedEvent {
  type: "late_join" | "audio_glitch" | "curveball_question" | "one_more_question" | "long_silence";
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
  audio_base64: string;
}

export interface RelaySessionEventMessage {
  type: "session_start" | "session_end" | "audio_glitch";
  character_id?: string;
  duration_ms?: number;
}
