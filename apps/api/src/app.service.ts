import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'EasyBookshelf API',
      version: '0.1.0',
      docs: '/docs',
    };
  }
}
