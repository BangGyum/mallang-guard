import { reducedMotion } from './motion';

export function playFeedback(node: HTMLElement, kind: 'shake' | 'pulse') {
  if (reducedMotion()) return;
  for (const animation of node.getAnimations()) animation.cancel();
  node.animate(
    kind === 'shake'
      ? [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-4px)', color: '#b6464e' },
          { transform: 'translateX(4px)', color: '#b6464e' },
          { transform: 'translateX(0)' },
        ]
      : [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
    { duration: 320, easing: 'ease-out' },
  );
}
