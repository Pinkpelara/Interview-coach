
SEATVIO
AI Interview Simulation Platform
“So real, you’ll get nervous.”

Product Requirements Document — Complete Build Specification
Version 3.0 | Confidential
Technology-Agnostic — Implementation-Ready
This document is a complete build specification. It defines every feature, behavior, rule, and interaction in sufficient detail for any developer, AI coding assistant, or vibe-coding tool to implement the full application without ambiguity. It does not prescribe specific frameworks, libraries, AI models, or hosting providers — the developer has full authority over technology choices provided the functional requirements and performance targets defined herein are met.

NAMING NOTICE: Do not use “Intervia” (trademark conflict) or “Nerveo” (belongs to a recording artist). The confirmed product name is Seatvio. Primary domain: seatvio.app. Trademark searches required: Canada & United States.
 
1. PRODUCT VISION & OVERVIEW
1.1 What Seatvio Is
Seatvio is an AI-powered interview simulation platform. It puts job seekers inside a fully realistic, on-camera, live video interview experience with AI characters — indistinguishable in feel from a real video call — before they ever walk into an actual interview.
CRITICAL DESIGN PRINCIPLE: Seatvio is a full live video interview simulation. The AI interviewers are real-time animated characters with lip-synced speech, dynamic facial expressions, natural eye movement, and reactive body language. They are NOT static photos. They are NOT text-based chat. They are NOT pre-recorded video clips. The applicant sees, hears, and interacts with AI characters who behave exactly as real human interviewers would on a video call — speaking, listening, reacting, pausing, and making facial expressions in real time. The entire experience is indistinguishable from a live Zoom or Teams call with real people.
The platform operates across three modules:
•	PREPARE — a preparation module where users build and practice their answers before any simulation.
•	PERFORM — a live simulation module where a real interview takes place with AI interviewers on camera, through spoken conversation in real time.
•	OBSERVE — an observation module where users watch AI demonstrate both ideal and poor versions of their own interview.
Everything in the platform is custom-generated from the user’s specific resume, their target job description, and the company they are applying to. No content is generic. Every question, every character behavior, every feedback note is built around that specific candidate for that specific role.
1.2 The Core Problem Being Solved
Interview anxiety does not come from not knowing the answers. It comes from the visceral social pressure of being watched and evaluated in real time. Every existing interview prep tool trains users on content — questions, frameworks, model answers. None of them simulate the actual experience of being on camera with an interviewer who pushes back, lets silence sit, and reacts to weak answers.
Seatvio solves the actual problem: the emotional and psychological experience of being in the room. Users practice under real pressure so that when the real interview happens, the environment is familiar.
1.3 Positioning
Attribute	Detail
Tagline	So real, you’ll get nervous.
Target User	Job seekers preparing for professional interviews (B2C, self-serve)
Primary Differentiator	On-camera AI interviewers rendered as real-time animated video characters with distinct personalities, lip-synced speech, live facial expressions, eye contact, reactive body language, real-time reactions, silence pressure, and full panel dynamics — a live video call experience indistinguishable from interviewing with real people
Secondary Differentiator	The Observe module — users watch AI perform their interview perfectly and poorly so they can see themselves from the other side of the table
Business Model	Freemium subscription with a one-time intensive purchase option
Primary Domain	seatvio.app

2. USER JOURNEY — END TO END
The complete user journey through the platform flows in the following sequence. Every step is described in full detail in the sections that follow.
Step	Module	What the User Does	What the Platform Does
1	Onboarding	Signs up, creates profile, sets anxiety level	Stores user context that calibrates all future simulations
2	Application Setup	Uploads resume + job description, enters company name	Parses both documents, extracts structured data, scores alignment
3	Prepare	Reviews custom question bank, builds and saves answers	Generates hyper-specific questions from their actual background vs. the JD
4	Prepare	Practices answers in flashcard mode, records audio	Tracks confidence per question, surfaces weak answers more frequently
5	Perform	Receives pre-interview briefing, meets their interviewer panel	Generates character panel specifically matched to the company type, role, seniority level, and interview stage of the job the applicant applied to
6	Perform	Sits through a full on-camera live video interview with real-time animated AI characters	Characters appear as live video participants — animated faces with lip-synced speech, dynamic expressions, and reactive body language — responding to the candidate in real time through spoken conversation
7	Debrief	Watches their performance reviewed moment by moment	Generates Moment Map, scores, hiring probability, coach audio
8	Observe	Watches AI demonstrate perfect and poor versions of their interview	Generates both runs using their resume data and their actual weak patterns
9	Iterate	Repeats sessions until ready	Tracks improvement over time, unlocks harder scenarios

3. ONBOARDING & USER PROFILE
3.1 Account Creation
Users sign up with email and password. No third-party sign-in (no Google, no LinkedIn). Authentication is handled entirely within the platform using secure session tokens (e.g., JWT stored as HTTP-only cookies or equivalent secure method). Password must be at minimum 8 characters. Email must be verified before accessing the platform.
After verifying email, users are directed immediately to the onboarding flow. They cannot access any other part of the platform until onboarding is complete.
3.2 Onboarding Flow — Three Steps
Step 1: Professional Background
•	Full name
•	Current job title or most recent job title
•	Years of total professional experience (dropdown: 0–1, 1–3, 3–5, 5–10, 10+)
•	Current industry (dropdown with comprehensive list)
•	Target industry (may differ from current — drives company culture research)
Step 2: Interview Context
•	Target work arrangement: Remote / Hybrid / On-site
•	Interview anxiety self-assessment: a 1–10 slider with a label at each end (Completely calm vs. Extremely anxious). This number calibrates the intensity of pressure mechanics in simulations — a 9 gets shorter silences, gentler pushback in their first sessions, then escalates.
•	An open text field: “Describe what makes interviews hard for you.” (Optional but used to personalize the Cautionary Run in the Observe module)
Step 3: Optional Context
•	LinkedIn profile URL — scraped to enrich resume parsing
•	Portfolio or work samples URL — referenced in interview character questions for creative or technical roles
All three steps show a progress indicator. Each step has a Back button. No step can be skipped except Step 3. The user can update all profile fields later from their account settings.
3.3 What the Profile Powers
The profile is not just metadata. It actively shapes everything downstream:
•	Anxiety level calibrates silence duration, pushback intensity, and whether warmup sessions are recommended first
•	Current vs. target industry affects which company culture fingerprints are generated
•	Years of experience determines seniority calibration of questions and expected answer depth
•	The open text field about interview difficulties feeds directly into the Cautionary Run generation — the AI demonstrates the user’s specific stated fears

4. APPLICATION MANAGEMENT
4.1 What an Application Is
An Application is the central object of the platform. It represents one job the user is preparing for. Everything — questions, sessions, characters, scores, feedback — lives inside an Application. A user can have multiple active Applications simultaneously (preparing for multiple roles at once), each completely independent with its own question bank, session history, and readiness score.
4.2 Creating an Application
To create an Application, the user provides:
•	Company name — required. Used for company culture research and character generation.
•	Job title — required. Used for question calibration and seniority matching.
•	Job description — required. Can be pasted as text or uploaded as a PDF. Must be the actual JD, not a summary.
•	Resume — required. PDF upload. The platform extracts all text for parsing.
•	Interview stage — optional. Options: Applied, Phone Screen Scheduled, First Round Scheduled, Panel/Final Round Scheduled. This sets the default simulation mode.
APPLICATION–SIMULATION BINDING RULE: Every interview simulation session, every generated panel of interviewers, and every interview setting is permanently bound to a specific Application. The panel characters, question topics, company culture context, interview format, virtual background, and difficulty calibration are all derived from the company name, job title, job description, and seniority level within that Application. A user cannot run a simulation without first selecting which Application (which job) the session is for. There is no generic or unattached interview mode. If the user has three Applications, each one generates an entirely different panel, different questions, different culture context, and different pressure dynamics. Nothing carries over between Applications.
4.3 Document Parsing — What the Platform Extracts
From the Resume
•	Complete career timeline: each role, company, start year, end year, and the specific achievements and responsibilities listed
•	Top demonstrated skills — drawn only from what is explicitly stated or clearly implied in the resume
•	Experience gaps — dates where employment history has gaps, flagged as likely interview probe areas
•	Specific measurable achievements — any numbers, percentages, outcomes explicitly stated (these become the foundation of strong STAR answers)
•	Education history
•	Career transitions — any moves across industry, function, or seniority level, flagged as areas requiring explanation
From the Job Description
•	Required skills vs. preferred skills, treated separately
•	Key responsibilities — the actual day-to-day duties of the role
•	Seniority level — inferred from language, reporting structure, and required experience
•	Values language — the specific phrases and words the company uses to describe culture (e.g., ‘ownership mindset’, ‘bias for action’, ‘collaborative problem-solving’). These are injected into model answers and tracked during interviews.
•	Red flag areas — requirements in the JD that the resume does not satisfy. These become curveball questions.
•	Interview format prediction — based on the role type and JD language, the platform predicts whether the interview will be primarily behavioral, technical, case-based, or mixed.
Alignment Analysis (Resume vs. JD Combined)
•	Alignment score: an integer from 0 to 100 representing overall candidate–job fit, displayed prominently on the Application page
•	Skill gaps: specific required skills not present in the resume
•	Strengths to emphasize: resume strengths that directly match JD requirements — things the candidate should proactively reference
•	Missing keywords: JD terminology not present in the resume — language the candidate should naturally incorporate
•	Likely probe areas: a list of specific topics the interviewer will probe, derived from the gaps and transitions identified
4.4 Application Dashboard Page
Each Application has its own dashboard showing:
•	Company name, job title, and interview stage at the top
•	Alignment score as a large visual indicator with circular gauge
•	Skill gaps list and strengths-to-emphasize list in a two-column layout
•	Missing keywords displayed as chips/tags — visual so the user quickly absorbs them
•	Likely probe areas as a prioritized list
•	Readiness Score — a composite of question bank completion, answer confidence ratings, and sessions completed — displayed as a percentage
•	Session history for this application: all past sessions with dates, stages, and hiring probability scores
•	Four action buttons: Generate Question Bank, Start Interview, View Observe, Set Real Interview Date

5. PREPARE MODULE
5.1 Purpose
The Prepare module is where users build knowledge and rehearse answers before any simulation. It is the foundation. A user who has completed the Prepare module fully will perform meaningfully better in simulations because they have thought through their answers, identified their weak spots, and practiced their language.
5.2 The Question Bank
Generation Logic
The question bank is generated by the AI using the fully parsed resume, parsed JD, and alignment analysis. It is not a generic list pulled from a database. Every question is personalized — it references the candidate’s actual companies, roles, and the specific requirements of the JD. The AI is instructed to write questions the way an experienced interviewer who had read the resume and JD would ask them.
Question Categories
Category	What It Is	Min Qs
Behavioral	Past experience questions using STAR structure. Drawn from the JD competencies, anchored to the candidate’s actual roles.	6
Technical / Functional	Role-specific knowledge and skill questions calibrated to the JD’s requirements and the seniority level.	4
Situational	Hypothetical scenarios built from the actual responsibilities listed in the JD. The scenarios are plausible for that specific company.	4
Company-Specific	Why this company, why this role, what do you know about us — answered with actual company research, not generic enthusiasm.	3
Curveball	Questions designed to expose gaps identified in the alignment analysis. These are the questions the candidate is least prepared for.	3
Opening	Walk me through your background — with a recommended narrative arc built specifically from the candidate’s timeline.	2
Closing	Questions for the interviewer — 5–8 genuinely strong questions tailored to the role and company, not generic.	3

What Each Question Card Contains
•	The question text — personalized to their background
•	Why interviewers ask this question — 2–3 sentences explaining the real evaluation happening underneath the surface question
•	Recommended answer framework — STAR, SOAR, PAR, or direct response, whichever best fits this question type
•	A model answer — a complete, specific answer written in first person using the candidate’s actual experience from their resume. Minimum 200 words. This is not a template — it is a fully drafted answer they can adapt.
•	What not to say — specific pitfalls unique to this question, not generic advice
•	Time guidance — how long the answer should be in seconds (e.g., ‘This answer should be 90–120 seconds. Shorter feels dismissive. Longer loses the interviewer.’)
•	Likely follow-up — the single most probable follow-up question the interviewer will ask after this one
•	Difficulty rating — 1 to 5, so the user knows which questions need the most practice
5.3 Answer Builder
The Workspace
Each question card has a Build My Answer button that opens a workspace panel alongside the question. The user writes their own answer in a large text area. The workspace is a guided drafting environment, not a blank box.
Live Feedback While Writing
•	Word count and estimated speaking time update in real time (word count divided by 130 words per minute)
A red flag system scans the answer after the user stops typing for 2 seconds. It flags specific phrases inline:
◦	Uncertain language: ‘I think’, ‘I feel like’, ‘sort of’, ‘kind of’, ‘I’m not sure’, ‘maybe’ — flagged with a suggestion to replace with a direct claim
◦	Missing personal ownership: ‘we did’, ‘the team did’ without specifying the candidate’s specific role — flagged with a prompt to clarify their individual contribution
◦	Missing quantification: answers with no numbers, percentages, or measurable outcomes — flagged after 100 words with a reminder to add a specific result
◦	Rambling indicator: answers that exceed 150% of the recommended time guidance — flagged with a message that the answer needs to be tightened
AI Analysis Button
When the user clicks Analyze My Answer, the platform sends their answer alongside the question context, the model answer, and the company values language to the AI. The AI returns:
•	Strengths: specific things the user did well, with direct quotes from their answer
•	Issues: specific problems with exact quotes from the answer and concrete suggestions for how to fix each one
•	Missing elements: things a strong answer would include that this one does not
•	Four dimension scores: structure (1–10), specificity (1–10), confidence language (1–10), overall (1–10)
•	One-line verdict: a single direct sentence summarizing the answer’s current quality
Saving Answers
•	Users save answers and mark a favorite version per question
•	Confidence rating: 1–5 stars clicked after each practice — this feeds the spaced repetition system
•	Practice counter: tracks how many times the user has rehearsed each answer
•	Answer status: Drafting → Rehearsing → Ready, updated based on confidence ratings over time
5.4 Flashcard Mode
All saved answers are available as flashcards. The spaced repetition system surfaces questions with lower confidence ratings more frequently. One question appears at a time as a large card.
•	Front of card shows the question text only
•	User thinks through or speaks their answer, then flips the card
•	Back shows their saved answer (or the model answer if they have not saved one)
•	Three response buttons after viewing: Easy (sets confidence 5), Got It (confidence 3), Need Work (confidence 1)
•	Progress ring per question shows Drafting / Rehearsing / Ready status
•	A microphone button lets users record themselves answering. The recording plays back immediately. No transcription in flashcard mode — this is for self-evaluation of delivery only.
•	Overall progress bar shows percentage of questions in Ready state
5.5 Interview Frameworks & Coaching Library
A built-in resource section — not generic articles. Content is curated to the user’s specific role and industry. Includes:
•	STAR, SOAR, CAR, and PREP method explanations with examples drawn from the user’s own resume context
•	Body language and camera presence guide (eye contact, posture, framing, lighting for video interviews)
•	How to research a company the day before an interview
•	Salary negotiation guide (separate from the negotiation simulator in the main platform)
•	How to handle questions you don’t know the answer to
•	How to redirect a question you’ve been asked before in a previous round

6. PERFORM MODULE — THE LIVE VIDEO INTERVIEW SIMULATION
6.1 Purpose and Philosophy
The Perform module is the core of the platform. It is where the actual simulation happens. The guiding design principle is that nothing inside the interview room should remind the user they are using software. The experience must feel like a real video call with real people. Every design decision in this module — the absence of menus, the silence before responses, the unexpected moments — exists to create genuine psychological pressure.
THE PERFORM MODULE IS A FULL LIVE VIDEO INTERVIEW. The candidate sees animated AI characters on screen who look, sound, and behave like real human interviewers on a Zoom/Teams call. The AI characters speak with lip-synced voices, display real-time facial expressions (smiling, frowning, nodding, looking skeptical, looking distracted, taking notes), make natural eye contact with the camera, and exhibit reactive body language. This is NOT a chat interface. This is NOT a text exchange. This is NOT a screen showing static photos while audio plays. The candidate’s camera is on, the AI interviewers’ video feeds are on, and the interaction happens in real time through spoken conversation — exactly as a real video interview would.
6.2 Pre-Interview Setup
Session Configuration
Before every session, the user confirms:
•	Which Application this session is for (if they have multiple active) — this is mandatory; every session must be tied to a specific job the applicant applied to
•	Interview stage being simulated: Phone Screen, First Round, Panel Interview, Final Round, Case Interview, Stress Interview
•	Intensity level: Warm-Up (lighter pressure, shorter silences, more forgiving characters), Standard (realistic professional interview), High Pressure (extended silences, aggressive follow-ups, curveballs, adversarial moments)
•	Session length: 20 minutes, 45 minutes, 60 minutes, or custom
SESSION–APPLICATION MATCHING RULE: The interview stage, panel composition, question topics, company culture context, virtual background, and difficulty calibration are ALL derived from the specific Application selected. If the user is preparing for a Senior Product Manager role at Google, the panel will consist of characters appropriate for Google’s interview culture, the questions will target PM competencies at the senior level, the virtual background will reflect a corporate tech office, and the company values language embedded in the simulation will reflect Google’s actual culture. If the same user has a second Application for a Marketing Director role at a startup, that session will generate an entirely different panel, different questions, different virtual background, different culture context, and different pressure dynamics. Nothing carries over between Applications.
Camera and Microphone Check
A brief technical check confirms the user’s camera and microphone are working. The user sees their own feed and hears a test audio clip. They cannot proceed until both are confirmed working. This is mandatory because the Perform module is a live video experience — both the candidate’s camera and audio must be active throughout the entire session.
The Session Brief — Pre-Interview Briefing
A full-screen briefing screen appears. It looks like a meeting confirmation, not an app screen. It shows:
•	Today’s interviewer panel: character cards showing each interviewer’s name, title, and company. These characters are generated specifically for this Application’s company, role, and interview stage. No archetypes revealed — the user does not know in advance how each character will behave.
•	Interview format: what type of questions to expect (the platform tells them this is based on the company’s known interview style)
•	A one-line company culture reminder: a single sentence about what this company values, drawn from the company research
•	A real calendar-style notification that fires on screen: ‘Your interview with [Company Name] starts in 2 minutes.’ — This is the first pressure moment.
The 2-minute countdown is not just cosmetic. It is the window in which the platform pre-warms the AI systems (language model, speech-to-text, text-to-speech, face animation) so the interview begins without any perceptible loading delay.
6.3 The Interview Room
Visual Design
The interview room is a full-screen video call interface. It must be visually indistinguishable from a real professional video call. The interface has:
•	No application navigation, no menus, no help buttons, no escape options once started
•	Company logo top-left corner, small and professional
•	Subtle session timer top-right — visible but not prominent
•	AI interviewer video feed occupying the main screen — this is a real-time animated character, not a static image or photo
•	Candidate’s own camera feed: small tile, bottom-right corner, exactly as in Zoom or Teams
•	For panel sessions (2–3 interviewers): a grid layout matching the standard video call grid, with each AI character rendered as an independent animated video feed
•	A virtual background behind the AI interviewers matching the company’s aesthetic — modern office for corporate, more casual for startup — derived from company research for this specific Application
The AI Interviewer Characters — Real-Time Animated Video Participants
Each AI interviewer is a fully animated, real-time rendered video character with a distinct name, job title, personality, and voice. They appear on the candidate’s screen exactly as a real person would appear on a video call. The following describes exactly what the candidate sees and experiences:
•	Each character has a realistic animated face generated from stock or AI-generated imagery (not based on any real identifiable person) and rendered in real time
•	Lip sync: the character’s mouth movements are synchronized in real time to the words they are speaking via a real-time face animation pipeline
•	Facial expressions: characters display dynamic facial expressions that change based on context — the Skeptic maintains a neutral-to-doubtful expression, the Friendly Champion smiles and nods, the Technical Griller stares directly with zero emotional feedback, the Distracted Senior glances off-camera
•	Eye movement: characters make natural eye contact with the camera, look away when ‘thinking’, and shift gaze naturally during conversation
•	Body language: subtle upper-body movement — leaning forward to show interest, leaning back during pauses, gesturing when making a point
•	Voice: each character has a distinct AI-generated voice that matches their personality — the Skeptic speaks in a measured, deliberate tone; the Friendly Champion speaks warmly and quickly; the Technical Griller is flat and precise
•	Reactive behavior: characters react to what the candidate says IN REAL TIME. If the candidate gives a vague answer, the Skeptic’s expression shifts. If the candidate gives a strong answer, the Friendly Champion nods. These reactions are not scripted — they are driven by the AI’s evaluation of the candidate’s response.
The AI characters are NOT photos with audio overlaid. They are NOT static profile pictures in a chat window. They are NOT pre-recorded video segments stitched together. Each character is a continuously rendered, dynamically animated video presence that moves, speaks, reacts, and behaves like a live human participant on a video call. This is the core technical achievement that makes Seatvio feel real.
Panel Composition — Matched to the Job
The characters assigned to each interview session are selected and combined by the platform based on what would be realistic for this specific company, role, and interview stage within the selected Application. The user does not choose which archetypes appear. The platform’s selection logic works as follows:
•	Company type drives character selection: consulting firms get Skeptics and Technical Grillers; startups get Friendly Champions and Culture Fit Assessors; corporate enterprises get full panels with a Silent Observer
•	Role seniority affects character behavior: a junior role gets shorter, more structured interviews; a senior role gets deeper probing, longer silences, and more adversarial follow-ups
•	Interview stage determines panel size: Phone Screen = 1 character; First Round = 1–2 characters; Panel/Final Round = 2–3 characters
•	Company culture research shapes character personalities: if the JD emphasizes ‘move fast’ culture, the interviewers will be more direct and expect faster answers; if the JD emphasizes ‘thoughtful collaboration’, the pace will be more measured
•	The job description’s specific requirements determine question topics: characters will ask about the exact skills, responsibilities, and competencies listed in the JD for this Application

6.4 The Six Interviewer Archetypes
Each archetype is a behavioral specification. The developer must implement each archetype so that its communication style, behavioral rules, silence behavior, interruption patterns, and animated expression cues are all enforced consistently. These are not loose suggestions — they are the rules that make each character feel distinct and realistic.
The Skeptic
Communication style: direct, measured, maintains a neutral expression with a slight undercurrent of doubt. Never shows enthusiasm. Does not reward good answers with visible approval.
Behavioral rules: Always asks for specifics after any general claim. Never accepts ‘we did’ — always asks ‘what was your specific role versus the team’s?’ Pushes for numbers and outcomes in every behavioral answer. Asks the same question a different way if the first answer was vague. After a strong answer, gives a brief acknowledgment and immediately moves to the next question — no dwelling.
Interruption pattern: interrupts if an answer exceeds 2 minutes with ‘Let me stop you there — what was the specific outcome?’
Silence behavior: holds 3–4 seconds of silence after the candidate finishes before responding. Does not fill the silence. If the candidate speaks during the silence (to add more), the Skeptic often asks about that addition specifically.
Animated expression cues: slight narrowing of eyes when evaluating a claim, minimal facial movement, occasional slow nod that conveys acknowledgment without approval, brief glance down at ‘notes’ during candidate’s answer.
Typical phrases: ‘Walk me through specifically…’, ‘What was your role versus the team’s?’, ‘Give me a number there.’, ‘Let me ask that a different way.’
What they never say: ‘Great answer’, ‘Interesting’, ‘I love that’, any filler affirmation.
Best deployed in: consulting, finance, law, competitive tech roles.
The Friendly Champion
Communication style: warm, leans forward visually, smiling, makes the candidate feel immediately comfortable. Appears to be on their side.
Behavioral rules: This warmth is deliberate — it causes candidates to over-share, ramble, and reveal things they would not reveal to a colder interviewer. After genuinely warm responses to strong answers, asks probing follow-ups about edge cases or failures. Asks ‘tell me more about…’ frequently, which encourages candidates to keep talking past their best point.
Silence behavior: shorter silences (1–2 seconds) — the warmth creates a faster conversational rhythm.
Animated expression cues: frequent smiling, active nodding, leaning forward, eyebrow raises to show interest, expressive hand gestures.
Typical phrases: ‘That’s really interesting, tell me more.’, ‘I love that — and what happened next?’, ‘You mentioned X, what was the hardest part of that?’
Best deployed in: HR screens, culture fit rounds, startup first rounds.
The Technical Griller
Communication style: no pleasantries, stares directly at camera, zero emotional feedback during answers. Cares only about accuracy, depth, and process.
Behavioral rules: Opens with no small talk, goes directly to the first question. If the candidate answers vaguely, asks the exact same question again without rewording it — forcing the candidate to realize they did not actually answer it. Asks for the process behind decisions, not just the outcome. Asks about failure cases and edge cases.
Silence behavior: holds 4–5 seconds of silence. The longest silences in the platform.
Animated expression cues: fixed, unblinking stare at camera; no nodding; no smiling; occasional slight head tilt when analyzing a response; flat affect throughout.
Typical phrases: ‘Walk me through exactly how you did that.’, ‘What was your methodology?’, ‘What would have happened if X had gone differently?’, ‘Be more specific.’
Best deployed in: technical rounds, engineering roles, data roles, analytical positions.
The Distracted Senior
Communication style: clearly important and clearly somewhere else mentally. Looks off-camera. Joins the interview 3 minutes late. Occasionally glances at something off-screen.
Behavioral rules: Asks the candidate to repeat something they just said (‘Sorry, can you say that last part again?’). Cuts a long answer short to check something (‘Hold on — quick question: what was the timeline on that?’). Tests whether the candidate can maintain confidence and adapt their communication without becoming flustered or visibly annoyed. Asks one very sharp, focused question at the end that demonstrates they were listening the whole time.
Animated expression cues: frequently looks off-camera, checks ‘phone’, slight fidgeting, delayed eye contact return, but snaps to full attention for the final question.
Best deployed in: panel rounds where there is a senior stakeholder, executive-level roles.
The Culture Fit Assessor
Communication style: relaxed, conversational, no formal structure. Seems like they just want to have a conversation. Dangerously disarming.
Behavioral rules: Never asks technical questions. Only cares whether this person belongs. Probes working style, conflict resolution, values alignment, and how the candidate describes other people. Candidates consistently underestimate this interviewer and reveal cultural misalignments. Notices and asks about specific word choices: ‘You said ‘manage up’ — tell me what that means to you.’
Animated expression cues: relaxed posture, casual head movements, genuine-looking smiles, thoughtful pauses with head tilts.
Best deployed in: second rounds, culture screens, team-fit rounds.
The Silent Observer
Communication style: says almost nothing. Present on camera, clearly taking notes, nods occasionally. Generates constant unresolved social pressure throughout the session.
Behavioral rules: Does not ask questions during the main interview. At the very end, asks exactly one pointed question that reveals they have been listening carefully to every word. The question often references something the candidate said 20 minutes earlier.
Animated expression cues: visible note-taking gestures, occasional slow nod, maintains steady gaze at camera, no smiling, minimal facial movement except when writing.
Best deployed in: panel rounds, as a third character in final rounds.

6.5 Conversation Mechanics
How the Conversation Works
The interview conversation is not a scripted Q&A sequence. The AI characters respond to what the candidate actually said. Follow-up questions are generated from the candidate’s real answer — not predetermined. The conversation is genuinely reactive. All of this happens through spoken conversation — the candidate speaks aloud, the AI character listens, processes, and responds aloud with synchronized face animation.
Turn-Taking
The following describes the exact sequence of events in every conversational turn. The developer must implement this pipeline so that it feels seamless and natural to the candidate:
•	1. The interviewer asks a question — the character’s animated face speaks the words with full lip sync and expression
•	2. The candidate speaks — their audio is captured and transcribed in real time via a speech-to-text engine
•	3. When the candidate stops speaking (1.5-second silence detected), the completed transcription is sent to the language model for processing
•	4. The character holds their archetype-specific silence (2–5 seconds depending on character) — during this silence the character remains visually present on camera, maintaining eye contact or looking at ‘notes’, exactly as a real interviewer would
•	5. The language model generates the interviewer’s response in character, using full conversation context and the character’s behavioral rules
•	6. The response text is converted to speech audio matching the character’s voice via a text-to-speech engine
•	7. The face animation pipeline renders the character’s mouth movements and expressions synchronized to the generated speech audio
•	8. The animated video and audio are streamed to the candidate’s browser in real time
•	9. The candidate sees and hears the AI interviewer respond — as a live animated video character speaking directly to them
•	10. The cycle repeats
Character-Specific Silence Durations
Character	Silence Before Responding	Why
Skeptic	3–4 seconds	Creates pressure, implies the answer was not sufficient
Friendly Champion	1–2 seconds	Matches the warm, flowing conversational rhythm
Technical Griller	4–5 seconds	Maximum discomfort — implies deep consideration
Distracted Senior	Variable — 1–2s or 6–8s	Unpredictability is the point
Culture Fit Assessor	2–3 seconds	Thoughtful pace, not aggressive
Silent Observer	N/A (does not respond)	Presence is the mechanic

Follow-Up Question Logic
Every interviewer response is generated with full awareness of the entire conversation history up to that point. The language model prompt must instruct the AI to:
•	Ask follow-up questions that reference specific things the candidate said — not generic follow-ups
•	Probe any vague claim made in the previous answer
•	Ask about the outcome if the candidate described a situation but did not state a result
•	Ask about the candidate’s specific role if they used ‘we’ language
•	Occasionally ask a question that apparently moves to a new topic but actually revisits something from 10–15 minutes earlier
Panel Dynamics (Multi-Interviewer Sessions)
In panel sessions, all AI interviewers appear simultaneously as separate video feeds in a grid layout, exactly as a multi-person video call would look. Each character is independently animated and reactive throughout the session:
•	Characters take turns asking questions — the platform manages the rotation
•	Characters have brief exchanges between themselves: ‘James, did you want to follow up on that?’ — ‘No, I’m good — let’s keep going.’
•	One character occasionally references what another character asked: ‘Building on what Sarah mentioned earlier…’
•	The Silent Observer makes notes visibly throughout — the candidate can see them doing this in their video feed
•	When one character is speaking, the others remain visually active — nodding, looking at the speaker, or taking notes — exactly as real panelists would behave on a video call

6.6 Pressure Mechanics
Standard Pressure (All Sessions)
•	Silence after every candidate answer — never immediate response
•	Follow-ups that challenge vague language
•	Interviewers do not fill silence — ever
•	No positive reinforcement during the interview
Additional High Pressure Mechanics (High Pressure Mode)
•	Questions escalate in difficulty in the second half of the session
•	The Skeptic pushes back on two consecutive answers with increasing directness
•	A question appears that was not in the candidate’s Prepare module question bank
•	One interviewer appears visibly unimpressed after a particularly weak answer (expression change in the animation)
•	A panel member asks the same question two different ways back to back
Randomized Unexpected Moments (Across All Sessions)
These events are randomly assigned to sessions so the candidate cannot anticipate them:
•	An interviewer joins 2–3 minutes late — the candidate waits in the room seeing the empty video tile, exactly as they would on a real call
•	A simulated technical difficulty: one video feed freezes for 5 seconds, then recovers
•	A curveball question that is not related to any of the preparation material
•	‘We actually have time for one more question’ — said when the candidate believed the session was ending
•	A very long pause where no interviewer speaks — the candidate must decide whether to speak or hold

6.7 Interview Formats Supported
Format	Description	Typical Characters
Standard Behavioral	Competency-based questions, STAR expected	Skeptic + Friendly Champion
Technical / Functional Deep-Dive	Role-specific knowledge, process questions	Technical Griller + Silent Observer
Case Interview	Structured problem-solving, market sizing, frameworks	Skeptic + Technical Griller
Portfolio Review	Candidate presents work, characters ask questions about it	Culture Fit Assessor + Friendly Champion
Panel Interview	2–3 interviewers simultaneously, full panel dynamics, multiple video feeds in grid	Any combination of 3 archetypes
Phone Screen Simulation	Audio only, no video, different pressure profile	Friendly Champion (primary)
Stress Interview	Explicitly adversarial — used for finance, law, high-stakes roles	Skeptic + Technical Griller, maximum pressure
Every format listed above (except Phone Screen) is a full live video experience with animated AI characters. The candidate sees the interviewer(s) on camera, the interviewer(s) see the candidate on camera, and all interaction happens through real-time spoken conversation with animated, reactive AI faces.

6.8 What Is Not Available During the Interview
The following are deliberately absent from the interview room:
•	No hints or coaching prompts
•	No pause button
•	No visible notes from the Prepare module
•	No ability to restart a question
•	No indication of how many questions remain
•	No escape back to the application dashboard mid-session
•	No text chat or messaging interface — all communication is spoken
This is intentional. The absence of safety nets is what creates the pressure that makes the practice valuable. The session ends only when the AI ends it — not when the candidate is ready.

7. DEBRIEF SYSTEM
7.1 Purpose
The Debrief is the payoff of every session. It takes the full session transcript and turns it into a precise, personal coaching experience. It is not a feedback report. It is a moment-by-moment review of exactly what happened and why it mattered, delivered by an AI character speaking directly to the candidate.
7.2 Transition Into Debrief
When the interview session ends, the screen transitions. One character — the one who played the Friendly Champion during the interview — changes. The visual treatment shifts: softer framing, they relax their posture, their tone changes to direct and personal. They break from their interviewer role and become the Coach. This transition is cinematic and deliberate. The character says something like: ‘Okay — let’s talk about what just happened in there.’ This is the only moment in the platform where an AI character acknowledges the simulation context.
7.3 The Moment Map
A full-width horizontal timeline of the entire interview is displayed. Each conversational exchange occupies a segment of the timeline proportional to its duration. Segments are color-coded:
•	Green: Strong moments — specific, confident, well-structured, outcome-oriented
•	Yellow: Recoverable moments — started weakly or went vague but pulled back
•	Red: Dropped moments — lost the thread, went vague, energy dropped, filled silence with content that weakened the answer
•	Lightning bolt icons mark moments where the interviewer had a notable reaction — leaned in, looked up from notes, exchanged a glance with a co-interviewer
Clicking any segment opens a panel showing:
•	The exact transcript of that exchange — both what the interviewer said and what the candidate said
•	The coaching note for that moment — specific, referencing the candidate’s exact words
•	A Play This Moment button that plays the audio recording from that timestamp
7.4 Replay and Commentary
The full session audio is available for playback. As the candidate plays it back, coaching annotations appear at their timestamps — not as interruptions but as text overlays synced to the playback position.
Example annotations:
•	[04:32] You used ‘I think’ three times in 20 seconds here. That pattern signals uncertainty even when you know the answer. Your claim was actually correct — deliver it directly.
•	[11:18] The Skeptic paused here deliberately. You filled the silence by adding a caveat that undermined your original point. When an interviewer pauses, hold. They are not signaling that your answer was wrong.
•	[23:45] Strong close. Specific, confident, no filler. Notice how your energy here differs from your opener — this is what your first answer should sound like.
7.5 Performance Scores
Dimension	What It Measures	Range
Answer Quality	Relevance to what was asked, structural integrity, use of specific examples, presence of measurable outcomes	1–100
Delivery Confidence	Pace (from transcript word patterns), filler word frequency, energy maintenance across the session, trailing sentences	1–100
Pressure Recovery	How the candidate responded to pushback, interruptions, and difficult follow-ups. Did they hold their position or retreat?	1–100
Company Fit Language	How naturally the candidate used the specific values language identified from the company’s JD and culture research	1–100
Listening Accuracy	Whether answers addressed what was actually asked, or whether the candidate pivoted to a prepared answer regardless of the question	1–100

Each score card shows: the dimension name, score as a large number, a circular gauge, three specific observations from the session, and the primary weakness for that dimension.
7.6 Hiring Probability Score
A single number from 0 to 100, displayed prominently, representing the likelihood this candidate would advance from this interview stage at this company based on this performance. Below the number:
•	Primary reasons it would be Yes: three specific strengths from this session
•	Primary reasons it would be No: three specific weaknesses or gaps
•	Comparison to role requirements: a written assessment of how the performance matched what this specific role demands
•	Would Advance: Yes or No in large text — the honest binary call
7.7 Next Session Targets
Exactly three targets. Not a comprehensive feedback report. Three things — the highest-impact improvements for the next session. Each target card contains:
•	Title: a short label (e.g., ‘Eliminate uncertainty language’)
•	Description: the specific pattern observed in this session with exact examples from the transcript
•	Action: a concrete practice instruction (e.g., ‘Before your next session, record yourself answering your conflict management question five times without using I think, I feel, or I believe’)
•	Success Metric: how the candidate will know they have improved (e.g., ‘In your next session, zero uses of I think or I feel in behavioral answers’)
7.8 The Coach Audio
When the debrief page loads, the Coach character delivers a spoken 2-minute debrief. This is not a robotic summary — it is a script generated specifically for this session and delivered through the character’s animated face and voice. It:
•	Addresses the candidate directly by name
•	References three specific moments from the session by timestamp
•	Explains what happened at each moment and why it mattered to an interviewer
•	Gives one concrete tip for each moment
•	Ends by stating the three next targets conversationally
The coach audio plays automatically when the debrief page loads. The candidate hears a human-sounding voice and sees the animated Coach character speaking directly to them about their specific performance. This is the moment that makes the platform feel unlike any other tool.
7.9 Progress Tracking
At the bottom of the debrief: a chart showing all sessions for this Application across time. The x-axis is sessions, the y-axis is Hiring Probability Score. The trend line makes improvement (or plateau) immediately visible. Each data point is clickable and opens that session’s debrief.

8. OBSERVE MODULE
8.1 Purpose and Uniqueness
The Observe module has no equivalent on any other platform. It lets the candidate sit on the other side of the table and watch their interview play out twice — once perfectly, once poorly — with an AI candidate using their own background, their own experience, and their own stated weak patterns.
The insight it delivers is the one candidates never otherwise get: what do I actually look like to the interviewer? The Cautionary Run is particularly powerful because it uses the candidate’s real weak patterns, drawn from their actual session transcripts — not generic bad interview behavior.
The Observe module becomes available after the candidate has completed at least one live simulation session.
The Observe module plays back as a full video experience. The user watches an AI candidate (built from their profile) being interviewed by the same animated AI interviewers from their actual session. Both the AI candidate and the AI interviewers are rendered as animated video characters with lip-synced speech, expressions, and body language. The user is a spectator watching a realistic video interview unfold.
8.2 The Perfect Run
The AI generates a complete simulation of the candidate’s interview — same questions that appeared in their real session, same interviewer panel — with an AI candidate in the candidate’s seat who performs ideally.
The AI Candidate’s Profile
The AI candidate is built from the user’s own profile — same background, same companies, same experience. It is not a generic high-performer. It is them, but performing at the level a top candidate with their background would perform.
What Makes the Perfect Run Perfect
•	Answers reference the same past companies and roles from the actual resume
•	Responses are structured — each one follows STAR or the appropriate framework without being mechanical about it
•	Every claim is specific — numbers, outcomes, personal ownership are present in every behavioral answer
•	Pushback from the Skeptic is handled by holding the position and adding a specific detail, not retreating
•	Silence is held comfortably — the AI candidate does not fill silence with additional content
•	Answers stay within the time guidance for each question
•	The company’s values language appears naturally in answers, not forced
•	Two strong, specific closing questions are asked
•	The opening is direct and energetic — starts with impact, not throat-clearing
Annotations on the Perfect Run
After watching each answer, a green annotation panel appears explaining what made that specific response strong — the exact technique used, the framing choice, the language pattern. These are not generic notes. They reference the specific content of what was just said.
8.3 The Cautionary Run
The same setup — same questions, same panel — but the AI candidate now demonstrates what failure looks like using the user’s actual weak patterns.
How Weak Patterns Are Identified
The platform reads the user’s real session transcripts and the Moment Map from their debrief. It extracts:
•	The specific filler phrases they actually use
•	The moments where they retreated under pushback
•	The answers where they went vague after a strong start
•	The silence-filling behavior — speaking when they should have held
•	The over-qualification language they actually used
The Cautionary Run demonstrates these exact patterns — not cartoon bad interview behavior, but a realistic performance of a nervous, under-prepared candidate making the specific mistakes this candidate makes.
Annotations on the Cautionary Run
After each answer, a red annotation panel appears identifying exactly what went wrong — with a direct label for the pattern (e.g., ‘Silence-Filling’, ‘Retreat Under Pressure’, ‘Vague Claim Without Support’) and a note explaining how an interviewer reads this behavior.
8.4 Split View
The candidate can switch to Split View — both runs play simultaneously in side-by-side windows, synced to the same question. Both AI candidates answer the same question at the same time. The divergence between them often becomes visible within the first 15 seconds of an answer. This is the most direct comparison the platform offers.
8.5 Custom Observe Scenarios
Beyond the standard Perfect and Cautionary runs tied to a real session, the candidate can request focused demonstration scenarios. These are short 3–5 minute scenes — not full interviews — targeting a specific moment or question type. Available scenarios include:
•	How to handle the salary question — both the perfect negotiation and the common mistakes
•	How the perfect candidate answers a question they do not know the answer to
•	How to recover after giving a bad answer — the specific technique of acknowledging, resetting, and delivering a better version
•	The worst way to answer ‘What is your greatest weakness’ — and the best way
•	How to handle ‘Why are you leaving your current role’ when the real reason is complicated
•	How the perfect candidate handles the very long silence — the moment no one speaks

9. ADDITIONAL PLATFORM FEATURES
9.1 Multi-Application Management
Users preparing for multiple roles simultaneously have a completely independent workspace per Application. The main dashboard shows all active Applications as cards, each displaying:
•	Company name and job title
•	Readiness score as a percentage
•	Hiring probability trend: up, down, or flat
•	Days until the real interview date (if set)
•	Number of sessions completed
Switching between Applications is seamless. No data from one Application influences another.
9.2 The Pressure Lab
Standalone short sessions (10–15 minutes) targeting specific high-stakes moments. Not full interviews — focused drills. All Pressure Lab sessions use the same live video format with animated AI characters.
Scenario	What It Drills	Character Used
Salary Negotiation Lab	The post-offer negotiation conversation end-to-end	Hiring Manager character (warm but firm)
Conflict Question Lab	Behavioral questions specifically about conflict, difficult colleagues, and disagreement	Skeptic
Tell Me About Yourself Lab	The opening question — 10 iterations to find the right narrative arc	Friendly Champion
Curveball Recovery Lab	Questions designed to catch the candidate off guard — pure recovery practice	Technical Griller
Panel Dynamics Lab	Reading the room with 3 interviewers — who to address, how to split attention	Full panel of three characters
Why Are You Leaving Lab	The delicate question about reasons for departure	Culture Fit Assessor
Gap Explanation Lab	Explaining career gaps, career changes, or unconventional backgrounds	Skeptic + Friendly Champion

Each Pressure Lab session produces a brief focused debrief — not the full Moment Map, but a 3–4 observation summary and a single next target.
9.3 Salary Negotiation Simulator
A dedicated extended session where the AI Hiring Manager character makes an initial offer and the candidate must negotiate. The simulation runs through the full negotiation arc:
•	The initial offer is made — calibrated to the role’s realistic market range
•	The candidate must counter
•	The Hiring Manager responds: accepts, counters, or states that the offer is firm
•	The candidate must navigate to a close — accepting, asking for non-salary benefits, or requesting time to consider
Three difficulty settings: Flexible Hiring Manager, Standard Negotiation, Firm on Budget.
Full debrief after each run — was the counter reasonable, what negotiation language worked, what created resistance, what was left on the table.
9.4 Interview Day Countdown Mode
When a candidate sets a real interview date on their Application, the platform activates a countdown plan:
•	Days remaining counter displayed prominently on the Application dashboard
•	A day-by-day practice plan is generated: given the days remaining and the candidate’s current weak areas from their session history, the AI generates a specific daily session recommendation
•	The plan is displayed as a visual calendar — each day shows what to practice and why
•	A daily reminder notification: ‘Day 4 of your interview prep. Today: Curveball Recovery Lab. Your last session flagged pressure recovery as your weakest dimension.’
•	The night before the real interview: a lighter warmup session — not a full pressure simulation, but a confidence-building run through the opening question and two strongest behavioral answers
•	Morning of the real interview: a 5-minute audio warmup — the Coach character speaking directly to the candidate with a brief reminder of their three next targets and an energy boost
•	After the real interview: a reflection session where the candidate logs what was actually asked and how it went. The platform compares what happened against what it predicted — this closes the feedback loop and improves future predictions.
9.5 Progress Sharing — The Debrief Card
After every session, the candidate can generate a shareable Debrief Card — a clean, beautifully designed image suitable for sharing on LinkedIn. The card contains:
•	The Seatvio logo
•	The company and role they practiced for (they can choose to hide this)
•	Their Hiring Probability Score as a large number
•	Three dimension scores as compact visual gauges
•	Their top next target — the single most important improvement
•	A subtle ‘practiced on seatvio.app’ footer
The card is generated as a downloadable PNG. A pre-filled LinkedIn post text is provided alongside it for one-click sharing. This drives organic, word-of-mouth acquisition — people actively want to signal they are preparing seriously for interviews.
9.6 Account Settings
The settings page allows users to:
•	Update all profile information set during onboarding
•	Change email address (requires verification)
•	Change password
•	Manage notification preferences — which email alerts to receive
•	View and manage their active subscription
•	Archive or delete individual Applications
•	Delete their account and all associated data

10. MONETISATION MODEL
10.1 Plan Structure
Plan	Price	Sessions	Key Features
Free	$0/month	2 sessions/month	Question bank, flashcards, basic debrief (scores only — no Moment Map, no coach audio), 1 interviewer character
Prep	$19/month	Unlimited	All question bank features, full debrief with Moment Map and coach audio, all interview stages, all character archetypes, Pressure Lab
Pro	$49/month	Unlimited	Everything in Prep, plus: Company DNA research, Observe module (Perfect and Cautionary runs), panel mode, stress interview, salary negotiation simulator, Debrief Card sharing
Crunch	$99 one-time	Unlimited for 14 days	Full Pro access for 14 days, plus a personally generated day-by-day countdown plan for a specific upcoming interview

10.2 Feature Gating Logic
Free users who attempt to access gated features see an inline upgrade prompt — not a modal that blocks their work, but a component within the feature that explains what they are missing and links to the upgrade flow. The prompt references what the feature would show them based on their specific session data, making the value concrete rather than abstract.
10.3 Payment Processing
Subscriptions and one-time purchases must be handled by a PCI-compliant payment processor. The platform must never store payment card data directly. Monthly and annual billing options for Prep and Pro (annual at approximately 20% discount). The Crunch plan is a one-time charge that grants a 14-day access window starting from the purchase date.

11. PLATFORM-WIDE BEHAVIOURS & RULES
11.1 Data and Privacy
•	All user data — resumes, job descriptions, session transcripts, audio recordings — must be stored only on infrastructure controlled by the platform. No user data is sent to third-party AI services. All AI models must be self-hosted.
•	Session audio and video recordings are stored for 90 days. After 90 days, audio is deleted but the text transcript is retained for progress tracking.
•	Users can delete any individual session’s data at any time from their session history.
•	Users can request full account deletion, which permanently removes all data within 30 days.
11.2 Notification System
The platform sends email notifications for the following events. All can be individually toggled off in settings:
•	Welcome email after account creation
•	Session summary email after every completed session — containing key scores and the three next targets
•	Daily countdown reminder during Interview Day Countdown Mode
•	Weekly progress summary — how many sessions completed, hiring probability trend
•	Re-engagement prompt if the user has not practiced in 5+ days when a real interview date is set
•	Real interview day morning message
11.3 Session History
A dedicated Session History page shows all sessions across all Applications in reverse chronological order. Each entry shows:
•	Application name (company + role)
•	Session date and duration
•	Interview stage and intensity
•	Hiring probability score from that session
•	A thumbnail of the Moment Map timeline
•	Link to the full debrief
11.4 Landing Page
The root URL of the platform (for non-logged-in visitors) is a landing page. It must communicate:
•	The core positioning: this is not a question bank, it is a realistic live video interview experience with AI interviewers who look, sound, and behave like real people
•	The three modules and what they do — visually, not in paragraphs
•	Social proof: session count, improvement statistics, user testimonials
•	A prominent demonstration — a short video or animated preview showing what the interview room actually looks like, emphasizing that the AI characters are live animated video participants, not static images or text chat
•	Pricing plans
•	Sign up CTA
The landing page should open with the tagline and a visual of the interview room. The first thing a visitor sees should make them immediately understand that this is different from every other interview tool — these are real-time animated video interviewers, not chatbots.
11.5 Empty States
For new users with no data, every section shows an empty state that guides them to the next action rather than displaying an empty layout:
•	Dashboard with no Applications: shows a prompt to create their first Application with a brief explanation of what that unlocks
•	Question Bank with no questions generated: shows the Generate button prominently with a description of what will be created
•	Session History with no sessions: shows a preview of what the debrief looks like with sample data, and a Start Interview button
11.6 Error Handling
•	All API failures show a human-readable error message — never a technical error code
•	If document parsing fails, the user is told which document caused the issue and prompted to re-upload
•	If a session connection drops mid-interview, the session is preserved up to that point and the user is given the option to resume or end and debrief on the completed portion
•	If AI generation takes longer than expected, a loading state with a descriptive message is shown — not a spinner with no context

12. DATA MODEL SUMMARY
The following entities and their relationships define the complete data structure of the platform. The developer may choose any database system that supports these relationships. Field names are logical — the developer may adapt naming conventions to match their chosen framework.
Entity	Key Fields	Relationships
Users	id, email, password_hash, full_name, created_at	Has one Profile, has many Applications
User Profiles	user_id, anxiety_level, current_role, years_experience, current_industry, target_industry, work_arrangement, linkedin_url	Belongs to User
Applications	id, user_id, company_name, job_title, jd_text, resume_text, real_interview_date, alignment_score, status	Belongs to User, has many Questions, has many Sessions
Parsed Resume	application_id, career_timeline, top_skills, experience_gaps, achievements, education	Belongs to Application
Parsed JD	application_id, required_skills, preferred_skills, responsibilities, seniority_level, values_language, red_flag_areas, interview_format_prediction	Belongs to Application
Questions	id, application_id, question_text, question_type, why_asked, framework, model_answer, what_not_to_say, time_guidance_seconds, difficulty	Belongs to Application, has many User Answers
User Answers	id, question_id, user_id, answer_text, audio_url, confidence_rating, status, practice_count	Belongs to Question and User, has many Answer Feedbacks
Answer Feedbacks	id, user_answer_id, strengths, issues, missing_elements, scores	Belongs to User Answer
Interview Sessions	id, user_id, application_id, stage, intensity, duration_minutes, status, characters, started_at, ended_at	Belongs to Application, has many Exchanges, has one Analysis
Session Exchanges	id, session_id, sequence_number, speaker, character_id, message_text, audio_url, timestamp_ms	Belongs to Session
Session Analysis	id, session_id, moment_map, dimension_scores (5), hiring_probability, next_targets	Belongs to Session
Observe Sessions	id, source_session_id, type (perfect/cautionary), exchanges, annotations	Belongs to source Session
Subscriptions	id, user_id, plan, status, current_period_end, payment_processor_ids	Belongs to User

13. TECHNICAL REQUIREMENTS & ARCHITECTURE PRINCIPLES
This section defines what the platform must be able to do technically. It does not prescribe specific libraries, frameworks, models, or hosting providers. The developer has full authority over implementation choices, provided the following requirements and principles are met.
13.1 Full Ownership — No Third-Party AI Dependencies
Every AI capability in the platform must run on infrastructure owned or directly controlled by the platform operator. No feature may depend on a third-party AI API that could change its pricing, deprecate its endpoint, rate-limit the platform, or shut down. All AI models must be self-hosted. The platform pays for compute (hardware, hosting, electricity) — not for per-token or per-request AI service fees.
This applies to all AI components:
•	The large language model used for conversation, question generation, answer analysis, and debrief scoring
•	The speech-to-text engine used for real-time transcription of the candidate’s spoken answers
•	The text-to-speech engine used to generate the AI interviewer’s spoken voice
•	The face animation model used to generate real-time lip-synced animated video of the AI characters
The developer should select open-source or permissively licensed models for each of these capabilities. The specific model choices are the developer’s decision, but all models must be self-hostable with no ongoing API fees or usage-based billing from a third party.
13.2 Server Architecture
The platform requires at minimum two logical server roles (which may or may not be physically separate machines depending on available resources):
•	Application Server: handles the web application, the database, file/media storage, and lighter AI tasks (document parsing, question generation, answer analysis, debrief scoring). Does not require a GPU.
•	GPU Server: handles all GPU-intensive real-time tasks: language model inference during live interviews, real-time speech-to-text transcription, text-to-speech generation, and real-time face animation rendering. Requires one or more capable GPUs.
The developer chooses hosting providers, server specifications, and deployment strategies. The architecture must support the latency target defined below.
13.3 Real-Time Video Interview Pipeline
The following pipeline must be implemented to deliver the live video interview experience. The developer chooses specific technologies for each step, but the pipeline sequence and performance requirements are fixed:
•	1. CAPTURE: The candidate’s audio is captured from their microphone and streamed to the server in real time via a low-latency protocol (e.g., WebRTC or equivalent).
•	2. TRANSCRIBE: A speech-to-text engine transcribes the candidate’s audio to text in real time. When 1.5 seconds of silence is detected, the completed transcription is passed to the next stage.
•	3. GENERATE: A self-hosted large language model receives the full conversation history, the active character’s personality rules, and the transcribed candidate answer, then generates the interviewer’s next response in character.
•	4. SYNTHESIZE: A text-to-speech engine converts the generated response text into speech audio using the character’s distinct voice profile.
•	5. ANIMATE: A face animation model generates real-time video of the AI character’s face, with mouth movements synchronized to the generated speech audio and expressions driven by the context of the conversation.
•	6. STREAM: The generated video and audio are streamed back to the candidate’s browser in real time via a low-latency protocol.
•	7. DISPLAY: The candidate sees and hears the AI interviewer respond on their screen as a live animated video character.
13.4 Latency Target
The total round-trip processing time from when the candidate stops speaking to when the AI interviewer’s animated video response begins playing must be under 2.5 seconds in standard conditions. This is the critical performance target for the interview room.
The 2.5-second target is for technical processing time only. It does not include the character’s intentional silence pauses (which range from 1–8 seconds depending on archetype). The character’s silence is a deliberate behavioral choice added on top of the processing time, not a loading delay. The user must not perceive any gap between the end of the intentional silence and the start of the character’s response.
13.5 Candidate Camera and Audio Requirements
The candidate’s own camera feed is displayed as a small picture-in-picture tile during the session, exactly as on a standard video call. The platform captures and stores the candidate’s audio (for transcript and playback in the debrief) but does NOT record or store the candidate’s video. The candidate’s video feed is live-only and not persisted.
13.6 The Prompts Are the Product
The AI model prompts — for character personas, question generation, answer analysis, debrief scoring, Observe run generation — are as important as the application code. They must be treated as first-class product assets: version-controlled alongside the code, reviewed with the same rigor as any feature change, and iterated on continuously. The quality of the user experience is directly determined by the quality of these prompts. Each archetype’s behavioral rules (Section 6.4) must be encoded into the system prompts that drive the language model during live sessions.
13.7 Offline / Asynchronous AI Tasks
Not all AI tasks happen in real time. The following tasks can run asynchronously (in a background job queue) and do not have the 2.5-second latency constraint:
•	Resume and JD parsing (when an Application is created)
•	Question bank generation (when the user clicks Generate Question Bank)
•	Answer analysis (when the user clicks Analyze My Answer)
•	Session analysis and debrief generation (after a session ends)
•	Observe module run generation (Perfect and Cautionary runs)
•	Countdown plan generation (when a real interview date is set)
For these tasks, the platform should display meaningful progress indicators and estimated completion times, not empty spinners.

14. SUCCESS METRICS
These are the metrics that define whether the platform is achieving its purpose. They are product metrics, not just business metrics.
Metric	What It Measures	Target
Sessions per Active User per Month	Engagement depth — are people practicing regularly	5+ sessions/month for paid users
Hiring Probability Score Improvement	The core product outcome — are users actually getting better	Average +15 points over first 5 sessions
Session Completion Rate	Do users finish sessions or abandon them	>80% of started sessions completed
Return Rate After First Session	Does the product deliver enough value that users come back	>65% of users complete a second session within 7 days
Observe Module Usage	Is the differentiated feature being discovered and used	>40% of Pro users watch at least one Observe run
Debrief Card Shares	Viral acquisition signal	>10% of debrief views result in card generation
Free to Paid Conversion	Business health	>8% of free users convert to Prep or Pro within 30 days
Real Interview Correlation	Long-term validation — do users who practice more get better real outcomes	Tracked via post-real-interview reflection sessions

15. PRODUCT NAMING & BRAND
The confirmed product name is Seatvio. The primary domain to acquire is seatvio.app. Alternative/backup domains: seatvio.io, seatvio.co, seatvio.ai.
Trademark searches are required in both Canada and the United States before launch.
NAMING NOTICE: Do not use “Intervia” — trademark conflict with an existing product. Do not use “Nerveo” — this name belongs to a recording artist. The confirmed clean name is Seatvio (verified with no conflicts found in apps, startups, musicians, or existing brands as of the search date).

— End of Document —
