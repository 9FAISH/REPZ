/** Per-side plate breakdown for a barbell total. Pure math, unit-tested. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export function platesPerSide(totalKg: number, barKg: number): { plates: number[]; leftoverKg: number } {
  const perSide = (totalKg - barKg) / 2
  if (perSide <= 0) return { plates: [], leftoverKg: 0 }
  let rest = perSide
  const plates: number[] = []
  for (const p of PLATES_KG) {
    while (rest >= p - 1e-9) {
      plates.push(p)
      rest = Math.round((rest - p) * 100) / 100
    }
  }
  return { plates, leftoverKg: rest }
}
