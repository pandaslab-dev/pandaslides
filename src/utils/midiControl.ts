import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

export const MIDI_ACTIONS = ["previous", "next", "goLive", "blackout", "logo"] as const;
export type MidiAction = (typeof MIDI_ACTIONS)[number];

type MidiSupportState = "unsupported" | "idle" | "requesting" | "ready" | "error";

type MidiBinding = {
  kind: "note" | "cc";
  channel: number;
  value: number;
};

type MidiSettings = {
  selectedInputId: string | null;
  bindings: Partial<Record<MidiAction, MidiBinding>>;
};

type MidiInputSummary = {
  id: string;
  name: string;
};

type MidiMessagePayload = {
  kind: "note" | "cc" | "other";
  channel: number;
  value: number;
  amount: number;
};

type MidiRequestOptions = {
  sysex?: boolean;
};

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: MidiRequestOptions) => Promise<MIDIAccess>;
};

type UseMidiControlsOptions = {
  onAction: (action: MidiAction) => void;
};

type UseMidiControlsResult = {
  bindings: Partial<Record<MidiAction, MidiBinding>>;
  inputs: MidiInputSummary[];
  isLearning: MidiAction | null;
  lastMessage: string | null;
  requestAccess: () => Promise<void>;
  selectInput: (inputId: string) => void;
  setLearningAction: (action: MidiAction | null) => void;
  clearBinding: (action: MidiAction) => void;
  selectedInputId: string | null;
  status: MidiSupportState;
};

const midiSettingsKey = "pandaslides.midi-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isMidiAction(value: unknown): value is MidiAction {
  return typeof value === "string" && MIDI_ACTIONS.includes(value as MidiAction);
}

function loadMidiSettings(): MidiSettings {
  if (typeof window === "undefined") {
    return { selectedInputId: null, bindings: {} };
  }

  try {
    const raw = window.localStorage.getItem(midiSettingsKey);
    if (!raw) {
      return { selectedInputId: null, bindings: {} };
    }

    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { selectedInputId: null, bindings: {} };
    }

    const bindings = isRecord(parsed.bindings)
      ? Object.fromEntries(
          Object.entries(parsed.bindings)
            .filter(([action, binding]) => {
              return (
                isMidiAction(action) &&
                isRecord(binding) &&
                (binding.kind === "note" || binding.kind === "cc") &&
                typeof binding.channel === "number" &&
                typeof binding.value === "number"
              );
            })
            .map(([action, binding]) => [action, binding as MidiBinding]),
        )
      : {};

    return {
      selectedInputId: typeof parsed.selectedInputId === "string" ? parsed.selectedInputId : null,
      bindings,
    };
  } catch {
    return { selectedInputId: null, bindings: {} };
  }
}

function saveMidiSettings(settings: MidiSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(midiSettingsKey, JSON.stringify(settings));
}

function describeMidiBinding(binding: MidiBinding) {
  return `${binding.kind.toUpperCase()} ${binding.value} · Ch ${binding.channel + 1}`;
}

function parseMidiMessage(event: MIDIMessageEvent): MidiMessagePayload | null {
  const data = event.data;
  if (!data || data.length < 3) {
    return null;
  }

  const status = data[0];
  const value = data[1];
  const amount = data[2];
  const channel = status & 0x0f;
  const command = status & 0xf0;

  if (command === 0x90 && amount > 0) {
    return {
      kind: "note",
      channel,
      value,
      amount,
    };
  }

  if (command === 0xb0) {
    return {
      kind: "cc",
      channel,
      value,
      amount,
    };
  }

  return {
    kind: "other",
    channel,
    value,
    amount,
  };
}

function readMidiInputs(midiAccess: MIDIAccess | null) {
  if (!midiAccess) {
    return [] as MidiInputSummary[];
  }

  return Array.from(midiAccess.inputs.values()).map((input) => ({
    id: input.id,
    name: input.name?.trim() || "Unnamed MIDI Device",
  }));
}

export function formatMidiBinding(binding: MidiBinding | undefined) {
  return binding ? describeMidiBinding(binding) : "Not bound";
}

export function useMidiControls({ onAction }: UseMidiControlsOptions): UseMidiControlsResult {
  const savedSettings = useMemo(() => loadMidiSettings(), []);
  const [status, setStatus] = useState<MidiSupportState>(() =>
    typeof navigator !== "undefined" && "requestMIDIAccess" in navigator ? "idle" : "unsupported",
  );
  const [inputs, setInputs] = useState<MidiInputSummary[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string | null>(savedSettings.selectedInputId);
  const [bindings, setBindings] = useState<Partial<Record<MidiAction, MidiBinding>>>(savedSettings.bindings);
  const [isLearning, setIsLearning] = useState<MidiAction | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const lastTriggerRef = useRef<Record<MidiAction, number>>({
    previous: 0,
    next: 0,
    goLive: 0,
    blackout: 0,
    logo: 0,
  });

  useEffect(() => {
    saveMidiSettings({ selectedInputId, bindings });
  }, [bindings, selectedInputId]);

  const refreshInputs = useEffectEvent(() => {
    const nextInputs = readMidiInputs(midiAccessRef.current);
    setInputs(nextInputs);

    if (nextInputs.length === 0) {
      setSelectedInputId(null);
      return;
    }

    setSelectedInputId((currentId) => {
      if (currentId && nextInputs.some((input) => input.id === currentId)) {
        return currentId;
      }

      return nextInputs[0].id;
    });
  });

  const handleMidiMessage = useEffectEvent((event: MIDIMessageEvent) => {
    const parsed = parseMidiMessage(event);
    if (!parsed || parsed.kind === "other") {
      return;
    }

    const summary = `${parsed.kind.toUpperCase()} ${parsed.value} · Ch ${parsed.channel + 1} · ${parsed.amount}`;
    setLastMessage(summary);

    if (isLearning) {
      const learnedBinding: MidiBinding = {
        kind: parsed.kind,
        channel: parsed.channel,
        value: parsed.value,
      };
      setBindings((currentBindings) => ({
        ...currentBindings,
        [isLearning]: learnedBinding,
      }));
      setIsLearning(null);
      return;
    }

    const matchedAction = MIDI_ACTIONS.find((action) => {
      const binding = bindings[action];
      return (
        binding &&
        binding.kind === parsed.kind &&
        binding.channel === parsed.channel &&
        binding.value === parsed.value &&
        parsed.amount > 0
      );
    });

    if (!matchedAction) {
      return;
    }

    const now = Date.now();
    if (now - lastTriggerRef.current[matchedAction] < 160) {
      return;
    }

    lastTriggerRef.current[matchedAction] = now;
    onAction(matchedAction);
  });

  useEffect(() => {
    const midiAccess = midiAccessRef.current;
    if (!midiAccess) {
      return;
    }

    for (const input of midiAccess.inputs.values()) {
      input.onmidimessage = input.id === selectedInputId ? handleMidiMessage : null;
    }

    return () => {
      for (const input of midiAccess.inputs.values()) {
        input.onmidimessage = null;
      }
    };
  }, [handleMidiMessage, selectedInputId]);

  async function requestAccess() {
    const navigatorWithMidi = navigator as NavigatorWithMidi;
    if (!navigatorWithMidi.requestMIDIAccess) {
      setStatus("unsupported");
      return;
    }

    try {
      setStatus("requesting");
      const midiAccess = await navigatorWithMidi.requestMIDIAccess();
      midiAccessRef.current = midiAccess;
      midiAccess.onstatechange = refreshInputs;
      refreshInputs();
      setStatus("ready");
      setLastMessage("MIDI connected");
    } catch {
      setStatus("error");
      setLastMessage("MIDI access was denied");
    }
  }

  return {
    bindings,
    clearBinding(action) {
      setBindings((currentBindings) => {
        const nextBindings = { ...currentBindings };
        delete nextBindings[action];
        return nextBindings;
      });
    },
    inputs,
    isLearning,
    lastMessage,
    requestAccess,
    selectInput(inputId) {
      setSelectedInputId(inputId);
    },
    selectedInputId,
    setLearningAction(action) {
      setIsLearning(action);
    },
    status,
  };
}
