# LUSDT Frontend Monorepo

This monorepo contains all frontend applications and shared packages for the LUSDT ecosystem.

## Structure

```
lusdt-frontend-monorepo/
├── apps/
│   ├── admin-panel/          # Administrative interface
│   └── user-interface/       # User-facing bridge interface
├── packages/
│   ├── shared-components/    # Reusable UI components
│   ├── blockchain-services/  # Blockchain integration services
│   └── shared-utils/         # Common utilities and helpers
└── docs/                     # Documentation
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Install all dependencies
npm install

# Install dependencies for all workspaces
npm run install:all
```

### Development

```bash
# Start all applications in development mode
npm run dev

# Start specific applications
npm run dev:admin      # Admin panel
npm run dev:user       # User interface
npm run dev:components # Component library

# Build all packages
npm run build

# Run tests for all packages
npm run test
```

### Package Scripts

Each package has its own set of scripts:

- `dev` - Start development server
- `build` - Build for production
- `test` - Run tests
- `lint` - Run linting
- `clean` - Clean build artifacts

### Workspace Dependencies

Packages can depend on each other using the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@lusdt/shared-components": "workspace:*"
  }
}
```

## Architecture

### Shared Components (`@lusdt/shared-components`)

Reusable UI components built with:
- React 19
- TypeScript
- Tailwind CSS 4.1
- Headless UI
- Framer Motion

### Blockchain Services (`@lusdt/blockchain-services`)

Blockchain integration services for:
- Solana wallet connections (Phantom, Solflare)
- Lunes/Polkadot.js integration
- USDT/LUSDT token operations
- Bridge transaction handling

### Shared Utils (`@lusdt/shared-utils`)

Common utilities including:
- Validation functions
- Formatting helpers
- Constants and configuration
- Type definitions

### Applications

#### Admin Panel (`@lusdt/admin-panel`)
- System monitoring and control
- Contract management
- Transaction oversight
- Configuration management

#### User Interface (`@lusdt/user-interface`)
- Bridge operations (deposit/redemption)
- Wallet connections
- Transaction tracking
- User dashboard

## Development Guidelines

### Code Style

- Use TypeScript for all code
- Follow ESLint configuration
- Use Prettier for formatting
- Write tests for all functionality

### Component Development

- Use shared components from `@lusdt/shared-components`
- Follow accessibility guidelines (WCAG 2.1)
- Implement responsive design with Tailwind CSS
- Use semantic HTML elements

### State Management

- Use Zustand for global state
- Keep state minimal and focused
- Use React hooks for local state
- Implement proper error boundaries

## Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test:admin
npm run test:user
npm run test:components

# Run tests with coverage
npm run test:coverage
```

## Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build:admin
npm run build:user
npm run build:components
```

## Deployment

Each application can be deployed independently:

- Admin Panel: Internal administrative interface
- User Interface: Public-facing bridge application

## Contributing

1. Create feature branch from `main`
2. Make changes in appropriate package
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## License

MIT License - see LICENSE file for details