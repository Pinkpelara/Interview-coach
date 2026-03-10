from pathlib import Path

from app import create_app


def reset_db():
    db_path = Path(__file__).resolve().parent.parent / "seatvio.db"
    if db_path.exists():
        db_path.unlink()


def test_end_to_end_flow():
    reset_db()
    app = create_app()
    client = app.test_client()

    signup = client.post("/api/auth/signup", json={"email": "user@example.com", "password": "password123"})
    assert signup.status_code == 200
    verify_url = signup.get_json()["verify_url"]
    token = verify_url.split("token=")[1]

    verified = client.get(f"/api/auth/verify?token={token}")
    assert verified.status_code == 200

    login = client.post("/api/auth/login", json={"email": "user@example.com", "password": "password123"})
    assert login.status_code == 200

    onboarding = client.post(
        "/api/onboarding",
        json={
            "full_name": "Test User",
            "current_role": "Product Manager",
            "years_experience": "5-10",
            "current_industry": "Tech",
            "target_industry": "Tech",
            "work_arrangement": "Hybrid",
            "anxiety_level": 7,
            "interview_difficulty_notes": "Long silences",
        },
    )
    assert onboarding.status_code == 200

    app_create = client.post(
        "/api/applications",
        json={
            "company_name": "Seatvio Labs",
            "job_title": "Senior Product Manager",
            "interview_stage": "First Round Scheduled",
            "jd_text": "Need product strategy, leadership, data-driven execution, stakeholder management",
            "resume_text": "Led roadmap, delivered data-informed improvements, owned cross-functional initiatives",
        },
    )
    assert app_create.status_code == 200
    app_id = app_create.get_json()["id"]

    question_generate = client.post(f"/api/applications/{app_id}/questions/generate")
    assert question_generate.status_code == 200

    questions = client.get(f"/api/applications/{app_id}/questions").get_json()
    assert len(questions) >= 20
    qid = questions[0]["id"]

    save_answer = client.post(
        f"/api/questions/{qid}/answer",
        json={"answer_text": "I improved conversion by 12% by redesigning onboarding.", "confidence_rating": 4},
    )
    assert save_answer.status_code == 200

    start = client.post(
        "/api/sessions/start",
        json={"application_id": app_id, "stage": "First Round", "intensity": "Standard", "duration_minutes": 20},
    )
    assert start.status_code == 200
    session_id = start.get_json()["session_id"]

    turn = client.post(f"/api/sessions/{session_id}/turn", json={"message": "I led that project and delivered 18% growth."})
    assert turn.status_code == 200

    end = client.post(f"/api/sessions/{session_id}/end")
    assert end.status_code == 200
    assert "hiring_probability" in end.get_json()

    observe_generate = client.post(f"/api/sessions/{session_id}/observe/generate")
    assert observe_generate.status_code == 200

    observe = client.get(f"/api/sessions/{session_id}/observe")
    assert observe.status_code == 200
    assert len(observe.get_json()) == 2
