# LUSDT User Interface

A React-based user interface for the LUSDT bridge system, enabling users to convert between USDT and LUSDT across Solana and Lunes networks.

## Features

### Core Functionality
- **Dashboard**: Comprehensive overview of balances, transaction history, and quick actions
- **Bridge Interface**: Seamless conversion between USDT and LUSDT across networks
- **Transaction History**: Real-time tracking and monitoring of bridge operations with filtering
- **Settings Management**: User preferences, network configuration, and privacy controls

### User Experience
- **Responsive Design**: Mobile-first design with adaptive layouts for all screen sizes
- **Multi-Wallet Support**: Connect to various Solana wallets (Phantom, Solflare) and Lunes wallets
- **Real-time Updates**: Live balance updates and transaction status monitoring
- **Intuitive Navigation**: Breadcrumb navigation, mobile bottom navigation, and sidebar navigation

### Technical Features
- **State Management**: Zustand for efficient state management with persistence
- **Type Safety**: Full TypeScript coverage with comprehensive type definitions
- **Testing**: Comprehensive test suite with Vitest and React Testing Library
- **Performance**: Optimized rendering with React 19 and modern build tools

## Technology Stack

- **React 19** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Vitest** for testing
- **Zustand** for state management

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── layout/         # Layout components (Header, Sidebar, etc.)
├── pages/              # Page components
├── utils/              # Utility functions and configurations
├── types/              # TypeScript type definitions
├── test/               # Test setup and utilities
├── App.tsx             # Main application component
├── main.tsx            # Application entry point
└── index.css           # Global styles
```

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3001](http://localhost:3001) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint

## Configuration

Environment variables can be configured in `.env` file:

```env
# Solana Configuration
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_NETWORK=devnet
VITE_USDT_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Lunes Configuration
VITE_LUNES_RPC_URL=wss://rpc.lunes.io
VITE_LUSDT_CONTRACT_ADDRESS=5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
VITE_TAX_MANAGER_CONTRACT_ADDRESS=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty

# Bridge Service Configuration
VITE_BRIDGE_API_URL=http://localhost:3000
VITE_BRIDGE_WS_URL=ws://localhost:3000
```

## Architecture

The application follows a modular architecture with:

- **Component-based UI**: Reusable components with consistent styling
- **Route-based navigation**: React Router for client-side routing
- **Responsive design**: Mobile-first approach with Tailwind CSS
- **Type safety**: Full TypeScript coverage
- **Testing**: Comprehensive test suite with Vitest

## Integration

This application integrates with:

- **Shared Components**: Reusable UI components from `@lusdt/shared-components`
- **Blockchain Services**: Wallet and contract services from `@lusdt/blockchain-services`
- **Shared Utils**: Common utilities from `@lusdt/shared-utils`

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

MIT License - see LICENSE file for details