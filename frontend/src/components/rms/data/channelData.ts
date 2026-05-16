import { ChannelData } from "../types";

export function generateChannels(startDate: Date, numDays: number): ChannelData[] {
  const dates: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const channels: ChannelData[] = [
    { channelId: "ch_direct", channelName: "Direct",         commission: 0,    closedDates: [], logoType: "direct" },
    { channelId: "ch_bk",     channelName: "Booking.com",    commission: 10,   closedDates: [], logoType: "booking" },
    { channelId: "ch_agoda",  channelName: "Agoda",          commission: 14.5, closedDates: [], logoType: "agoda" },
    { channelId: "ch_airbnb", channelName: "Airbnb",         commission: 15,   closedDates: [], logoType: "airbnb" },
    { channelId: "ch_hrs",    channelName: "HRS",            commission: 15,   closedDates: [], logoType: "hrs" },
    { channelId: "ch_trip",   channelName: "Trip.com",       commission: 16,   closedDates: [], logoType: "trip" },
    { channelId: "ch_hb",     channelName: "Hotelbeds",      commission: 17.8, closedDates: [], logoType: "hotelbeds" },
    { channelId: "ch_lm",     channelName: "Lastminute",     commission: 18,   closedDates: [], logoType: "lastminute" },
    { channelId: "ch_exp",    channelName: "Expedia.fr",     commission: 18,   closedDates: [], logoType: "expedia" },
    { channelId: "ch_tbo",    channelName: "TBO.com",        commission: 20,   closedDates: [], logoType: "tbo" },
    { channelId: "ch_trav",   channelName: "Travco",         commission: 22,   closedDates: [], logoType: "travco" },
    { channelId: "ch_miki",   channelName: "MIKI Travel",    commission: 23,   closedDates: [], logoType: "miki" },
    { channelId: "ch_mh",     channelName: "Magic Holidays", commission: 25,   closedDates: [], logoType: "magic_holidays" },
    { channelId: "ch_oly",    channelName: "Olympia Burodie",commission: 27,   closedDates: [], logoType: "olympia" },
    { channelId: "ch_ogus",   channelName: "OpenGUS",        commission: 28,   closedDates: [], logoType: "opengus" },
  ];

  // Sample closures
  const ch0 = channels.find(c => c.channelId === "ch_bk");
  if (ch0) ch0.closedDates = dates.filter((_, i) => i >= 7 && i <= 14);
  const ch1 = channels.find(c => c.channelId === "ch_trav");
  if (ch1) ch1.closedDates = dates.filter((_, i) => (i >= 5 && i <= 10) || (i >= 18 && i <= 23));

  return channels;
}
