import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n';
import { RichText } from './RichText';

function renderText(text: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <I18nProvider lang="de">
          <RichText text={text} />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RichText', () => {
  it('interpretiert niemals HTML (Schutz vor XSS)', () => {
    const { container } = renderText('<img src=x onerror="alert(1)"><script>alert(2)</script>');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(2)</script>');
  });

  it('verlinkt Hashtags und nur http(s)-Adressen', () => {
    const { container } = renderText('Hallo #Welt javascript:alert(1) https://example.org/test');
    const tag = screen.getByText('#Welt');
    expect(tag.getAttribute('href')).toBe('/feed?tag=welt');
    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('https://example.org/test');
    expect(links.some((href) => href?.startsWith('javascript:'))).toBe(false);
    const external = container.querySelector('a[href="https://example.org/test"]');
    expect(external?.getAttribute('rel')).toContain('noopener');
  });
});
