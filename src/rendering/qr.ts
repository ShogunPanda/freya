const alignmentsByVersion = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170]
]

export function getAlignments(moduleCount: number): number[][] {
  const version = (moduleCount - 17) / 4
  const aligments = []

  const currentAlignments = alignmentsByVersion[version - 1]
  for (const i of currentAlignments) {
    for (const j of currentAlignments) {
      if (isFinder(moduleCount, i, j)) {
        // Skip the one overlapping with finders
        continue
      }

      aligments.push([i - 2, j - 2])
    }
  }

  return aligments
}

export function getCover(moduleCount: number, ratio: number): number[] {
  let width
  let height

  // Center the image in the module, alloc
  // Resize the width so that it's at most 30% of the QR
  if (ratio > 1) {
    // Landscape
    width = Math.round(moduleCount * 0.3)
    height = Math.round(width / ratio)
  } else {
    height = Math.round(moduleCount * 0.3)
    width = Math.round(height / ratio)
  }

  return [Math.floor((moduleCount - width) / 2) - 1, Math.floor((moduleCount - height) / 2) - 1, width + 1, height + 1]
}

export function isFinder(moduleCount: number, y: number, x: number): boolean {
  return (
    (y < 7 && (x < 7 || x > moduleCount - 8)) || // Top corners
    (y > moduleCount - 8 && x < 7) // Bottom left corner
  )
}

export function isAlignment(aligments: number[][], y: number, x: number): boolean {
  return aligments.some(([topLevelY, topLevelX]: number[]) => {
    return y >= topLevelY && y <= topLevelY + 4 && x >= topLevelX && x <= topLevelX + 4
  })
}

export function isCovered(mask: number[], y: number, x: number): boolean {
  return x >= mask[0] && y >= mask[1] && x <= mask[0] + mask[2] && y <= mask[1] + mask[3]
}
