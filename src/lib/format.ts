/** 'PECTORALIS MAJOR STERNAL HEAD' → 'Pectoralis major sternal head' */
export function sentenceCase(s: string): string {
  const lower = s.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export const joinEquipments = (equipments: string[]) =>
  equipments.map(sentenceCase).join(' + ')
