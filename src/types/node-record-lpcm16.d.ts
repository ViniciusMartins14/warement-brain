declare module 'node-record-lpcm16' {
  import { Readable } from 'stream';

  export interface RecordOptions {
    sampleRate?: number;
    channels?: number;
    compress?: boolean;
    threshold?: number;
    thresholdStart?: number;
    thresholdEnd?: number;
    silence?: string;
    verbose?: boolean;
    recordProgram?: string;
    device?: string;
    audioType?: string;
  }

  export interface Recording {
    stream(): Readable;
    stop(): void;
    pause(): void;
    resume(): void;
  }

  export function record(options?: RecordOptions): Recording;
}
