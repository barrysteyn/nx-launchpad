import { useState } from 'react';
import { getToken, saveToken } from './token';

export function useToken(): string | null {
  const [token] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      saveToken(urlToken);
      params.delete('token');
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname +
        (newSearch ? `?${newSearch}` : '') +
        window.location.hash;
      window.history.replaceState(null, '', newUrl);
      return urlToken;
    }
    return getToken();
  });
  return token;
}
