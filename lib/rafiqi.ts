export type Ayah = {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  hizbQuarter: number;
  sajda: boolean | Record<string, unknown>;
};

export type Surah = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  ayahs: Ayah[];
};

export type QuranPayload = { data: { surahs: Surah[] } };

export type DhikrItem = { id: number; text: string; repeat: number; source?: string };
export type DhikrCategory = { title: string; items: DhikrItem[] };
export type City = {
  country: string;
  city: string;
  latin: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type RuqyahRef = {
  title: string;
  surah: number;
  from: number;
  to: number;
  source: string;
};

export type PrayerTime = { key: string; label: string; minutes: number; text: string };

export const normalizeArabic = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .toLowerCase();

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function qiblaBearing(latitude: number, longitude: number) {
  const kaabaLat = toRadians(21.4225);
  const deltaLon = toRadians(39.8262 - longitude);
  const lat = toRadians(latitude);
  const y = Math.sin(deltaLon);
  const x = Math.cos(lat) * Math.tan(kaabaLat) - Math.sin(lat) * Math.cos(deltaLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

function formatMinutes(minutes: number) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return new Intl.DateTimeFormat("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

export function calculatePrayerTimes(date: Date, latitude: number, longitude: number): PrayerTime[] {
  const n = dayOfYear(date);
  const gamma = (2 * Math.PI * (n - 1)) / 365;
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const timezoneHours = -date.getTimezoneOffset() / 60;
  const solarNoon = 720 - (equationOfTime + 4 * longitude - 60 * timezoneHours);
  const lat = toRadians(latitude);

  const hourAngle = (zenith: number) => {
    const cosAngle =
      (Math.cos(toRadians(zenith)) - Math.sin(lat) * Math.sin(declination)) /
      (Math.cos(lat) * Math.cos(declination));
    return toDegrees(Math.acos(clamp(cosAngle, -1, 1))) * 4;
  };

  const sunriseAngle = hourAngle(90.833);
  const fajrAngle = hourAngle(109.5);
  const ishaAngle = hourAngle(107.5);
  const asrAltitude = toDegrees(
    Math.atan(1 / (1 + Math.tan(Math.abs(lat - declination)))),
  );
  const asrAngle = hourAngle(90 - asrAltitude);

  const raw = [
    ["fajr", "الفجر", solarNoon - fajrAngle],
    ["sunrise", "الشروق", solarNoon - sunriseAngle],
    ["dhuhr", "الظهر", solarNoon + 2],
    ["asr", "العصر", solarNoon + asrAngle],
    ["maghrib", "المغرب", solarNoon + sunriseAngle],
    ["isha", "العشاء", solarNoon + ishaAngle],
  ] as const;

  return raw.map(([key, label, minutes]) => ({ key, label, minutes, text: formatMinutes(minutes) }));
}

export function nextPrayer(times: PrayerTime[], now: Date) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const actualPrayers = times.filter((item) => item.key !== "sunrise");
  const next = actualPrayers.find((item) => item.minutes > currentMinutes);
  if (next) return { ...next, remaining: Math.max(0, Math.round((next.minutes - currentMinutes) * 60)) };
  const fajr = actualPrayers[0];
  return { ...fajr, remaining: Math.max(0, Math.round((1440 - currentMinutes + fajr.minutes) * 60)) };
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function hijriDate(date: Date, adjustment = 0) {
  const adjusted = new Date(date);
  adjusted.setDate(adjusted.getDate() + adjustment);
  return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(adjusted);
}

export function gregorianDate(date: Date) {
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
