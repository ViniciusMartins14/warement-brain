import { Controller, Get } from '@nestjs/common';
import { AudioService } from './audio/audio.service';

@Controller()
export class AppController {
  constructor(private readonly audioService: AudioService) {}

  @Get('test-listen')
  testListening() {
    this.audioService.startBrainHearing();
    return {
      status: 'success',
      message: 'Warement Brain ativado.',
    };
  }
}
