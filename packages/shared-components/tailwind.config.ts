import type { Config } from 'tailwindcss';

export default {
  // Novo engine CSS do Tailwind 4.1
  engine: 'oxide', // Engine baseado em Rust para performance superior
  
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './stories/**/*.{js,ts,jsx,tsx}',
    // Incluir outros pacotes que usam estes componentes
    '../admin-panel/src/**/*.{js,ts,jsx,tsx}',
    '../user-interface/src/**/*.{js,ts,jsx,tsx}'
  ],
  
  theme: {
    extend: {
      // Sistema de cores LUSDT com CSS custom properties
      colors: {
        // Cores primárias da marca LUSDT
        primary: {
          50: 'rgb(from var(--color-primary) r g b / 0.05)',
          100: 'rgb(from var(--color-primary) r g b / 0.1)',
          200: 'rgb(from var(--color-primary) r g b / 0.2)',
          300: 'rgb(from var(--color-primary) r g b / 0.3)',
          400: 'rgb(from var(--color-primary) r g b / 0.4)',
          500: 'var(--color-primary)',
          600: 'rgb(from var(--color-primary) calc(r * 0.9) calc(g * 0.9) calc(b * 0.9))',
          700: 'rgb(from var(--color-primary) calc(r * 0.8) calc(g * 0.8) calc(b * 0.8))',
          800: 'rgb(from var(--color-primary) calc(r * 0.7) calc(g * 0.7) calc(b * 0.7))',
          900: 'rgb(from var(--color-primary) calc(r * 0.5) calc(g * 0.5) calc(b * 0.5))',
          950: 'rgb(from var(--color-primary) calc(r * 0.3) calc(g * 0.3) calc(b * 0.3))'
        },
        
        // Cores das redes blockchain
        solana: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#dc2626', // Cor oficial Solana
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75'
        },
        
        lunes: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Cor oficial Lunes
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        
        // Cores semânticas
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: {
          DEFAULT: 'var(--color-muted)',
          foreground: 'var(--color-muted-foreground)'
        },
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        
        // Estados de transação
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)'
      },
      
      // Container queries para layouts responsivos
      containers: {
        'card': '20rem',      // 320px
        'sidebar': '18rem',   // 288px
        'modal': '32rem',     // 512px
        'dashboard': '64rem', // 1024px
        'form': '28rem',      // 448px
        'table': '48rem'      // 768px
      },
      
      // Sistema de espaçamento customizado
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem'
      },
      
      // Tipografia otimizada
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono Variable',
          'JetBrains Mono',
          'Fira Code',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      },
      
      // Sistema de animações aprimorado
      animation: {
        // Animações de entrada
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        
        // Animações de estado
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 0.6s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        
        // Animações específicas para transações
        'transaction-success': 'transactionSuccess 0.6s ease-out',
        'transaction-pending': 'transactionPending 2s ease-in-out infinite',
        'bridge-flow': 'bridgeFlow 3s ease-in-out infinite',
        
        // Animações de loading
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite'
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideLeft: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideRight: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' }
        },
        transactionSuccess: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        transactionPending: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        bridgeFlow: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      },
      
      // Sombras customizadas
      boxShadow: {
        'glow': '0 0 20px rgb(var(--color-primary) / 0.3)',
        'glow-lg': '0 0 40px rgb(var(--color-primary) / 0.4)',
        'transaction': '0 4px 20px rgb(var(--color-success) / 0.2)',
        'error': '0 4px 20px rgb(var(--color-error) / 0.2)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 25px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
      },
      
      // Bordas arredondadas
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem'
      }
    }
  },
  
  plugins: [
    // Plugins oficiais do Tailwind 4.1
    require('@tailwindcss/container-queries'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    
    // Plugin customizado para componentes LUSDT
    function({ addUtilities, addComponents, theme }) {
      // Utilitários customizados
      addUtilities({
        // Gradientes da marca
        '.bg-gradient-lusdt': {
          background: 'linear-gradient(135deg, rgb(var(--color-primary) / 0.1) 0%, rgb(var(--color-lunes-500) / 0.1) 100%)'
        },
        '.bg-gradient-bridge': {
          background: 'linear-gradient(90deg, rgb(var(--color-solana-500) / 0.2) 0%, rgb(var(--color-lunes-500) / 0.2) 100%)'
        },
        
        // Efeitos de brilho
        '.glow-primary': {
          'box-shadow': '0 0 20px rgb(var(--color-primary) / 0.3)'
        },
        '.glow-success': {
          'box-shadow': '0 0 20px rgb(var(--color-success) / 0.3)'
        },
        
        // Utilitários de texto
        '.text-gradient': {
          'background': 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-lunes-600)))',
          'background-clip': 'text',
          '-webkit-background-clip': 'text',
          'color': 'transparent'
        }
      });
      
      // Componentes base
      addComponents({
        // Card base para o sistema LUSDT
        '.lusdt-card': {
          '@apply bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-card': {},
          '@apply hover:shadow-card-hover transition-all duration-300': {},
          '@apply @container/card': {},
          '@apply dark:bg-gray-900/80 dark:border-gray-700/50': {}
        },
        
        // Botão base
        '.lusdt-button': {
          '@apply inline-flex items-center justify-center font-medium transition-all duration-200': {},
          '@apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2': {},
          '@apply disabled:pointer-events-none disabled:opacity-50': {}
        },
        
        // Input base
        '.lusdt-input': {
          '@apply block w-full rounded-lg border border-gray-300 bg-white px-3 py-2': {},
          '@apply text-gray-900 placeholder-gray-500': {},
          '@apply focus:border-primary-500 focus:ring-1 focus:ring-primary-500': {},
          '@apply disabled:bg-gray-50 disabled:text-gray-500': {},
          '@apply dark:bg-gray-800 dark:border-gray-600 dark:text-white': {}
        },
        
        // Status badges para transações
        '.status-badge': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium': {},
          '&.pending': '@apply bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          '&.processing': '@apply bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          '&.completed': '@apply bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          '&.failed': '@apply bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        }
      });
    }
  ]
} satisfies Config;