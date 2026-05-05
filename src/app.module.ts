import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { BrainModule } from './brain/brain.module';
import { AudioModule } from './audio/audio.module';
import { MemoryModule } from './memory/memory.module';
import { VectorModule } from './vector/vector.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AudioModule,
    BrainModule,
    MemoryModule,
    VectorModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
