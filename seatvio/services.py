from __future__ import annotations

import json
import random
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any


QUESTION_CATEGORY_MINIMUMS = {
    "Behavioral": 6,
    "Technical / Functional": 4,
    "Situational": 4,
    "Company-Specific": 3,
    "Curveball": 3,
    "Opening": 2,
    "Closing": 3,
}

FRAMEWORK_BY_CATEGORY = {
    "Behavioral": "STAR",
    "Technical / Functional": "Direct response",
    "Situational": "SOAR",
    "Company-Specific": "PREP",
    "Curveball": "PAR",
    "Opening": "PREP",
    "Closing": "Direct response",
}

UNSURE_PHRASES = [
    "i think",
    "i feel like",
    "sort of",
    "kind of",
    "i'm not sure",
    "maybe",
    "i guess",
    "probably",
]

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
    "you",
    "your",
    "our",
    "we",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def json_dumps(data: Any) -> str:
    return json.dumps(data, ensure_ascii=True)


def json_loads(text: str | None, fallback: Any) -> Any:
    if not text:
        return fallback
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return fallback


def normalize_words(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9\-\+\.]{1,}", text.lower())


def top_keywords(text: str, n: int = 20) -> list[str]:
    words = [w for w in normalize_words(text) if w not in STOPWORDS and len(w) > 2]
    return [word for word, _ in Counter(words).most_common(n)]


def extract_values_language(jd_text: str) -> list[str]:
    values_candidates = []
    pattern = re.compile(
        r"(ownership mindset|bias for action|customer obsession|collaborat\w+|move fast|"
        r"data[- ]driven|accountab\w+|innovation|growth mindset|team player|"
        r"stakeholder management|high standards)",
        re.IGNORECASE,
    )
    for match in pattern.findall(jd_text):
        values_candidates.append(match.lower())
    if not values_candidates:
        values_candidates = top_keywords(jd_text, n=6)[:4]
    return sorted(set(values_candidates))[:8]


def infer_seniority(job_title: str, jd_text: str) -> str:
    text = f"{job_title} {jd_text}".lower()
    if any(k in text for k in ["principal", "director", "head", "vp", "executive"]):
        return "senior"
    if any(k in text for k in ["senior", "lead", "staff", "manager"]):
        return "mid-senior"
    if any(k in text for k in ["intern", "junior", "associate", "entry"]):
        return "junior"
    return "mid"


def analyze_alignment(resume_text: str, jd_text: str) -> dict[str, Any]:
    resume_terms = set(top_keywords(resume_text, n=45))
    jd_terms = set(top_keywords(jd_text, n=45))
    overlap = sorted(resume_terms & jd_terms)
    gaps = sorted(jd_terms - resume_terms)[:10]
    missing_keywords = gaps[:8]
    strengths = overlap[:8]
    probe_areas = []
    if gaps:
        probe_areas.extend([f"Depth in {term}" for term in gaps[:4]])
    if "manager" in jd_text.lower() and "lead" not in resume_text.lower():
        probe_areas.append("Leadership and people-management evidence")
    if "stakeholder" in jd_text.lower() and "stakeholder" not in resume_text.lower():
        probe_areas.append("Cross-functional stakeholder management")
    overlap_ratio = 0.0 if not jd_terms else len(overlap) / len(jd_terms)
    alignment_score = int(min(100, max(15, 40 + overlap_ratio * 60)))
    return {
        "alignment_score": alignment_score,
        "skill_gaps": gaps,
        "strengths": strengths,
        "missing_keywords": missing_keywords,
        "probe_areas": probe_areas[:8],
        "values_language": extract_values_language(jd_text),
    }


def category_seed_templates(category: str) -> list[str]:
    templates = {
        "Behavioral": [
            "Tell me about a time at {company} when you had to influence without authority.",
            "Describe a high-pressure project from your background and the outcome you drove.",
            "Walk me through a conflict with a stakeholder and how you resolved it.",
            "Share a moment when you failed initially and what changed after your recovery.",
        ],
        "Technical / Functional": [
            "How would you approach {skill} for this role in the first 90 days?",
            "Walk through your methodology for delivering {skill} outcomes at scale.",
            "What metrics would you track to ensure success in this position?",
        ],
        "Situational": [
            "If your first major initiative misses its target, how would you recover?",
            "How would you prioritize competing requests from leadership and operations?",
            "What would you do if requirements changed halfway through delivery?",
        ],
        "Company-Specific": [
            "Why this role at {company}, and why now?",
            "What did you learn about {company}'s culture that makes you a fit?",
            "How would you embody our values in your first quarter?",
        ],
        "Curveball": [
            "Your resume suggests less depth in {gap}. How would you close that quickly?",
            "Why should we take a risk on you over someone with direct experience?",
            "What is one concern we should have about your candidacy?",
        ],
        "Opening": [
            "Walk me through your background and why it leads to this role.",
            "Give me the 90-second story of your career so far.",
        ],
        "Closing": [
            "What questions do you have for us?",
            "What would help you decide to join {company}?",
            "What would success in this role look like to you after 6 months?",
        ],
    }
    return templates.get(category, [])


def generate_question_bank(
    company_name: str,
    job_title: str,
    jd_text: str,
    resume_text: str,
    alignment: dict[str, Any],
) -> list[dict[str, Any]]:
    random.seed(f"{company_name}:{job_title}")
    questions = []
    top_skills = top_keywords(jd_text, n=10)
    gap_term = alignment["skill_gaps"][0] if alignment["skill_gaps"] else "this role area"

    for category, minimum in QUESTION_CATEGORY_MINIMUMS.items():
        templates = category_seed_templates(category)
        for idx in range(minimum):
            template = templates[idx % len(templates)]
            skill = top_skills[idx % max(1, len(top_skills))] if top_skills else "execution"
            question_text = template.format(company=company_name, skill=skill, gap=gap_term)
            model_answer = (
                f"In my most relevant role, I tackled a challenge directly tied to {job_title}. "
                f"I scoped the problem, aligned stakeholders, and implemented a measurable plan. "
                f"I can point to concrete outcomes tied to {skill}, including improvements in quality, "
                "cycle time, and team alignment. I would bring that same approach here by setting "
                "clear goals, translating ambiguity into milestones, and communicating trade-offs early. "
                "The key lesson from my background is to stay specific: define baseline metrics, execute "
                "with ownership, and close with outcomes that matter to the business."
            )
            questions.append(
                {
                    "category": category,
                    "question_text": question_text,
                    "why_asked": (
                        "Interviewers use this to validate role fit, ownership, and your ability to "
                        "connect experience to the job's real responsibilities."
                    ),
                    "framework": FRAMEWORK_BY_CATEGORY[category],
                    "model_answer": model_answer,
                    "what_not_to_say": "Avoid vague claims, team-only ownership, and missing outcomes.",
                    "time_guidance_seconds": 90 if category in {"Behavioral", "Opening"} else 75,
                    "likely_followup": "What was your personal contribution and measurable outcome?",
                    "difficulty": 4 if category == "Curveball" else 3,
                }
            )
    return questions


def evaluate_answer_status(confidence: int, practice_count: int) -> str:
    if confidence >= 4 and practice_count >= 3:
        return "Ready"
    if practice_count >= 2:
        return "Rehearsing"
    return "Drafting"


def analyze_answer_text(answer_text: str, time_guidance_seconds: int) -> dict[str, Any]:
    lowered = answer_text.lower()
    words = max(1, len(answer_text.split()))
    speaking_seconds = int((words / 130) * 60)
    issues = []

    uncertain_matches = [phrase for phrase in UNSURE_PHRASES if phrase in lowered]
    if uncertain_matches:
        issues.append(
            {
                "type": "Uncertain language",
                "detail": f"Detected uncertain phrases: {', '.join(uncertain_matches[:3])}.",
                "suggestion": "Replace with direct claims and concrete evidence.",
            }
        )

    if ("we " in lowered or "team " in lowered) and "i " not in lowered:
        issues.append(
            {
                "type": "Missing personal ownership",
                "detail": "The answer emphasizes team actions but not your direct role.",
                "suggestion": "Explicitly state your personal decisions and contributions.",
            }
        )

    if words >= 100 and not re.search(r"\b\d+(\.\d+)?%?\b", answer_text):
        issues.append(
            {
                "type": "Missing quantification",
                "detail": "Long answer without measurable outcomes.",
                "suggestion": "Add at least one metric (time, %, revenue, cost, SLA, volume).",
            }
        )

    if speaking_seconds > int(time_guidance_seconds * 1.5):
        issues.append(
            {
                "type": "Rambling indicator",
                "detail": f"Estimated speaking time ({speaking_seconds}s) exceeds guidance.",
                "suggestion": "Tighten to one clear story with concise context and outcomes.",
            }
        )

    structure = 10 - min(5, len(issues))
    specificity = 7 if re.search(r"\b\d+(\.\d+)?%?\b", answer_text) else 5
    confidence = 9 - min(5, len(uncertain_matches))
    overall = int((structure + specificity + confidence) / 3)
    strengths = []
    if words >= 60:
        strengths.append("Answer has sufficient depth to evaluate.")
    if "i " in lowered:
        strengths.append("Includes first-person ownership language.")
    if not strengths:
        strengths.append("Concise response; can be expanded with stronger evidence.")

    return {
        "strengths": strengths[:3],
        "issues": issues,
        "missing_elements": [
            "A stronger explicit outcome statement.",
            "A clearer structure: context, action, measurable result.",
        ],
        "scores": {
            "structure": max(1, min(10, structure)),
            "specificity": max(1, min(10, specificity)),
            "confidence_language": max(1, min(10, confidence)),
            "overall": max(1, min(10, overall)),
        },
        "verdict": "Solid base; sharpen specificity and confidence language.",
        "word_count": words,
        "estimated_speaking_seconds": speaking_seconds,
    }


ARCHETYPES = {
    "Skeptic": {
        "silence_seconds": [3, 4],
        "style": "direct and measured",
        "phrases": [
            "Walk me through specifically.",
            "What was your role versus the team's?",
            "Give me a number there.",
        ],
    },
    "Friendly Champion": {
        "silence_seconds": [1, 2],
        "style": "warm and encouraging",
        "phrases": [
            "That's helpful, tell me more.",
            "I appreciate that context.",
            "What was the hardest part?",
        ],
    },
    "Technical Griller": {
        "silence_seconds": [4, 5],
        "style": "precise and demanding",
        "phrases": [
            "Walk me through exactly how.",
            "What was your methodology?",
            "Be more specific.",
        ],
    },
    "Distracted Senior": {
        "silence_seconds": [1, 8],
        "style": "unpredictable and brief",
        "phrases": [
            "Sorry, repeat that last part.",
            "Quick one: what timeline did you commit to?",
        ],
    },
    "Culture Fit Assessor": {
        "silence_seconds": [2, 3],
        "style": "conversational and values-focused",
        "phrases": [
            "How does that reflect your working style?",
            "What does collaboration mean to you in practice?",
        ],
    },
    "Silent Observer": {
        "silence_seconds": [0, 0],
        "style": "mostly silent",
        "phrases": ["I've been listening throughout—one final question."],
    },
}


def choose_panel(stage: str, company_name: str, seniority: str) -> list[dict[str, Any]]:
    stage_lower = stage.lower()
    if "phone" in stage_lower:
        archetypes = ["Friendly Champion"]
    elif "panel" in stage_lower or "final" in stage_lower:
        archetypes = ["Skeptic", "Technical Griller", "Silent Observer"]
    elif "stress" in stage_lower:
        archetypes = ["Skeptic", "Technical Griller"]
    else:
        archetypes = ["Skeptic", "Friendly Champion"]

    if "startup" in company_name.lower():
        archetypes = ["Friendly Champion", "Culture Fit Assessor"][: len(archetypes)]
    if seniority in {"senior", "mid-senior"} and "Distracted Senior" not in archetypes and len(archetypes) >= 2:
        archetypes[1] = "Distracted Senior"

    panel = []
    for i, archetype in enumerate(archetypes):
        panel.append(
            {
                "id": f"char_{i+1}",
                "name": ["Jordan", "Avery", "Casey"][i],
                "title": ["Hiring Manager", "Panelist", "Observer"][i],
                "archetype": archetype,
                "style": ARCHETYPES[archetype]["style"],
            }
        )
    return panel


def response_for_turn(character: dict[str, Any], candidate_text: str, turn_index: int) -> dict[str, Any]:
    archetype = character["archetype"]
    rules = ARCHETYPES[archetype]
    silence_range = rules["silence_seconds"]
    silence_seconds = random.randint(silence_range[0], silence_range[1]) if silence_range[1] > 0 else 0

    vague = len(candidate_text.split()) < 25 or "we " in candidate_text.lower()
    phrase = rules["phrases"][turn_index % len(rules["phrases"])]
    if archetype == "Silent Observer" and turn_index < 4:
        message = "(takes notes silently)"
    elif vague:
        message = f"{phrase} Please anchor it to your personal actions and the final outcome."
    else:
        message = f"{phrase} What would you do differently next time?"

    return {"silence_seconds": silence_seconds, "message": message}


def calculate_debrief(transcript: list[dict[str, Any]], values_language: list[str]) -> dict[str, Any]:
    candidate_turns = [t for t in transcript if t.get("speaker") == "candidate"]
    if not candidate_turns:
        return {
            "moment_map": [],
            "dimension_scores": {
                "answer_quality": 50,
                "delivery_confidence": 50,
                "pressure_recovery": 50,
                "company_fit_language": 50,
                "listening_accuracy": 50,
            },
            "hiring_probability": 50,
            "next_targets": [],
        }

    full_text = " ".join(t["message"] for t in candidate_turns).lower()
    total_words = len(full_text.split())
    unsure_count = sum(full_text.count(p) for p in UNSURE_PHRASES)
    number_count = len(re.findall(r"\b\d+(\.\d+)?%?\b", full_text))
    value_hits = sum(1 for value in values_language if value in full_text)

    answer_quality = min(100, max(35, 55 + number_count * 8 - unsure_count * 4))
    delivery_confidence = min(100, max(30, 70 - unsure_count * 6))
    pressure_recovery = min(100, max(35, 60 + (number_count * 3) - unsure_count * 4))
    company_fit = min(100, max(20, 40 + value_hits * 12))
    listening = min(100, max(35, 60 + (total_words // 45)))
    hiring_probability = int(
        (answer_quality + delivery_confidence + pressure_recovery + company_fit + listening) / 5
    )

    moment_map = []
    for i, turn in enumerate(candidate_turns, start=1):
        txt = turn["message"].lower()
        color = "green"
        note = "Strong specificity and clear ownership."
        if any(p in txt for p in UNSURE_PHRASES):
            color = "yellow"
            note = "Uncertainty language reduced confidence."
        if "we " in txt and " i " not in f" {txt} ":
            color = "red"
            note = "Team-heavy wording hid your personal ownership."
        moment_map.append(
            {
                "timestamp": f"{i*2:02d}:{(i*17)%60:02d}",
                "color": color,
                "exchange": turn["message"],
                "coach_note": note,
            }
        )

    next_targets = [
        {
            "title": "Eliminate uncertainty language",
            "description": "Reduce phrases like 'I think' and 'maybe' in behavioral answers.",
            "action": "Record 5 answers with direct claims and one measurable outcome each.",
            "success_metric": "Zero uncertain phrases in your next session opener + 2 behavioral answers.",
        },
        {
            "title": "Lead with personal ownership",
            "description": "State your individual actions before team context.",
            "action": "Use 'I owned / I decided / I delivered' sentence stems first.",
            "success_metric": "Every major answer includes explicit first-person role statement.",
        },
        {
            "title": "Increase quantified outcomes",
            "description": "Include concrete metrics in each key story.",
            "action": "Add one number, timeline, and business impact per STAR story.",
            "success_metric": "At least 4 quantified outcomes in next full session.",
        },
    ]
    return {
        "moment_map": moment_map,
        "dimension_scores": {
            "answer_quality": answer_quality,
            "delivery_confidence": delivery_confidence,
            "pressure_recovery": pressure_recovery,
            "company_fit_language": company_fit,
            "listening_accuracy": listening,
        },
        "hiring_probability": hiring_probability,
        "next_targets": next_targets,
    }


def generate_observe_runs(session_transcript: list[dict[str, Any]]) -> dict[str, Any]:
    interviewer_turns = [t for t in session_transcript if t.get("speaker") != "candidate"]
    perfect_script = []
    caution_script = []
    for i, turn in enumerate(interviewer_turns[:6], start=1):
        question = turn["message"]
        perfect_answer = (
            "I handled this by clarifying the goal, aligning stakeholders, and delivering a measurable result "
            f"(example {i}: +{i*8}% quality, timeline met). I owned decision points and trade-offs."
        )
        caution_answer = (
            "I think we mostly handled this okay, and the team did a lot. "
            "Maybe it could have gone better, but it was complicated."
        )
        perfect_script.append({"question": question, "answer": perfect_answer})
        caution_script.append({"question": question, "answer": caution_answer})

    perfect_annotations = [
        "Strong ownership language and measured business impact.",
        "Clear structure: context, action, result.",
    ]
    caution_annotations = [
        "Silence-filling and uncertainty language reduce credibility.",
        "Missing metrics and unclear personal contribution.",
    ]
    return {
        "perfect": {"script": perfect_script, "annotations": perfect_annotations},
        "cautionary": {"script": caution_script, "annotations": caution_annotations},
    }
