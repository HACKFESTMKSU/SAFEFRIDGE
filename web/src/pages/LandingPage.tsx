import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const manifesto = [
  <>We <b>ACKNOWLEDGE</b> that a third of Kenya's harvest is lost after it leaves the farm — much of it to cold storage that failed <i>in silence</i>.</>,
  <>We <b>BELIEVE</b> vaccines, insulin and medicine deserve a guaranteed 2–8°C — every hour of every day, for our patients and our <i>future generations</i>.</>,
  <>We <b>RECOGNISE</b> that power cuts and dead zones are the reality — so monitoring must keep working <b>without</b> the internet.</>,
  <>We are <b>COMMITTED</b> to affordable hardware, honest software and alerts that always get through — by app, email or <b>GSM SMS</b>.</>,
  <>We are <b>PROUD</b> to build for the hospitals, pharmacies, food hubs and markets that feed and heal <b>Kenya — and Africa</b>.</>,
]

const events = [
  { img: '/images/village_reach.jpg', place: 'NAIROBI', title: 'HACKFEST MKSU Build — First Working Prototype', date: 'Nov 2026' },
  { img: '/images/pharmacy_store.jpg', place: 'LAMU', title: 'Chemist & Dispensary Monitoring — Pilot Site', date: 'Planned' },
  { img: '/images/produce_market.jpg', place: 'KISUMU', title: 'Food Hub Deployment — Fresh Produce', date: 'Planned' },
]

const features = [
  { title: 'Live telemetry', text: 'Temperature, humidity, pressure, power draw and leak readings refreshed every 60 seconds.' },
  { title: 'Automatic incidents', text: 'Sustained breaches open incidents with recommended actions — no alert spam, auto-close on recovery.' },
  { title: 'GSM SMS fallback', text: 'Critical alerts still arrive by SMS over a SIM card when Wi-Fi is down.' },
  { title: '24-hour history', text: 'Per-unit charts reveal slow drift before it becomes a total loss.' },
  { title: 'Role-based access', text: 'Admin, Operator and Technician roles keep duties cleanly separated.' },
  { title: 'Maintenance log', text: 'Full audit trail of inspections, repairs and incident resolutions.' },
]

const units = [
  { name: 'CG-001 · Dispensary Unit', desc: 'Medicine cabinets and pharmacy cold shelves — temperature, humidity, current and leak sensing.', tag: '2–8°C' },
  { name: 'CG-002 · Vaccine Cold Room', desc: 'Walk-in cold rooms and vaccine stores — critical excursion alerts built in.', tag: '−25 to −15°C' },
  { name: 'CG-003 · Fresh Produce Store', desc: 'Markets, food hubs and aggregation centres — keeps fruit, vegetables and dairy safe.', tag: '2–8°C' },
]

const slides = [
  { src: '/images/village_reach.jpg', alt: 'Cold chain delivery', caption: 'Protecting the cold chain from the first mile' },
  { src: '/images/ghana_vaccine.jpg', alt: 'Vaccine preparation', caption: 'Every dose depends on a working cold unit' },
  { src: '/images/ethiopia_vaccine.jpg', alt: 'Health worker with vaccines', caption: 'Last-mile delivery needs last-mile monitoring' },
  { src: '/images/produce_market.jpg', alt: 'Fresh vegetable market in Kiambu, Kenya', caption: 'Fresh produce deserves fresh storage' },
  { src: '/images/africa.png', alt: 'Map of Africa', caption: 'Built for Africa, starting with Kenya' },
]

export function LandingPage() {
  const { user } = useAuth()
  const [slide, setSlide] = useState(0)
  const [form, setForm] = useState({ name: '', phone: '', unit: 'Dispensary / pharmacy unit', need: 'Ongoing monitoring' })

  function onQuote(e: FormEvent) {
    e.preventDefault()
    const body = encodeURIComponent(
      `ColdGuard quote request\nName: ${form.name}\nPhone: ${form.phone}\nUnit type: ${form.unit}\nNeed: ${form.need}`,
    )
    window.location.href = `mailto:hello@coldguard.local?subject=ColdGuard%20quote&body=${body}`
  }

  return (
    <div className="landing">
      {/* NAV */}
      <header className="rv-nav">
        <div className="rv-nav-inner">
          <Link to="/" className="landing-brand">
            <span className="brand-badge">COLDGUARD</span>
          </Link>
          <nav className="landing-links">
            <a href="#manifesto">About</a>
            <a href="#units">Units</a>
            <a href="#events">Deployments</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="landing-nav-cta">
            {user ? (
              <Link className="btn" to="/">Open dashboard</Link>
            ) : (
              <>
                <Link className="btn dark" to="/login">Sign in</Link>
                <Link className="btn" to="/login">Live demo</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="rv-hero">
        <div className="rv-hero-copy">
          <h1>It's time.<br />Guard every<br />degree.</h1>
          <p className="landing-sub">
            A hackathon-built IoT platform that monitors the cold storage your
            medicines, vaccines and fresh food depend on — working end-to-end today.
          </p>
        </div>
        <div className="rv-monitor">
          <div className="rv-monitor-head">
            <span className="rv-monitor-dot" />
            <span>Unit CG-001 · live</span>
            <span className="rv-monitor-time">just now</span>
          </div>
          <div className="rv-monitor-temp">4.2°C</div>
          <div className="rv-monitor-rows">
            <div><span>Humidity</span><b>58%</b></div>
            <div><span>Power draw</span><b>1.4 A</b></div>
            <div><span>Leaks</span><b>None</b></div>
            <div><span>Status</span><b className="ok">Safe range</b></div>
          </div>
          <div className="rv-monitor-band">
            <span>2°C</span>
            <div className="rv-monitor-bar"><span style={{width:'55%'}} /></div>
            <span>8°C</span>
          </div>
          <a className="rv-monitor-link" href="#manifesto">How we keep every unit in range →</a>
        </div>
      </section>

      {/* DEMO STRIP — M-Pesa-style band */}
      <section className="rv-paystrip">
        <span className="rv-paystrip-badge">LIVE DEMO</span>
        <span className="rv-paystrip-text">admin@coldguard.local · admin123 — sign in to see the live dashboard</span>
        <Link className="btn" to="/login">Open dashboard →</Link>
      </section>

      {/* WIDE MEDIA BANNER — video + photo slider */}
      <section className="rv-banner">
        <div className="landing-slider-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {slides.map((s) => (
            <figure key={s.src} className="rv-banner-slide">
              <img src={s.src} alt={s.alt} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <button className="rv-banner-btn prev" onClick={()=>setSlide((s)=>(s-1+slides.length)%slides.length)}>‹</button>
        <button className="rv-banner-btn next" onClick={()=>setSlide((s)=>(s+1)%slides.length)}>›</button>
        <div className="rv-banner-dots">
          {slides.map((_,i)=>(<button key={i} className={`landing-dot ${i===slide?'active':''}`} aria-label={`Slide ${i+1}`} onClick={()=>setSlide(i)}/>))}
        </div>
      </section>

      {/* MANIFESTO — photo bleeding left + bordered card */}
      <section id="manifesto" className="rv-manifesto">
        <div className="rv-manifesto-photo">
          <img src="/images/ghana_vaccine.jpg" alt="Health worker preparing vaccines" />
        </div>
        <div className="rv-manifesto-card">
          <h2>ColdGuard</h2>
          <p className="rv-manifesto-sub">Sisi ni walezi — our hackathon manifesto</p>
          {manifesto.map((m, i) => <p key={i}>{m}</p>)}
          <div className="rv-manifesto-cta">
            <Link className="btn dark square" to="/login">Live demo</Link>
            <a className="btn dark square" href="#contact">Get a quote</a>
          </div>
        </div>
      </section>

      {/* VIDEO */}
      <section className="landing-section rv-video">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Watch</span>
          <h2>Why the cold chain matters</h2>
        </div>
        <div className="rv-video-card">
          <video controls preload="metadata" poster="/images/ethiopia_vaccine.jpg">
            <source src="/videos/vaccine_logistics.webm" type="video/webm" />
          </video>
          <p className="rv-video-credit">Video: CDC — COVID-19 vaccine logistics (Wikimedia Commons, public domain)</p>
        </div>
      </section>

      {/* UNITS */}
      <section id="units" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Our units</span>
          <h2>Monitoring for every cold application</h2>
        </div>
        <div className="rv-units">
          {units.map((u) => (
            <article key={u.name} className="rv-unit">
              <div className="rv-unit-top">
                <h3>{u.name}</h3>
                <span className="rv-unit-tag">{u.tag}</span>
              </div>
              <p>{u.desc}</p>
              <Link className="btn dark square" to="/login">See live demo</Link>
            </article>
          ))}
        </div>
      </section>

      {/* EVENTS / DEPLOYMENTS — dark section */}
      <section id="events" className="rv-events">
        <div className="landing-section-head">
          <h2>Build &amp; Roadmap</h2>
        </div>
        <div className="rv-events-track">
          {events.map((e) => (
            <article key={e.place} className="rv-event-card">
              <img src={e.img} alt={e.title} />
              <div className="rv-event-overlay">
                <span className="rv-event-place">{e.place}</span>
                <h3>{e.title}</h3>
                <span className="rv-event-date">{e.date}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="landing-section">
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

      {/* CONTACT */}
      <section id="contact" className="landing-section rv-contact">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Contact us</span>
          <h2>Talk to the team</h2>
        </div>
        <form className="rv-contact-form" onSubmit={onQuote}>
          <div className="field"><label>Name</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
          <div className="field"><label>Email address</label><input type="email" placeholder="you@facility.org" /></div>
          <div className="field" style={{gridColumn:'1/-1'}}><label>Leave a message</label><textarea rows={4} placeholder="Tell us about your cold storage needs…" /></div>
          <button className="btn" type="submit">Submit</button>
        </form>
        <div className="rv-contact-info">
          <img src="/images/pharmacy_store.jpg" alt="A Kenyan chemist serving a customer" className="rv-contact-img" />
          <h3>ColdGuard</h3>
          <p>hello@coldguard.local</p>
          <p>+254 700 000 000</p>
          <p>Nairobi, Kenya</p>
        </div>
      </section>

      <footer className="rv-footer">
        <span className="brand-badge">COLDGUARD</span>
        <nav className="rv-footer-links">
          <a href="#manifesto">About</a><a href="#units">Units</a><a href="#events">Deployments</a><a href="#contact">Contact</a><Link to="/login">Sign in</Link>
        </nav>
        <p className="rv-footer-copy">© 2026 ColdGuard · HACKFEST MKSU · Team ColdGuard</p>
      </footer>
    </div>
  )
}
