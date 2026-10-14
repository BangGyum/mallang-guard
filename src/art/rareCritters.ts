const ink = '#344953';
const line = `stroke="${ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const path = (d: string, fill: string) => `<path d="${d}" fill="${fill}" ${line}/>`;
const ellipse = (x: number, y: number, rx: number, ry: number, fill: string) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${line}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" ${line}/>`;
const stroke = (d: string, color: string, width = 2) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

function face(eyes = ink) {
  return (
    stroke('M33 31L42 34M55 34L65 31', ink, 1.8) +
    ellipse(39, 37, 2.5, 3.2, eyes) +
    ellipse(59, 37, 2.5, 3.2, eyes) +
    path('M46 43H53L49 47Z', ink) +
    stroke('M46 50H53', ink, 1.4)
  );
}

function coat(main: string, accent: string) {
  return (
    path('M34 77H46L45 93H28L29 89L34 86Z', '#556773') +
    path('M55 77H66L68 87L73 90L71 93H55Z', '#556773') +
    path('M33 50L65 50L74 82L59 89L51 81L38 90L27 81Z', main) +
    path('M34 52L48 62L42 82L30 79Z', accent) +
    path('M63 52L53 62L60 82L71 78Z', accent) +
    path('M33 55L24 62L21 75L29 78L40 63Z', main) +
    path('M63 54L72 56L80 69L70 74L60 64Z', main) +
    rect(40, 76, 23, 5, '#566775') +
    rect(48, 76, 6, 5, '#e2c685')
  );
}

export const RARE_CRITTERS = {
  fox: () =>
    path('M65 80Q87 83 91 62Q98 76 89 88Q80 96 66 89Z', '#e3e5dc') +
    path('M85 67L91 61Q96 75 89 84L82 82Z', '#a5bcbf') +
    coat('#718e8b', '#d0e5d9') +
    path(
      'M26 29L26 10L43 22Q54 16 65 24L76 11L74 33L79 44L69 49L71 54L60 52Q47 58 38 53L28 51L31 46L22 42Z',
      '#e3e5dc',
    ) +
    path('M30 26L30 17L38 26M68 27L72 18L71 30', '#c0b1c4') +
    path('M31 41L26 45L35 49L46 52L58 50L70 45L65 40', '#f6f1df') +
    face('#496d76') +
    stroke('M35 36L31 33M63 36L67 33', '#496d76', 1.4) +
    stroke('M28 28Q49 18 72 28', '#556775', 3) +
    rect(23, 30, 6, 11, '#556775') +
    path('M29 50L47 57L66 50L63 58H36Z', '#b7d6c7') +
    path('M21 67L35 63H48L54 59H78V70H56L52 80H44L46 70H35L23 75Z', '#526577') +
    rect(76, 61, 22, 5, '#d5e3df') +
    rect(55, 52, 19, 6, '#526577') +
    rect(57, 53, 8, 4, '#a7d9ce') +
    stroke('M61 63H75', '#a7d9ce', 2.5) +
    stroke('M93 59V69', '#526577', 2.5) +
    stroke('M35 69L41 72M64 71L69 73', '#dfe7dd', 5),
  redPanda: () =>
    path('M64 82Q91 95 95 75Q95 62 81 62L73 67Q88 71 87 81L68 75Z', '#ce865e') +
    stroke('M85 67L90 73M86 81L81 87', '#844f43', 5) +
    coat('#d3c8a1', '#ede1bc') +
    ellipse(30, 20, 8, 9, '#b77555') +
    ellipse(69, 20, 8, 9, '#b77555') +
    ellipse(30, 20, 4, 5, '#f2d8b3') +
    ellipse(69, 20, 4, 5, '#f2d8b3') +
    path('M26 31Q26 19 48 19Q70 19 74 35Q76 49 63 55Q50 62 34 55Q24 50 26 31Z', '#c88558') +
    path('M28 29L40 31L41 43L32 49L27 43M69 29L58 31L57 43L66 49L72 41', '#f2dec1') +
    ellipse(38, 38, 6, 8, '#624c48') +
    ellipse(60, 38, 6, 8, '#624c48') +
    path('M37 45L49 40L62 46L59 54H41Z', '#f2dec1') +
    face('#3d403f') +
    path('M28 26L32 18L55 15L71 22L70 28H32Z', '#75897c') +
    rect(49, 20, 13, 6, '#dcc681') +
    path('M26 67L38 62H59L64 57H88L97 65V77L88 82H56L52 90H44L46 79H36L26 82Z', '#64777b') +
    rect(60, 61, 27, 16, '#e1dac0') +
    ellipse(90, 69, 7, 10, '#53696e') +
    ellipse(91, 69, 3, 6, '#dcc681') +
    stroke('M66 64V73M73 64V73M80 64V73', '#879b91', 3) +
    stroke('M33 72L40 76M56 79L63 82', '#ecd9b6', 5),
  deer: () =>
    stroke('M37 20L32 9L33 3M32 10L23 8L19 3M63 20L69 9L68 3M69 10L79 8L82 3', '#c0a57c', 3) +
    path('M26 55L18 80L28 88L41 73H62L77 88L85 81L74 54Z', '#cfcae5') +
    coat('#a8a6bf', '#e4dbc6') +
    ellipse(26, 29, 11, 5, '#d3bfa0') +
    ellipse(73, 29, 11, 5, '#d3bfa0') +
    path('M29 29Q30 17 50 20Q69 18 72 32L70 43Q64 57 49 56Q31 53 28 41Z', '#e5d4b6') +
    path('M36 39Q49 36 62 39L62 49Q49 57 36 49Z', '#f7eed7') +
    stroke('M29 27L38 22L51 28L58 23L69 27', '#f7eed7', 4) +
    face('#756697') +
    stroke('M35 34L31 31M62 34L66 31', '#756697', 1.4) +
    path('M33 53L48 60L65 53L61 62H38Z', '#f5ebd6') +
    path('M49 61L44 68L49 75L55 68Z', '#b2a5d5') +
    stroke('M80 92L86 43', '#667786', 4) +
    path('M76 41L80 31L77 23L85 31L89 21L90 33L98 26L94 38L87 45Z', '#c9bde6') +
    stroke('M86 37L88 30M85 44L86 39', '#edf6ec', 3) +
    stroke('M78 65L83 68', '#f5ebd6', 5) +
    path('M19 69L29 66L35 73L30 80L19 77Z', '#e6dac1'),
};
