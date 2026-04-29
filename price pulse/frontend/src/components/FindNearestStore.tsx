import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { RETAILER_LABELS, RETAILER_MAP_QUERIES } from '../data/mockProducts'
import type { Retailer } from '../types'

export function FindNearestStore({
  cheapestStore,
  defaultOpen = false,
}: {
  cheapestStore: Retailer | null
  defaultOpen?: boolean
}) {
  const [showMap, setShowMap] = useState(defaultOpen)
  const store = cheapestStore || 'cargills'
  const mapQuery = RETAILER_MAP_QUERIES[store]
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const mapUrl = googleMapsApiKey
    ? `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(googleMapsApiKey)}&q=${encodeURIComponent(mapQuery)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`

  return (
    <section className="px-4 py-4 mb-24" aria-label="Find nearest store">
      <h2 className="text-lg font-semibold text-grey-900 mb-2">Find Nearest Store</h2>
      <p className="text-sm text-grey-500 mb-3">
        Open map to find the closest {RETAILER_LABELS[store]} branch.
      </p>
      <button
        type="button"
        onClick={() => setShowMap(!showMap)}
        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        <MapPin className="w-5 h-5" />
        {showMap ? 'Hide map' : 'Find nearest store'}
      </button>
      {showMap && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-grey-200 bg-grey-100 aspect-[4/3]">
          {googleMapsApiKey ? (
            <iframe
              title="Nearest store map"
              src={mapUrl}
              className="w-full h-full min-h-[200px]"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center p-4 text-center">
              <div>
                <p className="text-sm font-medium text-grey-800">Google Maps API key is not configured yet.</p>
                <p className="mt-1 text-xs text-grey-500">
                  Add <span className="font-mono">VITE_GOOGLE_MAPS_API_KEY</span> in your frontend environment to enable the embedded map.
                </p>
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
