export type CandidateTurnMessage = {
  type: "candidate_turn";
  candidate_text?: string;
  candidate_audio_b64?: string;
  character_id: string;
  voice_id: string;
  system_prompt: string;
  conversation: Array<{ role: string; content: string }>;
};

export type InterviewerSpeakingMessage = {
  type: "interviewer_speaking";
  character_id: string;
  expression_state: "speaking";
  response_text: string;
  audio_base64: string;
};

export type ExpressionUpdateMessage = {
  type: "expression_update";
  character_id: string;
  state:
    | "neutral"
    | "listening"
    | "thinking"
    | "nodding"
    | "skeptical"
    | "writing_notes"
    | "distracted"
    | "speaking";
};

export type SessionStateMessage =
  | { type: "session_start"; session_id: string }
  | { type: "session_end"; session_id: string }
  | { type: "video_freeze"; character_id: string; duration_ms: number };

export type RelayControlMessage =
  | { type: "relay_ready"; relay_id: string; session_id: string }
  | { type: "relay_connected"; upstream: "interview-conductor" }
  | { type: "relay_upstream_closed" }
  | { type: "relay_upstream_error"; error: string };

export type RealtimeMessage =
  | CandidateTurnMessage
  | InterviewerSpeakingMessage
  | ExpressionUpdateMessage
  | SessionStateMessage
  | RelayControlMessage;
