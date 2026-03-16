#!/usr/bin/env node

import { execSync } from 'node:child_process'

function run(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  })
}

function runCapture(command) {
  try {
    const output = execSync(command, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    return { ok: true, output: output.toString() }
  } catch (error) {
    const stdout = error?.stdout ? error.stdout.toString() : ''
    const stderr = error?.stderr ? error.stderr.toString() : ''
    return { ok: false, output: `${stdout}\n${stderr}` }
  }
}

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

if (!hasDatabaseUrl) {
  console.log('Skipping database deploy step (DATABASE_URL not set).')
  process.exit(0)
}

console.log('Running Prisma migration deploy...')
const migrate = runCapture('npx prisma migrate deploy')

if (migrate.ok) {
  console.log('Prisma migrations applied successfully.')
  process.exit(0)
}

if (!migrate.output.includes('P3005')) {
  console.error('Prisma migration deploy failed with unexpected error:')
  console.error(migrate.output)
  process.exit(1)
}

console.warn('Detected P3005 (non-empty DB without Prisma baseline).')
console.warn('Applying idempotent v6 alignment SQL via prisma db execute...')

run(
  'npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260316170500_v6_runtime_alignment/migration.sql'
)

console.log('v6 alignment SQL executed successfully.')
