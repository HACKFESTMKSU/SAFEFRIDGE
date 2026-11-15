import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Radio,
  ShieldCheck,
  Snowflake,
  TrendingDown,
} from 'lucide-react'

interface Slide {
  kicker: string
  title: string
  body: string[]
  bullets?: string[]
  icon?: React.ReactNode
}

const slides: Slide[] = [
  {
    kicker: 'ColdGuard · HACKFEST MKSU',
    title: 'Cold storage fails silently. We make it speak up.',
    body: [
      'ESP32 sensors → MQTT → cloud dashboard → threshold incidents → GSM SMS fallback.',
      'Built for fridges, freezers and cold rooms across African healthcare and food facilities.',
    ],
    icon: <Snowflake size={40} />,
  },
  {
    kicker: 'The problem',
    title: 'When a cold unit drifts, nobody gets the memo',
    body: [
      'Across Kenyan hospitals, county clinics, pharmacies and food hubs — and the wider African cold chain — failures are discovered too late.',
      'Vaccines under the national immunisation programme, insulin and fresh produce are expensive. One unnoticed failure writes off an entire batch.',
    ],
    bullets: [
      'Silent excursions — units drift out of range for hours unnoticed',
      'Kenya Power brownouts & rural dead zones blind cloud-only monitors',
      'Costly losses — vaccines, insulin, produce written off silently',
    ],
  },
  {
    kicker: 'IoT architecture',
    title: 'Sensor to SMS in three hops',
    body: [
      'EDGE — ESP32 reads DHT11, BMP180, ACS712, water & MQ-3 every 60s; SIM800L sends critical SMS when Wi-Fi is down; LittleFS buffers readings offline.',
      'CLOUD — FastAPI validates telemetry, runs threshold rules, opens incidents; JWT auth with Admin / Operator / Technician roles.',
      'WEB — React dashboard: live metrics, 24h charts, incident ack/resolve, thresholds & SMS config.',
    ],
  },
  {
    kicker: 'Features · Phase 0–2',
    title: 'Foundation: auth, ingest, dashboard',
    bullets: [
      'JWT auth, bcrypt passwords, role enforcement on API + UI',
      'MQTT ingest on coldsuite/device topics, plausibility flagging (FR-13)',
      'Asset & device registry, device↔asset linking',
      'Admin threshold & SMS recipient configuration',
      'Live metrics + 24-hour Recharts history per asset',
      'Online/offline badges from last-seen heartbeat',
    ],
    icon: <Cpu size={36} />,
  },
  {
    kicker: 'Features · Phase 3–4',
    title: 'Intelligence: incidents, resilience, GSM SMS',
    bullets: [
      'Rule engine: sustained-breach gate (2 readings) → auto-incident',
      'Duplicate suppression + auto-resolve when device recovers',
      'device_offline watcher every 60s',
      'Operator ack → resolve with note; technician maintenance notes',
      'Email hook on critical incidents (SMTP optional)',
      'Firmware: LittleFS ring buffer + chronological replay',
      'SIM800L critical SMS with 15-min rate limit',
    ],
    icon: <BellRing size={36} />,
  },
  {
    kicker: 'Problems solved',
    title: 'Ten real issues, ten fixes',
    bullets: [
      'Mock-only frontend → full FastAPI backend + real JWT wiring',
      'No persistence → server DB + token session restore',
      'Offline incidents never closed → missing db.commit() fixed',
      'Incident spam → sustained-breach gate + dedup',
      'Bad sensor values → quality="suspect" flag, never alerts',
      'Wi-Fi down = blind → buffer + GSM SMS fallback',
      'JWT secret warning → ≥32-byte dev default',
      'No-hardware demo → simulate_device.py MQTT simulator',
      'Push denied → collaborator access → org branch pushed',
      'Static landing → Kenya-focused problem/solution + slider',
    ],
    icon: <TrendingDown size={36} />,
  },
  {
    kicker: 'Live demo',
    title: 'Five minutes, no hardware needed',
    body: [
      'amqtt → uvicorn app.main:app → npm run dev. Login as admin@coldguard.local / admin123.',
      'simulate_device.py streams MQTT telemetry; --temp 12.5 creates a critical incident in ~30s; --offline 120 triggers device_offline.',
    ],
    bullets: [
      'Landing page → live demo → dashboard',
      'Over-temp spike → incident appears → operator ack/resolve',
      'Wi-Fi drop → offline badge + device_offline incident',
    ],
    icon: <Radio size={36} />,
  },
  {
    kicker: 'Status & next',
    title: 'Phases 0–3 done · Phase 4 awaits hardware',
    body: [
      'Everything in SRS phases 0–3 is functional end-to-end. Phase 4 code is complete — it needs a physical ESP32 flash, ACS712/water calibration, and a SIM800L AT smoke test.',
      'Optional next: MQTT auth hardening, Postgres migration, OTA updates.',
    ],
    icon: <ShieldCheck size={36} />,
  },
]

export function PresentationPage() {
  const [i, setI] = useState(0)
  const slide = slides[i]

  return (
    <div className="pres">
      <header className="pres-top">
        <Link to="/welcome" className="btn ghost sm">
          <ArrowLeft size={16} /> Site
        </Link>
        <span className="pres-count">
          {String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
      </header>

      <main className="pres-stage">
        <button
          className="pres-nav prev"
          aria-label="Previous slide"
          onClick={() => setI((v) => (v - 1 + slides.length) % slides.length)}
        >
          <ChevronLeft size={26} />
        </button>

        <section className="pres-slide" key={i}>
          <span className="landing-eyebrow">{slide.kicker}</span>
          <div className="pres-slide-body">
            <h1>{slide.title}</h1>
            {slide.icon ? <div className="landing-feature-icon">{slide.icon}</div> : null}
          </div>
          {slide.body.map((p, j) => (
            <p key={j} className="pres-lead">{p}</p>
          ))}
          {slide.bullets ? (
            <ul className="pres-bullets">
              {slide.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <button
          className="pres-nav next"
          aria-label="Next slide"
          onClick={() => setI((v) => (v + 1) % slides.length)}
        >
          <ChevronRight size={26} />
        </button>
      </main>

      <footer className="pres-dots">
        {slides.map((_, j) => (
          <button
            key={j}
            className={`landing-dot ${j === i ? 'active' : ''}`}
            aria-label={`Slide ${j + 1}`}
            onClick={() => setI(j)}
          />
        ))}
      </footer>
    </div>
  )
}
