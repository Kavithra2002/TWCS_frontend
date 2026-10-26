import type { Metadata } from 'next';
import { Fraunces, Inter, Noto_Sans_Sinhala, Noto_Sans_Tamil } from 'next/font/google';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const welcome = Fraunces({ subsets: ['latin'], weight: '500', variable: '--font-welcome' });
const sinhala = Noto_Sans_Sinhala({ subsets: ['sinhala'], variable: '--font-sinhala', display: 'swap' });
const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], variable: '--font-tamil', display: 'swap' });

export const metadata: Metadata = {
  title: 'TWCS — Tea Withering Control System',
  description: 'Real-time monitoring and control of tea withering troughs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${welcome.variable} ${sinhala.variable} ${tamil.variable}`} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var lang=localStorage.getItem('twcs.lang');if(lang==='si'||lang==='ta'||lang==='en')document.documentElement.lang=lang;if(localStorage.getItem('twcs.theme')==='light')document.documentElement.classList.add('light')}catch(e){}})();`,
          }}
        />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
