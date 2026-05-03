/**
 * useVoice — custom hook for voice recording & TTS playback.
 *
 * Handles:
 * - Audio recording (press-and-hold or toggle)
 * - Sending recordings to the voice pipeline
 * - Playing back TTS audio from base64
 */

import { useRef, useState, useCallback } from "react";
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

export function useVoice(getToken: GetToken) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Request audio permissions. */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        return false;
      }
      // Configure audio mode for recording + playback
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

  /** Start recording audio. */
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

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();
      recordingRef.current = recording;
      setVoiceState("recording");
      setRecordingDuration(0);

      // Track duration
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.error("Failed to start recording:", err);
      setVoiceState("idle");
      return false;
    }
  }, [requestPermissions]);

  /** Stop recording and send audio to the voice pipeline. */
  const stopRecording = useCallback(async (): Promise<VoiceResult | null> => {
    // Clear duration timer
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
  }, [getToken]);

  /** Cancel an in-progress recording without sending. */
  const cancelRecording = useCallback(async () => {
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
  }, []);

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
