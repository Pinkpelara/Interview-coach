type ParsedResumeData = {
  topSkills: string[]
  careerTimeline: string
  experienceGaps: string[]
  achievements: string[]
  education: string
}

type ParsedJDData = {
  requiredSkills: string[]
  preferredSkills: string[]
  responsibilities: string[]
  seniorityLevel: string
  valuesLanguage: string[]
  redFlagAreas: string[]
  interviewFormatPrediction: string
}

export type DeterministicApplicationAnalysis = {
  alignmentScore: number
  skillGaps: string[]
  strengths: string[]
  missingKeywords: string[]
  probeAreas: string[]
  parsedResume: ParsedResumeData
  parsedJD: ParsedJDData
  readinessScore: number
}

const SKILL_CATALOG = [
  'Python', 'Java', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'SQL',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
  'Terraform', 'CI/CD', 'Git', 'GraphQL', 'REST APIs', 'System Design', 'Microservices',
  'Machine Learning', 'Data Analysis', 'Tableau', 'Power BI', 'Excel', 'Figma', 'Product Strategy',
  'Roadmapping', 'Stakeholder Management', 'Project Management', 'Agile', 'Scrum', 'Leadership',
  'Mentoring', 'Communication', 'Experimentation', 'A/B Testing', 'Analytics', 'SEO', 'SEM',
  'Content Strategy', 'Salesforce', 'HubSpot', 'Negotiation', 'Conflict Resolution', 'Testing',
  'Unit Testing', 'Integration Testing', 'Security', 'SRE', 'Incident Response'
]

const VALUES_PHRASES = [
  'ownership', 'bias for action', 'customer obsession', 'collaboration', 'integrity', 'accountability',
  'growth mindset', 'move fast', 'high standards', 'inclusive', 'innovation', 'results-oriented',
  'continuous improvement', 'team-first', 'data-driven'
]

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'at', 'with', 'by', 'from', 'as',
  'is', 'are', 'be', 'this', 'that', 'will', 'you', 'your', 'our', 'we', 'their', 'they', 'it'
])

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n|•|·/)
    .map((l) => l.trim())
    .filter(Boolean)
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

function pickTopSkillMentions(text: string, limit: number): string[] {
  const lower = normalize(text)
  const hits = SKILL_CATALOG.filter((skill) => lower.includes(skill.toLowerCase()))
  return hits.slice(0, limit)
}

function extractEducation(resumeText: string): string {
  const lines = splitLines(resumeText)
  const eduLines = lines.filter((l) =>
    /(university|college|bachelor|master|phd|b\.?sc|m\.?sc|mba|degree|diploma)/i.test(l)
  )
  return eduLines.slice(0, 3).join(' | ') || 'No explicit education section detected.'
}

function extractAchievements(resumeText: string): string[] {
  const lines = splitLines(resumeText)
  const quantified = lines.filter((l) => /(\d+%|\$\d+|\d+\+? (users|customers|projects|team|engineers|people|clients))/i.test(l))
  const impactVerbs = lines.filter((l) => /^(led|built|launched|improved|increased|reduced|owned|designed|scaled)\b/i.test(l))
  return unique([...quantified, ...impactVerbs]).slice(0, 8)
}

function extractCareerTimeline(resumeText: string): string {
  const lines = splitLines(resumeText)
  const timeline = lines.filter((l) => /(19|20)\d{2}|present|current/i.test(l)).slice(0, 8)
  if (timeline.length > 0) return timeline.join(' | ')
  return lines.slice(0, 5).join(' | ')
}

function extractExperienceGaps(resumeText: string): string[] {
  const matches = Array.from(resumeText.matchAll(/\b((?:19|20)\d{2})\b/g))
  const years = unique(matches.map((m) => Number.parseInt(m[1], 10))).sort((a, b) => a - b)
  if (years.length < 2) return []
  const gaps: string[] = []
  for (let i = 1; i < years.length; i++) {
    const diff = years[i] - years[i - 1]
    if (diff > 1 && diff <= 5) {
      gaps.push(`Potential timeline gap between ${years[i - 1]} and ${years[i]}`)
    }
  }
  return gaps.slice(0, 4)
}

function extractResponsibilityLines(jdText: string): string[] {
  const lines = splitLines(jdText)
  const responsibilityLines = lines.filter((l) =>
    /(responsib|you will|own|lead|deliver|manage|design|build|coordinate|collaborate)/i.test(l)
  )
  return responsibilityLines.slice(0, 8)
}

function extractSkillsFromJDSection(jdText: string, sectionPattern: RegExp): string[] {
  const lines = splitLines(jdText)
  const filtered = lines.filter((l) => sectionPattern.test(l))
  const fromCatalog = filtered.flatMap((line) =>
    SKILL_CATALOG.filter((skill) => line.toLowerCase().includes(skill.toLowerCase()))
  )
  return unique(fromCatalog)
}

function inferSeniority(jobTitle: string, jdText: string): string {
  const combined = `${jobTitle} ${jdText}`.toLowerCase()
  if (/(intern|graduate|entry)/.test(combined)) return 'entry'
  if (/(junior|associate)/.test(combined)) return 'junior'
  if (/(staff|principal|architect)/.test(combined)) return 'staff+'
  if (/(director|head|vp|vice president|chief)/.test(combined)) return 'executive'
  if (/(senior|sr\.)/.test(combined)) return 'senior'
  return 'mid'
}

function inferInterviewFormat(jobTitle: string, jdText: string): string {
  const combined = `${jobTitle} ${jdText}`.toLowerCase()
  const isTechnical = /(engineer|developer|data|technical|architecture|code|system design)/.test(combined)
  const isCase = /(case|market sizing|framework|consulting|strategy)/.test(combined)
  const isPortfolio = /(portfolio|design samples|creative|ux|ui)/.test(combined)
  if (isCase) return 'Case + Behavioral'
  if (isPortfolio) return 'Portfolio + Behavioral'
  if (isTechnical) return 'Technical + Behavioral'
  return 'Behavioral + Culture'
}

function extractValuesLanguage(jdText: string): string[] {
  const lower = normalize(jdText)
  const found = VALUES_PHRASES.filter((p) => lower.includes(p))
  return found.length ? found : ['ownership', 'collaboration', 'results-oriented']
}

function extractKeywordCandidates(text: string, limit: number): string[] {
  const tokens = tokenize(text)
  const freq = new Map<string, number>()
  tokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1))
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter((t) => t.length > 3)
    .slice(0, limit)
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(' ')
}

export function buildDeterministicApplicationAnalysis(input: {
  companyName: string
  jobTitle: string
  resumeText: string
  jdText: string
}): DeterministicApplicationAnalysis {
  const { companyName, jobTitle, resumeText, jdText } = input
  const resumeLower = normalize(resumeText)

  const resumeSkills = pickTopSkillMentions(resumeText, 16)
  const requiredSkills = extractSkillsFromJDSection(
    jdText,
    /(required|must have|minimum qualifications|basic qualifications|you have)/i
  )
  const preferredSkills = extractSkillsFromJDSection(
    jdText,
    /(preferred|nice to have|bonus|plus|desired)/i
  )

  const fallbackJDSkills = pickTopSkillMentions(jdText, 14)
  const finalRequiredSkills = requiredSkills.length ? requiredSkills : fallbackJDSkills.slice(0, 8)
  const finalPreferredSkills = preferredSkills.length ? preferredSkills : fallbackJDSkills.slice(8, 14)

  const matchedRequired = finalRequiredSkills.filter((s) => resumeLower.includes(s.toLowerCase()))
  const missingRequired = finalRequiredSkills.filter((s) => !resumeLower.includes(s.toLowerCase()))
  const matchedPreferred = finalPreferredSkills.filter((s) => resumeLower.includes(s.toLowerCase()))

  const jdKeywords = extractKeywordCandidates(jdText, 24)
  const missingKeywords = jdKeywords
    .filter((k) => !resumeLower.includes(k))
    .map((k) => titleCase(k))
    .slice(0, 8)

  const requiredCoverage = finalRequiredSkills.length ? matchedRequired.length / finalRequiredSkills.length : 0.55
  const preferredCoverage = finalPreferredSkills.length ? matchedPreferred.length / Math.max(1, finalPreferredSkills.length) : 0.5
  const keywordCoverage = jdKeywords.length
    ? (jdKeywords.length - missingKeywords.length) / jdKeywords.length
    : 0.5

  const redFlagAreas = missingRequired.slice(0, 4).map((skill) => `Limited evidence of ${skill} from resume history`)
  const alignmentScore = clamp(
    Math.round(35 + requiredCoverage * 45 + preferredCoverage * 10 + keywordCoverage * 10 - redFlagAreas.length * 2),
    0,
    100
  )

  const parsedResume: ParsedResumeData = {
    topSkills: resumeSkills.slice(0, 10),
    careerTimeline: extractCareerTimeline(resumeText),
    experienceGaps: extractExperienceGaps(resumeText),
    achievements: extractAchievements(resumeText),
    education: extractEducation(resumeText),
  }

  const valuesLanguage = extractValuesLanguage(jdText)
  const parsedJD: ParsedJDData = {
    requiredSkills: finalRequiredSkills.slice(0, 10),
    preferredSkills: finalPreferredSkills.slice(0, 8),
    responsibilities: extractResponsibilityLines(jdText),
    seniorityLevel: inferSeniority(jobTitle, jdText),
    valuesLanguage,
    redFlagAreas,
    interviewFormatPrediction: inferInterviewFormat(jobTitle, jdText),
  }

  const strengths = unique([
    ...matchedRequired.slice(0, 4).map((s) => `${s} aligned to core role requirements`),
    ...resumeSkills.slice(0, 3).map((s) => `${s} appears repeatedly across resume experience`),
    ...(parsedResume.achievements[0] ? [`Quantified impact present: "${parsedResume.achievements[0].slice(0, 80)}"`] : []),
  ]).slice(0, 6)

  const skillGaps = unique([
    ...missingRequired.map((s) => `Build stronger evidence in ${s}`),
    ...missingKeywords.slice(0, 3).map((k) => `Incorporate ${k} language naturally in interview answers`),
  ]).slice(0, 6)

  const probeAreas = unique([
    ...missingRequired.map((s) => `Depth of hands-on experience with ${s}`),
    ...(parsedResume.experienceGaps.length > 0 ? ['Career timeline continuity and transitions'] : []),
    ...(parsedResume.achievements.length === 0 ? ['Quantifiable business outcomes from prior roles'] : []),
    `Why ${companyName} and why ${jobTitle} now`,
  ]).slice(0, 6)

  return {
    alignmentScore,
    skillGaps: skillGaps.length ? skillGaps : ['Demonstrate stronger role-specific depth with concrete examples'],
    strengths: strengths.length ? strengths : ['Relevant background with transferable role capabilities'],
    missingKeywords: missingKeywords.length ? missingKeywords : ['Ownership', 'Collaboration', 'Execution'],
    probeAreas: probeAreas.length ? probeAreas : ['Role-specific depth', 'Outcome ownership', 'Company motivation'],
    parsedResume,
    parsedJD,
    readinessScore: 0,
  }
}
