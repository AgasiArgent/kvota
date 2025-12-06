import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider, theme } from 'antd';
import ruRU from 'antd/lib/locale/ru_RU';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Russian B2B Quotation Platform',
  description: 'Professional quotation management system for Russian B2B business operations',
  keywords: 'quotation, B2B, Russian business, VAT, approval workflow, INN, KPP, OGRN',
};

// Russian B2B theme configuration - Dark mode
const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#3b82f6', // Blue-500 to match shadcn
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    colorBgContainer: '#1f1f1f', // Match --card
    colorBgElevated: '#1f1f1f',
    colorBgLayout: '#141414', // Match --background
    colorText: '#d9d9d9', // hsl(0 0% 85%) - main content grey
    colorTextSecondary: '#999999', // hsl(0 0% 60%) - labels/headers grey
    borderRadius: 6,
    wireframe: false,
    fontSize: 14,
    fontFamily:
      'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 36,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 6,
      controlHeight: 36,
    },
    Card: {
      borderRadius: 8,
      paddingLG: 24,
    },
    Table: {
      borderRadius: 8,
      headerBg: '#1f1f1f', // Dark header
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AntdRegistry>
          <ConfigProvider locale={ruRU} theme={antdTheme}>
            <App>
              <AuthProvider>
                {children}
                <Toaster />
              </AuthProvider>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
