from __future__ import annotations

import secrets
from functools import wraps

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from seatvio.db import close_db, get_db, init_db
from seatvio.services import (
    analyze_alignment,
    analyze_answer_text,
    calculate_debrief,
    choose_panel,
    evaluate_answer_status,
    generate_observe_runs,
    generate_question_bank,
    infer_seniority,
    json_dumps,
    json_loads,
    now_iso,
    response_for_turn,
)


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder="seatvio/static",
        template_folder="seatvio/templates",
    )
    app.config["SECRET_KEY"] = "dev-" + secrets.token_hex(16)
    init_db()
    app.teardown_appcontext(close_db)

    def current_user():
        uid = session.get("user_id")
        if not uid:
            return None
        row = get_db().execute("SELECT id, email, email_verified FROM users WHERE id = ?", (uid,)).fetchone()
        return dict(row) if row else None

    def login_required(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Authentication required."}), 401
            return fn(*args, **kwargs)

        return wrapper

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/api/auth/signup")
    def signup():
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        if not email or "@" not in email:
            return jsonify({"error": "Valid email is required."}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters."}), 400

        token = secrets.token_urlsafe(24)
        try:
            db = get_db()
            db.execute(
                "INSERT INTO users (email, password_hash, verify_token, created_at) VALUES (?, ?, ?, ?)",
                (email, generate_password_hash(password), token, now_iso()),
            )
            db.commit()
        except Exception:
            return jsonify({"error": "Email already in use."}), 409
        return jsonify(
            {
                "message": "Account created. Verify email before login.",
                "verify_url": f"/api/auth/verify?token={token}",
            }
        )

    @app.get("/api/auth/verify")
    def verify_email():
        token = request.args.get("token", "")
        db = get_db()
        row = db.execute("SELECT id FROM users WHERE verify_token = ?", (token,)).fetchone()
        if not row:
            return jsonify({"error": "Invalid verification token."}), 400
        db.execute("UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?", (row["id"],))
        db.execute("INSERT OR IGNORE INTO profiles (user_id) VALUES (?)", (row["id"],))
        db.commit()
        return jsonify({"message": "Email verified. You can now log in."})

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        db = get_db()
        user = db.execute(
            "SELECT id, password_hash, email_verified FROM users WHERE email = ?", (email,)
        ).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid credentials."}), 401
        if not user["email_verified"]:
            return jsonify({"error": "Verify your email first."}), 403
        session["user_id"] = user["id"]
        return jsonify({"message": "Logged in."})

    @app.post("/api/auth/logout")
    @login_required
    def logout():
        session.clear()
        return jsonify({"message": "Logged out."})

    @app.get("/api/me")
    def me():
        user = current_user()
        if not user:
            return jsonify({"authenticated": False})
        profile = get_db().execute("SELECT * FROM profiles WHERE user_id = ?", (user["id"],)).fetchone()
        return jsonify({"authenticated": True, "user": user, "profile": dict(profile) if profile else None})

    @app.post("/api/onboarding")
    @login_required
    def onboarding():
        user = current_user()
        data = request.get_json(force=True)
        payload = {
            "full_name": data.get("full_name", "").strip(),
            "current_role": data.get("current_role", "").strip(),
            "years_experience": data.get("years_experience", "").strip(),
            "current_industry": data.get("current_industry", "").strip(),
            "target_industry": data.get("target_industry", "").strip(),
            "work_arrangement": data.get("work_arrangement", "").strip(),
            "anxiety_level": int(data.get("anxiety_level", 5)),
            "interview_difficulty_notes": data.get("interview_difficulty_notes", "").strip(),
            "linkedin_url": data.get("linkedin_url", "").strip(),
            "portfolio_url": data.get("portfolio_url", "").strip(),
        }
        db = get_db()
        db.execute(
            """
            INSERT INTO profiles (
                user_id, full_name, current_role, years_experience, current_industry,
                target_industry, work_arrangement, anxiety_level, interview_difficulty_notes,
                linkedin_url, portfolio_url, onboarding_complete
            )
            VALUES (:user_id, :full_name, :current_role, :years_experience, :current_industry,
                :target_industry, :work_arrangement, :anxiety_level, :interview_difficulty_notes,
                :linkedin_url, :portfolio_url, 1)
            ON CONFLICT(user_id) DO UPDATE SET
                full_name=excluded.full_name,
                current_role=excluded.current_role,
                years_experience=excluded.years_experience,
                current_industry=excluded.current_industry,
                target_industry=excluded.target_industry,
                work_arrangement=excluded.work_arrangement,
                anxiety_level=excluded.anxiety_level,
                interview_difficulty_notes=excluded.interview_difficulty_notes,
                linkedin_url=excluded.linkedin_url,
                portfolio_url=excluded.portfolio_url,
                onboarding_complete=1
            """,
            {"user_id": user["id"], **payload},
        )
        db.commit()
        return jsonify({"message": "Onboarding saved."})

    @app.post("/api/applications")
    @login_required
    def create_application():
        user = current_user()
        data = request.get_json(force=True)
        company_name = (data.get("company_name") or "").strip()
        job_title = (data.get("job_title") or "").strip()
        jd_text = (data.get("jd_text") or "").strip()
        resume_text = (data.get("resume_text") or "").strip()
        interview_stage = (data.get("interview_stage") or "Applied").strip()
        if not all([company_name, job_title, jd_text, resume_text]):
            return jsonify({"error": "Company, role, job description, and resume are required."}), 400
        alignment = analyze_alignment(resume_text, jd_text)
        db = get_db()
        cur = db.execute(
            """
            INSERT INTO applications (
                user_id, company_name, job_title, interview_stage, jd_text, resume_text, alignment_score,
                strengths_json, skill_gaps_json, missing_keywords_json, probe_areas_json, values_language_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                company_name,
                job_title,
                interview_stage,
                jd_text,
                resume_text,
                alignment["alignment_score"],
                json_dumps(alignment["strengths"]),
                json_dumps(alignment["skill_gaps"]),
                json_dumps(alignment["missing_keywords"]),
                json_dumps(alignment["probe_areas"]),
                json_dumps(alignment["values_language"]),
                now_iso(),
            ),
        )
        db.commit()
        return jsonify({"id": cur.lastrowid, "alignment": alignment})

    @app.get("/api/applications")
    @login_required
    def list_applications():
        user = current_user()
        rows = get_db().execute(
            """
            SELECT id, company_name, job_title, interview_stage, alignment_score, readiness_score, real_interview_date, created_at
            FROM applications WHERE user_id = ? ORDER BY id DESC
            """,
            (user["id"],),
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    @app.get("/api/applications/<int:app_id>")
    @login_required
    def get_application(app_id: int):
        user = current_user()
        row = get_db().execute(
            "SELECT * FROM applications WHERE id = ? AND user_id = ?",
            (app_id, user["id"]),
        ).fetchone()
        if not row:
            return jsonify({"error": "Application not found."}), 404
        data = dict(row)
        for key in ("strengths_json", "skill_gaps_json", "missing_keywords_json", "probe_areas_json", "values_language_json"):
            data[key.replace("_json", "")] = json_loads(data.pop(key), [])
        return jsonify(data)

    @app.post("/api/applications/<int:app_id>/questions/generate")
    @login_required
    def generate_questions(app_id: int):
        user = current_user()
        db = get_db()
        app_row = db.execute(
            "SELECT * FROM applications WHERE id = ? AND user_id = ?",
            (app_id, user["id"]),
        ).fetchone()
        if not app_row:
            return jsonify({"error": "Application not found."}), 404
        alignment = {
            "skill_gaps": json_loads(app_row["skill_gaps_json"], []),
            "values_language": json_loads(app_row["values_language_json"], []),
        }
        questions = generate_question_bank(
            app_row["company_name"],
            app_row["job_title"],
            app_row["jd_text"],
            app_row["resume_text"],
            alignment,
        )
        db.execute("DELETE FROM questions WHERE application_id = ?", (app_id,))
        for q in questions:
            db.execute(
                """
                INSERT INTO questions (
                    application_id, category, question_text, why_asked, framework, model_answer,
                    what_not_to_say, time_guidance_seconds, likely_followup, difficulty, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    app_id,
                    q["category"],
                    q["question_text"],
                    q["why_asked"],
                    q["framework"],
                    q["model_answer"],
                    q["what_not_to_say"],
                    q["time_guidance_seconds"],
                    q["likely_followup"],
                    q["difficulty"],
                    now_iso(),
                ),
            )
        db.commit()
        return jsonify({"message": f"Generated {len(questions)} personalized questions."})

    @app.get("/api/applications/<int:app_id>/questions")
    @login_required
    def list_questions(app_id: int):
        user = current_user()
        db = get_db()
        valid = db.execute("SELECT 1 FROM applications WHERE id = ? AND user_id = ?", (app_id, user["id"])).fetchone()
        if not valid:
            return jsonify({"error": "Application not found."}), 404
        rows = db.execute(
            """
            SELECT q.*, a.answer_text, a.confidence_rating, a.practice_count, a.status, a.analysis_json, a.favorite
            FROM questions q
            LEFT JOIN answers a ON a.question_id = q.id AND a.user_id = ?
            WHERE q.application_id = ?
            ORDER BY q.id
            """,
            (user["id"], app_id),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["analysis"] = json_loads(d.pop("analysis_json"), None)
            out.append(d)
        return jsonify(out)

    @app.post("/api/questions/<int:question_id>/answer")
    @login_required
    def save_answer(question_id: int):
        user = current_user()
        data = request.get_json(force=True)
        answer_text = (data.get("answer_text") or "").strip()
        confidence = int(data.get("confidence_rating") or 3)
        favorite = 1 if data.get("favorite") else 0
        if not answer_text:
            return jsonify({"error": "Answer text is required."}), 400
        db = get_db()
        q = db.execute(
            """
            SELECT q.id, q.time_guidance_seconds
            FROM questions q
            JOIN applications a ON a.id = q.application_id
            WHERE q.id = ? AND a.user_id = ?
            """,
            (question_id, user["id"]),
        ).fetchone()
        if not q:
            return jsonify({"error": "Question not found."}), 404
        analysis = analyze_answer_text(answer_text, q["time_guidance_seconds"])
        existing = db.execute(
            "SELECT id, practice_count FROM answers WHERE question_id = ? AND user_id = ?",
            (question_id, user["id"]),
        ).fetchone()
        practice_count = 1
        if existing:
            practice_count = existing["practice_count"] + 1
        status = evaluate_answer_status(confidence, practice_count)
        db.execute(
            """
            INSERT INTO answers (
                question_id, user_id, answer_text, confidence_rating, practice_count, status, favorite, analysis_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(question_id, user_id) DO UPDATE SET
                answer_text=excluded.answer_text,
                confidence_rating=excluded.confidence_rating,
                practice_count=answers.practice_count + 1,
                status=excluded.status,
                favorite=excluded.favorite,
                analysis_json=excluded.analysis_json,
                updated_at=excluded.updated_at
            """,
            (
                question_id,
                user["id"],
                answer_text,
                confidence,
                practice_count,
                status,
                favorite,
                json_dumps(analysis),
                now_iso(),
                now_iso(),
            ),
        )
        db.commit()
        return jsonify({"analysis": analysis, "status": status})

    @app.post("/api/questions/<int:question_id>/analyze")
    @login_required
    def analyze_answer(question_id: int):
        user = current_user()
        data = request.get_json(force=True)
        answer_text = (data.get("answer_text") or "").strip()
        db = get_db()
        q = db.execute(
            """
            SELECT q.time_guidance_seconds
            FROM questions q JOIN applications a ON q.application_id = a.id
            WHERE q.id = ? AND a.user_id = ?
            """,
            (question_id, user["id"]),
        ).fetchone()
        if not q:
            return jsonify({"error": "Question not found."}), 404
        if not answer_text:
            return jsonify({"error": "Answer text is required."}), 400
        return jsonify(analyze_answer_text(answer_text, q["time_guidance_seconds"]))

    @app.get("/api/applications/<int:app_id>/flashcards")
    @login_required
    def flashcards(app_id: int):
        user = current_user()
        rows = get_db().execute(
            """
            SELECT q.id, q.question_text, q.model_answer, a.answer_text, a.status, a.confidence_rating
            FROM questions q
            LEFT JOIN answers a ON a.question_id = q.id AND a.user_id = ?
            WHERE q.application_id = ?
            ORDER BY COALESCE(a.confidence_rating, 1) ASC, q.id ASC
            """,
            (user["id"], app_id),
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    @app.post("/api/sessions/start")
    @login_required
    def start_session():
        user = current_user()
        data = request.get_json(force=True)
        app_id = int(data.get("application_id", 0))
        stage = (data.get("stage") or "First Round").strip()
        intensity = (data.get("intensity") or "Standard").strip()
        duration = int(data.get("duration_minutes") or 20)
        db = get_db()
        app_row = db.execute(
            "SELECT id, company_name, job_title, jd_text FROM applications WHERE id = ? AND user_id = ?",
            (app_id, user["id"]),
        ).fetchone()
        if not app_row:
            return jsonify({"error": "Application not found."}), 404
        seniority = infer_seniority(app_row["job_title"], app_row["jd_text"])
        panel = choose_panel(stage, app_row["company_name"], seniority)
        intro = {
            "speaker": panel[0]["name"],
            "character": panel[0]["archetype"],
            "message": f"Welcome. Let's begin. Walk me through your background for this {app_row['job_title']} role.",
            "timestamp": now_iso(),
        }
        cur = db.execute(
            """
            INSERT INTO sessions (
                user_id, application_id, stage, intensity, duration_minutes, characters_json, transcript_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["id"],
                app_id,
                stage,
                intensity,
                duration,
                json_dumps(panel),
                json_dumps([intro]),
                now_iso(),
            ),
        )
        db.commit()
        return jsonify({"session_id": cur.lastrowid, "panel": panel, "opening": intro})

    @app.post("/api/sessions/<int:session_id>/turn")
    @login_required
    def take_turn(session_id: int):
        user = current_user()
        data = request.get_json(force=True)
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Candidate response is required."}), 400
        db = get_db()
        row = db.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, user["id"]),
        ).fetchone()
        if not row:
            return jsonify({"error": "Session not found."}), 404
        if row["status"] != "in_progress":
            return jsonify({"error": "Session already ended."}), 400

        transcript = json_loads(row["transcript_json"], [])
        panel = json_loads(row["characters_json"], [])
        turn_index = len([t for t in transcript if t.get("speaker") == "candidate"])
        transcript.append({"speaker": "candidate", "message": message, "timestamp": now_iso()})

        active_character = panel[turn_index % len(panel)]
        ai = response_for_turn(active_character, message, turn_index)
        ai_entry = {
            "speaker": active_character["name"],
            "character": active_character["archetype"],
            "silence_seconds": ai["silence_seconds"],
            "message": ai["message"],
            "timestamp": now_iso(),
        }
        transcript.append(ai_entry)
        db.execute(
            "UPDATE sessions SET transcript_json = ? WHERE id = ?",
            (json_dumps(transcript), session_id),
        )
        db.commit()
        return jsonify({"response": ai_entry, "turn_count": turn_index + 1})

    @app.post("/api/sessions/<int:session_id>/end")
    @login_required
    def end_session(session_id: int):
        user = current_user()
        db = get_db()
        row = db.execute(
            """
            SELECT s.*, a.values_language_json
            FROM sessions s
            JOIN applications a ON a.id = s.application_id
            WHERE s.id = ? AND s.user_id = ?
            """,
            (session_id, user["id"]),
        ).fetchone()
        if not row:
            return jsonify({"error": "Session not found."}), 404
        transcript = json_loads(row["transcript_json"], [])
        values_language = json_loads(row["values_language_json"], [])
        report = calculate_debrief(transcript, values_language)
        db.execute(
            """
            UPDATE sessions
            SET status = 'completed',
                moment_map_json = ?,
                dimension_scores_json = ?,
                hiring_probability = ?,
                next_targets_json = ?,
                ended_at = ?
            WHERE id = ?
            """,
            (
                json_dumps(report["moment_map"]),
                json_dumps(report["dimension_scores"]),
                report["hiring_probability"],
                json_dumps(report["next_targets"]),
                now_iso(),
                session_id,
            ),
        )
        app_stats = db.execute(
            """
            SELECT COUNT(*) AS cnt, AVG(hiring_probability) AS avg_hp
            FROM sessions
            WHERE application_id = ? AND status = 'completed'
            """,
            (row["application_id"],),
        ).fetchone()
        readiness = min(100, int((app_stats["cnt"] * 12) + (app_stats["avg_hp"] or 0) * 0.5))
        db.execute("UPDATE applications SET readiness_score = ? WHERE id = ?", (readiness, row["application_id"]))
        db.commit()
        return jsonify({"message": "Session ended and debrief generated.", **report})

    @app.get("/api/sessions/<int:session_id>/debrief")
    @login_required
    def get_debrief(session_id: int):
        user = current_user()
        row = get_db().execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, user["id"]),
        ).fetchone()
        if not row:
            return jsonify({"error": "Session not found."}), 404
        return jsonify(
            {
                "id": row["id"],
                "status": row["status"],
                "transcript": json_loads(row["transcript_json"], []),
                "moment_map": json_loads(row["moment_map_json"], []),
                "dimension_scores": json_loads(row["dimension_scores_json"], {}),
                "hiring_probability": row["hiring_probability"],
                "next_targets": json_loads(row["next_targets_json"], []),
            }
        )

    @app.post("/api/sessions/<int:session_id>/observe/generate")
    @login_required
    def generate_observe(session_id: int):
        user = current_user()
        db = get_db()
        row = db.execute(
            "SELECT id, transcript_json, status FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, user["id"]),
        ).fetchone()
        if not row:
            return jsonify({"error": "Session not found."}), 404
        if row["status"] != "completed":
            return jsonify({"error": "Complete the session before Observe is available."}), 400
        runs = generate_observe_runs(json_loads(row["transcript_json"], []))
        db.execute("DELETE FROM observe_runs WHERE source_session_id = ?", (session_id,))
        for run_type, payload in runs.items():
            db.execute(
                """
                INSERT INTO observe_runs (source_session_id, run_type, script_json, annotations_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    run_type,
                    json_dumps(payload["script"]),
                    json_dumps(payload["annotations"]),
                    now_iso(),
                ),
            )
        db.commit()
        return jsonify({"message": "Observe runs generated."})

    @app.get("/api/sessions/<int:session_id>/observe")
    @login_required
    def get_observe(session_id: int):
        user = current_user()
        valid = get_db().execute(
            "SELECT 1 FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, user["id"]),
        ).fetchone()
        if not valid:
            return jsonify({"error": "Session not found."}), 404
        rows = get_db().execute(
            "SELECT run_type, script_json, annotations_json FROM observe_runs WHERE source_session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
        return jsonify(
            [
                {
                    "run_type": r["run_type"],
                    "script": json_loads(r["script_json"], []),
                    "annotations": json_loads(r["annotations_json"], []),
                }
                for r in rows
            ]
        )

    @app.get("/api/history")
    @login_required
    def history():
        user = current_user()
        rows = get_db().execute(
            """
            SELECT s.id, s.created_at, s.stage, s.intensity, s.duration_minutes, s.hiring_probability,
                   a.company_name, a.job_title
            FROM sessions s
            JOIN applications a ON a.id = s.application_id
            WHERE s.user_id = ?
            ORDER BY s.id DESC
            """,
            (user["id"],),
        ).fetchall()
        return jsonify([dict(r) for r in rows])

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
