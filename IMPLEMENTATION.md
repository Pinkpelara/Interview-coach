# Seatvio MVP Implementation

This repository now contains a runnable Seatvio MVP aligned to the PRD modules:

- **Onboarding**: profile capture with anxiety level and interview context.
- **Application Management**: create independent applications with resume/JD text and alignment analysis.
- **Prepare**: personalized question bank generation across required categories; answer builder with analysis, confidence, status, and flashcard API.
- **Perform**: live session simulation loop (MVP text-based), interviewer archetype behavior, turn-taking, and pressure mechanics (silence timings).
- **Debrief**: moment map, five dimension scores, hiring probability, and exactly three next-session targets.
- **Observe**: perfect + cautionary generated runs with annotations.
- **Session History**: cross-application session list with scores.
- **Prompt Assets**: versioned prompt files in `seatvio/prompts/`.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open: http://localhost:8000

## Test

```bash
pytest -q
```
