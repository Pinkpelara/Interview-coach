import express from "express";
import crypto from "node:crypto";

const app = express();
const PORT = Number(process.env.PORT || 8094);
const AI_ENGINE_URL = (process.env.AI_ENGINE_URL || "http://localhost:8093").replace(/\/$/, "");

app.use(express.json({ limit: "10mb" }));

const db = {
  users: new Map(),
  profiles: new Map(),
  apps: new Map(),
  appStatus: new Map(),
  questionsByApp: new Map(),
  answers: new Map(),
  answersByQuestion: new Map(),
  feedbackByAnswer: new Map(),
  sessions: new Map(),
  exchangesBySession: new Map(),
  analysesBySession: new Map(),
  observeBySession: new Map(),
  subscriptionsByUser: new Map(),
  countdownByApp: new Map(),
  verifyTokens: new Map(),
  resetTokens: new Map(),
  authSessions: new Map(),
};

const DEFAULT_PLAN = {
  plan: "free",
  status: "active",
  billing_cycle: "monthly",
  sessions_used_this_month: 0,
};

const hashPassword = (pw) => crypto.createHash("sha256").update(pw).digest("hex");
const id = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function parseCookie(req) {
  const raw = req.headers.cookie || "";
  const entries = raw.split(";").map((v) => v.trim()).filter(Boolean);
  const kv = Object.fromEntries(entries.map((line) => {
    const idx = line.indexOf("=");
    if (idx === -1) return [line, ""];
    return [line.slice(0, idx), decodeURIComponent(line.slice(idx + 1))];
  }));
  return kv;
}

function authFromRequest(req) {
  const cookies = parseCookie(req);
  const sessionToken = cookies.seatvio_session;
  if (sessionToken && db.authSessions.has(sessionToken)) {
    return db.authSessions.get(sessionToken);
  }
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (db.authSessions.has(token)) return db.authSessions.get(token);
  }
  return null;
}

function requireAuth(req, res, next) {
  const userId = authFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.userId = userId;
  return next();
}

function setAuthCookie(res, token) {
  res.setHeader("Set-Cookie", `seatvio_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
}

const AVATAR_COLORS = ["#4F46E5", "#DC2626", "#059669", "#D97706", "#7C3AED", "#DB2777"];
let _charIndex = 0;

function panelForSession({ stage, intensity, company_name }) {
  const make = (archetype, title) => {
    const name = randomName();
    const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase();
    const color = AVATAR_COLORS[_charIndex % AVATAR_COLORS.length];
    _charIndex++;
    return {
      character_id: id(),
      archetype,
      name,
      title: `${title} at ${company_name}`,
      voice_id: voiceForArchetype(archetype),
      avatar_color: color,
      initials,
    };
  };

  const byStage = {
    phone_screen: [make("friendly_champion", "Recruiter")],
    first_round: [make("skeptic", "Engineering Manager"), make("friendly_champion", "HR Business Partner")],
    panel: [make("skeptic", "Engineering Manager"), make("technical_griller", "Principal Engineer"), make("silent_observer", "Director")],
    final_round: [make("culture_fit", "Head of Talent"), make("skeptic", "VP Engineering"), make("silent_observer", "General Manager")],
    case: [make("skeptic", "Strategy Lead"), make("technical_griller", "Analytics Lead")],
    stress: [make("skeptic", "Partner"), make("technical_griller", "Principal Interviewer")],
  };
  const panel = byStage[stage] || byStage.first_round;
  const pressure = intensity === "high_pressure" ? 1000 : intensity === "warmup" ? -1000 : 0;
  return panel.map((c) => ({
    ...c,
    silence_duration_ms: Math.max(1000, baseSilenceMs(c.archetype) + pressure),
  }));
}

function baseSilenceMs(archetype) {
  switch (archetype) {
    case "skeptic": return 3500;
    case "friendly_champion": return 1500;
    case "technical_griller": return 4500;
    case "distracted_senior": return 6000;
    case "culture_fit": return 2500;
    case "silent_observer": return 0;
    default: return 2500;
  }
}

function voiceForArchetype(archetype) {
  const map = {
    skeptic: "onyx",
    friendly_champion: "nova",
    technical_griller: "ash",
    distracted_senior: "echo",
    culture_fit: "shimmer",
    silent_observer: "sage",
  };
  return map[archetype] || "alloy";
}

function randomName() {
  const first = ["Maya", "Noah", "Ethan", "James", "Olivia", "Ava", "Liam", "Sophia"];
  const last = ["Chen", "Schmidt", "Park", "Patel", "Reed", "Morgan", "Diaz", "Khan"];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

async function callAi(path, payload, fallback) {
  try {
    const response = await fetch(`${AI_ENGINE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "seatvio-api-server", mode: "v4-dev" });
});

// 3.1 Auth Endpoints
app.post("/api/auth/signup", (req, res) => {
  const { email, password, full_name } = req.body || {};
  if (!email || !password || !full_name) return res.status(400).json({ error: "email, password, and full_name are required" });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if ([...db.users.values()].some((u) => u.email === email)) return res.status(409).json({ error: "Email already exists" });

  const user = {
    id: id(),
    email,
    password_hash: hashPassword(password),
    full_name,
    email_verified: false,
    onboarding_done: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.users.set(user.id, user);
  db.subscriptionsByUser.set(user.id, { ...DEFAULT_PLAN, user_id: user.id });
  const token = id();
  db.verifyTokens.set(token, user.id);
  res.status(201).json({ ok: true, user_id: user.id, verify_token: token });
});

app.post("/api/auth/verify", (req, res) => {
  const { token } = req.body || {};
  const userId = db.verifyTokens.get(token);
  if (!userId) return res.status(400).json({ error: "Invalid verification token" });
  const user = db.users.get(userId);
  user.email_verified = true;
  user.updated_at = nowIso();
  db.verifyTokens.delete(token);
  return res.json({ ok: true });
});

app.post("/api/auth/signin", (req, res) => {
  const { email, password } = req.body || {};
  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user || user.password_hash !== hashPassword(password || "")) return res.status(401).json({ error: "Invalid credentials" });
  const token = id();
  db.authSessions.set(token, user.id);
  setAuthCookie(res, token);
  return res.json({ ok: true, user_id: user.id, onboarding_done: user.onboarding_done });
});

app.post("/api/auth/signout", (req, res) => {
  const userId = authFromRequest(req);
  if (userId) {
    for (const [token, uid] of db.authSessions.entries()) {
      if (uid === userId) db.authSessions.delete(token);
    }
  }
  res.setHeader("Set-Cookie", "seatvio_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  return res.json({ ok: true });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body || {};
  const user = [...db.users.values()].find((u) => u.email === email);
  if (!user) return res.json({ ok: true });
  const token = id();
  db.resetTokens.set(token, user.id);
  return res.json({ ok: true, reset_token: token });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { token, password } = req.body || {};
  const userId = db.resetTokens.get(token);
  if (!userId) return res.status(400).json({ error: "Invalid reset token" });
  if (!password || String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  const user = db.users.get(userId);
  user.password_hash = hashPassword(password);
  user.updated_at = nowIso();
  db.resetTokens.delete(token);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.users.get(req.userId);
  const profile = db.profiles.get(req.userId) || null;
  res.json({ user, profile });
});

// 3.2 Profile Endpoints
app.post("/api/profile", requireAuth, (req, res) => {
  const profile = { id: id(), user_id: req.userId, ...req.body, created_at: nowIso() };
  db.profiles.set(req.userId, profile);
  const user = db.users.get(req.userId);
  user.onboarding_done = true;
  user.updated_at = nowIso();
  res.status(201).json(profile);
});

app.put("/api/profile", requireAuth, (req, res) => {
  const current = db.profiles.get(req.userId);
  if (!current) return res.status(404).json({ error: "Profile not found" });
  const updated = { ...current, ...req.body };
  db.profiles.set(req.userId, updated);
  res.json(updated);
});

app.get("/api/profile", requireAuth, (req, res) => {
  res.json(db.profiles.get(req.userId) || null);
});

// 3.3 Application Endpoints
app.post("/api/applications", requireAuth, async (req, res) => {
  const { company_name, job_title, jd_text, resume_text, interview_stage } = req.body || {};
  if (!company_name || !job_title || !jd_text || !resume_text) {
    return res.status(400).json({ error: "company_name, job_title, jd_text, and resume_text are required" });
  }
  const appObj = {
    id: id(),
    user_id: req.userId,
    company_name,
    job_title,
    jd_text,
    resume_text,
    interview_stage: interview_stage || "applied",
    status: "active",
    alignment_score: null,
    readiness_score: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.apps.set(appObj.id, appObj);
  db.appStatus.set(appObj.id, { parsing: "queued", questions: "queued" });

  setTimeout(async () => {
    const parsedResume = await callAi("/parse/resume", { text: resume_text }, { top_skills: ["communication"] });
    const parsedJD = await callAi("/parse/jd", { text: jd_text }, { required_skills: ["ownership"], responsibilities: ["deliver outcomes"] });
    const alignment = await callAi("/alignment", { resume_text, jd_text }, { alignment_score: 70, likely_probe_areas: ["metrics"] });
    const qgen = await callAi("/questions/generate", { resume_text, jd_text, company_name, job_title }, { questions: [] });
    appObj.alignment_score = alignment.alignment_score || 70;
    db.questionsByApp.set(appObj.id, (qgen.questions || []).map((q, i) => ({
      id: id(),
      application_id: appObj.id,
      question_text: q.question_text || `Question ${i + 1}`,
      question_type: q.question_type || "behavioral",
      why_asked: q.why_asked || "Assess signal quality under pressure.",
      framework: q.framework || "STAR",
      model_answer: q.model_answer || "Model answer pending synthesis from ai-engine.",
      what_not_to_say: q.what_not_to_say || "Avoid vague claims without outcomes.",
      time_guidance_sec: q.time_guidance_sec || 120,
      likely_followup: q.likely_followup || "What was your specific role?",
      difficulty: q.difficulty || 3,
      sort_order: i + 1,
      parsed_resume: parsedResume,
      parsed_jd: parsedJD,
    })));
    db.appStatus.set(appObj.id, { parsing: "done", questions: "done" });
  }, 30);

  res.status(201).json(appObj);
});

app.get("/api/applications", requireAuth, (req, res) => {
  const data = [...db.apps.values()].filter((a) => a.user_id === req.userId && a.status !== "deleted");
  res.json(data);
});

app.get("/api/applications/:id", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  const questions = db.questionsByApp.get(req.params.id) || [];
  res.json({ ...appObj, questions });
});

app.put("/api/applications/:id", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  const updated = { ...appObj, ...req.body, updated_at: nowIso() };
  db.apps.set(req.params.id, updated);
  res.json(updated);
});

app.delete("/api/applications/:id", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  appObj.status = "deleted";
  appObj.updated_at = nowIso();
  db.apps.set(req.params.id, appObj);
  res.json({ ok: true });
});

app.get("/api/applications/:id/status", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  res.json(db.appStatus.get(req.params.id) || { parsing: "unknown", questions: "unknown" });
});

// 3.4 Question Endpoints
app.get("/api/applications/:id/questions", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  const filter = req.query.question_type;
  const questions = db.questionsByApp.get(req.params.id) || [];
  res.json(filter ? questions.filter((q) => q.question_type === filter) : questions);
});

app.get("/api/questions/:id", requireAuth, (req, res) => {
  for (const questions of db.questionsByApp.values()) {
    const question = questions.find((q) => q.id === req.params.id);
    if (question) return res.json(question);
  }
  return res.status(404).json({ error: "Question not found" });
});

// 3.5 Answer Endpoints
app.post("/api/questions/:id/answers", requireAuth, (req, res) => {
  const answer = {
    id: id(),
    question_id: req.params.id,
    user_id: req.userId,
    answer_text: req.body.answer_text || "",
    audio_url: req.body.audio_url || null,
    confidence_rating: req.body.confidence_rating || 1,
    status: req.body.status || "drafting",
    practice_count: req.body.practice_count || 0,
    is_favorite: Boolean(req.body.is_favorite),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.answers.set(answer.id, answer);
  const list = db.answersByQuestion.get(req.params.id) || [];
  list.push(answer);
  db.answersByQuestion.set(req.params.id, list);
  res.status(201).json(answer);
});

app.put("/api/answers/:id", requireAuth, (req, res) => {
  const answer = db.answers.get(req.params.id);
  if (!answer || answer.user_id !== req.userId) return res.status(404).json({ error: "Answer not found" });
  const updated = { ...answer, ...req.body, updated_at: nowIso() };
  db.answers.set(req.params.id, updated);
  res.json(updated);
});

app.post("/api/answers/:id/analyze", requireAuth, async (req, res) => {
  const answer = db.answers.get(req.params.id);
  if (!answer || answer.user_id !== req.userId) return res.status(404).json({ error: "Answer not found" });
  const analysis = await callAi("/answers/analyze", req.body, {
    strengths: [{ text: "Clear opening", quote_from_answer: answer.answer_text.slice(0, 80) }],
    issues: [{ text: "Add metrics", quote_from_answer: answer.answer_text.slice(0, 80), suggestion: "Add one number." }],
    missing_elements: ["Measurable outcome"],
    scores: { structure: 7, specificity: 6, confidence: 7, overall: 7 },
    verdict: "Strong baseline with room for specificity.",
  });
  const feedback = {
    id: id(),
    user_answer_id: answer.id,
    strengths: analysis.strengths || [],
    issues: analysis.issues || [],
    missing_elements: analysis.missing_elements || [],
    score_structure: analysis.scores?.structure || 7,
    score_specificity: analysis.scores?.specificity || 7,
    score_confidence: analysis.scores?.confidence || 7,
    score_overall: analysis.scores?.overall || 7,
    verdict: analysis.verdict || "Solid draft answer.",
    created_at: nowIso(),
  };
  db.feedbackByAnswer.set(answer.id, feedback);
  res.json(feedback);
});

app.get("/api/questions/:id/answers", requireAuth, (req, res) => {
  const rows = (db.answersByQuestion.get(req.params.id) || []).filter((a) => a.user_id === req.userId);
  res.json(rows);
});

// 3.6 Session Endpoints
app.post("/api/applications/:id/sessions", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  const stage = req.body.stage || "first_round";
  const intensity = req.body.intensity || "standard";
  const target_duration_min = Number(req.body.target_duration_min || 45);
  const session = {
    id: id(),
    user_id: req.userId,
    application_id: appObj.id,
    stage,
    intensity,
    target_duration_min,
    actual_duration_ms: null,
    status: "pending",
    characters: panelForSession({ stage, intensity, company_name: appObj.company_name }),
    unexpected_events: [
      { type: "late_join", trigger_time_ms: 120000 },
      { type: "audio_glitch", trigger_time_ms: 360000 },
      { type: "curveball_question", trigger_time_ms: 600000 },
    ],
    started_at: null,
    ended_at: null,
    created_at: nowIso(),
  };
  db.sessions.set(session.id, session);
  db.exchangesBySession.set(session.id, []);
  res.status(201).json(session);
});

app.get("/api/sessions/:id", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

app.put("/api/sessions/:id", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  const next = { ...session, ...req.body };
  if (req.body.status === "in_progress" && !session.started_at) next.started_at = nowIso();
  if (req.body.status === "completed" && !session.ended_at) next.ended_at = nowIso();
  db.sessions.set(req.params.id, next);
  res.json(next);
});

app.post("/api/sessions/:id/exchanges", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  const list = db.exchangesBySession.get(req.params.id) || [];
  const row = {
    id: id(),
    session_id: req.params.id,
    sequence_number: list.length + 1,
    speaker: req.body.speaker || "candidate",
    character_id: req.body.character_id || null,
    message_text: req.body.message_text || "",
    audio_url: req.body.audio_url || null,
    timestamp_ms: Number(req.body.timestamp_ms || list.length * 10000),
    duration_ms: req.body.duration_ms || null,
    created_at: nowIso(),
  };
  list.push(row);
  db.exchangesBySession.set(req.params.id, list);
  res.status(201).json(row);
});

// Compatibility route used by current web client transport.
app.post("/api/sessions/:id/exchange", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  const exchanges = db.exchangesBySession.get(req.params.id) || [];
  const messageText = String(req.body.messageText || "").trim();
  const characterId = String(req.body.characterId || "").trim();
  if (!messageText || !characterId) {
    return res.status(400).json({ error: "messageText and characterId are required" });
  }

  const candidateExchange = {
    id: id(),
    session_id: req.params.id,
    sequence_number: exchanges.length + 1,
    speaker: "candidate",
    character_id: null,
    message_text: messageText,
    audio_url: null,
    timestamp_ms: exchanges.length * 12000,
    duration_ms: null,
    created_at: nowIso(),
  };
  const interviewerExchange = {
    id: id(),
    session_id: req.params.id,
    sequence_number: exchanges.length + 2,
    speaker: "interviewer",
    character_id: characterId,
    message_text: `Thanks. Could you be more specific about your personal role and measurable outcome?`,
    audio_url: null,
    timestamp_ms: exchanges.length * 12000 + 3000,
    duration_ms: null,
    created_at: nowIso(),
  };
  exchanges.push(candidateExchange, interviewerExchange);
  db.exchangesBySession.set(req.params.id, exchanges);
  return res.json({
    candidateExchange: {
      id: candidateExchange.id,
      sequenceNumber: candidateExchange.sequence_number,
      speaker: "candidate",
      characterId: null,
      messageText: candidateExchange.message_text,
      timestampMs: candidateExchange.timestamp_ms,
    },
    interviewerExchange: {
      id: interviewerExchange.id,
      sequenceNumber: interviewerExchange.sequence_number,
      speaker: "interviewer",
      characterId: interviewerExchange.character_id,
      messageText: interviewerExchange.message_text,
      timestampMs: interviewerExchange.timestamp_ms,
    },
    character: session.characters.find((c) => c.character_id === characterId) || null,
  });
});

app.get("/api/sessions/:id/exchanges", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  res.json(db.exchangesBySession.get(req.params.id) || []);
});

app.post("/api/sessions/:id/complete", requireAuth, async (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  session.status = "completed";
  session.ended_at = nowIso();
  const exchanges = db.exchangesBySession.get(req.params.id) || [];
  const generated = await callAi("/debrief/generate", {
    transcript: exchanges.map((e) => `${e.speaker}: ${e.message_text}`).join("\n"),
    company_name: req.body.company_name || "Company",
    job_title: req.body.job_title || "Role",
  }, {});
  const analysis = {
    id: id(),
    session_id: req.params.id,
    moment_map: generated.moment_map || [],
    score_answer_quality: generated.score_answer_quality || 72,
    score_delivery: generated.score_delivery || 69,
    score_pressure: generated.score_pressure || 66,
    score_company_fit: generated.score_company_fit || 70,
    score_listening: generated.score_listening || 68,
    hiring_probability: generated.hiring_probability || 65,
    would_advance: generated.would_advance ?? false,
    yes_reasons: generated.yes_reasons || ["Strong examples", "Good ownership", "Clear structure"],
    no_reasons: generated.no_reasons || ["Needs tighter outcomes", "Confidence dips", "Keyword coverage gaps"],
    role_comparison: generated.role_comparison || "Candidate is close to role expectations with measurable improvement areas.",
    next_targets: generated.next_targets || [],
    coach_audio_url: generated.coach_audio_url || null,
    coach_script: generated.coach_script || "",
    created_at: nowIso(),
  };
  db.analysesBySession.set(req.params.id, analysis);
  res.json({ ok: true, analysis_id: analysis.id });
});

app.get("/api/sessions/:id/analysis", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  res.json(db.analysesBySession.get(req.params.id) || null);
});

// 3.7 Observe Endpoints
app.post("/api/sessions/:id/observe", requireAuth, async (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  const observe = await callAi("/observe/generate", req.body, {
    perfect_run_id: id(),
    cautionary_run_id: id(),
    perfect: { exchanges: [], annotations: [] },
    cautionary: { exchanges: [], annotations: [] },
  });
  const map = {
    perfect: { id: observe.perfect_run_id || id(), type: "perfect", ...observe.perfect },
    cautionary: { id: observe.cautionary_run_id || id(), type: "cautionary", ...observe.cautionary },
  };
  db.observeBySession.set(req.params.id, map);
  res.json({ ok: true, ...map });
});

app.get("/api/sessions/:id/observe/:type", requireAuth, (req, res) => {
  const session = db.sessions.get(req.params.id);
  if (!session || session.user_id !== req.userId) return res.status(404).json({ error: "Session not found" });
  const map = db.observeBySession.get(req.params.id) || {};
  const run = map[req.params.type];
  if (!run) return res.status(404).json({ error: "Observe run not found" });
  res.json(run);
});

// 3.8 Subscription Endpoints
app.get("/api/subscription", requireAuth, (req, res) => {
  res.json(db.subscriptionsByUser.get(req.userId) || { ...DEFAULT_PLAN, user_id: req.userId });
});

app.post("/api/subscription/checkout", requireAuth, (req, res) => {
  const plan = req.body.plan || "prep";
  const current = db.subscriptionsByUser.get(req.userId) || { ...DEFAULT_PLAN, user_id: req.userId };
  const next = {
    ...current,
    plan,
    status: "active",
    billing_cycle: req.body.billing_cycle || "monthly",
    processor_sub_id: `mock_sub_${id()}`,
    updated_at: nowIso(),
  };
  db.subscriptionsByUser.set(req.userId, next);
  res.json({ ok: true, checkout_id: `checkout_${id()}`, subscription: next });
});

app.post("/api/subscription/webhook", (req, res) => {
  res.json({ ok: true, received: true, event: req.body?.type || "unknown" });
});

app.post("/api/subscription/cancel", requireAuth, (req, res) => {
  const current = db.subscriptionsByUser.get(req.userId) || { ...DEFAULT_PLAN, user_id: req.userId };
  const next = { ...current, status: "cancelled", updated_at: nowIso() };
  db.subscriptionsByUser.set(req.userId, next);
  res.json({ ok: true, subscription: next });
});

// 3.9 Countdown Endpoints
app.post("/api/applications/:id/countdown", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  const interview_date = req.body.interview_date;
  if (!interview_date) return res.status(400).json({ error: "interview_date is required" });
  const plan_data = req.body.plan_data || [
    { day_number: 1, date: interview_date, activity: "Opening answer drill", reason: "Improve confidence", completed: false },
  ];
  const plan = { id: id(), application_id: req.params.id, interview_date, plan_data, created_at: nowIso() };
  db.countdownByApp.set(req.params.id, plan);
  res.status(201).json(plan);
});

app.get("/api/applications/:id/countdown", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  res.json(db.countdownByApp.get(req.params.id) || null);
});

app.put("/api/applications/:id/countdown/:day", requireAuth, (req, res) => {
  const appObj = db.apps.get(req.params.id);
  if (!appObj || appObj.user_id !== req.userId) return res.status(404).json({ error: "Application not found" });
  const plan = db.countdownByApp.get(req.params.id);
  if (!plan) return res.status(404).json({ error: "Countdown plan not found" });
  const dayNumber = Number(req.params.day);
  plan.plan_data = plan.plan_data.map((entry) =>
    entry.day_number === dayNumber ? { ...entry, completed: Boolean(req.body.completed) } : entry
  );
  db.countdownByApp.set(req.params.id, plan);
  res.json(plan);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api-server] listening on :${PORT}`);
});
