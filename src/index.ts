import { prometheus } from '@hono/prometheus'
import { Hono } from 'hono'

const app = new Hono()

// Prometheus metrics
const { printMetrics, registerMetrics } = prometheus()
app.use('*', registerMetrics)
app.get('/actuator/prometheus', printMetrics)

// Health checks
app.get('/actuator/health/liveness', (c) => c.json({ status: 'UP' }))
app.get('/actuator/health/readiness', (c) => c.json({ status: 'UP' }))

app.get('/', (c) => {
  return c.text('Hei Uniformen!')
})

export default {
  port: 3000,
  fetch: app.fetch,
}
