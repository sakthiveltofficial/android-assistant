declare module '@fugood/react-native-audio-pcm-stream' {
  interface Options {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    audioSource?: number;
    wavFile: string;
    bufferSize?: number;
  }
  const AudioRecord: {
    init(options: Options): void;
    start(): void;
    stop(): Promise<string> | void;
    on(event: 'data', callback: (base64Pcm: string) => void): void;
  };
  export default AudioRecord;
}
