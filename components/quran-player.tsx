"use client";

import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleGauge,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Search,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QuranAyah = {
  number: number;
  numberInSurah: number;
  text: string;
};

type QuranSurah = {
  number: number;
  name: string;
  englishName?: string;
  ayahs: QuranAyah[];
};

type QuranPayload = {
  data: {
    surahs: QuranSurah[];
  };
};

type Mp3Moshaf = {
  id: number;
  name: string;
  server: string;
  surah_total: number;
  surah_list: string;
};

type Mp3Reciter = {
  id: number;
  name: string;
  letter?: string;
  moshaf: Mp3Moshaf[];
};

type VoiceOption = {
  key: string;
  reciterId: number;
  reciterName: string;
  moshafId: number;
  moshafName: string;
  server: string;
  surahs: number[];
};

type TimingRead = {
  id: number;
  name: string;
  rewaya?: string;
  folder_url: string;
  soar_count?: number;
};

type TimingItem = {
  ayah: number;
  start_time: number;
  end_time: number;
};

type RepeatMode = "off" | "surah" | "ayah";

const PLAYER_STATE_KEY = "rafiqi:quran-player-v2";
const MP3QURAN_RECITERS = "https://www.mp3quran.net/api/v3/reciters?language=ar";
const MP3QURAN_TIMING_READS = "https://mp3quran.net/api/v3/ayat_timing/reads";

const padSurah = (value: number) => String(value).padStart(3, "0");

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "")
    .toLowerCase();
}

function normalizeServer(value: string) {
  return value.replace(/^http:/, "https:").replace(/\/+$/, "/").toLowerCase();
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function fallbackEditionFor(reciterName: string) {
  const name = normalizeText(reciterName);
  if (name.includes("منشاوي")) return "ar.minshawi";
  if (name.includes("حصري")) return "ar.husary";
  if (name.includes("عبدالباسط") || name.includes("عبدالباسطعبدالصمد")) return "ar.abdulbasitmurattal";
  if (name.includes("سديس")) return "ar.abdurrahmaansudais";
  if (name.includes("عفاسي")) return "ar.alafasy";
  return "ar.alafasy";
}

function voiceAudioUrl(voice: VoiceOption, surah: number) {
  const server = normalizeServer(voice.server);
  return `${server}${padSurah(surah)}.mp3`;
}

function fallbackAyahUrl(globalAyah: number, edition: string) {
  return `https://cdn.islamic.network/quran/audio/128/${edition}/${globalAyah}.mp3`;
}

export function QuranPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const desiredPlaying = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [quran, setQuran] = useState<QuranSurah[]>([]);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [timingReads, setTimingReads] = useState<TimingRead[]>([]);
  const [timings, setTimings] = useState<TimingItem[]>([]);
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [selectedVoiceKey, setSelectedVoiceKey] = useState("");
  const [reciterSearch, setReciterSearch] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [speed, setSpeed] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [continueSurahs, setContinueSurahs] = useState(true);
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fallbackAyahIndex, setFallbackAyahIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  const currentSurah = useMemo(
    () => quran.find((surah) => surah.number === selectedSurah) ?? null,
    [quran, selectedSurah],
  );

  const availableVoices = useMemo(
    () => voices.filter((voice) => voice.surahs.includes(selectedSurah)),
    [voices, selectedSurah],
  );

  const selectedVoice = useMemo(
    () => availableVoices.find((voice) => voice.key === selectedVoiceKey) ?? null,
    [availableVoices, selectedVoiceKey],
  );

  const filteredVoices = useMemo(() => {
    const needle = normalizeText(reciterSearch);
    if (!needle) return availableVoices;
    const filtered = availableVoices.filter((voice) =>
      normalizeText(`${voice.reciterName} ${voice.moshafName}`).includes(needle),
    );
    if (selectedVoice && !filtered.some((voice) => voice.key === selectedVoice.key)) {
      return [selectedVoice, ...filtered];
    }
    return filtered;
  }, [availableVoices, reciterSearch, selectedVoice]);

  const timingRead = useMemo(() => {
    if (!selectedVoice) return null;
    const voiceServer = normalizeServer(selectedVoice.server);
    const exact = timingReads.find((read) => normalizeServer(read.folder_url) === voiceServer);
    if (exact) return exact;
    const voiceName = normalizeText(selectedVoice.reciterName);
    return timingReads.find((read) => {
      const timingName = normalizeText(read.name);
      return timingName.includes(voiceName) || voiceName.includes(timingName);
    }) ?? null;
  }, [selectedVoice, timingReads]);

  const activeTiming = useMemo(() => {
    if (usingFallback) return null;
    const ms = currentTime * 1000;
    return timings.find((item) => item.ayah > 0 && ms >= item.start_time && ms < item.end_time) ?? null;
  }, [currentTime, timings, usingFallback]);

  const currentAyahNumber = usingFallback
    ? currentSurah?.ayahs[fallbackAyahIndex]?.numberInSurah ?? null
    : activeTiming?.ayah ?? null;

  const currentAyahText = useMemo(() => {
    if (!currentSurah || !currentAyahNumber) return "";
    return currentSurah.ayahs.find((ayah) => ayah.numberInSurah === currentAyahNumber)?.text ?? "";
  }, [currentAyahNumber, currentSurah]);

  const audioSource = useMemo(() => {
    if (!currentSurah || !selectedVoice) return "";
    if (usingFallback) {
      const ayah = currentSurah.ayahs[fallbackAyahIndex];
      if (!ayah) return "";
      return fallbackAyahUrl(ayah.number, fallbackEditionFor(selectedVoice.reciterName));
    }
    return voiceAudioUrl(selectedVoice, selectedSurah);
  }, [currentSurah, fallbackAyahIndex, selectedSurah, selectedVoice, usingFallback]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY) ?? "{}") as {
        surah?: number;
        voice?: string;
        speed?: number;
        volume?: number;
        repeat?: RepeatMode;
        continuous?: boolean;
      };
      if (saved.surah && saved.surah >= 1 && saved.surah <= 114) setSelectedSurah(saved.surah);
      if (saved.voice) setSelectedVoiceKey(saved.voice);
      if (saved.speed && saved.speed >= 0.75 && saved.speed <= 2) setSpeed(saved.speed);
      if (typeof saved.volume === "number") setVolume(Math.max(0, Math.min(1, saved.volume)));
      if (saved.repeat === "off" || saved.repeat === "surah" || saved.repeat === "ayah") setRepeatMode(saved.repeat);
      if (typeof saved.continuous === "boolean") setContinueSurahs(saved.continuous);
    } catch {
      // Keep defaults if old browser state is malformed.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PLAYER_STATE_KEY,
      JSON.stringify({
        surah: selectedSurah,
        voice: selectedVoiceKey,
        speed,
        volume,
        repeat: repeatMode,
        continuous: continueSurahs,
      }),
    );
  }, [continueSurahs, repeatMode, selectedSurah, selectedVoiceKey, speed, volume]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/data/quran.json").then((response) => {
        if (!response.ok) throw new Error("quran");
        return response.json() as Promise<QuranPayload>;
      }),
      fetch(MP3QURAN_RECITERS).then((response) => {
        if (!response.ok) throw new Error("reciters");
        return response.json() as Promise<{ reciters: Mp3Reciter[] }>;
      }),
      fetch(MP3QURAN_TIMING_READS)
        .then((response) => (response.ok ? response.json() as Promise<TimingRead[]> : []))
        .catch(() => [] as TimingRead[]),
    ])
      .then(([quranPayload, reciterPayload, timingPayload]) => {
        if (!active) return;
        setQuran(quranPayload.data.surahs);
        const flattened = reciterPayload.reciters.flatMap((reciter) =>
          reciter.moshaf.map((moshaf) => ({
            key: `${reciter.id}:${moshaf.id}`,
            reciterId: reciter.id,
            reciterName: reciter.name,
            moshafId: moshaf.id,
            moshafName: moshaf.name,
            server: moshaf.server,
            surahs: moshaf.surah_list.split(",").map(Number).filter(Boolean),
          })),
        );
        setVoices(flattened);
        setTimingReads(timingPayload);
        setSelectedVoiceKey((current) => {
          if (flattened.some((voice) => voice.key === current && voice.surahs.includes(selectedSurah))) return current;
          const minshawi = flattened.find(
            (voice) => normalizeText(voice.reciterName).includes("منشاوي") && voice.surahs.includes(selectedSurah),
          );
          return minshawi?.key ?? flattened.find((voice) => voice.surahs.includes(selectedSurah))?.key ?? "";
        });
      })
      .catch(() => {
        if (active) setMessage("تعذر تحميل مكتبة القراء الآن. تحقق من الاتصال ثم أعد المحاولة.");
      })
      .finally(() => {
        if (active) setLoadingLibrary(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!voices.length) return;
    if (availableVoices.some((voice) => voice.key === selectedVoiceKey)) return;
    const sameReciter = voices.find(
      (voice) =>
        voice.reciterId === selectedVoice?.reciterId &&
        voice.surahs.includes(selectedSurah),
    );
    const minshawi = availableVoices.find((voice) => normalizeText(voice.reciterName).includes("منشاوي"));
    setSelectedVoiceKey(sameReciter?.key ?? minshawi?.key ?? availableVoices[0]?.key ?? "");
  }, [availableVoices, selectedSurah, selectedVoice, selectedVoiceKey, voices]);

  useEffect(() => {
    setUsingFallback(false);
    setFallbackAyahIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setMessage("");
  }, [selectedSurah, selectedVoiceKey]);

  useEffect(() => {
    let cancelled = false;
    if (!timingRead) {
      setTimings([]);
      return;
    }
    fetch(`https://mp3quran.net/api/v3/ayat_timing?surah=${selectedSurah}&read=${timingRead.id}`)
      .then((response) => {
        if (!response.ok) throw new Error("timing");
        return response.json() as Promise<TimingItem[]>;
      })
      .then((items) => {
        if (!cancelled) setTimings(items.filter((item) => item.end_time > item.start_time));
      })
      .catch(() => {
        if (!cancelled) setTimings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSurah, timingRead]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSource) return;
    audio.src = audioSource;
    audio.load();
    audio.playbackRate = speed;
    audio.volume = volume;
    if (desiredPlaying.current) {
      setLoadingAudio(true);
      audio.play().catch(() => {
        setLoadingAudio(false);
        setMessage("اضغط تشغيل لبدء التلاوة؛ بعض المتصفحات تمنع التشغيل التلقائي.");
      });
    }
  }, [audioSource]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!sleepUntil) {
      setSleepRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((sleepUntil - Date.now()) / 1000));
      setSleepRemaining(remaining);
      if (remaining === 0) {
        desiredPlaying.current = false;
        audioRef.current?.pause();
        setSleepUntil(null);
        setMessage("توقف التشغيل بانتهاء مؤقت النوم.");
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [sleepUntil]);

  const goToSurah = useCallback((number: number, autoplay = desiredPlaying.current) => {
    const next = Math.min(114, Math.max(1, number));
    desiredPlaying.current = autoplay;
    setSelectedSurah(next);
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audioSource || !audio) return;
    desiredPlaying.current = true;
    setLoadingAudio(true);
    audio.play().catch(() => {
      setLoadingAudio(false);
      setMessage("لم يبدأ الصوت. جرّب اختيار قارئ آخر أو أعد المحاولة.");
    });
  }, [audioSource]);

  const pause = useCallback(() => {
    desiredPlaying.current = false;
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSurah) return;

    if (usingFallback) {
      if (repeatMode === "ayah") {
        audio.currentTime = 0;
        play();
        return;
      }
      if (fallbackAyahIndex < currentSurah.ayahs.length - 1) {
        setFallbackAyahIndex((index) => index + 1);
        return;
      }
      if (repeatMode === "surah") {
        setFallbackAyahIndex(0);
        return;
      }
      if (continueSurahs && selectedSurah < 114) {
        goToSurah(selectedSurah + 1, true);
        return;
      }
      desiredPlaying.current = false;
      setIsPlaying(false);
      return;
    }

    if (repeatMode === "surah") {
      audio.currentTime = 0;
      play();
      return;
    }
    if (continueSurahs && selectedSurah < 114) {
      goToSurah(selectedSurah + 1, true);
      return;
    }
    desiredPlaying.current = false;
    setIsPlaying(false);
  }, [continueSurahs, currentSurah, fallbackAyahIndex, goToSurah, play, repeatMode, selectedSurah, usingFallback]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
    if (!usingFallback && repeatMode === "ayah") {
      const ms = audio.currentTime * 1000;
      const timing = timings.find((item) => item.ayah > 0 && ms >= item.start_time && ms < item.end_time);
      if (timing && ms >= timing.end_time - 90) {
        audio.currentTime = timing.start_time / 1000;
        if (desiredPlaying.current) audio.play().catch(() => undefined);
      }
    }
  }, [repeatMode, timings, usingFallback]);

  const handleAudioError = useCallback(() => {
    if (!selectedVoice || !currentSurah) return;
    if (!usingFallback && currentSurah.ayahs.length) {
      setMessage(`تعذر ملف السورة لهذا القارئ؛ تم التحويل تلقائيًا إلى تشغيل الآيات عبر AlQuran.Cloud.`);
      setUsingFallback(true);
      setFallbackAyahIndex(0);
      return;
    }
    desiredPlaying.current = false;
    setIsPlaying(false);
    setLoadingAudio(false);
    setMessage("تعذر تشغيل التلاوة من المصدرين. جرّب قارئًا آخر.");
  }, [currentSurah, selectedVoice, usingFallback]);

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || usingFallback) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || usingFallback) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + seconds));
  };

  const jumpAyah = (direction: -1 | 1) => {
    if (!currentSurah) return;
    if (usingFallback) {
      const next = Math.min(currentSurah.ayahs.length - 1, Math.max(0, fallbackAyahIndex + direction));
      setFallbackAyahIndex(next);
      return;
    }
    if (!timings.length) {
      skip(direction * 10);
      return;
    }
    const valid = timings.filter((item) => item.ayah > 0);
    const activeIndex = valid.findIndex((item) => item.ayah === activeTiming?.ayah);
    const baseIndex = activeIndex >= 0 ? activeIndex : 0;
    const next = valid[Math.min(valid.length - 1, Math.max(0, baseIndex + direction))];
    if (next && audioRef.current) audioRef.current.currentTime = next.start_time / 1000;
  };

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSurah || !selectedVoice) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${currentSurah.name}${currentAyahNumber ? ` — الآية ${currentAyahNumber}` : ""}`,
      artist: selectedVoice.reciterName,
      album: `رفيقي · ${selectedVoice.moshafName}`,
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    const safeHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose mediaSession but not every action.
      }
    };
    safeHandler("play", play);
    safeHandler("pause", pause);
    safeHandler("nexttrack", () => goToSurah(Math.min(114, selectedSurah + 1), true));
    safeHandler("previoustrack", () => goToSurah(Math.max(1, selectedSurah - 1), true));
    safeHandler("seekbackward", () => skip(-10));
    safeHandler("seekforward", () => skip(10));
    return () => {
      safeHandler("play", null);
      safeHandler("pause", null);
      safeHandler("nexttrack", null);
      safeHandler("previoustrack", null);
      safeHandler("seekbackward", null);
      safeHandler("seekforward", null);
    };
  }, [currentAyahNumber, currentSurah, goToSurah, pause, play, selectedSurah, selectedVoice]);

  const sleepLabel = sleepRemaining
    ? `${Math.floor(sleepRemaining / 60)}:${String(sleepRemaining % 60).padStart(2, "0")}`
    : "إيقاف";

  const playerTitle = currentSurah?.name ?? "مشغل القرآن";
  const playerSubtitle = selectedVoice
    ? `${selectedVoice.reciterName} · ${selectedVoice.moshafName}`
    : "تحميل مكتبة القراء…";

  return (
    <>
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true);
          setLoadingAudio(false);
          setMessage("");
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setLoadingAudio(true)}
        onCanPlay={() => setLoadingAudio(false)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 right-3 z-[80] md:bottom-5 md:left-auto md:right-6 md:w-[500px]" dir="rtl">
        {expanded && (
          <div className="mb-3 max-h-[72vh] overflow-y-auto rounded-[28px] border border-border bg-card/95 p-4 text-foreground shadow-2xl backdrop-blur-xl md:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <strong className="block text-lg">مشغل القرآن</strong>
                  <small className="block truncate text-muted-foreground">MP3Quran + AlQuran.Cloud · بدون حساب أو Backend</small>
                </div>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-border" onClick={() => setExpanded(false)} aria-label="تصغير المشغل">
                <X className="h-4 w-4" />
              </button>
            </div>

            {message && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-muted p-3 text-sm leading-6">
                <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{message}</span>
              </div>
            )}

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-bold">
                السورة
                <select
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                  value={selectedSurah}
                  onChange={(event) => goToSurah(Number(event.target.value), desiredPlaying.current)}
                  disabled={!quran.length}
                >
                  {quran.map((surah) => (
                    <option key={surah.number} value={surah.number}>
                      {surah.number}. {surah.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-bold">
                القارئ والرواية
                <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
                    placeholder="ابحث عن قارئ…"
                    value={reciterSearch}
                    onChange={(event) => setReciterSearch(event.target.value)}
                  />
                </div>
                <select
                  className="h-12 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
                  value={selectedVoiceKey}
                  onChange={(event) => setSelectedVoiceKey(event.target.value)}
                  disabled={loadingLibrary || !filteredVoices.length}
                >
                  {filteredVoices.map((voice) => (
                    <option key={voice.key} value={voice.key}>
                      {voice.reciterName} — {voice.moshafName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="my-4 rounded-2xl border border-border bg-muted/60 p-4 text-center">
              <small className="mb-1 block text-muted-foreground">
                {usingFallback ? "تشغيل آية بآية · مصدر احتياطي" : timingRead && timings.length ? "مزامنة الآيات مفعّلة" : "تلاوة السورة كاملة"}
              </small>
              <strong className="block text-xl">{playerTitle}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">{selectedVoice?.reciterName ?? "جاري تحميل القراء"}</span>
              {currentAyahNumber && (
                <div className="mt-3 rounded-xl bg-card p-3">
                  <span className="mb-1 block text-xs font-bold text-primary">الآية {currentAyahNumber}</span>
                  <p className="m-0 font-[Rafiqi_Quran] text-lg leading-[2]">{currentAyahText}</p>
                </div>
              )}
            </div>

            <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground" dir="ltr">
              <span className="w-10 text-left">{formatClock(currentTime)}</span>
              <input
                className="min-w-0 flex-1 accent-[var(--primary)]"
                type="range"
                min={0}
                max={Math.max(duration || 0, 1)}
                step={0.25}
                value={Math.min(currentTime, Math.max(duration || 0, 1))}
                onChange={(event) => seek(Number(event.target.value))}
                disabled={usingFallback || !duration}
                aria-label="موضع التلاوة"
              />
              <span className="w-10 text-right">{formatClock(duration)}</span>
            </div>

            <div className="mb-4 flex items-center justify-center gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-full border border-border" onClick={() => jumpAyah(-1)} aria-label="الآية السابقة">
                <ChevronRight className="h-5 w-5" />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-border text-xs font-bold" onClick={() => skip(-10)} disabled={usingFallback} aria-label="رجوع 10 ثوان">
                -10
              </button>
              <button
                className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg disabled:opacity-50"
                onClick={togglePlay}
                disabled={!audioSource || loadingLibrary}
                aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
              >
                {loadingAudio ? <CircleGauge className="h-6 w-6 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-border text-xs font-bold" onClick={() => skip(10)} disabled={usingFallback} aria-label="تقديم 10 ثوان">
                +10
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-border" onClick={() => jumpAyah(1)} aria-label="الآية التالية">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${continueSurahs ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                onClick={() => setContinueSurahs((value) => !value)}
              >
                متابعة السور {continueSurahs ? "✓" : ""}
              </button>
              <button
                className={`flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${repeatMode !== "off" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                onClick={() => setRepeatMode((mode) => mode === "off" ? "surah" : mode === "surah" ? "ayah" : "off")}
                title="إيقاف ← تكرار السورة ← تكرار الآية"
              >
                <Repeat2 className="h-3.5 w-3.5" />
                {repeatMode === "off" ? "بدون تكرار" : repeatMode === "surah" ? "تكرار السورة" : "تكرار الآية"}
              </button>
              <label className="flex items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-2 text-xs font-bold">
                <RotateCcw className="h-3.5 w-3.5" />
                <select className="min-w-0 bg-transparent outline-none" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                  {[0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((value) => <option key={value} value={value}>{value}×</option>)}
                </select>
              </label>
              <label className="flex items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-2 text-xs font-bold">
                <CircleGauge className="h-3.5 w-3.5" />
                <select
                  className="min-w-0 bg-transparent outline-none"
                  value={sleepUntil ? "active" : "off"}
                  onChange={(event) => {
                    const minutes = Number(event.target.value);
                    if (!minutes) setSleepUntil(null);
                    else setSleepUntil(Date.now() + minutes * 60_000);
                  }}
                >
                  <option value="off">نوم: {sleepLabel}</option>
                  {sleepUntil && <option value="active">متبقي {sleepLabel}</option>}
                  <option value="10">10 دقائق</option>
                  <option value="20">20 دقيقة</option>
                  <option value="30">30 دقيقة</option>
                  <option value="45">45 دقيقة</option>
                  <option value="60">60 دقيقة</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <input
                className="min-w-0 flex-1 accent-[var(--primary)]"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="مستوى الصوت"
              />
              <span className="w-9 text-left text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{usingFallback ? "المصدر: AlQuran.Cloud CDN" : "المصدر: MP3Quran.net"}</span>
              <span>{timings.length && !usingFallback ? `توقيت ${timings.filter((item) => item.ayah > 0).length} آية` : "التشغيل مستمر تلقائيًا"}</span>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-[22px] border border-border bg-card/95 text-foreground shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 p-2.5 pr-3">
            <button
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              onClick={togglePlay}
              disabled={!audioSource || loadingLibrary}
              aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل القرآن"}
            >
              {loadingAudio ? <CircleGauge className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button className="min-w-0 flex-1 text-right" onClick={() => setExpanded((value) => !value)} aria-label="فتح مشغل القرآن">
              <strong className="block truncate text-sm">{playerTitle}{currentAyahNumber ? ` · آية ${currentAyahNumber}` : ""}</strong>
              <small className="block truncate text-xs text-muted-foreground">{playerSubtitle}</small>
            </button>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border" onClick={() => goToSurah(Math.max(1, selectedSurah - 1), desiredPlaying.current)} disabled={selectedSurah <= 1} aria-label="السورة السابقة">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border" onClick={() => goToSurah(Math.min(114, selectedSurah + 1), desiredPlaying.current)} disabled={selectedSurah >= 114} aria-label="السورة التالية">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "تصغير" : "توسيع"}>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
          {!usingFallback && duration > 0 && (
            <div className="h-1 bg-muted">
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
