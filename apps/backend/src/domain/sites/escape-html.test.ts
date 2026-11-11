import { expect, test } from 'vitest';
import { escapeHtml } from './escape-html.ts';

test('escapes what could start a tag or end an attribute', () => {
  expect(escapeHtml(`<b onclick="x()">Tom & 'Jerry'</b>`)).toBe(
    '&lt;b onclick=&quot;x()&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;',
  );
});

test('leaves ordinary text as it is', () => {
  expect(escapeHtml('Iceland 2026, rated 4★')).toBe('Iceland 2026, rated 4★');
});
