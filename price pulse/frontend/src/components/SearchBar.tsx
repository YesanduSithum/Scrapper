import { useState, useRef, useCallback } from 'react'
import { Mic, Search } from 'lucide-react'

const PLACEHOLDERS = [
  'Search in English, සිංහල, or Singlish...',
  'e.g. Milk, කිරි, or rice',
]

export function SearchBar({
  value,
  onChange,
  onVoiceResult,
}: {
  value: string
  onChange: (v: string) => void
  onVoiceResult?: (text: string) => void
}) {
  const [isListening, setIsListening] = useState(false)
  const [placeholderIndex] = useState(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startVoiceSearch = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
    if (!SpeechRecognitionAPI) {
      alert('Voice search is not supported in this browser. Try Chrome or Edge.')
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-LK'
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      onChange(transcript)
      onVoiceResult?.(transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
  }, [onChange, onVoiceResult])

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-grey-200 safe-top">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-grey-400" />
          <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-grey-200 bg-grey-50 text-grey-900 placeholder-grey-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-sans sinhala"
            aria-label="Search products in English, Sinhala or Singlish"
          />
        </div>
        <button
          type="button"
          onClick={startVoiceSearch}
          disabled={isListening}
          className="flex-shrink-0 p-3 rounded-xl bg-primary-100 text-primary-700 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-70 transition-colors"
          aria-label="Voice search"
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
