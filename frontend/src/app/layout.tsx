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

// Russian B2B theme configuration - Dark mode (Warm Linear)
const antdTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#f59e0b', // Amber-500 - warm accent
    colorSuccess: '#34d399', // Emerald-400 for profit/success
    colorWarning: '#fbbf24', // Amber-400 for warnings
    colorError: '#fb7185', // Rose-400 for errors/negative
    colorInfo: '#d9d9d9', // Grey for info (not amber)
    colorBgContainer: '#1f1f1f', // Match --card
    colorBgElevated: '#1f1f1f',
    colorBgLayout: '#141414', // Match --background
    colorText: '#d9d9d9', // hsl(0 0% 85%) - main content grey
    colorTextSecondary: '#999999', // hsl(0 0% 60%) - labels/headers grey
    colorTextTertiary: '#666666', // Even more muted
    colorTextQuaternary: '#4d4d4d', // Most muted
    colorLink: '#d9d9d9', // Links inherit text color, not primary
    colorLinkHover: '#ffffff', // Slightly brighter on hover
    colorBorder: '#2e2e2e', // Match --border
    colorBorderSecondary: '#252525', // Slightly darker border
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
      primaryShadow: 'none', // Remove shadow/glow
      defaultBorderColor: '#2e2e2e', // Grey border for outline buttons
      defaultBg: 'transparent',
      defaultHoverBg: 'rgba(255, 255, 255, 0.05)',
      defaultHoverBorderColor: '#3e3e3e',
      defaultActiveBg: 'rgba(255, 255, 255, 0.08)',
      defaultActiveBorderColor: '#4e4e4e',
    },
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      colorBgContainer: '#292929', // Slightly lighter than card
      colorBorder: '#2e2e2e',
      hoverBorderColor: '#3e3e3e',
      activeBorderColor: '#f59e0b', // Amber on focus
    },
    Select: {
      borderRadius: 6,
      controlHeight: 36,
      colorBgContainer: '#292929',
      colorBorder: '#2e2e2e',
      optionSelectedBg: 'rgba(245, 158, 11, 0.12)', // Amber tint for selected
    },
    Card: {
      borderRadius: 8,
      paddingLG: 24,
      colorBorderSecondary: '#2e2e2e', // Subtle border
    },
    Table: {
      borderRadius: 8,
      headerBg: '#1a1a1a', // Slightly darker header
      headerColor: '#999999', // Muted header text
      headerSplitColor: 'transparent', // Remove header dividers
      borderColor: '#252525', // Very subtle borders
      rowHoverBg: 'rgba(255, 255, 255, 0.03)', // Subtle hover
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Tag: {
      // Make tags grey by default, use dot indicators for status
      defaultBg: '#292929',
      defaultColor: '#d9d9d9',
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 24,
    },
    Pagination: {
      itemBg: 'transparent',
      itemActiveBg: 'rgba(245, 158, 11, 0.12)',
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
