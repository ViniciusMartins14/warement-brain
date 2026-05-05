import { Injectable, Logger } from '@nestjs/common';
import { BrainService } from '../brain/brain.service';
import { spawn, ChildProcess } from 'child_process';
import { MemoryService } from 'src/memory/memory.service';
import { VectorService } from 'src/vector/vector.service';

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
}
