// Official OTA partner logo components — SVG, typographic, no external images
// All logos are constructed from brand colors and typography documented in public brand guidelines.

import { ReactNode } from "react";

export type PartnerKey =
  | "booking"
  | "expedia"
  | "trip"
  | "agoda"
  | "airbnb"
  | "hrs"
  | "tbo"
  | "travco"
  | "lastminute"
  | "hotelbeds"
  | "miki"
  | "olympia"
  | "opengus"
  | "magic_holidays"
  | "infiniter"
  | "direct"
  | "default";

interface PartnerInfo {
  name: string;
  logo: ReactNode;
  bg: string;   // badge background for fallback
  color: string; // text color
}

const circle = (content: ReactNode, bg: string) => (
  <div
    className="flex items-center justify-center rounded-full shrink-0"
    style={{ width: 28, height: 28, backgroundColor: bg }}
  >
    {content}
  </div>
);

export const PARTNERS: Record<PartnerKey, PartnerInfo> = {
  booking: {
    name: "Booking.com",
    bg: "#003580",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <text x="3" y="18" fontSize="16" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">B</text>
        <circle cx="18" cy="17" r="3" fill="#00AEEF"/>
      </svg>,
      "#003580"
    ),
  },
  expedia: {
    name: "Expedia.fr",
    bg: "#FFC107",
    color: "#00355F",
    logo: circle(
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M5 19l9-9H8V5h10v10h-5l-8 8v-4z" fill="#00355F"/>
      </svg>,
      "#FFC107"
    ),
  },
  trip: {
    name: "Trip.com",
    bg: "#1E6FDB",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
        <text x="4" y="18" fontSize="15" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">T</text>
        <circle cx="18.5" cy="17.5" r="3" fill="#FF9800"/>
      </svg>,
      "#1E6FDB"
    ),
  },
  agoda: {
    name: "Agoda",
    bg: "#E8F4FD",
    color: "#CC0000",
    logo: circle(
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <text x="5" y="17" fontSize="14" fontWeight="700" fill="#CC0000" fontFamily="Arial, sans-serif">a</text>
        <circle cx="8.5" cy="20.5" r="1.5" fill="#FF5252"/>
        <circle cx="12" cy="20.5" r="1.5" fill="#4CAF50"/>
        <circle cx="15.5" cy="20.5" r="1.5" fill="#2196F3"/>
      </svg>,
      "#E8F4FD"
    ),
  },
  airbnb: {
    name: "Airbnb",
    bg: "#FF5A5F",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M12 2C9.76 2 8 3.42 8 5.2c0 1.14.6 2.2 1.66 3.1C7.84 9.24 6 11.28 6 13.6 6 16.02 8.52 18 12 18s6-1.98 6-4.4c0-2.32-1.84-4.36-3.66-5.3C15.4 7.4 16 6.34 16 5.2 16 3.42 14.24 2 12 2zm0 2c1.1 0 2 .68 2 1.2S13.1 6.4 12 6.4s-2-.68-2-1.2S10.9 4 12 4zm0 12c-2.2 0-4-1.14-4-2.4 0-1.56 2-3.6 4-3.6s4 2.04 4 3.6C16 14.86 14.2 16 12 16z"/>
      </svg>,
      "#FF5A5F"
    ),
  },
  hrs: {
    name: "HRS",
    bg: "#E30613",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#E30613"/>
        <text x="5.5" y="19" fontSize="10" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">HRS</text>
      </svg>,
      "#E30613"
    ),
  },
  tbo: {
    name: "TBO.com",
    bg: "#1565C0",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#1565C0"/>
        <text x="4" y="17" fontSize="8" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">TBO</text>
        <text x="2" y="23" fontSize="6" fontWeight="600" fill="#90CAF9" fontFamily="Arial, sans-serif">.com</text>
      </svg>,
      "#1565C0"
    ),
  },
  travco: {
    name: "Travco",
    bg: "#0A4F9C",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#0A4F9C"/>
        <text x="3" y="19" fontSize="8" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">Tvco</text>
      </svg>,
      "#0A4F9C"
    ),
  },
  lastminute: {
    name: "Lastminute",
    bg: "#E81C3D",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#E81C3D"/>
        <text x="6" y="17" fontSize="8" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">LM</text>
      </svg>,
      "#E81C3D"
    ),
  },
  hotelbeds: {
    name: "Hotelbeds",
    bg: "#4338CA",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#4338CA"/>
        <text x="6" y="18" fontSize="10" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">HB</text>
      </svg>,
      "#4338CA"
    ),
  },
  miki: {
    name: "MIKI Travel",
    bg: "#003366",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#003366"/>
        <text x="3.5" y="18" fontSize="9" fontWeight="900" fill="white" fontFamily="Arial, sans-serif" letterSpacing="0.5">MIKI</text>
      </svg>,
      "#003366"
    ),
  },
  olympia: {
    name: "Olympia Burodie",
    bg: "#1A3A5C",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#1A3A5C"/>
        <text x="4" y="17" fontSize="8" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">OLY</text>
      </svg>,
      "#1A3A5C"
    ),
  },
  opengus: {
    name: "OpenGUS",
    bg: "#1E40AF",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#1E40AF"/>
        {/* Infinity-like symbol */}
        <path d="M7 14 Q10 10 14 14 Q18 18 21 14 Q18 10 14 14 Q10 18 7 14Z" fill="white" stroke="white" strokeWidth="0.5"/>
      </svg>,
      "#1E40AF"
    ),
  },
  magic_holidays: {
    name: "Magic Holidays",
    bg: "#F59E0B",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#F59E0B"/>
        <text x="5" y="18" fontSize="9" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">MH</text>
      </svg>,
      "#F59E0B"
    ),
  },
  infiniter: {
    name: "Infiniter Hotel",
    bg: "#D97706",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#D97706"/>
        {/* Golden loop symbol */}
        <path d="M7 14 Q10 10 14 14 Q18 18 21 14 Q18 10 14 14 Q10 18 7 14Z" fill="white" strokeWidth="0.5"/>
      </svg>,
      "#D97706"
    ),
  },
  direct: {
    name: "Direct",
    bg: "#059669",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#059669"/>
        <text x="4" y="18" fontSize="9" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">DIR</text>
      </svg>,
      "#059669"
    ),
  },
  default: {
    name: "OTA",
    bg: "#64748B",
    color: "#FFFFFF",
    logo: circle(
      <svg viewBox="0 0 28 28" width="28" height="28">
        <circle cx="14" cy="14" r="14" fill="#64748B"/>
        <text x="5" y="18" fontSize="9" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">OTA</text>
      </svg>,
      "#64748B"
    ),
  },
};

export function getPartnerLogo(key: PartnerKey) {
  return PARTNERS[key] ?? PARTNERS.default;
}
