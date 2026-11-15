import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BellRing,
  Boxes,
  Cpu,
  ChevronLeft,
  ChevronRight,
  History,
  LineChart,
  MessageSquareText,
  PlugZap,
  Radio,
  ShieldCheck,
  Snowflake,
  Thermometer,
  TrendingDown,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const problems = [
  {
    icon: <Thermometer size={20} />,
    title: 'Silent excursions',
    text: 'From Nairobi hospitals to county clinics across Kenya, a fridge door left ajar or a failing compressor can push a unit out of range for hours — and nobody knows until the stock is already spoiled.',
  },
  {
    icon: <PlugZap size={20} />,
    title: 'Unreliable power & signal',
    text: 'Kenya Power brownouts and dead zones in rural counties are everyday realities. Cloud-only monitors go blind exactly when facilities need them most.',
  },
  {
    icon: <TrendingDown size={20} />,
    title: 'Costly losses',
    text: 'Vaccines under the Kenya immunisation programme, insulin and fresh produce represent enormous investment. One unnoticed failure can write off an entire batch.',
  },
]

const slides = [
  {
    src: '/images/village_reach.jpg',
    alt: 'Vaccine cold chain storage in Mozambique',
    caption: 'The cold chain starts at the shelf — not the dashboard',
  },
  {
    src: '/images/ghana_vaccine.jpg',
    alt: 'Nurse preparing a COVID-19 vaccine in Ghana',
    caption: 'Every dose depends on a working cold unit',
  },
  {
    src: '/images/ethiopia_vaccine.jpg',
    alt: 'Nurse preparing a measles vaccine in Ethiopia',
    caption: 'Last-mile delivery needs last-mile monitoring',
  },
  {
    src: '/images/cold_room.jpg',
    alt: 'Cold storage room in Namibia',
    caption: 'Cold rooms, pharmacies and freezers — all under one view',
  },
  {
    src: '/images/africa.png',
    alt: 'Map of Africa',
    caption: 'Built for facilities across Africa, starting with Kenya',
  },
]

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
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000)
    return () => clearInterval(t)
  }, [])

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
            <a href="#problem">The problem</a>
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
            Cold storage fails silently.
            <br />
            <span className="landing-h1-accent">We make it speak up.</span>
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
            <a className="btn secondary lg" href="#problem">
              See the problem
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
            <img src="/images/village_reach.jpg" alt="Vaccine cold chain storage in Mozambique" />
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

      <section id="problem" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">The problem</span>
          <h2>When a cold unit drifts, nobody gets the memo</h2>
          <p>
            Across Kenyan hospitals, county clinics, pharmacies and food hubs
            — and the wider African cold chain — failures are almost always
            discovered too late.
          </p>
        </div>
        <div className="landing-ps">
          <div className="landing-problem">
            {problems.map((p) => (
              <article key={p.title} className="landing-ps-card">
                <div className="landing-feature-icon">{p.icon}</div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
          <div className="landing-solution">
            <img src="/images/ghana_vaccine.jpg" alt="Nurse preparing a COVID-19 vaccine in Ghana" />
            <div className="landing-solution-copy">
              <span className="landing-eyebrow">The solution</span>
              <h3>ColdGuard watches every unit, all the time</h3>
              <p>
                An ESP32 on each fridge reads temperature, humidity, pressure,
                compressor current and leaks — publishing over MQTT and raising
                incidents the moment readings leave safe bounds. If Wi-Fi dies,
                critical conditions still trigger SMS over GSM.
              </p>
              <Link className="btn" to="/login">
                See it working <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-slider" aria-label="Cold-chain in Africa">
        <div className="landing-slider-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {slides.map((s) => (
            <figure key={s.src} className="landing-slide">
              <img src={s.src} alt={s.alt} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <button
          className="landing-slider-btn prev"
          aria-label="Previous image"
          onClick={() => setSlide((s) => (s - 1 + slides.length) % slides.length)}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="landing-slider-btn next"
          aria-label="Next image"
          onClick={() => setSlide((s) => (s + 1) % slides.length)}
        >
          <ChevronRight size={20} />
        </button>
        <div className="landing-slider-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`landing-dot ${i === slide ? 'active' : ''}`}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setSlide(i)}
            />
          ))}
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
