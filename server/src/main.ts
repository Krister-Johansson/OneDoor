import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { appConfig } from './config/app.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { host, port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(port, host);
}
await bootstrap();
