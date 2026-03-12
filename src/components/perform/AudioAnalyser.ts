/**
 * AudioAnalyser — Web Audio API wrapper for real-time audio amplitude analysis
 *
 * Connects to TTS HTMLAudioElement output and provides normalized amplitude
 * values (0.0–1.0) for driving lip sync animation in CharacterVideo.
 */

export class AudioAnalyser {
  private static audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private connectedElement: HTMLAudioElement | null = null

  /** Get or create the shared AudioContext (singleton) */
  private static getContext(): AudioContext {
    if (!AudioAnalyser.audioCtx || AudioAnalyser.audioCtx.state === 'closed') {
      AudioAnalyser.audioCtx = new AudioContext()
    }
    return AudioAnalyser.audioCtx
  }

  /** Resume AudioContext after user gesture (required by browsers) */
  static async ensureResumed(): Promise<void> {
    const ctx = AudioAnalyser.getContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
  }

  /**
   * Connect to an HTMLAudioElement for analysis.
   * Routes: audioElement → MediaElementSource → AnalyserNode → destination (speakers)
   *
   * IMPORTANT: Each HTMLAudioElement can only have ONE MediaElementSource.
   * Call disconnect() before connecting a new element.
   */
  connect(audioElement: HTMLAudioElement): void {
    // Don't reconnect the same element
    if (this.connectedElement === audioElement && this.analyser) return

    this.disconnect()

    const ctx = AudioAnalyser.getContext()

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.6
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    try {
      this.source = ctx.createMediaElementSource(audioElement)
      this.source.connect(this.analyser)
      this.analyser.connect(ctx.destination)
      this.connectedElement = audioElement
    } catch (e) {
      // Element may already have a source — browsers throw on duplicate
      console.warn('AudioAnalyser: Could not create MediaElementSource:', e)
      // Still try to use the analyser for amplitude reading
      this.connectedElement = audioElement
    }
  }

  /**
   * Get current audio amplitude as a normalized value (0.0 to 1.0).
   * Returns 0 if not connected or audio is silent.
   */
  getAmplitude(): number {
    if (!this.analyser || !this.dataArray) return 0

    this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>)

    // Calculate RMS (root mean square) of frequency data
    let sum = 0
    const len = this.dataArray.length
    for (let i = 0; i < len; i++) {
      const val = this.dataArray[i] / 255
      sum += val * val
    }
    const rms = Math.sqrt(sum / len)

    // Normalize to 0–1 range with a slight boost for speech frequencies
    return Math.min(1, rms * 2.5)
  }

  /** Disconnect from current audio element */
  disconnect(): void {
    try {
      this.source?.disconnect()
      this.analyser?.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    this.source = null
    this.analyser = null
    this.dataArray = null
    this.connectedElement = null
  }

  /** Get the raw AnalyserNode for advanced usage */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyser
  }

  /** Check if connected to an audio element */
  isConnected(): boolean {
    return this.connectedElement !== null && this.analyser !== null
  }
}
