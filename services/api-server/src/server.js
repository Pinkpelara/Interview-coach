import express from 'express'

const app = express()
const PORT = Number(process.env.PORT || 8094)

app.use(express.json({ limit: '5mb' }))

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'seatvio-api-server',
    mode: 'scaffold',
  })
})

app.post('/auth/login', (_req, res) => {
  // TODO: Implement service-native auth when migrating away from monolithic API routes.
  res.status(501).json({ error: 'Not implemented in scaffold mode' })
})

app.post('/applications', (_req, res) => {
  // TODO: Implement service-native application creation flow.
  res.status(501).json({ error: 'Not implemented in scaffold mode' })
})

app.get('/sessions/:id', (req, res) => {
  // TODO: Implement service-native session retrieval flow.
  res.status(501).json({ error: `Session ${req.params.id} retrieval not implemented` })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api-server] listening on :${PORT}`)
})
