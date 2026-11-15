import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BellRing,
  Boxes,
  Cpu,
  History,
  LineChart,
  MessageSquareText,
  Radio,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    icon: <Thermometer size={22} />,
    title: 'Live cold-chain telemetry',
    text: 'Temperature, humidity, pressure, compressor current and water-leak readings from every unit, refreshed in real time.',
  },
  {
    icon: <BellRing size={22} />,
    title: 'Threshold incidents',
    text: 'Sustained excursions automatically open incidents with severity, evidence and recommended actions for your team.',
  },
  {
    icon: <Radio size={22} />,
    title: 'Works when Wi-Fi dies',
    text: 'ESP32 buffers readings during outages and fires critical SMS alerts over GSM via SIM800L — no cloud required.',
  },
  {
    icon: <LineChart size={22} />,
    title: '24-hour history',
    text: 'Per-asset charts of temperature, humidity and current so technicians can spot drift before it becomes a failure.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Role-based access',
    text: 'Admin, Operator and Technician roles keep configuration, response and maintenance duties cleanly separated.',
  },
  {
    icon: <MessageSquareText size={22} />,
    title: 'Maintenance notes',
    text: 'Technicians log inspections and repairs against assets and incidents — full audit trail for every cold unit.',
  },
]

const steps = [
  {
    n: '01',
    icon: <Cpu size={20} />,
    title: 'Sense',
    text: 'ESP32 reads DHT11, BMP180, ACS712 and water sensors every 60 seconds on the shelf, inside the cold room or under the fridge.',
  },
  {
    n: '02',
    icon: <Radio size={20} />,
    title: 'Transmit',
    text: 'Readings publish over MQTT as they happen. If connectivity drops, the device buffers locally and replays on reconnect.',
  },
  {
    n: '03',
    icon: <Activity size={20} />,
    title: 'Respond',
    text: 'The dashboard shows live status, threshold rules open incidents, and operators acknowledge, resolve and escalate — by app or SMS.',
  },
]

const roles = [
  { role: 'Admin', who: 'System owner', can: 'Users, assets, devices, thresholds, full visibility' },
  { role: 'Operator', who: 'Facility staff', can: 'Live assets, alerts, acknowledge & resolve incidents' },
  { role: 'Technician', who: 'Maintenance', can: 'History, diagnostics, maintenance notes' },
]

export function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-brand">
            <div className="brand-mark">
              <Snowflake size={20} />
            </div>
            <div className="brand-text">
              <strong>ColdGuard</strong>
              <span>Cold-chain intelligence</span>
            </div>
          </Link>
          <nav className="landing-links">
            <a href="#platform">Platform</a>
            <a href="#how">How it works</a>
            <a href="#roles">Roles</a>
          </nav>
          <div className="landing-nav-cta">
            {user ? (
              <Link className="btn" to="/">
                Open dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link className="btn secondary" to="/login">
                  Sign in
                </Link>
                <Link className="btn" to="/login">
                  Live demo <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">
            <Snowflake size={14} /> ESP32 · MQTT · GSM SMS
          </span>
          <h1>
            Every degree matters.
            <br />
            <span className="landing-h1-accent">Guard the cold chain.</span>
          </h1>
          <p className="landing-sub">
            ColdGuard monitors fridges, freezers and cold rooms across African
            healthcare and food facilities — live telemetry, threshold
            incidents, and GSM SMS alerts that still fire when Wi-Fi doesn't.
          </p>
          <div className="landing-hero-actions">
            <Link className="btn lg" to="/login">
              {user ? 'Open dashboard' : 'Explore the live demo'} <ArrowRight size={17} />
            </Link>
            <a className="btn secondary lg" href="#platform">
              See the platform
            </a>
          </div>
          <div className="landing-hero-meta">
            <span><Boxes size={15} /> Fridges, freezers &amp; cold boxes</span>
            <span><History size={15} /> 24h telemetry history</span>
            <span><Users size={15} /> 3 role-based access levels</span>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-card">
            <img src="/images/africa.png" alt="Africa — ColdGuard coverage" />
            <div className="landing-float landing-float-temp">
              <Thermometer size={16} />
              <div>
                <strong>4.2°C</strong>
                <span>Pharmacy Fridge A · live</span>
              </div>
            </div>
            <div className="landing-float landing-float-incident">
              <BellRing size={16} />
              <div>
                <strong>Critical</strong>
                <span>Vaccine Freezer B · −10.2°C</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-stat">
          <strong>6</strong>
          <span>Sensor channels per unit</span>
        </div>
        <div className="landing-stat">
          <strong>60s</strong>
          <span>Sampling interval</span>
        </div>
        <div className="landing-stat">
          <strong>3</strong>
          <span>User roles, zero ambiguity</span>
        </div>
        <div className="landing-stat">
          <strong>24/7</strong>
          <span>Monitoring &amp; alerting</span>
        </div>
      </section>

      <section id="platform" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Platform</span>
          <h2>Built for the realities of African cold storage</h2>
          <p>
            Power cuts, weak signal and remote sites are the norm. ColdGuard is
            designed so a single fridge failure never becomes a silent
            vaccine spoilage event.
          </p>
        </div>
        <div className="landing-features">
          {features.map((f) => (
            <article key={f.title} className="landing-feature">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="landing-section landing-how">
        <div className="landing-section-head">
          <span className="landing-eyebrow">How it works</span>
          <h2>From sensor to SMS in three steps</h2>
        </div>
        <div className="landing-steps">
          {steps.map((s) => (
            <article key={s.n} className="landing-step">
              <div className="landing-step-top">
                <span className="landing-step-num">{s.n}</span>
                <div className="landing-feature-icon">{s.icon}</div>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roles" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Access control</span>
          <h2>Everyone sees what they need — nothing more</h2>
        </div>
        <div className="landing-roles">
          {roles.map((r) => (
            <article key={r.role} className="landing-role">
              <h3>{r.role}</h3>
              <span className="landing-role-who">{r.who}</span>
              <p>{r.can}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <h2>See it live — no hardware required</h2>
          <p>
            The demo dashboard ships with seeded fridges, a freezer excursion
            and a device-offline scenario. Sign in and explore.
          </p>
        </div>
        <Link className="btn lg light" to="/login">
          Open live demo <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-brand">
            <div className="brand-mark">
              <Snowflake size={18} />
            </div>
            <div className="brand-text">
              <strong>ColdGuard</strong>
              <span>Cold-chain intelligence</span>
            </div>
          </div>
          <p>
            ESP32 edge sensing · MQTT telemetry · threshold incidents · GSM SMS
            fallback. Built for hackathon demonstration.
          </p>
          <span className="landing-footer-copy">© 2026 ColdGuard · HACKFEST MKSU</span>
        </div>
      </footer>
    </div>
  )
}
