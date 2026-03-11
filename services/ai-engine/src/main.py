from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field


APP_NAME = "seatvio-ai-engine"

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
    company_values: list[str] = Field(default_factory=list)


class DebriefRequest(BaseModel):
    transcript: str = Field(min_length=1)
    company_name: str = Field(min_length=1)
    job_title: str = Field(min_length=1)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"ok": True, "service": APP_NAME, "mode": "scaffold"}


@app.post("/parse/resume")
async def parse_resume(payload: ParseDocumentRequest) -> dict[str, Any]:
    # TODO: Replace mock extraction with model-backed parser.
    return {
        "career_timeline": ["Mock role timeline extracted from resume."],
        "top_skills": ["communication", "project management"],
        "experience_gaps": [],
        "achievements": ["Improved key metric by 18% (mock)."],
        "education": ["Mock education entry."],
    }


@app.post("/parse/jd")
async def parse_jd(payload: ParseDocumentRequest) -> dict[str, Any]:
    # TODO: Replace mock extraction with model-backed parser.
    return {
        "required_skills": ["stakeholder management", "analysis"],
        "preferred_skills": ["mentoring"],
        "responsibilities": ["Deliver cross-functional outcomes"],
        "seniority_level": "mid-senior",
        "values_language": ["ownership", "collaboration"],
        "red_flag_areas": [],
        "interview_format_prediction": "behavioral_mixed",
    }


@app.post("/alignment")
async def alignment(payload: AlignmentRequest) -> dict[str, Any]:
    # TODO: Replace with model/scoring pipeline.
    return {
        "alignment_score": 72,
        "skill_gaps": ["domain-specific tooling"],
        "strengths": ["cross-functional delivery", "communication"],
        "missing_keywords": ["ownership mindset"],
        "likely_probe_areas": ["scope clarity", "metrics ownership"],
    }


@app.post("/questions/generate")
async def generate_questions(payload: QuestionGenRequest) -> dict[str, Any]:
    # TODO: Replace with model-backed generation.
    return {
        "questions": [
            {
                "question_text": f"Walk me through your background and why {payload.company_name} for {payload.job_title}.",
                "question_type": "opening",
                "difficulty": 2,
            },
            {
                "question_text": "Tell me about a time you handled conflicting stakeholder priorities.",
                "question_type": "behavioral",
                "difficulty": 3,
            },
        ]
    }


@app.post("/answers/analyze")
async def analyze_answer(payload: AnswerAnalyzeRequest) -> dict[str, Any]:
    # TODO: Replace with model-backed answer analysis.
    return {
        "strengths": ["Good structure and role ownership in opening sentence."],
        "issues": ["Needs one measurable outcome."],
        "missing_elements": ["Quantified impact"],
        "scores": {"structure": 7, "specificity": 6, "confidence": 7, "overall": 7},
        "verdict": "Solid answer with room for stronger metrics.",
    }


@app.post("/debrief/generate")
async def generate_debrief(payload: DebriefRequest) -> dict[str, Any]:
    # TODO: Replace with model-backed debrief analysis.
    return {
        "hiring_probability": 67,
        "next_targets": [
            {
                "title": "Increase quantified outcomes",
                "action": "Add one metric to each behavioral answer.",
            },
            {
                "title": "Reduce filler words",
                "action": "Pause before key claims.",
            },
            {
                "title": "Mirror company language",
                "action": "Use 4-6 JD terms naturally.",
            },
        ],
    }


@app.post("/observe/generate")
async def generate_observe(payload: DebriefRequest) -> dict[str, Any]:
    # TODO: Replace with model-backed perfect/cautionary run generation.
    return {
        "perfect_run_id": "mock-perfect-run",
        "cautionary_run_id": "mock-cautionary-run",
    }
