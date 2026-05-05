import { Injectable, Logger } from '@nestjs/common';
import { BrainService } from '../brain/brain.service';
import { spawn, ChildProcess } from 'child_process';
import { MemoryService } from 'src/memory/memory.service';
import { VectorService } from 'src/vector/vector.service';
import * as fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import * as path from 'path';
import { exec } from 'child_process';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);
  private readonly tempAudioPath = 'temp_brain_audio.wav';
  private currentProcess: ChildProcess | null = null;

  private config = {
    mode: 'VAD',
    isActive: true,
  };

  constructor(
    private readonly brainService: BrainService,
    private readonly memoryService: MemoryService,
    private readonly vectorService: VectorService,
  ) {}

  startBrainHearing() {
    if (!this.config.isActive) return;

    if (this.config.mode === 'VAD') {
      this.listenWithVAD();
    } else {
      this.listenForWakeWord();
    }
  }

  private listenWithVAD() {
    this.logger.log(
      'Modo VAD: Aguardando alguém falar (Ignorando silêncio)...',
    );

    this.currentProcess = spawn('sox', [
      '-t',
      'waveaudio',
      'default',
      this.tempAudioPath,
      'silence',
      '1',
      '0.1',
      '2%',
      '1',
      '1.5',
      '2%',
    ]);

    this.currentProcess.on('exit', () => {
      if (!this.config.isActive) return;

      const processAudio = async () => {
        try {
          this.logger.log(
            'Silêncio detectado. Enviando trecho para transcrição...',
          );

          const text = await this.brainService.transcribe(this.tempAudioPath);

          if (text && text.trim().length > 2) {
            const existingFiles = this.memoryService.getVaultFiles();

            // 1. Roteia a Intenção
            const intent = await this.brainService.routeToTopic(
              text.trim(),
              existingFiles,
            );

            const safeIntent = intent?.toUpperCase();

            if (safeIntent === 'DESCARTAR') {
              this.logger.log(`Áudio descartado: "${text.trim()}"`);
              return;
            }

            if (safeIntent?.includes('PERGUNTA')) {
              this.logger.log(
                'Pergunta detectada! Vasculhando a memória (ChromaDB)...',
              );

              const context = await this.vectorService.searchContext(
                text.trim(),
              );

              const resposta = await this.brainService.answerQuestion(
                text.trim(),
                context,
              );

              this.logger.log(`\n BRAIN: ${resposta}\n`);

              await this.speak(resposta);
              return;
            }

            this.logger.log(`Intenção de Escrita: Roteado para [${intent}]`);
            const targetFile = intent?.endsWith('.md')
              ? intent
              : `${intent}.md`;

            const currentContent =
              this.memoryService.getFileContent(targetFile);

            this.logger.log('Consolidando informação no arquivo...');

            const finalContent = await this.brainService.analyzeAndFormat(
              text.trim(),
              currentContent,
            );

            if (finalContent) {
              this.memoryService.saveToFile(targetFile, finalContent);

              await this.vectorService.saveDocument(targetFile, finalContent);
            }
          }
        } catch (error) {
          this.logger.error('Erro ao processar o áudio:', error);
        } finally {
          setTimeout(() => this.listenWithVAD(), 500);
        }
      };

      void processAudio();
    });

    this.currentProcess.on('error', (err) => {
      this.logger.error('Erro no SoX:', err);
    });
  }

  private listenForWakeWord() {
    this.logger.log('Modo Wake Word: Aguardando palavra-chave...');

    this.currentProcess = spawn('sox', [
      '-t',
      'waveaudio',
      'default',
      this.tempAudioPath,
    ]);
  }

  startListening(durationInSeconds = 5) {
    this.logger.log(
      `Warement Brain ativando escuta por ${durationInSeconds}s (Modo Nativo Windows)...`,
    );

    const soxProcess = spawn('sox', [
      '-t',
      'waveaudio',
      'default',
      this.tempAudioPath,
    ]);

    soxProcess.on('error', (err) => {
      this.logger.error('Erro ao iniciar o processo do SoX:', err);
    });

    soxProcess.stderr.on('data', (data) => {
      console.log(`[SoX Log]: ${data}`);
    });

    setTimeout(() => {
      this.logger.log(
        '🛑 Gravação finalizada. Matando processo e enviando para o Cérebro...',
      );
      soxProcess.kill();

      setTimeout(() => {
        this.brainService.transcribe(this.tempAudioPath);
      }, 500);
    }, durationInSeconds * 1000);
  }

  private async speak(text: string) {
    this.logger.log('🗣️ Gerando voz neural (Edge-TTS - Antonio)...');

    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        'pt-BR-AntonioNeural',
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
      );

      const audioPath = path.resolve(process.cwd(), 'jarvis_response.mp3');

      const streamData = tts.toStream(text);
      const readableStream = streamData.audioStream;
      const writeStream = fs.createWriteStream(audioPath);

      await new Promise<void>((resolve, reject) => {
        readableStream.pipe(writeStream);
        writeStream.on('finish', resolve);
        readableStream.on('error', reject);
        writeStream.on('error', reject);
      });

      this.logger.log('🔊 Reproduzindo resposta...');

      const psCommand = `powershell -c "Add-Type -AssemblyName PresentationCore; $p = New-Object System.Windows.Media.MediaPlayer; $p.Open('${audioPath}'); $p.Play(); Start-Sleep -s 2; while($p.Position -lt $p.NaturalDuration.TimeSpan) { Start-Sleep -m 100 }"`;

      await new Promise<void>((resolve) => {
        exec(psCommand, (error) => {
          if (error) this.logger.error('Erro no Playback PowerShell:', error);
          resolve();
        });
      });

      this.logger.log('Reprodução finalizada.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro no TTS: ${errorMessage}`);
    }
  }
}
