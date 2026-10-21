function emblem(color: string, glyph: string): string {
  return `<g fill="none" stroke="${color}" stroke-width="3"><circle cx="32" cy="32" r="27" stroke-dasharray="32 10" opacity=".7"/>${glyph}</g>`;
}

export const SKILL_DRAWINGS = {
  'skill-eventHorizon': emblem(
    '#89D9CE',
    '<ellipse cx="32" cy="32" rx="25" ry="12" transform="rotate(-30 32 32)"/><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="5" fill="#F1DFAD"/><path d="M32 5V14M32 50V59M5 32H14M50 32H59"/>',
  ),
  'skill-acornPickup': emblem(
    '#E5BA67',
    '<path d="M22 29Q20 47 32 51Q44 47 42 29Z" fill="#F2CD88"/><path d="M19 29Q32 15 45 29ZM32 20L35 13"/>',
  ),
  'skill-nyangCombo': emblem('#8AD9DD', '<path d="M16 13Q48 24 47 50Q36 28 16 13ZM12 22Q30 28 36 46"/>'),
  'skill-potLidGuard': emblem(
    '#D8B278',
    '<path d="M32 12L49 22V41L32 52L15 41V22Z"/><path d="M22 32H42M32 22V42" stroke="#FFF4CE"/>',
  ),
  'skill-snowballBarrage': emblem(
    '#93DCEF',
    '<path d="M32 13V51M16 23L48 41M16 41L48 23M26 18L32 23L38 18M26 46L32 41L38 46M17 30L24 28L23 21M41 43L40 36L47 34"/>',
  ),
  'skill-stardustShower': emblem(
    '#B6A9ED',
    '<path d="M32 12L50 44H14ZM32 21L28 32H36L30 43"/><circle cx="32" cy="32" r="19" opacity=".5"/>',
  ),
  'skill-carrotSoup': emblem('#91D5B0', '<path d="M17 23L28 32L17 41M31 23L42 32L31 41M44 23L51 32L44 41"/>'),
  'skill-tunnelAmbush': emblem('#D6C38F', '<path d="M15 20L28 32L15 44M29 20L42 32L29 44M49 19V45"/>'),
  'skill-stickyRoad': emblem(
    '#C9A2DC',
    '<path d="M22 19L42 19L51 32L42 45H22L13 32ZM22 19L32 32L42 19M13 32H51M22 45L32 32L42 45"/><circle cx="32" cy="32" r="5" fill="#DAB8E8"/>',
  ),
  'skill-wideBarrage': emblem(
    '#F2AC69',
    '<path d="M33 12Q47 25 41 32L48 27Q53 46 34 51Q14 52 17 33L25 39Q22 24 33 12Z" fill="#EFA86C"/><path d="M32 32Q43 46 33 47Q25 46 32 32Z" stroke="#FFF0BF"/>',
  ),
  'skill-tripleAim': emblem(
    '#E4B773',
    '<circle cx="17" cy="32" r="7"/><circle cx="32" cy="26" r="7"/><circle cx="47" cy="32" r="7"/><path d="M17 22V42M32 16V36M47 22V42"/>',
  ),
  'skill-polarAim': emblem(
    '#A1DED5',
    '<circle cx="32" cy="32" r="15"/><path d="M32 11V24M32 40V53M11 32H24M40 32H53M28 32H36" stroke="#E5FFF3"/>',
  ),
  'skill-siegeBarrage': emblem(
    '#D8B777',
    '<path d="M18 19H46V45H18Z"/><circle cx="32" cy="32" r="9"/><path d="M12 32H25M39 32H52M32 12V25M32 39V52"/>',
  ),
  'skill-stormChain': emblem(
    '#ECA678',
    '<path d="M31 12Q45 22 39 31L47 25Q53 43 36 50Q20 54 17 40Q14 31 21 24L25 35Q33 27 31 12Z" fill="#F3BD82"/><path d="M33 32Q43 43 34 47Q25 48 33 32Z" fill="#FFF4D3" stroke="#FFF4D3"/><path d="M10 27Q6 39 15 46M51 18Q59 28 54 37" stroke="#EAC2C9"/>',
  ),
};
