import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

@Module({
  imports: [AuthModule],
  controllers: [ReadingController],
  providers: [ReadingService],
})
export class ReadingModule {}
