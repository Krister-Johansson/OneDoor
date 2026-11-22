import { ValidationPipe } from '@nestjs/common';
import type { ValidationError as ClassValidatorError } from 'class-validator';
import { ValidationError } from './domain-errors.js';

// The global pipe (APP_PIPE in AppModule). It turns inputs into their
// classes, rejects fields the class does not declare, and reports failures
// as a domain ValidationError, so GraphQL answers `extensions.code: VALIDATION`.
// Messages name the field and the rule, never the value: inputs carry secrets.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new ValidationError(collectMessages(errors).join('; ')),
  });
}

function collectMessages(errors: ClassValidatorError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectMessages(error.children ?? []),
  ]);
}
