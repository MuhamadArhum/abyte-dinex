import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    css: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Abyte ERP',
        short_name: 'Abyte ERP',
        description: 'Enterprise Point of Sale System',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: false,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts (recharts is heavy)
          'vendor-charts': ['recharts'],
          // Animation
          'vendor-motion': ['framer-motion'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // QZ Tray (printer bridge)
          'vendor-qz': ['qz-tray'],
          // Accounting pages
          'pages-accounts': [
            './src/pages/accounts/ChartOfAccounts',
            './src/pages/accounts/JournalEntries',
            './src/pages/accounts/GeneralLedger',
            './src/pages/accounts/TrialBalance',
            './src/pages/accounts/ProfitLoss',
            './src/pages/accounts/BalanceSheet',
            './src/pages/accounts/BankAccounts',
            './src/pages/accounts/PaymentVouchers',
            './src/pages/accounts/ReceiptVouchers',
          ],
          // HR pages
          'pages-hr': [
            './src/pages/hr/Staff',
            './src/pages/hr/Attendance',
            './src/pages/hr/DailyAttendance',
            './src/pages/hr/SalarySheet',
            './src/pages/hr/PayrollProcessing',
            './src/pages/hr/AdvancePayments',
            './src/pages/hr/LoanManagement',
            './src/pages/hr/HolidayCalendar',
            './src/pages/hr/LeaveRequests',
            './src/pages/hr/StaffReports',
            './src/pages/hr/EmployeeLedger',
            './src/pages/hr/IncrementHistory',
          ],
          // Sales pages
          'pages-sales': [
            './src/pages/sales/SalesReports',
            './src/pages/sales/Quotations',
            './src/pages/sales/CreditSales',
            './src/pages/sales/PriceRules',
            './src/pages/sales/SalesTargets',
          ],
          // Inventory pages
          'pages-inventory': [
            './src/pages/inventory/Inventory',
            './src/pages/inventory/InventoryReports',
            './src/pages/inventory/StockAdjustments',
            './src/pages/inventory/StockTransfers',
            './src/pages/inventory/StockCount',
            './src/pages/inventory/PurchaseOrders',
            './src/pages/inventory/Bundles',
            './src/pages/inventory/ProductVariants',
          ],
        },
      },
    },
  },
})
