import { Module } from '@nestjs/common';
import { BrainService } from './brain.service';

@Module({
  imports: [],
  controllers: [],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
