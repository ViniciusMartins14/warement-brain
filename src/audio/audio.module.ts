import { Module } from '@nestjs/common';
import { BrainModule } from 'src/brain/brain.module';
import { AudioService } from './audio.service';
import { MemoryModule } from 'src/memory/memory.module';
import { VectorModule } from 'src/vector/vector.module';

@Module({
  imports: [BrainModule, MemoryModule, VectorModule],
  controllers: [],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
