import './KiloHero.css'

/** GYMBUDDY slot: Kilo + speech bubble. Placeholder sprite art for now —
 *  Phase 6 wires day-type/reaction animations behind this same component. */
export function KiloHero({ speech }: { speech: string }) {
  return (
    <section className="card-lg kilo-hero">
      <div className="kilo-sprite" aria-label="Kilo, your gym buddy" />
      <div className="kilo-speech">
        <div className="kilo-speech-arrow" />
        <div className="kilo-speech-text">{speech}</div>
        <div className="kilo-speech-byline">— Kilo, your spotter</div>
      </div>
    </section>
  )
}
