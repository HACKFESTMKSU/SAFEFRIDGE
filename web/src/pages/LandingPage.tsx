import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LiveChart, type ChartPoint } from '../components/charts/LiveChart'
import { BandMeter } from '../components/charts/BandMeter'
import { CountUp } from '../components/ui/CountUp'
import { InkSplash, Pipeline } from '../components/landing/Graphics'
import { FridgeSim } from '../components/landing/FridgeSim'
import { sampleFridge } from '../components/landing/story'
import { prefersReducedMotion, useAos, useNow } from '../hooks/motion'
import { useTilt } from '../hooks/useTilt'

const FEED_EVERY = 2000
const FEED_POINTS = 45

const steps = [
  {
    title: 'Sense',
    text: 'An ESP32 in each unit reads temperature, humidity, pressure, compressor current and a leak sensor every minute.',
  },
  {
    title: 'Send',
    text: 'Readings travel over Wi-Fi to the ColdGuard server. When Wi-Fi drops, a SIM800L module still gets critical alerts out by SMS.',
  },
  {
    title: 'Decide',
    text: 'Every reading is checked against the unit’s safe range. Two breaches in a row open an incident, so one noisy reading never wakes anyone.',
  },
  {
    title: 'Act',
    text: 'Staff get the alert by app, email or SMS, acknowledge it, fix the cause and close it with a note for the audit trail.',
  },
]

const units = [
  {
    code: 'CG-001',
    name: 'Dispensary unit',
    keeps: 'Medicine cabinets and pharmacy cold shelves',
    min: 2,
    max: 8,
    example: 4.2,
  },
  {
    code: 'CG-002',
    name: 'Vaccine cold room',
    keeps: 'Walk-in cold rooms and vaccine stores',
    min: -25,
    max: -15,
    example: -19.4,
  },
  {
    code: 'CG-003',
    name: 'Produce storehouse',
    keeps: 'Warehouses, farm stores and food hubs for agricultural produce',
    min: 2,
    max: 8,
    example: 6.1,
  },
]

const pledges = [
  <>
    We <b>acknowledge</b> that a third of Kenya’s harvest is lost after it leaves the farm, much of it to
    cold storage that failed in silence.
  </>,
  <>
    We <b>believe</b> vaccines, insulin and medicine deserve a guaranteed 2 to 8°C, every hour of every day,
    for our patients and for future generations.
  </>,
  <>
    We <b>recognise</b> that power cuts and dead zones are the reality, so monitoring must keep working
    without the internet.
  </>,
  <>
    We are <b>committed</b> to affordable hardware, honest software and alerts that always get through, by
    app, email or GSM SMS.
  </>,
  <>
    We are <b>proud</b> to build for the hospitals, pharmacies, warehouses, farm storehouses and food hubs
    that feed and heal Kenya, and Africa.
  </>,
]

const roadmap = [
  {
    img: '/images/village_reach.jpg',
    place: 'Nairobi',
    title: 'HACKFEST MKSU build, first working prototype',
    date: 'Nov 2026',
    done: true,
  },
  {
    img: '/images/pharmacy_store.jpg',
    place: 'Lamu',
    title: 'Chemist and dispensary monitoring pilot',
    date: 'Next',
    done: false,
  },
  {
    img: '/images/produce_market.jpg',
    place: 'Kisumu',
    title: 'Produce warehouse and storehouse deployment',
    date: 'Planned',
    done: false,
  },
]

function useSampleFeed() {
  const [points, setPoints] = useState<ChartPoint[]>(() => {
    const now = Date.now()
    return Array.from({ length: FEED_POINTS }, (_, i) => {
      const t = now - (FEED_POINTS - 1 - i) * FEED_EVERY
      return { t, v: sampleFridge(t) }
    })
  })
  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setPoints((prev) => [...prev.slice(1), { t, v: sampleFridge(t) }])
    }, FEED_EVERY)
    return () => window.clearInterval(id)
  }, [])
  return points
}

export function LandingPage() {
  const { user } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  const heroVisual = useRef<HTMLDivElement>(null)
  useAos(root)
  useTilt(heroVisual)

  const feed = useSampleFeed()
  const clock = useNow(1000)
  const latest = feed[feed.length - 1]
  const feedDomain: [number, number] = [clock - (FEED_POINTS - 1) * FEED_EVERY, clock]
  const [step, setStep] = useState<number | null>(null)

  const demoTo = user ? '/' : '/login'
  const animated = !prefersReducedMotion()

  return (
    <div className="lp" ref={root}>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/welcome" className="brand-badge" aria-label="ColdGuard home">
            COLDGUARD
          </Link>
          <nav className="lp-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#try">Try it</a>
            <a href="#units">Units</a>
            <a href="#roadmap">Roadmap</a>
          </nav>
          <div className="lp-nav-cta">
            {user ? (
              <Link className="btn" to="/">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link className="btn secondary" to="/login">
                  Sign in
                </Link>
                <Link className="btn" to="/login">
                  Live demo
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-wrap lp-frame">
          <div className="lp-hero">
            <div>
              <h1 className="lp-h1">
                <span className="lp-line">
                  <span>It’s time.</span>
                </span>
                <span className="lp-line">
                  <span>Guard every</span>
                </span>
                <span className="lp-line">
                  <span>degree.</span>
                </span>
              </h1>
              <p className="lp-lede">
                ColdGuard watches fridges, freezers, cold rooms, and agricultural storehouses and warehouses
                that keep medicine, vaccines, and produce safe — and raises the alarm the moment conditions
                drift.
              </p>
              <div className="lp-cta-row">
                <Link className="btn lg" to={demoTo}>
                  Open the live demo
                </Link>
                <a className="btn lg secondary" href="#how">
                  See how it works
                </a>
              </div>
            </div>

            <div className="lp-hero-visual" ref={heroVisual}>
              <div className="lp-ink-wrap" aria-hidden="true">
                <InkSplash />
              </div>
              <div className="lp-tilt">
              <div className="lp-live-card">
                <span className="lp-live-blink" aria-hidden="true" />
                <p className="lp-marker">Iko baridi?</p>
                <div className="lp-temp" aria-live="off">
                  <CountUp value={latest.v} decimals={1} fromZeroOnView duration={1400} />
                  °C
                </div>
                <p className="lp-temp-cap">Pharmacy fridge, right now</p>
                <div className="lp-live-chart">
                  <LiveChart
                    points={feed}
                    label="Sample pharmacy fridge temperature"
                    unit="°C"
                    compact
                    live
                    height={92}
                    domain={feedDomain}
                    band={{ min: 2, max: 8 }}
                    gapMs={60_000}
                  />
                </div>
                <p className="lp-live-status">
                  <span className="status-dot ok" aria-hidden="true" />
                  In the safe range, 2 to 8°C
                </p>
                <Link className="lp-gradient-btn" to={demoTo}>
                  See every unit live
                </Link>
                <p className="lp-feed-note">Sample feed, new reading every 2 seconds</p>
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* SMS strip */}
        <section className="lp-strip" aria-label="SMS alerts">
          <div className="lp-wrap lp-strip-inner">
            <span className="lp-strip-tag">SMS</span>
            <div className="lp-strip-copy">
              <strong>Alerts still arrive when the Wi-Fi doesn’t.</strong>
              <span>A SIM800L module in each unit sends critical alerts over GSM.</span>
            </div>
            <p className="lp-sms">
              ColdGuard: Pharmacy Fridge A is at 10.4°C, above its 8°C limit. Check the door and power.
            </p>
            <a className="btn sm dark" href="#how">
              How alerts work
            </a>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="lp-wrap lp-frame">
          <div className="lp-section">
            <div className="lp-head" data-aos="fade-up">
              <h2 className="lp-h2">Sense. Send. Decide. Act.</h2>
              <p>
                Every unit runs the same loop around the clock. When the Wi-Fi drops, the alert still gets out
                by SMS.
              </p>
            </div>
            <div className="lp-pipe" data-aos="fade-up">
              <Pipeline animated={animated} active={step} />
            </div>
            <ol className="lp-steps" onMouseLeave={() => setStep(null)}>
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  data-aos="fade-up"
                  data-aos-delay={i * 90}
                  tabIndex={0}
                  className={step === i ? 'is-active' : ''}
                  onMouseEnter={() => setStep(i)}
                  onFocus={() => setStep(i)}
                  onBlur={() => setStep(null)}
                >
                  <span className="lp-step-n">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Playable simulator */}
        <section id="try" className="lp-wrap lp-frame">
          <div className="lp-section">
            <div className="lp-head" data-aos="fade-up">
              <h2 className="lp-h2">Try to spoil the vaccines</h2>
              <p>
                This is a simulated ColdGuard unit running at 150 times real speed. Open the door, cut the power
                or take the Wi-Fi down, then handle the alert like the pharmacist on duty would.
              </p>
            </div>
            <div data-aos="fade-up">
              <FridgeSim />
            </div>
          </div>
        </section>

        {/* Units */}
        <section id="units" className="lp-wrap lp-frame">
          <div className="lp-section">
            <div className="lp-head" data-aos="fade-up">
              <h2 className="lp-h2">One kit, three kinds of cold</h2>
              <p>
                The same sensor kit adapts to each store. Set the safe range once and ColdGuard checks every
                reading against it.
              </p>
            </div>
            <div className="lp-table-wrap" data-aos="fade-up">
              <table className="lp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Unit</th>
                    <th>What it protects</th>
                    <th>Safe range</th>
                    <th>Example reading</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={u.code}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <span className="lp-unit-name">
                          <i aria-hidden="true" />
                          {u.name}
                        </span>
                      </td>
                      <td>
                        <p className="lp-unit-desc">{u.keeps}</p>
                      </td>
                      <td className="mono">
                        {u.min} to {u.max}°C
                      </td>
                      <td>
                        <BandMeter value={u.example} min={u.min} max={u.max} tone="ok" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Manifesto */}
        <section id="about" className="lp-wrap lp-frame">
          <div className="lp-manifesto">
            <div className="lp-manifesto-photo" data-aos="fade-right">
              <img src="/images/ghana_vaccine.jpg" alt="Health worker preparing vaccines" loading="lazy" />
            </div>
            <div className="lp-manifesto-card" data-aos="fade-left">
              <h2>ColdGuard</h2>
              <p className="lp-manifesto-sub">Sisi ni walezi. We are the guardians.</p>
              {pledges.map((p, i) => (
                <p key={i} className="pledge">
                  {p}
                </p>
              ))}
              <div className="lp-manifesto-cta">
                <Link className="btn dark" to={demoTo}>
                  Open the live demo
                </Link>
                <a className="btn secondary" href="#units">
                  Our units
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="lp-dark">
          <div className="lp-wrap">
            <h2 className="lp-h2" data-aos="fade-up">
              Build and roadmap
            </h2>
            <p className="lp-dark-sub" data-aos="fade-up">
              Built at HACKFEST MKSU. Pilots come next, starting with chemists and food hubs.
            </p>
            <div className="lp-road">
              {roadmap.map((r, i) => (
                <article key={r.place} className="lp-road-card" data-aos="fade-up" data-aos-delay={i * 110}>
                  <img src={r.img} alt="" loading="lazy" />
                  <div className="lp-road-body">
                    <div className="lp-road-place">{r.place}</div>
                    <h3>{r.title}</h3>
                    <div className="lp-road-meta">
                      <span className={`lp-road-state ${r.done ? 'done' : ''}`}>{r.done ? 'Built' : 'Planned'}</span>
                      <span>{r.date}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Video */}
        <section className="lp-wrap lp-frame">
          <div className="lp-section">
            <div className="lp-head" data-aos="fade-up">
              <h2 className="lp-h2">Why the cold chain matters</h2>
              <p>A short CDC film on how vaccines stay cold from the factory to the clinic.</p>
            </div>
            <div className="lp-video-frame" data-aos="zoom-in">
              <video controls preload="metadata" poster="/images/ethiopia_vaccine.jpg">
                <source src="/videos/vaccine_logistics.webm" type="video/webm" />
              </video>
            </div>
            <p className="lp-credit">Video: CDC, COVID-19 vaccine logistics. Wikimedia Commons, public domain.</p>
          </div>
        </section>

        {/* Close */}
        <section className="lp-wrap lp-frame">
          <div className="lp-close" data-aos="fade-up">
            <h2 className="lp-h2">See every degree, live</h2>
            <div className="lp-close-cta">
              <Link className="btn lg" to={demoTo}>
                Open the live demo
              </Link>
              {user ? null : (
                <Link className="btn lg secondary" to="/login">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span className="brand-badge">COLDGUARD</span>
          <nav className="lp-footer-links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#try">Try it</a>
            <a href="#units">Units</a>
            <a href="#roadmap">Roadmap</a>
            <Link to="/login">Sign in</Link>
          </nav>
          <p className="lp-footer-copy">© 2026 ColdGuard. Built at HACKFEST MKSU by Team ColdGuard.</p>
        </div>
      </footer>
    </div>
  )
}
