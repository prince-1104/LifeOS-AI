/**
 * useVoice — custom hook for voice recording & TTS playback.
 *
 * Features:
 * - Audio recording with auto-silence detection (VAD)
 * - Automatically stops when user finishes speaking (~1.8s silence)
 * - Sends recordings to the voice pipeline
 * - Plays back TTS audio from base64
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { Audio } from "expo-av";
import { Platform } from "react-native";
import { voiceProcess, type VoiceProcessResponse } from "@/lib/api";
import type { GetToken } from "@/lib/api";

type VoiceState = "idle" | "recording" | "processing" | "playing";

type VoiceResult = {
  transcript: string;
  response: string;
  type: string;
  data: any;
  success: boolean;
};

// ── VAD settings ──────────────────────────────────────────────────────
const SILENCE_THRESHOLD_DB = -35;   // dBFS; below this = silence
const SILENCE_DURATION_MS = 1800;   // 1.8s of silence after speech → auto-stop
const MIN_RECORD_MS = 800;          // don't auto-stop in the first 800ms
const METERING_INTERVAL_MS = 250;   // how often to check audio level

export function useVoice(getToken: GetToken) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // VAD state
  const silenceStartRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);
  const recordStartTimeRef = useRef<number>(0);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRecordingRef = useRef<(() => Promise<VoiceResult | null>) | null>(null);
  // Flag to prevent double-stop
  const isStoppingRef = useRef(false);

  /** Request audio permissions. */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        return false;
      }
      // Configure audio mode for recording + playback (with metering)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Clean up VAD timer. */
  const cleanupVad = useCallback(() => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    hasSpeechRef.current = false;
    silenceStartRef.current = 0;
    isStoppingRef.current = false;
  }, []);

  /** Start recording audio with silence detection. */
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return false;

      // Stop any existing recording
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {}
        recordingRef.current = null;
      }

      // Stop any playing audio
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
      }

      isStoppingRef.current = false;

      // Use recording options with metering enabled
      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          extension: ".m4a",
        },
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          extension: ".m4a",
        },
        web: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
        },
        isMeteringEnabled: true,
      };

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();
      recordingRef.current = recording;
      recordStartTimeRef.current = Date.now();
      setVoiceState("recording");
      setRecordingDuration(0);

      // Track duration
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);

      // ── Silence detection via metering ─────────────────────────────
      hasSpeechRef.current = false;
      silenceStartRef.current = 0;

      vadTimerRef.current = setInterval(async () => {
        if (!recordingRef.current || isStoppingRef.current) return;

        try {
          const status = await recordingRef.current.getStatusAsync();
          if (!status.isRecording) return;

          const metering = status.metering ?? -160;
          const elapsed = Date.now() - recordStartTimeRef.current;

          if (metering > SILENCE_THRESHOLD_DB) {
            // User is speaking
            hasSpeechRef.current = true;
            silenceStartRef.current = 0;
          } else if (hasSpeechRef.current && elapsed > MIN_RECORD_MS) {
            // Silence after speech detected
            if (silenceStartRef.current === 0) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION_MS) {
              // Auto-stop! User is done speaking
              if (!isStoppingRef.current) {
                isStoppingRef.current = true;
                stopRecordingRef.current?.();
              }
            }
          }
        } catch {
          // Recording may have been stopped already
        }
      }, METERING_INTERVAL_MS);

      return true;
    } catch (err) {
      console.error("Failed to start recording:", err);
      setVoiceState("idle");
      return false;
    }
  }, [requestPermissions, cleanupVad]);

  /** Stop recording and send audio to the voice pipeline. */
  const stopRecording = useCallback(async (): Promise<VoiceResult | null> => {
    // Clean up VAD + duration timer
    cleanupVad();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (!recordingRef.current) {
      setVoiceState("idle");
      return null;
    }

    setVoiceState("processing");

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setVoiceState("idle");
        return null;
      }

      // Reset audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Send to voice pipeline
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result: VoiceProcessResponse = await voiceProcess(getToken, uri, {
        userTimezone: tz,
        tts: true,
        mimeType: Platform.OS === "ios" ? "audio/m4a" : "audio/m4a",
      });

      // Auto-play TTS response
      if (result.audio_base64) {
        await playAudioBase64(result.audio_base64);
      } else {
        setVoiceState("idle");
      }

      return {
        transcript: result.transcript,
        response: result.response,
        type: result.type,
        data: result.data,
        success: result.success,
      };
    } catch (err) {
      console.error("Voice processing failed:", err);
      setVoiceState("idle");
      return null;
    }
  }, [getToken, cleanupVad]);

  // Keep the ref in sync so the VAD timer can trigger stopRecording
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  /** Cancel an in-progress recording without sending. */
  const cancelRecording = useCallback(async () => {
    cleanupVad();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setVoiceState("idle");
    setRecordingDuration(0);
  }, [cleanupVad]);

  /** Play TTS audio from base64. */
  const playAudioBase64 = useCallback(async (base64: string) => {
    try {
      setVoiceState("playing");

      // Unload any existing sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {}
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      // When playback finishes, reset state
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setVoiceState("idle");
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error("TTS playback failed:", err);
      setVoiceState("idle");
    }
  }, []);

  /** Stop currently playing audio. */
  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setVoiceState("idle");
  }, []);

  return {
    voiceState,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    playAudioBase64,
    stopPlayback,
  };
}
