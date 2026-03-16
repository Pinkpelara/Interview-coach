-- Seatvio schema baseline (legacy migration, superseded by PRD v6 updates)
-- PostgreSQL migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  onboarding_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
  current_role VARCHAR(255),
  years_experience VARCHAR(20),
  current_industry VARCHAR(255),
  target_industry VARCHAR(255),
  work_arrangement VARCHAR(20),
  interview_difficulty TEXT,
  linkedin_url VARCHAR(500),
  portfolio_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  jd_text TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  jd_file_url VARCHAR(500),
  resume_file_url VARCHAR(500),
  interview_stage VARCHAR(50),
  real_interview_date DATE,
  alignment_score INTEGER CHECK (alignment_score BETWEEN 0 AND 100),
  readiness_score INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parsed_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  career_timeline JSONB NOT NULL,
  top_skills JSONB NOT NULL,
  experience_gaps JSONB,
  achievements JSONB,
  education JSONB,
  career_transitions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parsed_jds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  required_skills JSONB NOT NULL,
  preferred_skills JSONB,
  responsibilities JSONB NOT NULL,
  seniority_level VARCHAR(50),
  values_language JSONB,
  red_flag_areas JSONB,
  interview_format_prediction VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alignment_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  skill_gaps JSONB,
  strengths JSONB,
  missing_keywords JSONB,
  probe_areas JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(30) NOT NULL,
  why_asked TEXT NOT NULL,
  framework VARCHAR(20),
  model_answer TEXT NOT NULL,
  what_not_to_say TEXT NOT NULL,
  time_guidance_sec INTEGER,
  likely_followup TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  audio_url VARCHAR(500),
  confidence_rating INTEGER CHECK (confidence_rating BETWEEN 1 AND 5),
  status VARCHAR(20) DEFAULT 'drafting',
  practice_count INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_answer_id UUID REFERENCES user_answers(id) ON DELETE CASCADE,
  strengths JSONB,
  issues JSONB,
  missing_elements JSONB,
  score_structure INTEGER CHECK (score_structure BETWEEN 1 AND 10),
  score_specificity INTEGER CHECK (score_specificity BETWEEN 1 AND 10),
  score_confidence INTEGER CHECK (score_confidence BETWEEN 1 AND 10),
  score_overall INTEGER CHECK (score_overall BETWEEN 1 AND 10),
  verdict TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  stage VARCHAR(30) NOT NULL,
  intensity VARCHAR(20) NOT NULL,
  target_duration_min INTEGER NOT NULL,
  actual_duration_ms BIGINT,
  status VARCHAR(20) DEFAULT 'pending',
  characters JSONB NOT NULL,
  unexpected_events JSONB,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  speaker VARCHAR(20) NOT NULL,
  character_id VARCHAR(100),
  message_text TEXT NOT NULL,
  audio_url VARCHAR(500),
  timestamp_ms BIGINT NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
  moment_map JSONB NOT NULL,
  score_answer_quality INTEGER CHECK (score_answer_quality BETWEEN 1 AND 100),
  score_delivery INTEGER CHECK (score_delivery BETWEEN 1 AND 100),
  score_pressure INTEGER CHECK (score_pressure BETWEEN 1 AND 100),
  score_company_fit INTEGER CHECK (score_company_fit BETWEEN 1 AND 100),
  score_listening INTEGER CHECK (score_listening BETWEEN 1 AND 100),
  hiring_probability INTEGER CHECK (hiring_probability BETWEEN 0 AND 100),
  would_advance BOOLEAN NOT NULL,
  yes_reasons JSONB,
  no_reasons JSONB,
  role_comparison TEXT,
  next_targets JSONB NOT NULL,
  coach_audio_url VARCHAR(500),
  coach_script TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observe_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  run_type VARCHAR(20) NOT NULL,
  exchanges JSONB NOT NULL,
  annotations JSONB NOT NULL,
  audio_urls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  billing_cycle VARCHAR(20),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  payment_processor VARCHAR(50),
  processor_customer_id VARCHAR(255),
  processor_sub_id VARCHAR(255),
  sessions_used_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS countdown_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  interview_date DATE NOT NULL,
  plan_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
