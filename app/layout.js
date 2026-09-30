import './globals.css';
import { readDB } from '@/lib/db';
import GlobalAds from './GlobalAds';

export const metadata = {
  title: 'Drive Video',
  robots: 'noindex, nofollow'
};

export default function RootLayout({ children }) {
  let settings = {};
  try {
    settings = readDB().settings || {};
  } catch {
    settings = {};
  }
  return (
    <html lang="id">
      <body>
        {children}
        <GlobalAds settings={settings} />
      </body>
    </html>
  );
}
