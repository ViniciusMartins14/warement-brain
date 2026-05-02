import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { BrainModule } from './brain/brain.module';
import { AudioModule } from './audio/audio.module';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AudioModule, BrainModule, MemoryModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
