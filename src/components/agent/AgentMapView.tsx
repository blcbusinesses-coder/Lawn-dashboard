'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default marker icons
const icon = L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50% 50% 50% 0;
    background:linear-gradient(135deg,#06b6d4,#3b82f6);
    transform:rotate(-45deg);border:2px solid white;
    box-shadow:0 2px 8px rgba(6,182,212,0.5)
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -30],
})

export interface MapLocation {
  name:        string
  address?:    string
  lat:         number
  lng:         number
  description?: string
}

interface Props {
  locations: MapLocation[]
}

export default function AgentMapView({ locations }: Props) {
  if (!locations.length) return null

  const center: [number, number] = [
    locations.reduce((s, l) => s + l.lat, 0) / locations.length,
    locations.reduce((s, l) => s + l.lng, 0) / locations.length,
  ]

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 mt-2" style={{ height: 280 }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%', background: '#18181b' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {locations.map((loc, i) => (
          <Marker key={i} position={[loc.lat, loc.lng]} icon={icon}>
            <Popup>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
                <strong>{loc.name}</strong>
                {loc.address && <div style={{ color: '#666', marginTop: 2 }}>{loc.address}</div>}
                {loc.description && <div style={{ marginTop: 4 }}>{loc.description}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
