import {
  fillTemplate,
  isUrlParameterValue,
  templateOrigin,
  templateParameters,
} from './url-template.js';

const ADO = 'https://mcp.dev.azure.com/{organization}';

describe('url template (T22)', () => {
  it('lists the placeholder names once each', () => {
    expect(templateParameters(ADO)).toEqual(['organization']);
    expect(templateParameters('https://x.test/{a}/{b}/{a}')).toEqual([
      'a',
      'b',
    ]);
    expect(templateParameters('https://api.githubcopilot.com/mcp/')).toEqual(
      [],
    );
  });

  it('fills in the values', () => {
    expect(fillTemplate(ADO, { organization: 'contoso' })).toBe(
      'https://mcp.dev.azure.com/contoso',
    );
    expect(fillTemplate('https://x.test/mcp', {})).toBe('https://x.test/mcp');
  });

  it('refuses a missing value', () => {
    expect(fillTemplate(ADO, {})).toBeNull();
  });

  it.each([
    'contoso/other',
    '../admin',
    'a?b=1',
    'a#b',
    'evil.test@x',
    '-start',
    'end-',
    '',
    'x'.repeat(101),
    'with space',
  ])('refuses %j as a value', (value) => {
    expect(isUrlParameterValue(value)).toBe(false);
    expect(fillTemplate(ADO, { organization: value })).toBeNull();
  });

  it.each(['contoso', 'my-org', 'Org.Name_2', 'a'])('accepts %j', (value) => {
    expect(isUrlParameterValue(value)).toBe(true);
  });

  it('gives the origin of a template', () => {
    expect(templateOrigin(ADO)).toBe('https://mcp.dev.azure.com');
  });
});
