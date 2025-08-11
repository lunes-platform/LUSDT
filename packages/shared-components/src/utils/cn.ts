import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utilitário para combinar classes CSS de forma inteligente
 * Combina clsx para lógica condicional com tailwind-merge para resolver conflitos
 * 
 * @param inputs - Classes CSS ou condições
 * @returns String com classes CSS otimizadas
 * 
 * @example
 * ```tsx
 * // Uso básico
 * cn('px-4 py-2', 'bg-blue-500')
 * 
 * // Com condicionais
 * cn('px-4 py-2', {
 *   'bg-blue-500': isActive,
 *   'bg-gray-500': !isActive
 * })
 * 
 * // Resolvendo conflitos do Tailwind
 * cn('px-4 px-6') // Resultado: 'px-6' (último prevalece)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Variantes de estilo para componentes
 * Utilitário para criar sistemas de variantes type-safe
 */
export type VariantProps<T> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? keyof T[K]
    : T[K] extends readonly (infer U)[]
    ? U
    : never;
};

/**
 * Cria um sistema de variantes para componentes
 * 
 * @example
 * ```tsx
 * const buttonVariants = createVariants({
 *   variant: {
 *     primary: 'bg-blue-500 text-white',
 *     secondary: 'bg-gray-500 text-white'
 *   },
 *   size: {
 *     sm: 'px-3 py-1 text-sm',
 *     lg: 'px-6 py-3 text-lg'
 *   }
 * });
 * 
 * // Uso
 * buttonVariants({ variant: 'primary', size: 'lg' })
 * ```
 */
export function createVariants<T extends Record<string, Record<string, string>>>(
  variants: T
) {
  return function(props: Partial<VariantProps<T>> & { className?: string }) {
    const { className, ...variantProps } = props;
    
    const variantClasses = Object.entries(variantProps)
      .map(([key, value]) => {
        const variantGroup = variants[key as keyof T];
        return variantGroup?.[value as string] || '';
      })
      .filter(Boolean);
    
    return cn(...variantClasses, className);
  };
}

/**
 * Utilitário para criar classes condicionais baseadas em estado
 * 
 * @example
 * ```tsx
 * const classes = conditionalClasses({
 *   'bg-green-500': isSuccess,
 *   'bg-red-500': isError,
 *   'bg-yellow-500': isPending
 * }, 'px-4 py-2'); // classes base
 * ```
 */
export function conditionalClasses(
  conditions: Record<string, boolean>,
  baseClasses?: string
) {
  const conditionalClasses = Object.entries(conditions)
    .filter(([, condition]) => condition)
    .map(([className]) => className);
  
  return cn(baseClasses, ...conditionalClasses);
}

/**
 * Utilitário para criar classes responsivas de forma programática
 * 
 * @example
 * ```tsx
 * const responsiveClasses = createResponsiveClasses({
 *   base: 'text-sm',
 *   sm: 'text-base',
 *   md: 'text-lg',
 *   lg: 'text-xl'
 * });
 * ```
 */
export function createResponsiveClasses(
  breakpoints: Partial<{
    base: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  }>
) {
  const { base, ...responsive } = breakpoints;
  
  const responsiveClasses = Object.entries(responsive)
    .map(([breakpoint, className]) => `${breakpoint}:${className}`);
  
  return cn(base, ...responsiveClasses);
}

/**
 * Utilitário para criar classes de estado de foco/hover
 * 
 * @example
 * ```tsx
 * const interactiveClasses = createInteractiveClasses({
 *   base: 'bg-blue-500',
 *   hover: 'bg-blue-600',
 *   focus: 'ring-2 ring-blue-300',
 *   active: 'bg-blue-700',
 *   disabled: 'opacity-50 cursor-not-allowed'
 * });
 * ```
 */
export function createInteractiveClasses(states: {
  base?: string;
  hover?: string;
  focus?: string;
  active?: string;
  disabled?: string;
  [key: string]: string | undefined;
}) {
  const { base, hover, focus, active, disabled, ...otherStates } = states;
  
  const stateClasses = [
    base,
    hover && `hover:${hover}`,
    focus && `focus:${focus}`,
    active && `active:${active}`,
    disabled && `disabled:${disabled}`,
    ...Object.entries(otherStates)
      .filter(([, value]) => value)
      .map(([state, value]) => `${state}:${value}`)
  ].filter(Boolean);
  
  return cn(...stateClasses);
}

/**
 * Utilitário para criar classes de tema (light/dark)
 * 
 * @example
 * ```tsx
 * const themedClasses = createThemedClasses({
 *   light: 'bg-white text-black',
 *   dark: 'bg-gray-900 text-white'
 * });
 * ```
 */
export function createThemedClasses(themes: {
  light?: string;
  dark?: string;
  base?: string;
}) {
  const { base, light, dark } = themes;
  
  return cn(
    base,
    light,
    dark && `dark:${dark}`
  );
}