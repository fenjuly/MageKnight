"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, GameState } from "../lib/game-engine";

const SOUND_STORAGE_KEY = "mage-knight-sound-enabled";

export type GameFeedbackKind = "ui" | "card" | "move" | "explore" | "magic" | "heal" | "combat" | "block" | "attack" | "turn" | "victory";

type BrowserAudioContext = AudioContext & { resume(): Promise<void> };

function audioContextConstructor() {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

export function feedbackForAction(action: GameAction, before: GameState, after: GameState): GameFeedbackKind {
  if (after.result === "victory" && before.result !== "victory") return "victory";
  if (action.type === "EXPLORE_TILE") return "explore";
  if (action.type === "MAP_CLICK") return after.combat && !before.combat ? "combat" : "move";
  if (["START_MULTI_COMBAT", "ENTER_ADVENTURE", "BURN_MONASTERY", "PURSUE_VOLKARE_ENEMIES"].includes(action.type)) return "combat";
  if (["COMBAT_BLOCK", "ASSIGN_DEFEND", "COMBAT_REDUCE_CUMBERSOME"].includes(action.type)) return "block";
  if (["COMBAT_RANGED", "COMBAT_ATTACK", "COMBAT_GROUP_ATTACK"].includes(action.type)) return "attack";
  if (["COMBAT_ADVANCE", "COMBAT_DAMAGE", "ASSIGN_DAMAGE_UNIT", "COMBAT_RETREAT"].includes(action.type)) return "combat";
  if (["PLAY_CARD", "UNPLAY_CARD", "DISCARD_CARD", "BUY_CARD", "RECRUIT"].includes(action.type)) return "card";
  if (["GAIN_CRYSTAL", "SELECT_MINE_COLOR", "ACTIVATE_SKILL", "ACTIVATE_UNIT", "USE_BANNER", "REPLACE_FAMILIAR_CRYSTAL"].includes(action.type)) return "magic";
  if (["USE_HEAL", "HEAL_UNIT", "HEAL_WITH_INFLUENCE"].includes(action.type)) return "heal";
  if (["END_TURN", "FORFEIT_ROUND", "CHOOSE_TACTIC"].includes(action.type)) return "turn";
  return "ui";
}

export function useGameAudio() {
  const [enabled, setEnabledState] = useState(true);
  const enabledRef = useRef(true);
  const contextRef = useRef<BrowserAudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const ambientRef = useRef<{ oscillators: OscillatorNode[]; gain: GainNode } | null>(null);

  const getContext = useCallback(() => {
    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) return null;
    if (!contextRef.current) {
      const context = new AudioContextClass() as BrowserAudioContext;
      const master = context.createGain();
      master.gain.value = 0.42;
      master.connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }
    const context = contextRef.current;
    if (context.state === "suspended") void context.resume();
    return context;
  }, []);

  const stopAmbient = useCallback(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    const context = contextRef.current;
    const now = context?.currentTime ?? 0;
    ambient.gain.gain.cancelScheduledValues(now);
    ambient.gain.gain.setTargetAtTime(0, now, 0.16);
    window.setTimeout(() => ambient.oscillators.forEach((oscillator) => {
      try { oscillator.stop(); } catch { /* oscillator may already be stopped */ }
    }), 600);
    ambientRef.current = null;
  }, []);

  const startAmbient = useCallback(() => {
    if (!enabledRef.current || ambientRef.current) return;
    const context = getContext();
    const master = masterRef.current;
    if (!context || !master) return;
    const ambientGain = context.createGain();
    const filter = context.createBiquadFilter();
    ambientGain.gain.value = 0.018;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.7;
    ambientGain.connect(filter);
    filter.connect(master);
    const oscillators = [55, 82.41].map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index ? 5 : -4;
      oscillator.connect(ambientGain);
      oscillator.start();
      return oscillator;
    });
    ambientRef.current = { oscillators, gain: ambientGain };
  }, [getContext]);

  const play = useCallback((kind: GameFeedbackKind) => {
    if (!enabledRef.current) return;
    const context = getContext();
    const master = masterRef.current;
    if (!context || !master) return;
    startAmbient();
    const now = context.currentTime;
    const tone = (frequency: number, duration: number, gainValue = 0.08, type: OscillatorType = "sine", delay = 0, endFrequency?: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    };
    const noise = (duration: number, gainValue: number, frequency: number, delay = 0) => {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = now + delay;
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    };

    if (kind === "card") { noise(0.11, 0.06, 1800); tone(330, 0.12, 0.055, "triangle", 0.025, 460); }
    else if (kind === "move") { tone(118, 0.12, 0.07, "triangle", 0, 82); noise(0.08, 0.035, 520); }
    else if (kind === "explore") { tone(92, 0.42, 0.08, "sine", 0, 246); noise(0.38, 0.055, 950); tone(392, 0.22, 0.045, "triangle", 0.2, 587); }
    else if (kind === "magic") { tone(440, 0.2, 0.055, "sine"); tone(659, 0.3, 0.045, "sine", 0.08); }
    else if (kind === "heal") { tone(294, 0.24, 0.045, "sine"); tone(440, 0.3, 0.05, "sine", 0.09); tone(587, 0.34, 0.04, "sine", 0.17); }
    else if (kind === "block") { noise(0.18, 0.09, 720); tone(96, 0.22, 0.1, "square", 0, 68); }
    else if (kind === "attack") { noise(0.16, 0.12, 1400); tone(165, 0.18, 0.09, "sawtooth", 0, 72); }
    else if (kind === "combat") { tone(73, 0.34, 0.12, "sawtooth", 0, 48); noise(0.24, 0.1, 610); }
    else if (kind === "turn") { tone(196, 0.24, 0.05, "triangle"); tone(294, 0.32, 0.045, "triangle", 0.12); }
    else if (kind === "victory") { [262, 330, 392, 523].forEach((frequency, index) => tone(frequency, 0.46, 0.052, "triangle", index * 0.1)); }
    else tone(520, 0.075, 0.032, "sine", 0, 620);
  }, [getContext, startAmbient]);

  const setEnabled = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabledState(next);
    localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    if (next) {
      startAmbient();
      window.setTimeout(() => play("ui"), 20);
    } else stopAmbient();
  }, [play, startAmbient, stopAmbient]);

  useEffect(() => {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored === "off") {
      enabledRef.current = false;
      window.setTimeout(() => setEnabledState(false), 0);
    }
    return () => {
      stopAmbient();
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, [stopAmbient]);

  return { enabled, setEnabled, play };
}
