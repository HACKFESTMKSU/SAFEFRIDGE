import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Cpu,
  LineChart,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Radio,
  ShieldCheck,
  Snowflake,
  Star,
  Thermometer,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const units = [
  {
    name: 'CG-001 · Pharmacy Unit',
    desc: 'Compact monitor for dispensary and pharmacy cold storage — temp, humidity, current and leak sensing.',
    tag: '2–8°C',
  },
  {
    name: 'CG-002 · Freezer Unit',
    desc: 'Deep-cold monitoring for vaccine freezers and cold rooms — critical excursion alerts included.',
    tag: '−25 to −15°C',
  },
  {
    name: 'CG-003 · Cold Box',
    desc: 'Portable box monitoring for outreach and lab use — battery-friendly, GSM-ready.',
    tag: '2–8°C',
  },
]

const features = [
  { icon: <Thermometer size={22} />, title: 'Live telemetry', text: 'Temperature, humidity, pressure, current and leak readings refreshed in real time.' },
  { icon: <BellRing size={22} />, title: 'Smart incidents', text: 'Sustained breaches open incidents automatically — no alert spam, auto-resolve on recovery.' },
  { icon: <Radio size={22} />, title: 'GSM SMS fallback', text: 'Critical alerts still fire over SIM800L when Wi-Fi is down.' },
  { icon: <LineChart size={22} />, title: '24h history', text: 'Per-unit charts so drift is spotted before it becomes a failure.' },
  { icon: <ShieldCheck size={22} />, title: 'Role-based access', text: 'Admin, Operator and Technician roles keep duties cleanly separated.' },
  { icon: <MessageSquareText size={22} />, title: 'Maintenance notes', text: 'Full audit trail of inspections, repairs and resolutions.' },
]

const slides = [
  { src: '/images/village_reach.jpg', alt: 'Vaccine cold chain', caption: 'The cold chain starts at the shelf' },
  { src: '/images/ghana_vaccine.jpg', alt: 'Vaccine preparation in Ghana', caption: 'Every dose depends on a working unit' },
  { src: '/images/ethiopia_vaccine.jpg', alt: 'Vaccine preparation in Ethiopia', caption: 'Last-mile delivery needs last-mile monitoring' },
  { src: '/images/cold_room.jpg', alt: 'Cold storage room', caption: 'Every unit under one view' },
  { src: '/images/africa.png', alt: 'Map of Africa', caption: 'Built for Africa, starting with Kenya' },
]

export function LandingPage() {
  const { user } = useAuth()
  const [slide, setSlide] = useState(0)
  const [quoteSent, setQuoteSent] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', unit: 'Pharmacy / dispensary unit', need: 'Ongoing monitoring' })

  function onQuote(e: FormEvent) {
    e.preventDefault()
    const body = encodeURIComponent(
      `ColdGuard quote request\nName: ${form.name}\nPhone: ${form.phone}\nUnit type: ${form.unit}\nNeed: ${form.need}`,
    )
    window.location.href = `mailto:hello@coldguard.local?subject=ColdGuard%20quote&body=${body}`
    setQuoteSent(true)
  }

  return (
    <div className="landing rv">
      {/* NAV */}
      <header className="rv-nav">
        <div className="rv-nav-inner">
          <Link to="/" className="landing-brand">
            <div className="brand-mark"><Snowflake size={20} /></div>
            <div className="brand-text"><strong>COLDGUARD</strong><span>Cold-chain monitoring</span></div>
          </Link>
          <nav className="landing-links">
            <a href="#units">Units</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="landing-nav-cta">
            {user ? (
              <Link className="btn" to="/">Open dashboard <ArrowRight size={16} /></Link>
            ) : (
              <>
                <Link className="btn secondary" to="/login">Sign in</Link>
                <Link className="btn" to="/login">Live demo <ArrowRight size={16} /></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="rv-hero">
        <div className="rv-hero-copy">
          <span className="landing-eyebrow"><Snowflake size={14} /> Your cold chain starts here</span>
          <h1>Smooth, simple, stress-free cold storage monitoring.</h1>
          <p className="landing-sub">
            ColdGuard watches every unit around the clock — live readings, automatic
            alerts, and SMS that still works when internet doesn't.
          </p>
          <div className="landing-hero-meta">
            <span><Star size={15} /> Rated #1 approach for cold-chain monitoring</span>
            <span><Radio size={15} /> Daily, weekly &amp; long-term coverage</span>
            <span><ShieldCheck size={15} /> No hidden fees — ever</span>
            <span><Boxes size={15} /> Every unit type &amp; budget</span>
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
              <option>Pharmacy / dispensary unit</option>
              <option>Vaccine freezer</option>
              <option>Cold room</option>
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
          <button className="btn" type="submit">Request a quote <ArrowRight size={16} /></button>
          {quoteSent && <p className="rv-quote-ok">Opening your email app — quote request drafted.</p>}
          <div className="rv-quote-contact">
            <span><Mail size={14} /> hello@coldguard.local</span>
            <span><Phone size={14} /> +254 700 000 000</span>
            <span><MapPin size={14} /> Nairobi, Kenya</span>
          </div>
        </form>
      </section>

      {/* TRUSTED STRIP */}
      <section className="rv-trusted">
        <p>Trusted by facilities that cannot afford silent failures</p>
      </section>

      {/* UNITS / FLEET */}
      <section id="units" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Our units</span>
          <h2>Monitoring hardware for every cold application</h2>
          <p>Pick the right ColdGuard unit for your space — all share the same dashboard and alert engine.</p>
        </div>
        <div className="rv-units">
          {units.map((u) => (
            <article key={u.name} className="rv-unit">
              <div className="rv-unit-top">
                <div className="landing-feature-icon"><Cpu size={20} /></div>
                <span className="rv-unit-tag">{u.tag}</span>
              </div>
              <h3>{u.name}</h3>
              <p>{u.desc}</p>
              <Link className="btn secondary sm" to="/login">See live demo <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </section>

      {/* SLIDER */}
      <section className="landing-slider" aria-label="Cold-chain in Africa">
        <div className="landing-slider-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {slides.map((s) => (
            <figure key={s.src} className="landing-slide">
              <img src={s.src} alt={s.alt} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <button className="landing-slider-btn prev" aria-label="Previous" onClick={()=>setSlide((s)=>(s-1+slides.length)%slides.length)}><ChevronLeft size={20}/></button>
        <button className="landing-slider-btn next" aria-label="Next" onClick={()=>setSlide((s)=>(s+1)%slides.length)}><ChevronRight size={20}/></button>
        <div className="landing-slider-dots">
          {slides.map((_,i)=>(<button key={i} className={`landing-dot ${i===slide?'active':''}`} aria-label={`Slide ${i+1}`} onClick={()=>setSlide(i)}/>))}
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="landing-section rv-about">
        <div className="landing-section-head">
          <span className="landing-eyebrow">About us</span>
          <h2>Driven by a belief that monitoring should be effortless</h2>
        </div>
        <div className="rv-about-grid">
          <div>
            <h3>What began as a hackathon project</h3>
            <p>
              ColdGuard started at HACKFEST MKSU with one question: why do cold units
              fail silently across Africa? We built the full stack — ESP32 firmware,
              MQTT pipeline, FastAPI backend, React dashboard and GSM SMS fallback —
              in weeks, and it works end-to-end today.
            </p>
            <p>
              Our mission is simple: every facility that stores vaccines, medicine or
              food deserves monitoring that is affordable, offline-capable and honest.
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

      {/* FEATURES */}
      <section id="features" className="landing-section">
        <div className="landing-section-head">
          <span className="landing-eyebrow">Features</span>
          <h2>Everything a cold-chain team needs</h2>
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
          <button className="btn" type="submit">Submit <ArrowRight size={16} /></button>
        </form>
        <div className="rv-contact-info">
          <h3>ColdGuard</h3>
          <p><Mail size={15}/> hello@coldguard.local</p>
          <p><Phone size={15}/> +254 700 000 000</p>
          <p><MapPin size={15}/> Nairobi, Kenya</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-brand">
            <div className="brand-mark"><Snowflake size={18} /></div>
            <div className="brand-text"><strong>COLDGUARD</strong><span>Cold-chain monitoring</span></div>
          </div>
          <p>ESP32 edge sensing · MQTT telemetry · threshold incidents · GSM SMS fallback. Built for hackathon demonstration.</p>
          <span className="landing-footer-copy">© 2026 ColdGuard · HACKFEST MKSU</span>
        </div>
      </footer>
    </div>
  )
}
