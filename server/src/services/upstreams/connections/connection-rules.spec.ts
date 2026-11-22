import {
  hasControlCharacter,
  headerNameProblem,
  serverUrlProblem,
} from './connection-rules.js';

describe('serverUrlProblem (REQ-CONN-022)', () => {
  it.each([
    'https://mcp.example.com/mcp',
    'http://localhost:4000/mcp',
    'http://127.0.0.1:4000/mcp',
  ])('accepts %s', (url) => {
    expect(serverUrlProblem(url)).toBeNull();
  });

  it.each([
    ['http on another host', 'http://mcp.example.com/mcp'],
    ['another scheme', 'ftp://mcp.example.com/mcp'],
    ['a user name and password', 'https://user:pass@mcp.example.com/mcp'],
    ['a user name only', 'https://user@mcp.example.com/mcp'],
    ['a relative URL', '/mcp'],
    [
      'more than 2048 characters',
      `https://mcp.example.com/${'a'.repeat(2048)}`,
    ],
  ])('rejects %s', (_name, url) => {
    expect(serverUrlProblem(url)).toEqual(expect.any(String));
  });

  it('does not repeat the URL in the message', () => {
    const url = 'https://user:secret-password@mcp.example.com/mcp';
    expect(serverUrlProblem(url)).not.toContain('secret-password');
  });
});

describe('headerNameProblem (REQ-CONN-043)', () => {
  it.each(['Authorization', 'X-Api-Key', 'x_custom.key'])(
    'accepts %s',
    (name) => {
      expect(headerNameProblem(name)).toBeNull();
    },
  );

  it.each([
    'Host',
    'content-length',
    'Content-Type',
    'Transfer-Encoding',
    'Connection',
    'Mcp-Session-Id',
    'MCP-Protocol-Version',
  ])('rejects the reserved header %s', (name) => {
    expect(headerNameProblem(name)).toEqual(expect.any(String));
  });

  it.each(['', 'X Api Key', 'X-Key:', 'a'.repeat(101)])(
    'rejects the invalid name "%s"',
    (name) => {
      expect(headerNameProblem(name)).toEqual(expect.any(String));
    },
  );
});

describe('hasControlCharacter', () => {
  it.each(['a\nb', 'a\rb', 'a\u0000b', 'a\u007fb', '\tkey'])(
    'finds one in %j',
    (value) => {
      expect(hasControlCharacter(value)).toBe(true);
    },
  );

  it.each(['plain', 'with space', 'nyckel-åäö'])(
    'finds none in %j',
    (value) => {
      expect(hasControlCharacter(value)).toBe(false);
    },
  );
});
