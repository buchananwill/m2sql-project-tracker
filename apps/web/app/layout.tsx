import '@mantine/core/styles.css';
import 'reactflow/dist/style.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { theme } from '@/lib/theme';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'm2sql Project Tracker',
  description: 'Mermaid to SQL project planning and visualization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
          <title>m2sql Project Tracker</title>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
