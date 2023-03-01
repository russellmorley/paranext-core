import logger from '@shared/util/logger';
import { PropsWithChildren } from 'react';

export type PButtonProps = PropsWithChildren<{
  onClick?: () => void;
  onContextMenu?: () => void;
}>;

export function PButton({
  onClick,
  onContextMenu,
  children = 'Click me!',
}: PButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        if (onClick) {
          logger.log('PButton clicked!');
          e.preventDefault();
          onClick();
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu();
        }
      }}
    >
      {children}
    </button>
  );
}
