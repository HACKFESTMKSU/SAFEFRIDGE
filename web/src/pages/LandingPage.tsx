import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { BrandLogo } from '../components/BrandLogo'
import { LiveChart, type ChartPoint } from '../components/charts/LiveChart'
import { BandMeter } from '../components/charts/BandMeter'
import { CountUp } from '../components/ui/CountUp'
import { InkSplash, Pipeline } from '../components/landing/Graphics'
import { FridgeSim } from '../components/landing/FridgeSim'
import { sampleFridge } from '../components/landing/story'
import { prefersReducedMotion, useAos, useNow } from '../hooks/motion'
import { useTilt } from '../hooks/useTilt'
import { useMedia } from '../hooks/useMedia'

const FEED_EVERY = 2000
const FEED_POINTS = 45

const steps = [
  {
    title: 'Sense',
    text: 'An ESP32 in each cold room or storehouse reads temperature, humidity, compressor current and a leak sensor on a short interval.',
  },
  {
    title: 'See',
    text: 'Vision characterizes the crop in the room (demo: short video upload; production: facility camera). Different produce needs different safe bands.',
  },
  {
    title: 'Decide',
    text: 'Claude (or a produce catalog) applies the right thresholds. Every reading is checked against that crop’s band — two breaches open an incident.',
  },
  {
    title: 'Act',
    text: 'Staff get the alert by app, email or SMS, acknowledge it, fix the cause and close it with a note. GSM SMS still works when Wi-Fi is down.',
  },
]

const units = [
  {
    code: 'CG-001',
    name: 'Tomato cold room',
    keeps: 'Aggregation hubs and market cool stores for tomatoes',
    min: 10,
    max: 15,
    example: 12.1,
  },
  {
    code: 'CG-002',
    name: 'Mango storehouse',
    keeps: 'Post-harvest cool stores for mango and similar fruit',
    min: 10,
    max: 13,
    example: 11.4,
  },
  {
    code: 'CG-003',
    name: 'Potato warehouse',
    keeps: 'Farm and warehouse zones for roots and tubers',
    min: 4,
    max: 10,
    example: 7.2,
  },
]

const pledges = [
  <>
    We <b>acknowledge</b> that a large share of Kenya’s harvest is lost after it leaves the farm, much of it to
    cold storage that failed in silence.
  </>,
  <>
    We <b>believe</b> mangoes, potatoes, tomatoes and leafy greens deserve crop-specific safe bands — not one
    generic threshold for every storehouse.
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
    We are <b>proud</b> to build for the farms, markets, food hubs and warehouses that feed Kenya, and Africa.
  </>,
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

const LP_SECTIONS = [
  { href: '#how', label: 'How it works' },
  { href: '#try', label: 'Try it' },
  { href: '#units', label: 'Units' },
  { href: '#roadmap', label: 'Roadmap' },
] as const

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
  const [menuOpen, setMenuOpen] = useState(false)
  const compactNav = useMedia('(max-width: 1040px)')

  const demoTo = user ? '/' : '/login'
  const animated = !prefersReducedMotion()

  useEffect(() => {
    if (!compactNav) setMenuOpen(false)
  }, [compactNav])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`lp${menuOpen ? ' lp-menu-open' : ''}`} ref={root}>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <BrandLogo to="/welcome" size="md" aria-label="ColdGuard home" onClick={closeMenu} />
          <nav className="lp-links" aria-label="Sections">
            {LP_SECTIONS.map((s) => (
              <a key={s.href} href={s.href}>
                {s.label}
              </a>
            ))}
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
            <button
              type="button"
              className="lp-menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="lp-mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="lp-wrap lp-mobile-panel" id="lp-mobile-nav">
            <nav className="lp-mobile-links" aria-label="Sections">
              {LP_SECTIONS.map((s) => (
                <a key={s.href} href={s.href} onClick={closeMenu}>
                  {s.label}
                </a>
              ))}
            </nav>
            <div className="lp-mobile-cta">
              {user ? (
                <Link className="btn" to="/" onClick={closeMenu}>
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link className="btn secondary" to="/login" onClick={closeMenu}>
                    Sign in
                  </Link>
                  <Link className="btn" to="/login" onClick={closeMenu}>
                    Live demo
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>
      {menuOpen ? <div className="lp-menu-backdrop" onClick={closeMenu} aria-hidden="true" /> : null}

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
                ColdGuard watches cold rooms, storehouses, food hubs, and warehouses that hold perishable
                produce — sees which crop is stored, adapts the safe band, and raises the alarm the moment
                conditions drift.
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
                <p className="lp-temp-cap">Tomato storehouse, right now</p>
                <div className="lp-live-chart">
                  <LiveChart
                    points={feed}
                    label="Sample tomato storehouse temperature"
                    unit="°C"
                    compact
                    live
                    height={92}
                    domain={feedDomain}
                    band={{ min: 10, max: 15 }}
                    gapMs={60_000}
                  />
                </div>
                <p className="lp-live-status">
                  <span className="status-dot ok" aria-hidden="true" />
                  In the tomato band, 10 to 15°C
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
              ColdGuard: Produce Storehouse A is at 17.4°C, above its 15°C tomato limit. Check the door and
              power.
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
              <h2 className="lp-h2">Sense. See. Decide. Act.</h2>
              <p>
                Every storehouse runs the same loop around the clock — sensors plus crop-aware thresholds.
                When the Wi-Fi drops, the alert still gets out by SMS.
              </p>
            </div>
            <div className="lp-pipe" data-aos="fade-up">
              <Pipeline animated={animated} active={step} />
            </div>
            <ol className="lp-steps">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  tabIndex={0}
                  className={step === i ? 'is-active' : ''}
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
              <h2 className="lp-h2">Try to spoil the produce</h2>
              <p>
                This is a simulated tomato storehouse running at 150 times real speed. Open the door, cut the
                power or take the Wi-Fi down, then handle the alert like the operator on duty would.
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
              <h2 className="lp-h2">One kit, many crops</h2>
              <p>
                The same sensor kit watches every zone. Vision (or a manual pick) sets the crop profile;
                ColdGuard checks every reading against that band.
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
              <img src="/images/produce_market.jpg" alt="Fresh produce at a market storehouse" loading="lazy" />
            </div>
            <div className="lp-manifesto-card" data-aos="fade-left">
              <h2>ColdGuard</h2>
              <p className="lp-manifesto-sub">Sisi ni walezi. We guard the harvest.</p>
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

        {/* Why it matters */}
        <section className="lp-wrap lp-frame">
          <div className="lp-section">
            <div className="lp-head" data-aos="fade-up">
              <h2 className="lp-h2">Why the agri cold chain matters</h2>
              <p>
                Post-harvest losses drain farms and markets. Quiet failures in storehouses and cold rooms turn
                good harvests into waste — unless someone is watching every degree.
              </p>
            </div>
            <div className="lp-table-wrap" data-aos="fade-up" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <figure style={{ margin: 0 }}>
                <img
                  src="/images/cold_room.jpg"
                  alt="Cold room used for produce storage"
                  loading="lazy"
                  style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 8 }}
                />
                <figcaption className="lp-credit">Cold rooms and cool stores for perishable crops</figcaption>
              </figure>
              <figure style={{ margin: 0 }}>
                <img
                  src="/images/produce_market.jpg"
                  alt="Produce market and aggregation point"
                  loading="lazy"
                  style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 8 }}
                />
                <figcaption className="lp-credit">Markets and food hubs where stock waits overnight</figcaption>
              </figure>
            </div>
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
          <BrandLogo size="sm" />
          <nav className="lp-footer-links" aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#try">Try it</a>
            <a href="#units">Units</a>
            <Link to="/login">Sign in</Link>
          </nav>
          <p className="lp-footer-copy">© 2026 ColdGuard. Built at HACKFEST MKSU by Team ColdGuard.</p>
        </div>
      </footer>
    </div>
  )
}
