import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';
import {
  hasControlCharacter,
  headerNameProblem,
  serverUrlProblem,
} from '../../services/upstreams/connections/connection-rules.js';

// class-validator decorators for API inputs, built on the service rules.
// Messages come from the rules and never repeat the value.

function ruleDecorator(
  name: string,
  problem: (value: string, property: string) => string | null,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, key) => {
    const property = String(key);
    registerDecorator({
      name,
      target: target.constructor,
      propertyName: property,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && problem(value, property) === null,
        defaultMessage: (args) =>
          typeof args?.value === 'string'
            ? (problem(args.value, property) ?? '')
            : `${property} must be a string`,
      },
    });
  };
}

export const IsServerUrl = (options?: ValidationOptions) =>
  ruleDecorator('isServerUrl', serverUrlProblem, options);

export const IsHeaderName = (options?: ValidationOptions) =>
  ruleDecorator('isHeaderName', headerNameProblem, options);

export const HasNoControlCharacters = (options?: ValidationOptions) =>
  ruleDecorator(
    'hasNoControlCharacters',
    (value, property) =>
      hasControlCharacter(value)
        ? `${property} must not contain control characters such as line breaks`
        : null,
    options,
  );

// Trims a string before validation.
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// Validates a field that may be left out but not set to null.
export const IfGiven = () =>
  ValidateIf((_object, value) => value !== undefined);
