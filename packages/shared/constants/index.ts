export const PRODUCT = {
  name: "Seatvio",
  tagline: "So real, you'll get nervous.",
  domain: "seatvio.app",
} as const;

export const PLAN_LIMITS = {
  free: {
    sessionsPerMonth: 2,
    maxInterviewers: 1,
    features: {
      momentMap: false,
      coachAudio: false,
      pressureLab: false,
      observeModule: false,
      panelMode: false,
      stressInterview: false,
      salaryNegotiation: false,
      debriefCard: false,
      countdownPlan: false,
    },
  },
  prep: {
    sessionsPerMonth: Number.POSITIVE_INFINITY,
    maxInterviewers: 3,
    features: {
      momentMap: true,
      coachAudio: true,
      pressureLab: true,
      observeModule: false,
      panelMode: false,
      stressInterview: false,
      salaryNegotiation: false,
      debriefCard: false,
      countdownPlan: false,
    },
  },
  pro: {
    sessionsPerMonth: Number.POSITIVE_INFINITY,
    maxInterviewers: 3,
    features: {
      momentMap: true,
      coachAudio: true,
      pressureLab: true,
      observeModule: true,
      panelMode: true,
      stressInterview: true,
      salaryNegotiation: true,
      debriefCard: true,
      countdownPlan: false,
    },
  },
  crunch: {
    sessionsPerMonth: Number.POSITIVE_INFINITY,
    maxInterviewers: 3,
    features: {
      momentMap: true,
      coachAudio: true,
      pressureLab: true,
      observeModule: true,
      panelMode: true,
      stressInterview: true,
      salaryNegotiation: true,
      debriefCard: true,
      countdownPlan: true,
    },
  },
} as const;

export const ARCHETYPE_RULES = {
  skeptic: {
    label: "Skeptic",
    defaultSilenceSec: [3, 4],
    voiceId: "onyx",
  },
  friendly_champion: {
    label: "Friendly Champion",
    defaultSilenceSec: [1, 2],
    voiceId: "nova",
  },
  technical_griller: {
    label: "Technical Griller",
    defaultSilenceSec: [4, 5],
    voiceId: "ash",
  },
  distracted_senior: {
    label: "Distracted Senior",
    defaultSilenceSec: [1, 8],
    voiceId: "echo",
  },
  culture_fit: {
    label: "Culture Fit Assessor",
    defaultSilenceSec: [2, 3],
    voiceId: "shimmer",
  },
  silent_observer: {
    label: "Silent Observer",
    defaultSilenceSec: [0, 0],
    voiceId: "sage",
  },
} as const;

export const SESSION_STAGES = [
  "phone_screen",
  "first_round",
  "panel",
  "final_round",
  "case",
  "stress",
] as const;

export const SESSION_INTENSITIES = ["warmup", "standard", "high_pressure"] as const;

export const QUESTION_TYPES = [
  "behavioral",
  "technical",
  "situational",
  "company_specific",
  "curveball",
  "opening",
  "closing",
] as const;
