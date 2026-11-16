/**
 * Hand-built SVG artwork for the landing page: the ink splash behind the
 * hero card, and the sensor-to-phone pipeline for "How it works".
 */

export function InkSplash() {
  return (
    <svg className="lp-ink" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ink-rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.06" numOctaves="3" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="52" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ink-fine" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="10" />
        </filter>
      </defs>
      <g filter="url(#ink-rough)" fill="#000">
        <path d="M58,322 C40,150 170,46 318,52 C478,58 600,150 590,318 C580,488 470,592 312,588 C150,584 74,494 58,322 Z" />
        <rect x="16" y="150" width="220" height="20" rx="7" />
        <rect x="420" y="520" width="206" height="16" rx="6" />
        <rect x="372" y="70" width="248" height="24" rx="8" />
        <rect x="30" y="500" width="176" height="14" rx="5" />
      </g>
      <g filter="url(#ink-fine)" fill="#000">
        <circle cx="612" cy="262" r="9" />
        <circle cx="628" cy="296" r="4" />
        <circle cx="30" cy="380" r="7" />
        <circle cx="16" cy="346" r="3.5" />
        <circle cx="512" cy="606" r="6" />
        <circle cx="130" cy="34" r="5" />
        <circle cx="566" cy="40" r="3" />
      </g>
    </svg>
  )
}

const NODES = [125, 375, 625, 875]
const MID = 98

function Chip() {
  const pins = [-8, 0, 8]
  return (
    <g>
      <rect className="glyph" x={-14} y={-14} width={28} height={28} rx={3} />
      <rect className="glyph-fill" x={-5.5} y={-5.5} width={11} height={11} />
      {pins.map((p) => (
        <g key={p} className="glyph">
          <line x1={-14} x2={-20} y1={p} y2={p} />
          <line x1={14} x2={20} y1={p} y2={p} />
          <line y1={-14} y2={-20} x1={p} x2={p} />
          <line y1={14} y2={20} x1={p} x2={p} />
        </g>
      ))}
    </g>
  )
}

function Server() {
  return (
    <g>
      {[-20, -5.5, 9].map((y) => (
        <g key={y}>
          <rect className="glyph" x={-18} y={y} width={36} height={11} rx={2} />
          <circle className="glyph-fill" cx={-11} cy={y + 5.5} r={1.8} />
        </g>
      ))}
    </g>
  )
}

function Shield() {
  return (
    <g>
      <path className="glyph" d="M0,-21 L17,-14 V0 C17,11 9,18 0,22 C-9,18 -17,11 -17,0 V-14 Z" />
      <path className="glyph" d="M-7,0 L-2,5 L8,-6" />
    </g>
  )
}

function Phone() {
  return (
    <g>
      <rect className="glyph" x={-13} y={-22} width={26} height={44} rx={4} />
      <line className="glyph" x1={-4} x2={4} y1={16} y2={16} />
      <rect className="glyph-accent" x={-8} y={-14} width={16} height={9} rx={2} />
    </g>
  )
}

const GLYPHS = [Chip, Server, Shield, Phone]
const CAPTIONS = ['ESP32 + sensors', 'ColdGuard server', 'Rules engine', 'Phone + dashboard']

export function Pipeline({ animated = true, active = null }: { animated?: boolean; active?: number | null }) {
  const main = `M${NODES[0]},${MID} H${NODES[3]}`
  const sms = `M${NODES[0]},${MID + 38} C${NODES[0]},214 ${NODES[3]},214 ${NODES[3]},${MID + 38}`
  return (
    <svg viewBox="0 0 1000 250" role="img" aria-label="Readings flow from the sensor unit to the ColdGuard server, through the rules engine, to staff phones and the dashboard. A dashed SMS route connects the sensor unit straight to phones when Wi-Fi is down.">
      <path id="pipe-main" className="pipe-wire" d={main} />
      <path id="pipe-sms" className="pipe-wire sms" d={sms} />

      {animated ? (
        <>
          {[0, 0.8, 1.6, 2.4].map((begin) => (
            <rect key={begin} className="pipe-packet" x={-5} y={-5} width={10} height={10}>
              <animateMotion dur="3.2s" begin={`-${begin}s`} repeatCount="indefinite" rotate="auto">
                <mpath href="#pipe-main" />
              </animateMotion>
            </rect>
          ))}
          <rect className="pipe-packet alert" x={-5} y={-5} width={10} height={10}>
            <animateMotion dur="4.8s" begin="-1s" repeatCount="indefinite" rotate="auto">
              <mpath href="#pipe-sms" />
            </animateMotion>
          </rect>
        </>
      ) : null}

      <text className="pipe-sms-label" x={500} y={236} textAnchor="middle">
        GSM SMS route when Wi-Fi is down
      </text>

      {NODES.map((x, i) => {
        const Glyph = GLYPHS[i]
        return (
          <g
            key={x}
            className={`pipe-node ${active === i ? 'is-active' : ''} ${active != null && active > i ? 'is-past' : ''}`}
            transform={`translate(${x}, ${MID})`}
          >
            <rect className="box" x={-38} y={-38} width={76} height={76} />
            <Glyph />
            <text x={0} y={-52} textAnchor="middle">
              {CAPTIONS[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
