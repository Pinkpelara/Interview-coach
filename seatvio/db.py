import sqlite3
from pathlib import Path

from flask import g


DB_PATH = Path(__file__).resolve().parent.parent / "seatvio.db"


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        g.db = conn
    return g.db


def close_db(_error=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA foreign_keys = ON;")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email_verified INTEGER NOT NULL DEFAULT 0,
            verify_token TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profiles (
            user_id INTEGER PRIMARY KEY,
            full_name TEXT,
            current_role TEXT,
            years_experience TEXT,
            current_industry TEXT,
            target_industry TEXT,
            work_arrangement TEXT,
            anxiety_level INTEGER,
            interview_difficulty_notes TEXT,
            linkedin_url TEXT,
            portfolio_url TEXT,
            onboarding_complete INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            company_name TEXT NOT NULL,
            job_title TEXT NOT NULL,
            interview_stage TEXT,
            jd_text TEXT NOT NULL,
            resume_text TEXT NOT NULL,
            alignment_score INTEGER NOT NULL,
            readiness_score INTEGER NOT NULL DEFAULT 0,
            strengths_json TEXT NOT NULL,
            skill_gaps_json TEXT NOT NULL,
            missing_keywords_json TEXT NOT NULL,
            probe_areas_json TEXT NOT NULL,
            values_language_json TEXT NOT NULL,
            real_interview_date TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            question_text TEXT NOT NULL,
            why_asked TEXT NOT NULL,
            framework TEXT NOT NULL,
            model_answer TEXT NOT NULL,
            what_not_to_say TEXT NOT NULL,
            time_guidance_seconds INTEGER NOT NULL,
            likely_followup TEXT NOT NULL,
            difficulty INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            answer_text TEXT NOT NULL,
            confidence_rating INTEGER NOT NULL DEFAULT 3,
            practice_count INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'Drafting',
            favorite INTEGER NOT NULL DEFAULT 0,
            analysis_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(question_id, user_id),
            FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            application_id INTEGER NOT NULL,
            stage TEXT NOT NULL,
            intensity TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'in_progress',
            characters_json TEXT NOT NULL,
            transcript_json TEXT NOT NULL,
            moment_map_json TEXT,
            dimension_scores_json TEXT,
            hiring_probability INTEGER,
            next_targets_json TEXT,
            created_at TEXT NOT NULL,
            ended_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS observe_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_session_id INTEGER NOT NULL,
            run_type TEXT NOT NULL,
            script_json TEXT NOT NULL,
            annotations_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(source_session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        """
    )
    db.commit()
    db.close()
