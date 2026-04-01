/**
 * Audio Utility Functions
 * Handles audio recording, processing, and playback
 */

/**
 * Request microphone access and get the audio stream
 */
export async function getMicrophoneStream(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return stream;
  } catch (error) {
    console.error('Failed to access microphone:', error);
    throw new Error('Microphone access denied. Please check your browser permissions.');
  }
}

/**
 * Stop all audio tracks in a stream
 */
export function stopAudioStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Record audio from a MediaStream and return as base64
 */
export async function recordAudio(durationMs: number = 30000): Promise<string> {
  let stream: MediaStream | null = null;
  const mediaRecorder: MediaRecorder | null = null;

  try {
    stream = await getMicrophoneStream();

    return new Promise((resolve, reject) => {
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream!, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          resolve(base64);
        } catch (error) {
          reject(new Error('Failed to process audio data'));
        }
      };

      recorder.onerror = (event: ErrorEvent | Event) => {
        const errorMessage = 'error' in event ? event.error : 'Unknown recording error';
        reject(new Error(`Recording error: ${errorMessage}`));
      };

      // Start recording
      recorder.start();

      // Stop after duration
      setTimeout(() => {
        recorder.stop();
        stopAudioStream(stream!);
      }, durationMs);
    });
  } catch (error) {
    if (stream) {
      stopAudioStream(stream);
    }
    throw error;
  }
}

/**
 * Play audio from base64 string
 */
export function playAudio(base64Audio: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Convert base64 to blob
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });

      // Create audio element
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      audio.src = url;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to play audio'));
      };

      audio.play().catch((error) => {
        URL.revokeObjectURL(url);
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Convert WebM to WAV format for better compatibility
 */
export async function convertWebmToWav(webmBase64: string): Promise<string> {
  try {
    const binaryString = atob(webmBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // For now, return as-is. You might want to use a library like ffmpeg.js
    // for actual conversion, but most APIs accept WebM
    return webmBase64;
  } catch (error) {
    console.error('Error converting audio format:', error);
    throw error;
  }
}

/**
 * Get microphone permission status
 */
export async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    // Check if browser supports the Permissions API
    const permissionsApi = (navigator as any).permissions;
    if (!permissionsApi || typeof permissionsApi.query !== 'function') {
      return 'prompt';
    }

    const result = await permissionsApi.query({
      name: 'microphone',
    });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch (error) {
    console.warn('Could not check microphone permission:', error);
    return 'prompt';
  }
}

/**
 * Create a Web Speech API recognition instance (fallback for browser speech)
 */
export function createWebSpeechRecognition(): any {
  // @ts-ignore - Web Speech API not in standard types
  const SpeechRecognitionAPI =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  if (!SpeechRecognitionAPI) {
    console.warn('Web Speech API not supported in this browser');
    return null;
  }

  return new SpeechRecognitionAPI();
}

/**
 * Format audio duration for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get audio level from a MediaStream (for visualization)
 */
export function getAudioLevel(stream: MediaStream): Promise<number> {
  return new Promise((resolve) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const level = Math.round((average / 256) * 100);

    resolve(Math.min(level, 100));
  });
}

/**
 * Stop playing audio
 */
export function stopAudioPlayback(): void {
  const audios = document.querySelectorAll('audio');
  audios.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

/**
 * Request and store microphone access
 */
export async function requestMicrophoneAccess(): Promise<boolean> {
  try {
    const stream = await getMicrophoneStream();
    stopAudioStream(stream);
    return true;
  } catch (error) {
    console.error('Microphone access failed:', error);
    return false;
  }
}

/**
 * Speak text using Web Speech Synthesis API
 * Free, no API credits needed
 */
export function speakText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if Web Speech Synthesis API is available
    const speechSynthesisAPI = window.speechSynthesis;
    if (!speechSynthesisAPI) {
      reject(new Error('Web Speech Synthesis API not supported in this browser'));
      return;
    }

    // Cancel any ongoing speech
    speechSynthesisAPI.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    // Set voice if specified
    if (options?.voice) {
      const voices = speechSynthesisAPI.getVoices();
      const selectedVoice = voices.find(
        (v) => v.name.toLowerCase().includes(options.voice!.toLowerCase())
      );
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    // Set event handlers
    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    // Speak
    speechSynthesisAPI.speak(utterance);
  });
}

/**
 * Stop text-to-speech
 */
export function stopSpeech(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
