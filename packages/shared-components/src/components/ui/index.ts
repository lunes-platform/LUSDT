/**
 * Biblioteca de Componentes UI LUSDT
 * 
 * Componentes base otimizados com Tailwind 4.1 para o ecossistema LUSDT
 * Inclui suporte a container queries, animações avançadas e temas específicos
 */

// Componentes base
export { Button, buttonVariants, type ButtonProps } from './Button';
export { Input, type InputProps } from './Input';
export { Select, type SelectProps, type SelectOption } from './Select';
export { Badge, badgeVariants, type BadgeProps } from './Badge';
export { Loading, type LoadingProps } from './Loading';
export { 
  Card, 
  CardHeader, 
  CardContent, 
  CardFooter, 
  CardTitle, 
  CardDescription,
  type CardProps,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps
} from './Card';

// Componentes Bridge
export * from '../bridge';

// Re-exportar utilitários
export { cn, createVariants, conditionalClasses, createResponsiveClasses } from '../../utils/cn';