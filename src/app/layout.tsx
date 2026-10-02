import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const welcome = Fraunces({ subsets: ['latin'], weight: '500', variable: '--font-welcome' });

export const metadata: Metadata = {
  title: 'TWCS — Tea Withering Control System',
  description: 'Real-time monitoring and control of tea withering troughs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${welcome.variable}`} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('twcs.theme')==='light')document.documentElement.classList.add('light')}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
