export type Mode = 'development' | 'production' | 'print'

let mode: Mode = 'production'

export function setCurrentMode(newMode: Mode): Mode {
  mode = newMode
  return mode
}

export function getCurrentMode(): Mode {
  return mode
}
