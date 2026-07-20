import type { MascotAsset } from '../lib/mascot'
import './KiloHero.css'

/** GYMBUDDY slot. `asset` drives everything — a still or a sprite sheet of
 *  N frames — so swapping in real art (or Lottie later) needs no changes
 *  here. Callers pick the asset from day type or reaction state. */
export function KiloSprite({
  asset,
  height = 124,
  className = '',
}: {
  asset: MascotAsset
  height?: number
  className?: string
}) {
  // Stills render as an <img> so their natural aspect ratio survives inside
  // flex layouts; sheets need a fixed frame box to step across.
  if (asset.frames <= 1) {
    return <img className={`kilo-still ${className}`} src={asset.src} style={{ height }} alt="" />
  }
  return (
    <div
      className={`kilo-sprite ${className}`}
      style={{
        height,
        width: height * 0.79, // frame aspect of the current sheets
        backgroundImage: `url(${asset.src})`,
        backgroundSize: `${asset.frames * 100}% 100%`,
        animation: `kilo-frames ${asset.durationSec}s steps(${asset.frames}) infinite`,
        ['--kilo-end' as string]: `${100 - 100 / asset.frames}%`,
      }}
      aria-hidden="true"
    />
  )
}

export function KiloHero({ speech, asset }: { speech: string; asset: MascotAsset }) {
  return (
    <section className="card-lg kilo-hero">
      <KiloSprite asset={asset} />
      <div className="kilo-speech">
        <div className="kilo-speech-arrow" />
        <div className="kilo-speech-text">{speech}</div>
        <div className="kilo-speech-byline">— Kilo, your spotter</div>
      </div>
    </section>
  )
}
