import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/auth.decorators';
import { StorageService } from './storage.service';

@ApiTags('media')
@Public()
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Get('*path')
  @ApiOperation({ summary: 'Serve a public media file (covers in local dev)' })
  async serve(@Param('path') path: string, @Res() res: Response) {
    if (!path.startsWith('covers/')) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND', message: 'File not found' });
    }

    const object = await this.storage.getObject(path);
    res.setHeader('Content-Type', object.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(object.buffer);
  }
}
