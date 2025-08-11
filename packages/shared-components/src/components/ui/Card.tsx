import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Variante visual do card */
  variant?: 'default' | 'elevated' | 'outlined' | 'ghost' | 'gradient' | 'bridge';
  /** Tamanho do padding interno */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Se o card deve ter hover effects */
  hoverable?: boolean;
  /** Se o card deve ter efeito de brilho */
  glow?: boolean;
  /** Se o card é clicável */
  clickable?: boolean;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Se deve ter borda inferior */
  bordered?: boolean;
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Se deve ter borda superior */
  bordered?: boolean;
}

/**
 * Componente Card base otimizado com Tailwind 4.1
 * 
 * Características:
 * - Múltiplas variantes visuais incluindo temas específicos para bridge
 * - Container queries para responsividade
 * - Efeitos de hover e glow
 * - Suporte a backdrop blur
 * - Acessibilidade completa
 * 
 * @example
 * ```tsx
 * <Card variant="elevated" hoverable>
 *   <CardHeader>
 *     <h3>Título do Card</h3>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Conteúdo do card aqui</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Ação</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({
    className,
    variant = 'default',
    padding = 'md',
    hoverable = false,
    glow = false,
    clickable = false,
    children,
    ...props
  }, ref) => {
    // Classes de variantes
    const variantClasses = {
      default: [
        'bg-white border border-gray-200 shadow-sm',
        'dark:bg-gray-900 dark:border-gray-700'
      ].join(' '),
      
      elevated: [
        'bg-white border border-gray-200 shadow-lg',
        'dark:bg-gray-900 dark:border-gray-700'
      ].join(' '),
      
      outlined: [
        'bg-transparent border-2 border-gray-300',
        'dark:border-gray-600'
      ].join(' '),
      
      ghost: [
        'bg-gray-50/50 border border-gray-200/50',
        'dark:bg-gray-800/50 dark:border-gray-700/50'
      ].join(' '),
      
      gradient: [
        'bg-gradient-lusdt border border-gray-200/50 backdrop-blur-sm',
        'dark:border-gray-700/50'
      ].join(' '),
      
      bridge: [
        'bg-gradient-bridge border border-primary-200/50 backdrop-blur-sm',
        'shadow-lg',
        'dark:border-primary-700/50'
      ].join(' ')
    };
    
    // Classes de padding
    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-4 @[400px]/card:p-6',
      lg: 'p-6 @[400px]/card:p-8',
      xl: 'p-8 @[400px]/card:p-10'
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          // Classes base
          'rounded-xl transition-all duration-300',
          '@container/card',
          
          // Variante
          variantClasses[variant],
          
          // Padding
          paddingClasses[padding],
          
          // Estados interativos
          hoverable && [
            'hover:shadow-lg hover:-translate-y-1',
            'transform-gpu will-change-transform'
          ],
          
          glow && 'glow-primary',
          
          clickable && [
            'cursor-pointer select-none',
            'active:scale-[0.98] active:shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
          ],
          
          className
        )}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);

/**
 * Header do Card com estilos otimizados
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, bordered = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col space-y-1.5',
          bordered && 'pb-4 border-b border-gray-200 dark:border-gray-700',
          // Container query para responsividade
          '@[400px]/card:pb-6',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

/**
 * Conteúdo principal do Card
 */
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex-1',
          // Container query para espaçamento responsivo
          '@[400px]/card:text-base',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

/**
 * Footer do Card com estilos otimizados
 */
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, bordered = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center',
          bordered && 'pt-4 border-t border-gray-200 dark:border-gray-700',
          // Container query para responsividade
          '@[400px]/card:pt-6',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// Componente composto para facilitar o uso
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-gray-900',
      'dark:text-gray-100',
      '@[400px]/card:text-xl',
      className
    )}
    {...props}
  >
    {children}
  </h3>
));

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'text-sm text-gray-600 dark:text-gray-400',
      '@[400px]/card:text-base',
      className
    )}
    {...props}
  >
    {children}
  </p>
));

// Definir display names
Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';

export { 
  Card, 
  CardHeader, 
  CardContent, 
  CardFooter, 
  CardTitle, 
  CardDescription 
};