/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}

interface SpeechRecognitionEventMap {
  result: SpeechRecognitionEvent
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}
declare var SpeechRecognition: { prototype: SpeechRecognition; new (): SpeechRecognition }
declare var webkitSpeechRecognition: { prototype: SpeechRecognition; new (): SpeechRecognition }
