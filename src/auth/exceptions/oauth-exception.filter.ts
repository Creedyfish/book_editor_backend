import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import {
  EmailNotVerifiedException,
  EmailAlreadyExistsException,
} from './oauth.exceptions';

@Catch(EmailNotVerifiedException, EmailAlreadyExistsException)
export class OAuthExceptionFilter implements ExceptionFilter {
  catch(
    exception: EmailNotVerifiedException | EmailAlreadyExistsException,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (exception instanceof EmailNotVerifiedException) {
      return response.redirect(
        `${frontendUrl}/auth/error?message=email-not-verified`,
      );
    }

    if (exception instanceof EmailAlreadyExistsException) {
      return response.redirect(
        `${frontendUrl}/auth/error?message=email-exists`,
      );
    }

    // Fallback (shouldn't reach here with current setup)
    return response.redirect(`${frontendUrl}/auth/error?message=auth-failed`);
  }
}
