import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Configure CORS for production and development
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL // Set this in Render environment variables
        : 'http://localhost:3001', // Your frontend URL for development
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // Use the port provided by the environment (Render) or default to 3000
  const port = process.env.PORT || 3000;

  // For production (Render), bind to 0.0.0.0. For local, use localhost
  if (process.env.NODE_ENV === 'production') {
    await app.listen(port, '0.0.0.0');
  } else {
    await app.listen(port);
  }

  console.log(`Application is running on port ${port}`);
}

bootstrap();
