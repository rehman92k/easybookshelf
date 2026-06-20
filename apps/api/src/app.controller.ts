import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/auth.decorators';
import { AppService } from './app.service';

@ApiTags('root')
@Public()
@Controller({ version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('info')
  getInfo() {
    return this.appService.getInfo();
  }
}
