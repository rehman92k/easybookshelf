import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from './auth/decorators/auth.decorators';

@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class RootController {
  @Get()
  root(@Res() res: Response) {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EasyBookshelf API</title>
  <style>
    body { font-family: Georgia, serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; color: #1c1917; background: #faf8f5; }
    h1 { color: #b45309; }
    a { color: #b45309; }
    code { background: #f5f5f4; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    li { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <h1>EasyBookshelf API</h1>
  <p>Backend is running. Use these endpoints:</p>
  <ul>
    <li><a href="/docs">/docs</a> — API documentation (Swagger)</li>
    <li><a href="/api/v1/health">/api/v1/health</a> — Health check</li>
    <li><a href="/api/v1/info">/api/v1/info</a> — API info</li>
  </ul>
  <p><strong>Web apps</strong> (run separately):</p>
  <ul>
    <li><a href="http://localhost:3000">Reader</a> — port 3000</li>
    <li><a href="http://localhost:3001">Publisher</a> — port 3001</li>
    <li><a href="http://localhost:3002">Admin</a> — port 3002</li>
  </ul>
</body>
</html>`);
  }
}
