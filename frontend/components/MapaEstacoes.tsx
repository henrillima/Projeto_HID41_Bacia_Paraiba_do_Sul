"use client";

import { useEffect } from "react";
import type { ResumoEstacao } from "@/lib/types";

interface MapaEstacoesProps {
  estacoes: ResumoEstacao[];
  height?: string;
}

// react-leaflet não funciona no SSR — importado dinamicamente nas páginas.
export function MapaEstacoes({ estacoes, height = "400px" }: MapaEstacoesProps) {
  // Evita import de L no SSR
  if (typeof window === "undefined") return null;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MapContainer, TileLayer, Marker, Popup, CircleMarker } = require("react-leaflet");

  const center: [number, number] =
    estacoes.length > 0
      ? [
          estacoes.reduce((s, e) => s + e.lat, 0) / estacoes.length,
          estacoes.reduce((s, e) => s + e.lon, 0) / estacoes.length,
        ]
      : [-22.5, -45.2];

  return (
    <MapContainer
      center={center}
      zoom={9}
      style={{ height, width: "100%", borderRadius: "0.75rem" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {estacoes.map((e) => (
        <CircleMarker
          key={e.codigo}
          center={[e.lat, e.lon]}
          radius={e.is_referencia ? 10 : 7}
          pathOptions={{
            fillColor: e.is_referencia ? "#1565C0" : "#42A5F5",
            color: e.is_referencia ? "#0D47A1" : "#1976D2",
            fillOpacity: 0.85,
            weight: 2,
          }}
        >
          <Popup>
            <strong>{e.nome}</strong>
            <br />
            Código: {e.codigo}
            <br />
            {e.is_referencia && <em>Estação de referência</em>}
            <br />
            Anos de dados: {e.anos_dados}
            <br />
            Média anual: {e.media_anual_mm?.toFixed(0) ?? "—"} mm
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
