"use client";

import {
  AlertCircle,
  ArrowRight,
  BellRing,
  BookHeart,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  CircleGauge,
  Compass,
  Download,
  FileText,
  Heart,
  Home,
  Info,
  LocateFixed,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  type Ayah,
  type City,
  type DhikrCategory,
  type QuranPayload,
  type RuqyahRef,
  type Surah,
  calculatePrayerTimes,
  formatDuration,
  gregorianDate,
  hijriDate,
  nextPrayer,
  normalizeArabic,
  qiblaBearing,
} from "@/lib/rafiqi";

type Section =
  | "home"
  | "quran"
  | "tasbih"
  | "adhkar"
  | "more"
  | "prayer"
  | "qibla"
  | "ruqyah"
  | "khatmah"
  | "wird"
  | "notes"
  | "favorites"
  | "settings"
  | "privacy"
  | "about";

type Note = { surah: number; ayah: number; surahName: string; text: string };
type AudioItem = { globalNumber: number; title: string; subtitle: string };
type Edition = {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: "audio" | "text";
  type: string;
};
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const navItems: Array<{ key: Section; label: string; icon: typeof Home }> = [
  { key: "home", label: "الرئيسية", icon: Home },
  { key: "quran", label: "القرآن", icon: BookOpen },
  { key: "tasbih", label: "السبحة", icon: CircleGauge },
  { key: "adhkar", label: "الأذكار", icon: Heart },
  { key: "more", label: "المزيد", icon: MoreHorizontal },
];

const moreItems: Array<{ key: Section; label: string; description: string; icon: typeof Home }> = [
  { key: "prayer", label: "مواقيت الصلاة", description: "حساب محلي حسب موقعك", icon: BellRing },
  { key: "qibla", label: "اتجاه القبلة", description: "اتجاه رقمي وبوصلة الجهاز", icon: Compass },
  { key: "ruqyah", label: "الرقية الشرعية", description: "آيات وأدعية موثقة", icon: ShieldCheck },
  { key: "khatmah", label: "الختمة", description: "خطة مرنة ومتابعة يومية", icon: BookHeart },
  { key: "wird", label: "الورد اليومي", description: "أهداف القرآن والذكر", icon: Star },
  { key: "favorites", label: "المفضلة", description: "آياتك المحفوظة", icon: Bookmark },
  { key: "notes", label: "الملاحظات", description: "ملاحظات مرتبطة بالآيات", icon: FileText },
  { key: "settings", label: "الإعدادات والنسخ", description: "المظهر والنسخ الاحتياطي", icon: Settings },
  { key: "privacy", label: "الخصوصية", description: "لا حسابات ولا تتبع", icon: ShieldCheck },
  { key: "about", label: "حول رفيقي", description: "الإصدار والمصادر", icon: Info },
];

const tasbihPhrases = ["سبحان الله", "الحمد لله", "الله أكبر", "لا إله إلا الله", "أستغفر الله"];

const fallbackReciters: Edition[] = [
  { identifier: "ar.alafasy", language: "ar", name: "مشاري راشد العفاسي", englishName: "Mishary Rashid Alafasy", format: "audio", type: "versebyverse" },
  { identifier: "ar.abdulbasitmurattal", language: "ar", name: "عبد الباسط عبد الصمد — مرتل", englishName: "Abdul Basit Abdus Samad", format: "audio", type: "versebyverse" },
  { identifier: "ar.abdurrahmaansudais", language: "ar", name: "عبد الرحمن السديس", englishName: "Abdurrahmaan As-Sudais", format: "audio", type: "versebyverse" },
  { identifier: "ar.husary", language: "ar", name: "محمود خليل الحصري", englishName: "Mahmoud Khalil Al-Husary", format: "audio", type: "versebyverse" },
  { identifier: "ar.minshawi", language: "ar", name: "محمد صديق المنشاوي — مرتل", englishName: "Minshawi", format: "audio", type: "versebyverse" },
  { identifier: "ar.minshawimujawwad", language: "ar", name: "محمد صديق المنشاوي — مجوّد", englishName: "Minshawi (Mujawwad)", format: "audio", type: "versebyverse" },
];

const fallbackTafsirs: Edition[] = [
  { identifier: "ar.muyassar", language: "ar", name: "التفسير الميسر", englishName: "King Fahad Quran Complex", format: "text", type: "tafsir" },
  { identifier: "ar.jalalayn", language: "ar", name: "تفسير الجلالين", englishName: "Tafsir al-Jalalayn", format: "text", type: "tafsir" },
];

function mergeEditions(required: Edition[], remote: Edition[]) {
  const byIdentifier = new Map(remote.map((edition) => [edition.identifier, edition]));
  return [
    ...required.map((edition) => byIdentifier.get(edition.identifier) ?? edition),
    ...remote.filter((edition) => !required.some((item) => item.identifier === edition.identifier)),
  ];
}

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`rafiqi:${key}`);
      // Hydrate browser-only preferences after the client mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setValue(JSON.parse(saved) as T);
    } catch {
      // Keep the safe default when old local data is malformed.
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(`rafiqi:${key}`, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function ScreenHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <header className="screen-header">
      <div>
        <span className="eyebrow">رفيقي</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {onBack && (
        <Button className="icon-button" variant="outline" size="icon" onClick={onBack} aria-label="رجوع">
          <ArrowRight />
        </Button>
      )}
    </header>
  );
}

function EmptyState({ icon: Icon, title, text, action }: { icon: typeof Home; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function RafiqiApp() {
  const [section, setSection] = useState<Section>("home");
  const [quran, setQuran] = useState<Surah[]>([]);
  const [adhkar, setAdhkar] = useState<DhikrCategory[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [ruqyahRefs, setRuqyahRefs] = useState<RuqyahRef[]>([]);
  const [ruqyahGuidance, setRuqyahGuidance] = useState<Array<{ title: string; text: string; source: string }>>([]);
  const [reciters, setReciters] = useState<Edition[]>(fallbackReciters);
  const [tafsirs, setTafsirs] = useState<Edition[]>(fallbackTafsirs);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(new Date());
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [highlightAyah, setHighlightAyah] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDhikr, setSelectedDhikr] = useState<DhikrCategory | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [detailDialog, setDetailDialog] = useState({ open: false, title: "", text: "", loading: false });
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; surah?: Surah; ayah?: Ayah; text: string }>({ open: false, text: "" });
  const [customDhikrDialog, setCustomDhikrDialog] = useState({ open: false, text: "" });
  const [audioItem, setAudioItem] = useState<AudioItem | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const [theme, setTheme] = useStoredState<"light" | "dark" | "system">("theme", "system");
  const [fontScale, setFontScale] = useStoredState("font-scale", 100);
  const [hijriAdjustment, setHijriAdjustment] = useStoredState("hijri-adjustment", 0);
  const [selectedReciter, setSelectedReciter] = useStoredState("reciter", "ar.alafasy");
  const [selectedTafsir, setSelectedTafsir] = useStoredState("tafsir", "ar.muyassar");
  const [continueRecitation, setContinueRecitation] = useStoredState("continue-recitation", false);
  const [location, setLocation] = useStoredState("location", { latitude: 30.0444, longitude: 31.2357, city: "القاهرة" });
  const [favorites, setFavorites] = useStoredState<Record<string, boolean>>("favorites", {});
  const [notes, setNotes] = useStoredState<Record<string, Note>>("notes", {});
  const [lastRead, setLastRead] = useStoredState<{ surah: number; ayah: number } | null>("last-read", null);
  const [tasbih, setTasbih] = useStoredState("tasbih", { phrase: "سبحان الله", count: 0, goal: 33, total: 0 });
  const [customTasbihPhrases, setCustomTasbihPhrases] = useStoredState<string[]>("custom-tasbih-phrases", []);
  const [dhikrCounts, setDhikrCounts] = useStoredState<Record<string, number>>("dhikr-counts", {});
  const [khatmah, setKhatmah] = useStoredState("khatmah", { days: 30, completedPages: 0, startedAt: new Date().toISOString() });
  const [wird, setWird] = useStoredState("wird", [
    { id: "quran", label: "ورد القرآن", target: 6, value: 0 },
    { id: "morning", label: "أذكار الصباح", target: 1, value: 0 },
    { id: "evening", label: "أذكار المساء", target: 1, value: 0 },
    { id: "istighfar", label: "الاستغفار", target: 100, value: 0 },
    { id: "salawat", label: "الصلاة على النبي ﷺ", target: 10, value: 0 },
  ]);
  const [orientation, setOrientation] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/quran.json").then((response) => response.json() as Promise<QuranPayload>),
      fetch("/data/adhkar.json").then((response) => response.json() as Promise<DhikrCategory[]>),
      fetch("/data/cities.json").then((response) => response.json() as Promise<City[]>),
      fetch("/data/ruqyah_refs.json").then((response) => response.json() as Promise<RuqyahRef[]>),
      fetch("/data/ruqyah_guidance.json").then((response) => response.json() as Promise<Array<{ title: string; text: string; source: string }>>),
    ])
      .then(([quranData, adhkarData, cityData, refs, guidance]) => {
        setQuran(quranData.data.surahs);
        setAdhkar(adhkarData);
        setCities(cityData);
        setRuqyahRefs(refs);
        setRuqyahGuidance(guidance);
      })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const loadEditions = async () => {
      try {
        const [audioResponse, tafsirResponse] = await Promise.all([
          fetch("https://api.alquran.cloud/v1/edition?format=audio&language=ar&type=versebyverse"),
          fetch("https://api.alquran.cloud/v1/edition?format=text&language=ar&type=tafsir"),
        ]);
        if (!audioResponse.ok || !tafsirResponse.ok) return;
        const audioData = (await audioResponse.json()) as { data?: Edition[] };
        const tafsirData = (await tafsirResponse.json()) as { data?: Edition[] };
        if (audioData.data?.length) setReciters(mergeEditions(fallbackReciters, audioData.data));
        if (tafsirData.data?.length) setTafsirs(mergeEditions(fallbackTafsirs, tafsirData.data));
      } catch {
        // The built-in lists remain available when the API is offline.
      }
    };
    void loadEditions();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const online = () => setOffline(false);
    const offlineHandler = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineHandler);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", installHandler);
    return () => window.removeEventListener("beforeinstallprompt", installHandler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    root.dataset.theme = resolved;
    root.style.setProperty("--user-font-scale", String(fontScale / 100));
  }, [theme, fontScale]);

  useEffect(() => {
    if (!highlightAyah || !selectedSurah) return;
    const timer = window.setTimeout(() => document.getElementById(`ayah-${highlightAyah}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 160);
    return () => window.clearTimeout(timer);
  }, [highlightAyah, selectedSurah]);

  useEffect(() => () => audioElement?.pause(), [audioElement]);

  const prayerTimes = calculatePrayerTimes(now, location.latitude, location.longitude);
  const upcoming = useMemo(() => nextPrayer(prayerTimes, now), [prayerTimes, now]);
  const bearing = useMemo(() => qiblaBearing(location.latitude, location.longitude), [location]);

  const searchResults = useMemo(() => {
    const query = normalizeArabic(search.trim());
    if (!query) return [];
    const results: Array<{ surah: Surah; ayah: Ayah }> = [];
    for (const surah of quran) {
      if (normalizeArabic(`${surah.name} ${surah.englishName}`).includes(query)) {
        surah.ayahs.slice(0, 3).forEach((ayah) => results.push({ surah, ayah }));
      }
      for (const ayah of surah.ayahs) {
        if (normalizeArabic(ayah.text).includes(query)) results.push({ surah, ayah });
        if (results.length >= 60) return results;
      }
    }
    return results;
  }, [quran, search]);

  const navigate = (next: Section) => {
    setSelectedSurah(null);
    setHighlightAyah(null);
    setSelectedDhikr(null);
    setSection(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openSurah = (surah: Surah, ayahNumber?: number) => {
    setSelectedSurah(surah);
    setHighlightAyah(ayahNumber ?? null);
    setLastRead({ surah: surah.number, ayah: ayahNumber ?? 1 });
    setSection("quran");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAyahReference = (surahNumber: number, ayahNumber: number) => {
    const surah = quran.find((item) => item.number === surahNumber);
    if (surah) openSurah(surah, ayahNumber);
  };

  const playAyah = async (surah: Surah, ayah: Ayah) => {
    audioElement?.pause();
    const reciter = reciters.find((edition) => edition.identifier === selectedReciter) ?? fallbackReciters[0];
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.number}/${selectedReciter}`);
      if (!response.ok) throw new Error("network");
      const result = (await response.json()) as { data?: { audio?: string } };
      if (!result.data?.audio) throw new Error("audio");
      const audio = new Audio(result.data.audio);
      setAudioElement(audio);
      setAudioItem({ globalNumber: ayah.number, title: `${surah.name} — الآية ${ayah.numberInSurah}`, subtitle: reciter.name || reciter.englishName });
      setLastRead({ surah: surah.number, ayah: ayah.numberInSurah });
      setHighlightAyah(ayah.numberInSurah);
      audio.addEventListener("play", () => setAudioPlaying(true));
      audio.addEventListener("pause", () => setAudioPlaying(false));
      audio.addEventListener("ended", () => {
        setAudioPlaying(false);
        if (localStorage.getItem("rafiqi:continue-recitation") !== "true") return;
        const currentIndex = surah.ayahs.findIndex((item) => item.number === ayah.number);
        const nextAyah = surah.ayahs[currentIndex + 1];
        if (nextAyah) {
          void playAyah(surah, nextAyah);
          return;
        }
        const nextSurah = quran.find((item) => item.number === surah.number + 1);
        if (nextSurah?.ayahs[0]) {
          setSelectedSurah(nextSurah);
          setHighlightAyah(1);
          window.scrollTo({ top: 0, behavior: "smooth" });
          void playAyah(nextSurah, nextSurah.ayahs[0]);
          return;
        }
        setAudioItem(null);
        setAudioElement(null);
      });
      await audio.play();
    } catch {
      setAudioPlaying(false);
      setDetailDialog({ open: true, title: "تعذر تشغيل التلاوة", text: "يحتاج هذا المحتوى إلى اتصال بالإنترنت وسماح المتصفح بتشغيل الصوت.", loading: false });
    }
  };

  const closeAudio = () => {
    audioElement?.pause();
    setAudioElement(null);
    setAudioPlaying(false);
    setAudioItem(null);
  };

  const toggleAudio = () => {
    const audio = audioElement;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => undefined);
    else audio.pause();
  };

  const fetchEdition = async (ayah: Ayah, kind: "tafsir" | "translation") => {
    const edition = kind === "tafsir" ? selectedTafsir : "en.sahih";
    const tafsir = tafsirs.find((item) => item.identifier === selectedTafsir);
    setDetailDialog({ open: true, title: kind === "tafsir" ? (tafsir?.name || tafsir?.englishName || "التفسير") : "الترجمة الإنجليزية", text: "", loading: true });
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.number}/${edition}`);
      if (!response.ok) throw new Error("network");
      const result = (await response.json()) as { data?: { text?: string } };
      setDetailDialog((current) => ({ ...current, text: result.data?.text ?? "لا يوجد محتوى متاح.", loading: false }));
    } catch {
      setDetailDialog((current) => ({ ...current, text: "يحتاج هذا المحتوى إلى اتصال بالإنترنت. حاول مرة أخرى.", loading: false }));
    }
  };

  const saveNote = () => {
    const { surah, ayah, text } = noteDialog;
    if (!surah || !ayah) return;
    const key = `${surah.number}:${ayah.numberInSurah}`;
    if (text.trim()) {
      setNotes((current) => ({ ...current, [key]: { surah: surah.number, ayah: ayah.numberInSurah, surahName: surah.name, text: text.trim() } }));
    } else {
      setNotes((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
    setNoteDialog({ open: false, text: "" });
  };

  const saveCustomDhikr = () => {
    const phrase = customDhikrDialog.text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!phrase) return;
    const existing = [...tasbihPhrases, ...customTasbihPhrases].find(
      (item) => normalizeArabic(item) === normalizeArabic(phrase),
    );
    const selected = existing ?? phrase;
    if (!existing) setCustomTasbihPhrases((current) => [...current, phrase]);
    setTasbih({ ...tasbih, phrase: selected, count: 0 });
    setCustomDhikrDialog({ open: false, text: "" });
  };

  const removeSelectedCustomDhikr = () => {
    setCustomTasbihPhrases((current) => current.filter((phrase) => phrase !== tasbih.phrase));
    setTasbih({ ...tasbih, phrase: tasbihPhrases[0], count: 0 });
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setDetailDialog({ open: true, title: "الموقع غير متاح", text: "متصفحك لا يدعم تحديد الموقع. اختر مدينة يدويًا.", loading: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, city: "موقعي الحالي" }),
      () => setDetailDialog({ open: true, title: "لم يتم السماح بالموقع", text: "يمكنك الاستمرار واختيار مدينة يدويًا دون مشاركة موقعك.", loading: false }),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const enableCompass = async () => {
    const Orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
    if (Orientation.requestPermission) {
      const permission = await Orientation.requestPermission();
      if (permission !== "granted") return;
    }
    const handler = (event: DeviceOrientationEvent) => {
      const webkitCompass = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      setOrientation(webkitCompass ?? (event.alpha == null ? null : 360 - event.alpha));
    };
    window.addEventListener("deviceorientationabsolute", handler as EventListener, { once: false });
    window.addEventListener("deviceorientation", handler, { once: false });
  };

  const exportBackup = () => {
    const data: Record<string, unknown> = { format: "rafiqi-web-backup", version: 1, exportedAt: new Date().toISOString() };
    Object.keys(localStorage).filter((key) => key.startsWith("rafiqi:")).forEach((key) => {
      try { data[key] = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { data[key] = null; }
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rafiqi-web-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const restoreBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Record<string, unknown>;
        if (data.format !== "rafiqi-web-backup" || data.version !== 1) throw new Error("format");
        Object.entries(data).filter(([key]) => key.startsWith("rafiqi:")).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
        window.location.reload();
      } catch {
        setDetailDialog({ open: true, title: "تعذر استعادة النسخة", text: "الملف ليس نسخة رفيقي صالحة أو إصدارها غير مدعوم.", loading: false });
      }
    };
    reader.readAsText(file);
  };

  const installPwa = async () => {
    if (!installPrompt) {
      setDetailDialog({ open: true, title: "تثبيت رفيقي", text: "من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». إذا كان مثبتًا بالفعل فلن يظهر الطلب.", loading: false });
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const renderHome = () => {
    const continueSurah = lastRead ? quran.find((item) => item.number === lastRead.surah) : quran[0];
    const wirdDone = wird.reduce((sum, item) => sum + Math.min(item.value / item.target, 1), 0);
    return (
      <div className="screen home-screen">
        <section className="brand-row">
          <div className="brand-lockup">
            <Image src="/icons/icon-192.png" alt="شعار رفيقي" width={192} height={192} className="brand-logo" priority unoptimized />
            <div><span className="eyebrow">رفيقك في كل يوم</span><h1>رفيقي</h1><p>{hijriDate(now, hijriAdjustment)}</p></div>
          </div>
          <div className="header-actions">
            <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="تبديل الوضع الليلي">
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate("settings")} aria-label="فتح الإعدادات"><Settings /></Button>
          </div>
        </section>

        {offline && <div className="offline-banner"><AlertCircle /> تعمل البيانات المحفوظة دون إنترنت؛ التلاوة والتفسير قد لا يتوفران.</div>}

        <section className="prayer-hero">
          <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="hero-copy">
            <span className="hero-kicker">الصلاة القادمة · {location.city}</span>
            <h2>{upcoming.label}</h2>
            <strong>{upcoming.text}</strong>
            <p>متبقي {formatDuration(upcoming.remaining)}</p>
          </div>
          <div className="hero-mosque" aria-hidden="true"><Moon /><span>الله</span></div>
          <Button className="hero-button" onClick={() => navigate("prayer")}>كل المواقيت <ChevronLeft /></Button>
        </section>

        <section className="date-strip"><span>{gregorianDate(now)}</span><span>بياناتك محفوظة على هذا الجهاز فقط</span></section>

        <section className="daily-grid">
          <button className="feature-card lavender" onClick={() => continueSurah && openSurah(continueSurah, lastRead?.ayah)}>
            <span className="feature-icon"><BookOpen /></span><span><small>أكمل القرآن</small><strong>{continueSurah ? `سورة ${continueSurah.name.replace("سُورَةُ", "")}` : "القرآن الكريم"}</strong><em>آخر موضع محفوظ تلقائيًا</em></span><ChevronLeft />
          </button>
          <button className="feature-card mint" onClick={() => navigate("wird")}>
            <span className="feature-icon"><Heart /></span><span><small>وردي اليومي</small><strong>{Math.round((wirdDone / wird.length) * 100)}٪ مكتمل</strong><em>قرآن وذكر واستغفار</em></span><ChevronLeft />
          </button>
          <button className="feature-card gold-wash" onClick={() => navigate("tasbih")}>
            <span className="feature-icon"><CircleGauge /></span><span><small>السبحة</small><strong>{tasbih.count} / {tasbih.goal}</strong><em>{tasbih.phrase}</em></span><ChevronLeft />
          </button>
          <button className="feature-card rose" onClick={() => navigate("adhkar")}>
            <span className="feature-icon"><Sparkles /></span><span><small>ذكر اليوم</small><strong>أذكار الصباح والمساء</strong><em>محتوى محلي يعمل دون إنترنت</em></span><ChevronLeft />
          </button>
        </section>

        <section className="download-panel">
          <div><span className="eyebrow light">تجربة Android الكاملة</span><h2>الأذان الدقيق والتشغيل في الخلفية</h2><p>نسخة Android هي المرجع للتنبيهات والأذان أثناء إغلاق الصفحة.</p></div>
          <Button asChild className="download-button"><a href="/download/Rafiqi.apk" download><Download /> تحميل تطبيق Android</a></Button>
        </section>

        <section className="install-panel"><div><Download /><span><strong>ثبّت نسخة الويب</strong><small>تعمل كتطبيق وتدعم القراءة والذكر Offline.</small></span></div><Button variant="outline" onClick={installPwa}>تثبيت PWA</Button></section>
      </div>
    );
  };

  const renderQuran = () => {
    const editionSelectors = (
      <div className="quran-preferences">
        <label><Volume2 /><span>القارئ</span><select value={selectedReciter} onChange={(event) => setSelectedReciter(event.target.value)}>{reciters.map((edition) => <option key={edition.identifier} value={edition.identifier}>{edition.name || edition.englishName}</option>)}</select></label>
        <label><BookOpen /><span>التفسير</span><select value={selectedTafsir} onChange={(event) => setSelectedTafsir(event.target.value)}>{tafsirs.map((edition) => <option key={edition.identifier} value={edition.identifier}>{edition.name || edition.englishName}</option>)}</select></label>
        <div className="continue-recitation"><span><Play /><span><strong>متابعة التلاوة تلقائيًا</strong><small>تشغيل الآية التالية ثم الانتقال للسورة التالية.</small></span></span><Switch checked={continueRecitation} onCheckedChange={setContinueRecitation} aria-label="متابعة التلاوة تلقائيًا" /></div>
      </div>
    );
    if (selectedSurah) {
      return (
        <div className="screen reader-screen">
          <ScreenHeader title={selectedSurah.name} subtitle={`${selectedSurah.ayahs.length} آية · ${selectedSurah.revelationType === "Meccan" ? "مكية" : "مدنية"}`} onBack={() => { setSelectedSurah(null); setHighlightAyah(null); }} />
          {editionSelectors}
          <div className="reader-banner"><span>اقرأ بخشوع وهدوء</span><strong>اضغط إجراءات الآية للاستماع أو التفسير أو كتابة ملاحظة</strong></div>
          {selectedSurah.number !== 1 && selectedSurah.number !== 9 && <p className="basmala">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>}
          <div className="ayah-list">
            {selectedSurah.ayahs.map((ayah) => {
              const key = `${selectedSurah.number}:${ayah.numberInSurah}`;
              return (
                <article id={`ayah-${ayah.numberInSurah}`} key={ayah.number} className={`ayah-card ${highlightAyah === ayah.numberInSurah ? "highlight" : ""}`}>
                  <div className="ayah-meta"><span className="ayah-number">{ayah.numberInSurah}</span><span>الجزء {ayah.juz} · صفحة {ayah.page}</span>{ayah.sajda ? <span>سجدة</span> : null}</div>
                  <p className="ayah-text">{ayah.text} <span className="verse-mark">﴿{ayah.numberInSurah}﴾</span></p>
                  <div className="ayah-actions">
                    <Button variant="ghost" size="sm" onClick={() => playAyah(selectedSurah, ayah)}><Play /> استماع</Button>
                    <Button variant="ghost" size="sm" onClick={() => fetchEdition(ayah, "tafsir")}><BookOpen /> تفسير</Button>
                    <Button variant="ghost" size="sm" onClick={() => fetchEdition(ayah, "translation")}><Share2 /> ترجمة</Button>
                    <Button variant="ghost" size="sm" aria-label="إضافة إلى المفضلة" onClick={() => setFavorites((current) => ({ ...current, [key]: !current[key] }))} className={favorites[key] ? "active-action" : ""}><Heart /> {favorites[key] ? "محفوظة" : "مفضلة"}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setNoteDialog({ open: true, surah: selectedSurah, ayah, text: notes[key]?.text ?? "" })}><FileText /> {notes[key] ? "تعديل الملاحظة" : "ملاحظة"}</Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="screen">
        <ScreenHeader title="القرآن الكريم" subtitle="114 سورة · 6236 آية محفوظة للقراءة دون إنترنت" />
        {editionSelectors}
        <div className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في الآيات أو باسم السورة" aria-label="البحث في القرآن" />{search && <button onClick={() => setSearch("")} aria-label="مسح البحث"><X /></button>}</div>
        {loading ? <div className="loading-grid">{Array.from({ length: 8 }).map((_, index) => <span key={index} />)}</div> : search ? (
          <div className="search-results">
            <span className="section-label">{searchResults.length} نتيجة ظاهرة</span>
            {searchResults.map(({ surah, ayah }) => <button key={`${surah.number}-${ayah.number}`} className="search-result" onClick={() => openSurah(surah, ayah.numberInSurah)}><span>{surah.name} · {ayah.numberInSurah}</span><p>{ayah.text}</p><ChevronLeft /></button>)}
            {!searchResults.length && <EmptyState icon={Search} title="لا توجد نتائج" text="جرّب كلمة أخرى بدون تشكيل." />}
          </div>
        ) : (
          <div className="surah-grid">
            {quran.map((surah) => <button key={surah.number} className="surah-card" onClick={() => openSurah(surah)}><span className="surah-number">{surah.number}</span><span><strong>{surah.name}</strong><small>{surah.englishName} · {surah.ayahs.length} آية</small></span><ChevronLeft /></button>)}
          </div>
        )}
      </div>
    );
  };

  const renderTasbih = () => {
    const progress = Math.min(tasbih.count / tasbih.goal, 1);
    const beads = Array.from({ length: 33 });
    const phrases = [...tasbihPhrases, ...customTasbihPhrases];
    return (
      <div className="screen tasbih-screen">
        <ScreenHeader title="السبحة" subtitle="عداد هادئ يُحفظ تلقائيًا على جهازك" />
        <div className="tasbih-selectors">
          <div className="selector-field"><label>الذِكر<select value={tasbih.phrase} onChange={(event) => setTasbih({ ...tasbih, phrase: event.target.value, count: 0 })}>{phrases.map((phrase) => <option key={phrase}>{phrase}</option>)}</select></label><div className="custom-dhikr-actions"><button type="button" onClick={() => setCustomDhikrDialog({ open: true, text: "" })}><Plus /> إضافة ذكر مخصص</button>{customTasbihPhrases.includes(tasbih.phrase) && <button type="button" className="remove" onClick={removeSelectedCustomDhikr}><Trash2 /> حذف المخصص</button>}</div></div>
          <label>الهدف<select value={tasbih.goal} onChange={(event) => setTasbih({ ...tasbih, goal: Number(event.target.value) })}>{[33, 100, 300, 1000].map((goal) => <option key={goal} value={goal}>{goal}</option>)}</select></label>
        </div>
        <div className="bead-stage">
          <div className="bead-ring" style={{ "--progress": `${progress * 360}deg` } as React.CSSProperties}>
            {beads.map((_, index) => <span key={index} className={index < Math.round(progress * 33) ? "done" : ""} style={{ transform: `rotate(${index * (360 / 33)}deg) translateY(-143px)` }} />)}
            <button className="tasbih-button" onClick={() => setTasbih({ ...tasbih, count: tasbih.count + 1, total: tasbih.total + 1 })} aria-label="اضغط للعد">
              <small>{tasbih.phrase}</small><strong>{tasbih.count}</strong><span>اضغط للعد</span>
            </button>
          </div>
        </div>
        <div className="tasbih-progress"><span style={{ width: `${progress * 100}%` }} /></div>
        <div className="tasbih-actions">
          <Button variant="outline" onClick={() => tasbih.count > 0 && setTasbih({ ...tasbih, count: tasbih.count - 1, total: Math.max(0, tasbih.total - 1) })}><Undo2 /> تراجع</Button>
          <AlertDialog><AlertDialogTrigger asChild><Button variant="outline"><RotateCcw /> تصفير</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>تصفير العداد؟</AlertDialogTitle><AlertDialogDescription>سيبدأ عداد الجلسة الحالية من الصفر، وسيظل الإجمالي محفوظًا.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => setTasbih({ ...tasbih, count: 0 })}>تصفير</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
        <div className="stats-row"><div><strong>{tasbih.count}</strong><span>الجلسة</span></div><div><strong>{tasbih.total}</strong><span>الإجمالي</span></div><div><strong>{Math.floor(tasbih.total / 33)}</strong><span>دورات مكتملة</span></div></div>
      </div>
    );
  };

  const renderAdhkar = () => {
    if (selectedDhikr) {
      return <div className="screen"><ScreenHeader title={selectedDhikr.title} subtitle={`${selectedDhikr.items.length} ذكرًا محفوظًا محليًا`} onBack={() => setSelectedDhikr(null)} /><div className="dhikr-list">{selectedDhikr.items.map((item, index) => {
        const key = `${selectedDhikr.title}:${item.id}`;
        const count = dhikrCounts[key] ?? 0;
        return <article className="dhikr-card" key={key}><span className="dhikr-index">{index + 1}</span><p>{item.text}</p>{item.source && <small>{item.source}</small>}<button className={count >= item.repeat ? "complete" : ""} onClick={() => setDhikrCounts((current) => ({ ...current, [key]: count >= item.repeat ? 0 : count + 1 }))}><span>{Math.min(count, item.repeat)} / {item.repeat}</span>{count >= item.repeat ? <Check /> : <Plus />}</button></article>;
      })}</div></div>;
    }
    return <div className="screen"><ScreenHeader title="الأذكار" subtitle="حصن المسلم — تقدمك محفوظ محليًا" /><div className="category-grid">{adhkar.map((category, index) => {
      const completed = category.items.filter((item) => (dhikrCounts[`${category.title}:${item.id}`] ?? 0) >= item.repeat).length;
      return <button key={category.title} className="category-card" onClick={() => setSelectedDhikr(category)}><span className={`category-orb orb-${index % 4}`}><Sparkles /></span><span><strong>{category.title}</strong><small>{completed} من {category.items.length} مكتمل</small></span><ChevronLeft /></button>;
    })}</div></div>;
  };

  const renderPrayer = () => <div className="screen"><ScreenHeader title="مواقيت الصلاة" subtitle={`حساب محلي تقريبي — ${location.city}`} onBack={() => navigate("more")} /><section className="location-panel"><div><LocateFixed /><span><strong>{location.city}</strong><small>{location.latitude.toFixed(4)}، {location.longitude.toFixed(4)}</small></span></div><Button variant="outline" onClick={requestLocation}>استخدم موقعي</Button><label>أو اختر مدينة<select value={cities.findIndex((city) => city.city === location.city)} onChange={(event) => { const city = cities[Number(event.target.value)]; if (city) setLocation({ latitude: city.latitude, longitude: city.longitude, city: city.city }); }}><option value={-1}>اختر مدينة</option>{cities.map((city, index) => <option key={`${city.country}-${city.city}`} value={index}>{city.city} — {city.country}</option>)}</select></label></section><div className="prayer-list">{prayerTimes.map((prayer) => <div key={prayer.key} className={upcoming.key === prayer.key ? "next" : ""}><span><strong>{prayer.label}</strong>{upcoming.key === prayer.key && <small>الصلاة القادمة</small>}</span><time>{prayer.text}</time></div>)}</div><div className="web-limitation"><AlertCircle /><p><strong>تنبيه مهم لنسخة الويب</strong>قد يمنع المتصفح تشغيل الأذان تلقائيًا في الخلفية أو بعد إغلاق الصفحة. استخدم نسخة Android للأذان الدقيق.</p><Button asChild><a href="/download/Rafiqi.apk" download><Download /> Android</a></Button></div><audio controls className="adhan-preview" src="/audio-adhan.mp3">متصفحك لا يدعم الصوت.</audio></div>;

  const renderQibla = () => {
    const needle = orientation == null ? bearing : bearing - orientation;
    return <div className="screen"><ScreenHeader title="اتجاه القبلة" subtitle={`من ${location.city}`} onBack={() => navigate("more")} /><div className="qibla-stage"><div className="compass-face"><span className="north">ش</span><span className="east">ق</span><span className="south">ج</span><span className="west">غ</span><div className="qibla-needle" style={{ transform: `rotate(${needle}deg)` }}><span /><div className="kaaba">◆</div></div><div className="compass-center" /></div><strong>{Math.round(bearing)}°</strong><p>من الشمال الجغرافي باتجاه عقارب الساعة</p><Button onClick={enableCompass}><Compass /> تفعيل بوصلة الجهاز</Button></div><div className="info-card"><Info /><p>إذا لم يدعم جهازك حساس الاتجاه سيظل الرقم الدقيق متاحًا. أبعد الهاتف عن المعادن وعاير البوصلة بحركة رقم 8.</p></div></div>;
  };

  const renderRuqyah = () => <div className="screen"><ScreenHeader title="الرقية الشرعية" subtitle="آيات وأدعية ثابتة بلا طلاسم أو ادعاء شفاء" onBack={() => navigate("more")} /><div className="guidance-grid">{ruqyahGuidance.map((item) => <article key={item.title}><ShieldCheck /><strong>{item.title}</strong><p>{item.text}</p><small>{item.source}</small></article>)}</div><h2 className="section-title">آيات الرقية</h2><div className="ruqyah-list">{ruqyahRefs.map((ref) => <article key={`${ref.surah}-${ref.from}`}><span><strong>{ref.title}</strong><small>{ref.source}</small></span><Button variant="outline" onClick={() => openAyahReference(ref.surah, ref.from)}>فتح الآيات</Button></article>)}</div></div>;

  const renderKhatmah = () => {
    const percentage = Math.min((khatmah.completedPages / 604) * 100, 100);
    const daily = Math.ceil((604 - khatmah.completedPages) / Math.max(khatmah.days, 1));
    return <div className="screen"><ScreenHeader title="خطة الختمة" subtitle="تقدمك محفوظ على هذا الجهاز" onBack={() => navigate("more")} /><div className="khatmah-hero"><div className="progress-ring" style={{ "--value": `${percentage * 3.6}deg` } as React.CSSProperties}><span><strong>{Math.round(percentage)}٪</strong><small>{khatmah.completedPages} من 604 صفحة</small></span></div><div><span className="eyebrow light">الهدف الحالي</span><h2>ختمة خلال {khatmah.days} يومًا</h2><p>اقرأ نحو {daily} صفحة يوميًا لإكمال الخطة.</p></div></div><div className="plan-options">{[30, 60, 90].map((days) => <button className={khatmah.days === days ? "active" : ""} key={days} onClick={() => setKhatmah({ ...khatmah, days })}>{days}<small>يومًا</small></button>)}</div><label className="range-field"><span>الصفحات المكتملة <strong>{khatmah.completedPages}</strong></span><Slider min={0} max={604} step={1} value={[khatmah.completedPages]} onValueChange={(value) => setKhatmah({ ...khatmah, completedPages: value[0] })} /></label><div className="action-row"><Button onClick={() => setKhatmah({ ...khatmah, completedPages: Math.min(604, khatmah.completedPages + daily) })}><Plus /> تسجيل ورد اليوم</Button><Button variant="outline" onClick={() => { const surah = lastRead ? quran.find((item) => item.number === lastRead.surah) : quran[0]; if (surah) openSurah(surah, lastRead?.ayah); }}><BookOpen /> فتح القرآن</Button></div></div>;
  };

  const renderWird = () => {
    const total = Math.round((wird.reduce((sum, item) => sum + Math.min(item.value / item.target, 1), 0) / wird.length) * 100);
    return <div className="screen"><ScreenHeader title="وردي اليومي" subtitle="خطوات صغيرة ثابتة خير من الانقطاع" onBack={() => navigate("more")} /><div className="wird-summary"><span className="summary-ring" style={{ "--value": `${total * 3.6}deg` } as React.CSSProperties}><strong>{total}٪</strong></span><div><h2>تقدم اليوم</h2><p>{wird.filter((item) => item.value >= item.target).length} من {wird.length} أهداف مكتملة</p></div></div><div className="wird-list">{wird.map((item, index) => { const done = item.value >= item.target; return <article key={item.id} className={done ? "done" : ""}><button aria-label={`تبديل ${item.label}`} onClick={() => setWird(wird.map((entry, itemIndex) => itemIndex === index ? { ...entry, value: done ? 0 : entry.target } : entry))}>{done ? <Check /> : <Plus />}</button><span><strong>{item.label}</strong><small>{item.value} من {item.target}</small></span><div className="mini-progress"><span style={{ width: `${Math.min((item.value / item.target) * 100, 100)}%` }} /></div><Button variant="ghost" size="icon-sm" onClick={() => setWird(wird.map((entry, itemIndex) => itemIndex === index ? { ...entry, value: Math.min(entry.target, entry.value + 1) } : entry))}><Plus /></Button></article>; })}</div></div>;
  };

  const renderNotes = () => { const values = Object.values(notes); return <div className="screen"><ScreenHeader title="الملاحظات" subtitle="تُضاف من زر «ملاحظة» أسفل كل آية" onBack={() => navigate("more")} /><div className="instruction-card"><FileText /><div><strong>كيف أضيف ملاحظة؟</strong><p>افتح القرآن، اختر السورة، ثم اضغط «ملاحظة» أسفل الآية. ستظهر هنا ويمكنك الرجوع للآية أو تعديلها.</p></div><Button variant="outline" onClick={() => navigate("quran")}>فتح القرآن</Button></div>{values.length ? <div className="notes-list">{values.map((note) => <article key={`${note.surah}:${note.ayah}`}><span><small>{note.surahName} · الآية {note.ayah}</small><p>{note.text}</p></span><div><Button variant="outline" size="sm" onClick={() => openAyahReference(note.surah, note.ayah)}>فتح الآية</Button><Button variant="ghost" size="icon-sm" onClick={() => { const surah = quran.find((item) => item.number === note.surah); const ayah = surah?.ayahs.find((item) => item.numberInSurah === note.ayah); if (surah && ayah) setNoteDialog({ open: true, surah, ayah, text: note.text }); }}><FileText /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon-sm"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف الملاحظة؟</AlertDialogTitle><AlertDialogDescription>لن يمكن استعادتها إلا من نسخة احتياطية سابقة.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => setNotes((current) => { const next = { ...current }; delete next[`${note.surah}:${note.ayah}`]; return next; })}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></article>)}</div> : <EmptyState icon={FileText} title="لا توجد ملاحظات محفوظة" text="أضف ملاحظتك أثناء قراءة أي آية وستجدها هنا." action={<Button onClick={() => navigate("quran")}><BookOpen /> فتح القرآن</Button>} />}</div>; };

  const renderFavorites = () => { const items = Object.entries(favorites).filter(([, value]) => value).map(([key]) => { const [surahNumber, ayahNumber] = key.split(":").map(Number); const surah = quran.find((item) => item.number === surahNumber); const ayah = surah?.ayahs.find((item) => item.numberInSurah === ayahNumber); return surah && ayah ? { key, surah, ayah } : null; }).filter(Boolean) as Array<{ key: string; surah: Surah; ayah: Ayah }>; return <div className="screen"><ScreenHeader title="الآيات المفضلة" subtitle={`${items.length} آية محفوظة`} onBack={() => navigate("more")} />{items.length ? <div className="favorite-list">{items.map(({ key, surah, ayah }) => <article key={key}><small>{surah.name} · {ayah.numberInSurah}</small><p className="ayah-text compact">{ayah.text}</p><div><Button variant="outline" size="sm" onClick={() => openSurah(surah, ayah.numberInSurah)}>فتح</Button><Button variant="ghost" size="icon-sm" onClick={() => setFavorites((current) => ({ ...current, [key]: false }))}><Trash2 /></Button></div></article>)}</div> : <EmptyState icon={Heart} title="لا توجد آيات مفضلة" text="اضغط زر المفضلة أسفل أي آية لحفظها هنا." />}</div>; };

  const renderSettings = () => <div className="screen"><ScreenHeader title="الإعدادات والنسخ" subtitle="كل الإعدادات والبيانات محلية" onBack={() => navigate("more")} /><div className="settings-list"><section><div><Moon /><span><strong>المظهر</strong><small>فاتح أو ليلي أو حسب الجهاز</small></span></div><select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="system">حسب الجهاز</option><option value="light">فاتح</option><option value="dark">ليلي</option></select></section><section className="vertical"><div><BookOpen /><span><strong>حجم النص</strong><small>{fontScale}٪</small></span></div><Slider min={85} max={135} step={5} value={[fontScale]} onValueChange={(value) => setFontScale(value[0])} /></section><section><div><Moon /><span><strong>تصحيح التاريخ الهجري</strong><small>من -2 إلى +2 يوم</small></span></div><select value={hijriAdjustment} onChange={(event) => setHijriAdjustment(Number(event.target.value))}>{[-2, -1, 0, 1, 2].map((value) => <option key={value} value={value}>{value > 0 ? `+${value}` : value}</option>)}</select></section><section><div><BellRing /><span><strong>تنبيهات الويب</strong><small>حسب دعم المتصفح، ولا تضمن الأذان بالخلفية</small></span></div><Switch onCheckedChange={(checked) => checked && Notification.requestPermission()} /></section></div><div className="backup-panel"><div><ShieldCheck /><span><h2>نسخة احتياطية</h2><p>تشمل المفضلة والملاحظات والختمة والورد والسبحة والإعدادات، ولا تشمل ملفات الصوت.</p></span></div><div className="action-row"><Button onClick={exportBackup}><Download /> تصدير النسخة</Button><Button asChild variant="outline"><label>استعادة نسخة<input type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) restoreBackup(file); }} /></label></Button></div></div><div className="download-panel compact-panel"><div><h2>تحميل تطبيق Android</h2><p>للتنبيهات والأذان والتشغيل في الخلفية بصورة أدق.</p></div><Button asChild><a href="/download/Rafiqi.apk" download><Download /> Rafiqi.apk</a></Button></div></div>;

  const renderPrivacy = () => <div className="screen"><ScreenHeader title="الخصوصية" subtitle="رفيقي يحترم خصوصيتك من التصميم" onBack={() => navigate("more")} /><div className="policy-hero"><ShieldCheck /><h2>بياناتك لك وحدك</h2><p>لا حساب، لا إعلانات، لا تتبع، ولا بيع للبيانات.</p></div><div className="policy-list">{["المفضلة والملاحظات والتقدم والإعدادات تُحفظ داخل متصفحك فقط.", "الموقع يُطلب عند اختيارك لحساب الصلاة والقبلة ولا يُرسل إلى خادم رفيقي.", "القرآن والأذكار والرقية محفوظة داخل التطبيق وتعمل دون إنترنت بعد أول زيارة.", "التفسير والترجمة والتلاوة قد تُطلب مباشرة من AlQuran.Cloud وIslamic Network.", "يمكنك تصدير بياناتك أو مسح بيانات الموقع من إعدادات المتصفح في أي وقت."].map((text) => <div key={text}><Check /><p>{text}</p></div>)}</div></div>;

  const renderAbout = () => <div className="screen"><ScreenHeader title="حول رفيقي" subtitle="رفيقك للقرآن والذكر والصلاة" onBack={() => navigate("more")} /><div className="about-card"><Image src="/icons/icon-192.png" alt="شعار رفيقي" width={192} height={192} unoptimized /><h2>رفيقي Web / PWA</h2><strong>Version 1.2.0</strong><p>نسخة ويب عربية بدون حسابات أو Backend، تعمل محليًا حيثما تسمح إمكانات المتصفح.</p><a className="official-site" href="https://rafiqi.iegy.net/" target="_blank" rel="noreferrer">الموقع الرسمي: <strong>rafiqi.iegy.net</strong></a><Button asChild><a href="/download/Rafiqi.apk" download><Download /> تحميل Android</a></Button></div><div className="sources-card"><h3>المصادر والنِسب</h3><p>نص القرآن والتلاوة والتفسير والترجمة عبر بيانات AlQuran.Cloud وIslamic Network عند الحاجة. الأذكار من حصن المسلم والبيانات الموثقة المدمجة في رفيقي.</p><p>واجهة الويب لا تعد بتشغيل الأذان تلقائيًا أثناء إغلاق الصفحة بسبب قيود المتصفحات.</p></div><a className="developer-credit" href="https://iegy.net/" target="_blank" rel="noreferrer">Designed &amp; Developed by Mohammed Hussein · <strong>iegy.net</strong></a></div>;

  const renderMore = () => <div className="screen"><ScreenHeader title="المزيد" subtitle="كل أدوات رفيقي في مكان واحد" /><div className="more-grid">{moreItems.map(({ key, label, description, icon: Icon }, index) => <button key={key} onClick={() => navigate(key)}><span className={`more-icon more-${index % 5}`}><Icon /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronLeft /></button>)}</div><div className="download-panel"><div><span className="eyebrow light">Android v1.1.0</span><h2>حمّل تطبيق رفيقي</h2><p>نزّل ملف APK ثم افتحه واسمح لمتصفحك بالتثبيت عند الطلب. التطبيق بلا إعلانات أو تتبع، ويحفظ بياناتك محليًا على جهازك.</p></div><Button asChild className="download-button"><a href="/download/Rafiqi.apk" download><Download /> تحميل APK</a></Button></div></div>;

  const content = section === "home" ? renderHome() : section === "quran" ? renderQuran() : section === "tasbih" ? renderTasbih() : section === "adhkar" ? renderAdhkar() : section === "prayer" ? renderPrayer() : section === "qibla" ? renderQibla() : section === "ruqyah" ? renderRuqyah() : section === "khatmah" ? renderKhatmah() : section === "wird" ? renderWird() : section === "notes" ? renderNotes() : section === "favorites" ? renderFavorites() : section === "settings" ? renderSettings() : section === "privacy" ? renderPrivacy() : section === "about" ? renderAbout() : renderMore();

  return (
    <main className="app-shell">
      <div className="desktop-sidebar">
        <div className="sidebar-brand"><Image src="/icons/icon-192.png" alt="" width={192} height={192} unoptimized /><span><strong>رفيقي</strong><small>معك في كل خطوة</small></span></div>
        <nav>{navItems.map(({ key, label, icon: Icon }) => <button className={section === key ? "active" : ""} onClick={() => navigate(key)} key={key}><Icon />{label}</button>)}</nav>
        <div className="sidebar-bottom"><Button asChild><a href="/download/Rafiqi.apk" download><Download /> تطبيق Android</a></Button><a href="https://iegy.net/" target="_blank" rel="noreferrer">Mohammed Hussein · iegy.net</a></div>
      </div>
      <div className={`app-content ${audioItem ? "with-player" : ""}`}>{content}</div>

      {audioItem && <div className="mini-player"><button onClick={toggleAudio} aria-label={audioPlaying ? "إيقاف مؤقت" : "تشغيل"}>{audioPlaying ? <Pause /> : <Play />}</button><Volume2 /><span><strong>{audioItem.title}</strong><small>{audioItem.subtitle}</small></span><button onClick={closeAudio} aria-label="إغلاق مشغل التلاوة"><X /></button></div>}

      <nav className="bottom-nav">{navItems.map(({ key, label, icon: Icon }) => <button className={section === key ? "active" : ""} onClick={() => navigate(key)} key={key}><span><Icon /></span><small>{label}</small></button>)}</nav>

      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog((current) => ({ ...current, open }))}><DialogContent dir="rtl" className="dialog-ar"><DialogHeader><DialogTitle>{detailDialog.title}</DialogTitle><DialogDescription>المحتوى من المصدر المحدد في رفيقي.</DialogDescription></DialogHeader>{detailDialog.loading ? <div className="dialog-loading"><span /><span /><span /></div> : <p className="dialog-text">{detailDialog.text}</p>}</DialogContent></Dialog>

      <Dialog open={noteDialog.open} onOpenChange={(open) => setNoteDialog((current) => ({ ...current, open }))}><DialogContent dir="rtl" className="dialog-ar"><DialogHeader><DialogTitle>كتابة أو تعديل ملاحظة</DialogTitle><DialogDescription>{noteDialog.surah?.name} · الآية {noteDialog.ayah?.numberInSurah}. ستجدها لاحقًا في المزيد ← الملاحظات.</DialogDescription></DialogHeader><textarea className="note-textarea" value={noteDialog.text} onChange={(event) => setNoteDialog((current) => ({ ...current, text: event.target.value }))} placeholder="اكتب تدبرك أو ملاحظتك هنا…" autoFocus /><div className="dialog-actions"><Button onClick={saveNote}>حفظ الملاحظة</Button><Button variant="outline" onClick={() => setNoteDialog({ open: false, text: "" })}>إلغاء</Button></div></DialogContent></Dialog>

      <Dialog open={customDhikrDialog.open} onOpenChange={(open) => setCustomDhikrDialog((current) => ({ ...current, open }))}><DialogContent dir="rtl" className="dialog-ar"><DialogHeader><DialogTitle>إضافة ذكر مخصص</DialogTitle><DialogDescription>اكتب الذكر الذي تريد إضافته إلى السبحة. سيُحفظ على جهازك ويظهر دائمًا في قائمة الأذكار.</DialogDescription></DialogHeader><input className="custom-dhikr-input" value={customDhikrDialog.text} maxLength={120} onChange={(event) => setCustomDhikrDialog((current) => ({ ...current, text: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && saveCustomDhikr()} placeholder="مثال: حسبي الله ونعم الوكيل" autoFocus /><small className="character-count">{customDhikrDialog.text.length}/120</small><div className="dialog-actions"><Button onClick={saveCustomDhikr} disabled={!customDhikrDialog.text.trim()}><Plus /> إضافة واستخدام</Button><Button variant="outline" onClick={() => setCustomDhikrDialog({ open: false, text: "" })}>إلغاء</Button></div></DialogContent></Dialog>
    </main>
  );
}
