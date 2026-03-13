from __future__ import annotations

import os
import uuid
from datetime import date, timedelta
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field


APP_NAME = "seatvio-ai-engine"
AI_GATEWAY_URL = os.getenv("AI_GATEWAY_URL", "").rstrip("/")
LLM_URL = AI_GATEWAY_URL or os.getenv("LLM_URL", "").rstrip("/")

app = FastAPI(title=APP_NAME)


class ParseDocumentRequest(BaseModel):
    text: str = Field(min_length=1)


class AlignmentRequest(BaseModel):
    resume_text: str = Field(min_length=1)
    jd_text: str = Field(min_length=1)


class QuestionGenRequest(BaseModel):
    resume_text: str = Field(min_length=1)
    jd_text: str = Field(min_length=1)
    company_name: str = Field(min_length=1)
    job_title: str = Field(min_length=1)


class AnswerAnalyzeRequest(BaseModel):
    question: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    model_answer: str | None = None
    company_values: list[str] = Field(default_factory=list)


class DebriefRequest(BaseModel):
    transcript: str = Field(min_length=1)
    company_name: str = Field(min_length=1)
    job_title: str = Field(min_length=1)
    candidate_name: str = "Candidate"


class CountdownRequest(BaseModel):
    interview_date: date
    weakest_dimensions: list[str] = Field(default_factory=list)
    days: int = 7


def _score_from_overlap(resume_text: str, jd_text: str) -> int:
    resume_tokens = {t.lower() for t in resume_text.split() if len(t) > 3}
    jd_tokens = {t.lower() for t in jd_text.split() if len(t) > 3}
    if not jd_tokens:
        return 60
    overlap = len(resume_tokens.intersection(jd_tokens))
    ratio = overlap / max(1, len(jd_tokens))
    return max(25, min(96, int(40 + ratio * 70)))


def _question_payload(company_name: str, job_title: str, qtype: str, idx: int) -> dict[str, Any]:
    return {
        "question_text": f"[{qtype}] For the {job_title} role at {company_name}, walk me through a concrete example #{idx}.",
        "question_type": qtype,
        "why_asked": "Interviewers use this to evaluate ownership, judgment, and direct relevance to role requirements.",
        "framework": "STAR" if qtype in {"behavioral", "situational", "opening"} else "direct",
        "model_answer": (
            "In my previous role, I led a cross-functional initiative with clear accountability and measurable outcomes. "
            "I defined the problem, aligned stakeholders, and implemented a plan with milestone tracking. "
            "When risks surfaced, I made tradeoff decisions grounded in user impact and delivery constraints. "
            "I owned communication, clarified responsibilities, and drove execution through ambiguity. "
            "As a result, the project shipped on schedule and improved a core KPI with sustained gains over the following quarter. "
            "I would apply the same operating discipline in this role by pairing structured execution with high-quality collaboration."
        ),
        "what_not_to_say": "Avoid vague team-only language and claims without measurable outcomes.",
        "time_guidance_sec": 120,
        "likely_followup": "What was your specific role versus the team?",
        "difficulty": 3 if qtype != "curveball" else 5,
    }


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"ok": True, "service": APP_NAME, "llm_configured": bool(LLM_URL)}


@app.post("/parse/resume")
async def parse_resume(payload: ParseDocumentRequest) -> dict[str, Any]:
    return {
        "career_timeline": [
            {
                "company": "Extracted Company",
                "role": "Extracted Role",
                "start": "2021-01",
                "end": "2024-01",
                "achievements": ["Improved a process KPI by 18%"],
                "responsibilities": ["Led cross-functional delivery"],
            }
        ],
        "top_skills": ["communication", "stakeholder management", "execution"],
        "experience_gaps": [],
        "achievements": [{"text": "Improved KPI by 18%", "has_metrics": True, "metrics": "18%"}],
        "education": [{"institution": "Sample University", "degree": "BSc", "field": "Engineering", "year": "2020"}],
        "career_transitions": [],
    }


@app.post("/parse/jd")
async def parse_jd(payload: ParseDocumentRequest) -> dict[str, Any]:
    return {
        "required_skills": ["stakeholder management", "analytics", "communication"],
        "preferred_skills": ["mentorship", "domain expertise"],
        "responsibilities": ["Drive delivery", "Coordinate teams", "Own outcomes"],
        "seniority_level": "senior",
        "values_language": ["ownership mindset", "bias for action", "collaborative problem-solving"],
        "red_flag_areas": [{"requirement": "deep domain tooling", "gap_description": "resume does not explicitly mention tool depth"}],
        "interview_format_prediction": "mixed",
    }


@app.post("/alignment")
async def alignment(payload: AlignmentRequest) -> dict[str, Any]:
    score = _score_from_overlap(payload.resume_text, payload.jd_text)
    return {
        "alignment_score": score,
        "skill_gaps": [{"skill": "deep domain tooling", "importance": "required"}],
        "strengths": [{"strength": "cross-functional delivery", "jd_match": "ownership"}],
        "missing_keywords": ["ownership mindset", "bias for action"],
        "likely_probe_areas": [{"topic": "metrics ownership", "priority": 5, "reason": "high-signal performance area"}],
    }


@app.post("/questions/generate")
async def generate_questions(payload: QuestionGenRequest) -> dict[str, Any]:
    required_counts = [
        ("behavioral", 6),
        ("technical", 4),
        ("situational", 4),
        ("company_specific", 3),
        ("curveball", 3),
        ("opening", 2),
        ("closing", 3),
    ]
    questions: list[dict[str, Any]] = []
    for qtype, count in required_counts:
        for idx in range(1, count + 1):
            questions.append(_question_payload(payload.company_name, payload.job_title, qtype, idx))
    return {"questions": questions}


@app.post("/answers/analyze")
async def analyze_answer(payload: AnswerAnalyzeRequest) -> dict[str, Any]:
    has_number = any(c.isdigit() for c in payload.answer)
    confidence = 8 if "I " in payload.answer else 6
    specificity = 8 if has_number else 5
    overall = int((7 + confidence + specificity) / 3)
    return {
        "strengths": [{"text": "Clear ownership framing", "quote_from_answer": payload.answer[:120]}],
        "issues": [{
            "text": "Needs stronger quantification" if not has_number else "Tighten narrative transitions",
            "quote_from_answer": payload.answer[:120],
            "suggestion": "Add one measurable result with percentage, revenue, or time impact.",
        }],
        "missing_elements": [] if has_number else ["Specific measurable outcome"],
        "scores": {"structure": 7, "specificity": specificity, "confidence": confidence, "overall": overall},
        "verdict": "Strong baseline answer with clear ownership; add tighter measurable evidence.",
    }


@app.post("/debrief/generate")
async def generate_debrief(payload: DebriefRequest) -> dict[str, Any]:
    return {
        "moment_map": [
            {"start_ms": 0, "end_ms": 90000, "rating": "yellow", "coaching_note": "Opening was clear but not specific enough."},
            {"start_ms": 90000, "end_ms": 260000, "rating": "green", "coaching_note": "Strong structured example with ownership."},
            {"start_ms": 260000, "end_ms": 420000, "rating": "red", "coaching_note": "Filled silence and weakened final claim."},
        ],
        "score_answer_quality": 73,
        "score_delivery": 69,
        "score_pressure": 64,
        "score_company_fit": 71,
        "score_listening": 70,
        "hiring_probability": 67,
        "would_advance": False,
        "yes_reasons": [
            "Clear role ownership in strongest examples",
            "Good structural control in middle phase",
            "Relevant experience for core responsibilities",
        ],
        "no_reasons": [
            "Insufficient quantified outcomes in weaker answers",
            "Confidence dropped during long silences",
            "Missed opportunities to use company values language",
        ],
        "role_comparison": f"Performance is near the bar for {payload.job_title} at {payload.company_name}, but consistency under pressure needs improvement.",
        "next_targets": [
            {
                "title": "Quantify impact in every behavioral answer",
                "description": "Several answers lacked concrete numerical outcomes.",
                "action": "Practice 5 core stories and add one metric line to each.",
                "success_metric": "At least one measurable outcome in each key response.",
            },
            {
                "title": "Hold silence without over-explaining",
                "description": "Silence-filling weakened an otherwise strong point.",
                "action": "Drill 3-second post-answer holds in mock rounds.",
                "success_metric": "No additional caveat statements after final sentence.",
            },
            {
                "title": "Increase values-language precision",
                "description": "Role-fit language was present but inconsistent.",
                "action": "Integrate 4 JD value phrases naturally into prepared stories.",
                "success_metric": "Use 3+ value phrases naturally in next session.",
            },
        ],
        "coach_script": (
            f"{payload.candidate_name}, let's break this down. At 01:20 your opening was composed, but lacked measurable impact. "
            "At 03:45 you delivered your strongest structured answer with clear ownership. At 06:50 you filled a deliberate silence and softened your point. "
            "Next session, focus on quantified outcomes, silence control, and precise values language."
        ),
    }


@app.post("/coach/audio")
async def coach_audio(payload: dict[str, Any]) -> dict[str, Any]:
    return {"coach_audio_url": f"mock://coach/{uuid.uuid4()}.wav", "voice_id": payload.get("voice_id", "nova")}


@app.post("/observe/generate")
async def generate_observe(payload: DebriefRequest) -> dict[str, Any]:
    perfect_id = f"perfect-{uuid.uuid4()}"
    cautionary_id = f"cautionary-{uuid.uuid4()}"
    return {
        "perfect_run_id": perfect_id,
        "cautionary_run_id": cautionary_id,
        "perfect": {
            "exchanges": [{"speaker": "candidate", "text": "Strong, structured answer with measurable outcomes."}],
            "annotations": [{"after_exchange_index": 0, "type": "perfect", "text": "Clear ownership and outcome signal.", "label": "Specificity"}],
        },
        "cautionary": {
            "exchanges": [{"speaker": "candidate", "text": "I think we kind of improved things as a team."}],
            "annotations": [{"after_exchange_index": 0, "type": "cautionary", "text": "Vague claim without support.", "label": "Vague Claim"}],
        },
    }


@app.post("/countdown/generate")
async def generate_countdown(payload: CountdownRequest) -> dict[str, Any]:
    plan_data: list[dict[str, Any]] = []
    for i in range(payload.days):
        day = payload.interview_date - timedelta(days=payload.days - i - 1)
        weakness = payload.weakest_dimensions[i % len(payload.weakest_dimensions)] if payload.weakest_dimensions else "pressure_recovery"
        plan_data.append(
            {
                "day_number": i + 1,
                "date": str(day),
                "activity": "Curveball Recovery Lab" if weakness == "pressure_recovery" else "Behavioral Story Rehearsal",
                "reason": f"Targeting weakest dimension: {weakness}",
                "completed": False,
            }
        )
    return {"plan_data": plan_data}
