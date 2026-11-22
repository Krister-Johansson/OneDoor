import { toToolAnnotations } from './tool.mapper.js';

const NONE = {
  readOnlyHint: null,
  destructiveHint: null,
  idempotentHint: null,
  openWorldHint: null,
};

describe('toToolAnnotations', () => {
  it('keeps the boolean hints', () => {
    expect(
      toToolAnnotations({ readOnlyHint: true, destructiveHint: false }),
    ).toEqual({ ...NONE, readOnlyHint: true, destructiveHint: false });
  });

  it('drops hints that are not booleans and keys that are not hints', () => {
    expect(
      toToolAnnotations({
        readOnlyHint: 'yes',
        openWorldHint: 1,
        title: 'Echo',
        extra: { readOnlyHint: true },
      }),
    ).toEqual(NONE);
  });

  it('gives no hints for missing or malformed annotations', () => {
    expect(toToolAnnotations(null)).toEqual(NONE);
    expect(toToolAnnotations([true])).toEqual(NONE);
    expect(toToolAnnotations('readOnlyHint')).toEqual(NONE);
  });
});
