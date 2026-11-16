import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const units = [
  {
    name: 'CG-001 · Dispensary Unit',
    desc: 'Compact monitor for medicine cabinets and pharmacy cold shelves — temperature, humidity, current and leak sensing.',
    tag: '2–8°C',
  },
  {
    name: 'CG-002 · Vaccine Cold Room',
    desc: 'Deep-cold monitoring for vaccine stores and walk-in cold rooms — critical excursion alerts included.',
    tag: '−25 to −15°C',
  },
  {
    name: 'CG-003 · Fresh Produce Store',
    desc: 'Cold storage for markets, food hubs and aggregation centres — keeps fruit, vegetables and dairy safe.',
    tag: '2–8°C',
  },
]

const features = [
  { title: 'Live telemetry', text: 'Temperature, humidity, pressure, power draw and leak readings refreshed every 60 seconds.' },
  { title: 'Automatic incidents', text: 'Sustained breaches open incidents with recommended actions — no alert spam, auto-close on recovery.' },
  { title: 'GSM SMS fallback', text: 'Critical alerts still arrive by SMS over a SIM card when Wi-Fi is down.' },
  { title: '24-hour history', text: 'Per-unit charts reveal slow drift before it becomes a total loss.' },
  { title: 'Role-based access', text: 'Admin, Operator and Technician roles keep duties cleanly separated.' },
  { title: 'Maintenance log', text: 'Full audit trail of inspections, repairs and incident resolutions.' },
]

const problems = [
  {
    title: 'Food goes to waste silently',
    text: 'Kenya loses a third of its harvest after it leaves the farm. A failed cold room overnight writes off a full stock of produce, dairy or fish — before anyone even checks the thermometer.',
  },
  {
    title: 'Medicine loses its power',
    text: 'Vaccines and insulin must stay between 2°C and 8°C. One unnoticed excursion makes a whole batch useless — and dangerous if it is still given to patients.',
  },
  {
    title: 'Nobody is watching',
    text: 'Facilities rely on staff walking in and checking manually. Failures happen at night, on weekends and during power cuts — exactly when no one is looking.',
  },
]

const steps = [
  { n: '01', title: 'Sense', text: 'A small ESP32 device sits on each unit and reads six sensor channels every minute — no internet required to detect a problem.' },
  { n: '02', title: 'Send', text: 'Readings travel over MQTT. When connectivity drops, the device buffers data locally and replays it on reconnect.' },
  { n: '03', title: 'Respond', text: 'The dashboard opens incidents the moment limits are breached. Critical alerts also go out by GSM SMS — even with zero internet.' },
]

const slides = [
  { src: '/images/village_reach.jpg', alt: 'Cold chain delivery', caption: 'Protecting the cold chain from the first mile' },
  { src: '/images/ghana_vaccine.jpg', alt: 'Vaccine preparation', caption: 'Every dose depends on a working cold unit' },
  { src: '/images/ethiopia_vaccine.jpg', alt: 'Health worker with vaccines', caption: 'Last-mile delivery needs last-mile monitoring' },
  { src: '/images/cold_room.jpg', alt: 'Cold storage room', caption: 'Every unit under one view' },
  { src: '/images/africa.png', alt: 'Map of Africa', caption: 'Built for Africa, starting with Kenya' },
]

export function LandingPage() {
  const { user } = useAuth()
  const [slide, setSlide] = useState(0)
  const [quoteSent, setQuoteSent] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', unit: 'Dispensary / pharmacy unit', need: 'Ongoing monitoring' })

  function onQuote(e: FormEvent) {
    e.preventDefault()
    const body = encodeURIComponent(
      `ColdGuard quote request\nName: ${form.name}\nPhone: ${form.phone}\nUnit type: ${form.unit}\nNeed: ${form.need}`,
    )
    window.location.href = `mailto:hello@coldguard.local?subject=ColdGuard%20quote&body=${body}`
    setQuoteSent(true)
  }

  return (
    <div className="landing">
      {/* NAV */}
      <header className="rv-nav">
        <div className="rv-nav-inner">
          <Link to="/" className="landing-brand">
            <span className="brand-word">COLDGUARD</span>
            <span className="brand-sub">Cold-chain protection</span>
          </Link>
          <nav className="landing-links">
            <a href="#problem">The problem</a>
            <a href="#units">Units</a>
            <a href="#features">Features</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="landing-nav-cta">
            {user ? (
              <Link className="btn" to="/">Open dashboard</Link>
            ) : (
              <>
                <Link className="btn secondary" to="/login">Sign in</Link>
                <Link className="btn" to="/login">Live demo</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="rv-hero">
        <div className="rv-hero-copy">
          <span className="landing-eyebrow">Cold-chain protection for Kenya</span>
          <h1>Every dose protected. Every harvest saved.</h1>
          <p className="landing-sub">
            ColdGuard is an IoT monitoring system that watches medicine cold storage
            and fresh-food storage around the clock — detecting failures the moment
            they begin and alerting your team even when the internet is down.
          </p>
          <div className="rv-hero-points">
            <p><strong>1 in 3</strong> harvests in Kenya are lost after farm gate — much of it to broken cold storage.</p>
            <p><strong>2–8°C</strong> is the window vaccines and insulin must hold. One breach can ruin a batch.</p>
            <p><strong>24/7</strong> automated monitoring with instant SMS — even without Wi-Fi.</p>
          </div>
          <div className="rv-hero-img">
            <img src="/images/village_reach.jpg" alt="Cold chain delivery in East Africa" />
            <span className="rv-hero-img-tag">Live cold-chain monitoring</span>
          </div>
        </div>

        {/* QUOTE FORM */}
        <form className="rv-quote" onSubmit={onQuote}>
          <h3>Get a quote</h3>
          <p className="rv-quote-sub">Tell us about your facility — we reply with a no-obligation quote.</p>
          <div className="field"><label>Name</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" /></div>
          <div className="field"><label>Contact number</label><input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+254 7XX XXX XXX" /></div>
          <div className="field">
            <label>Unit type</label>
            <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
              <option>Dispensary / pharmacy unit</option>
              <option>Vaccine cold room</option>
              <option>Produce / food cold store</option>
              <option>Cold box / portable</option>
              <option>Multiple units</option>
            </select>
          </div>
          <div className="field">
            <label>How long do you need monitoring?</label>
            <select value={form.need} onChange={e=>setForm({...form,need:e.target.value})}>
              <option>Pilot (1–3 months)</option>
              <option>Ongoing monitoring</option>
              <option>Full facility rollout</option>
            </select>
          </div>
          <button className="btn" type="submit">Request a quote</button>
          {quoteSent && <p className="rv-quote-ok">Opening your email app — quote request drafted.</p>}
          <div className="rv-quote-contact">
            <span>hello@coldguard.local</span>
            <span>+254 700 000 000</span>
            <span>Nairobi, Kenya</span>
          </div>
        </form>
      </section>

      {/* TRUSTED STRIP */}
      <section className="rv-trusted">
        <p>Built for hospitals, pharmacies, food hubs and markets across Kenya</p>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">The problem</span>
          <h2>Cold storage fails silently — and the waste is enormous</h2>
          <p>Across Kenya, food and medicine are lost every day to cold-unit failures that nobody saw coming.</p>
        </div>
        <div className="rv-problems">
          {problems.map((p, i) => (
            <article key={p.title} className="rv-problem">
              <span className="rv-problem-n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">How it works</span>
          <h2>Sense. Send. Respond.</h2>
        </div>
        <div className="rv-steps">
          {steps.map((s) => (
            <article key={s.n} className="rv-step">
              <span className="rv-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* UNITS */}
      <section id="units" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Our units</span>
          <h2>Monitoring for every cold application</h2>
          <p>One platform, three deployments — all share the same dashboard and alert engine.</p>
        </div>
        <div className="rv-units">
          {units.map((u) => (
            <article key={u.name} className="rv-unit">
              <div className="rv-unit-top">
                <h3>{u.name}</h3>
                <span className="rv-unit-tag">{u.tag}</span>
              </div>
              <p>{u.desc}</p>
              <Link className="btn secondary sm" to="/login">See live demo</Link>
            </article>
          ))}
        </div>
      </section>

      {/* SLIDER */}
      <section className="landing-slider" aria-label="Cold chain in Africa">
        <div className="landing-slider-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {slides.map((s) => (
            <figure key={s.src} className="landing-slide">
              <img src={s.src} alt={s.alt} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <button className="landing-slider-btn prev" aria-label="Previous" onClick={()=>setSlide((s)=>(s-1+slides.length)%slides.length)}>‹</button>
        <button className="landing-slider-btn next" aria-label="Next" onClick={()=>setSlide((s)=>(s+1)%slides.length)}>›</button>
        <div className="landing-slider-dots">
          {slides.map((_,i)=>(<button key={i} className={`landing-dot ${i===slide?'active':''}`} aria-label={`Slide ${i+1}`} onClick={()=>setSlide(i)}/>))}
        </div>
      </section>

      {/* VIDEO */}
      <section className="landing-section rv-video">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Watch</span>
          <h2>Why the cold chain matters</h2>
          <p>How vaccines travel from manufacture to patient — and where monitoring fits in.</p>
        </div>
        <div className="rv-video-card">
          <video controls preload="metadata" poster="/images/ghana_vaccine.jpg">
            <source src="/videos/vaccine_logistics.webm" type="video/webm" />
            Your browser does not support the video tag.
          </video>
          <p className="rv-video-credit">Video: CDC — COVID-19 vaccine logistics (Wikimedia Commons, public domain)</p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Features</span>
          <h2>Everything a facility needs to stop wastage</h2>
        </div>
        <div className="landing-features">
          {features.map((f) => (
            <article key={f.title} className="landing-feature">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section className="landing-section rv-about">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Why we built it</span>
          <h2>Technology that pays for itself the first time it saves a batch</h2>
        </div>
        <div className="rv-about-grid">
          <div>
            <p>
              ColdGuard started at HACKFEST MKSU with a simple question: why do cold
              units across Africa fail silently? We built the complete system — ESP32
              firmware, MQTT pipeline, cloud backend, live dashboard and GSM SMS
              fallback — and it works end-to-end today.
            </p>
            <p>
              A single protected batch of vaccines or a saved stock of fresh produce
              covers the cost of a unit many times over. That is the return we design
              for: affordable hardware, honest software, and alerts that always get
              through.
            </p>
          </div>
          <div className="rv-about-stats">
            <div className="landing-stat"><strong>6</strong><span>Sensor channels</span></div>
            <div className="landing-stat"><strong>60s</strong><span>Sampling interval</span></div>
            <div className="landing-stat"><strong>3</strong><span>User roles</span></div>
            <div className="landing-stat"><strong>24/7</strong><span>Monitoring</span></div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="landing-section rv-contact">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Contact us</span>
          <h2>Talk to the team</h2>
          <p>Questions about units, pricing or pilots — send us a message.</p>
        </div>
        <form className="rv-contact-form" onSubmit={onQuote}>
          <div className="field"><label>Name</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
          <div className="field"><label>Email address</label><input type="email" placeholder="you@facility.org" /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label>Leave a message</label><textarea rows={4} placeholder="Tell us about your cold storage needs…" /></div>
          <button className="btn" type="submit">Submit</button>
        </form>
        <div className="rv-contact-info">
          <img src="/images/cold_room.jpg" alt="Cold storage room" className="rv-contact-img" />
          <h3>ColdGuard</h3>
          <p>hello@coldguard.local</p>
          <p>+254 700 000 000</p>
          <p>Nairobi, Kenya</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-brand">
            <span className="brand-word">COLDGUARD</span>
            <span className="brand-sub">Cold-chain protection</span>
          </div>
          <p>ESP32 edge sensing · MQTT telemetry · automatic incidents · GSM SMS fallback. Built for hackathon demonstration.</p>
          <span className="landing-footer-copy">© 2026 ColdGuard · HACKFEST MKSU</span>
        </div>
      </footer>
    </div>
  )
}
