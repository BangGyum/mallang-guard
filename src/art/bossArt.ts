import { ART_COLORS } from './palette';

const line = `stroke="${ART_COLORS.outline}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"`;

export function createBossArt(jelly: () => string, crow: () => string) {
  return {
    bigJelly: () =>
      jelly().replaceAll('#9B7BFF', '#D49376').replaceAll('#8463F0', '#B86F67') +
      `<path d="M27 45L30 30L44 35L50 25L56 35L70 30L73 45Z" fill="#E5C886" ${line}/><path d="M29 42H71" stroke="#F7E4B0" stroke-width="4"/><path d="M24 81L50 87L76 81" fill="none" stroke="#F5DCC1" stroke-width="5"/>`,
    gateJelly: () =>
      jelly().replaceAll('#9B7BFF', '#8FA5B9').replaceAll('#8463F0', '#6B839D') +
      `<path d="M23 52L26 23H37V32H45V23H56V32H64V23H75L77 52Z" fill="#C4CFD5" ${line}/><path d="M29 46H71M50 34V48" stroke="#879CAA" stroke-width="3"/><path d="M6 63L22 55L40 63L36 83L23 96L10 84Z" fill="#7A9CAD" ${line}/><path d="M16 67L23 62L30 67L28 81L23 86L18 81Z" fill="#D1ECED" ${line}/><path d="M73 66L83 58L95 64L91 84L79 92L74 83Z" fill="#7A9CAD" ${line}/>`,
    splitCaptain: () =>
      jelly().replaceAll('#9B7BFF', '#81B7B6').replaceAll('#8463F0', '#588C94') +
      `<path d="M30 48L25 30L41 34L50 19L59 34L75 30L70 48Z" fill="#CBDDD0" ${line}/><path d="M49 48L43 58L54 67L47 87" fill="none" stroke="#E2F5DB" stroke-width="5"/><circle cx="19" cy="84" r="12" fill="#B0DFD6" ${line}/><circle cx="80" cy="83" r="12" fill="#B0DFD6" ${line}/><path d="M16 81H22M77 80H83" stroke="#547C7E" stroke-width="2"/>`,
    greenhouseKeeper: () =>
      jelly().replaceAll('#9B7BFF', '#84AF92').replaceAll('#8463F0', '#5D8D7B') +
      `<path d="M29 49L31 29H69L71 49Z" fill="#B79D75" ${line}/><path d="M34 39H66" stroke="#E6D2A5" stroke-width="4"/><path d="M50 30V13" stroke="#467B65" stroke-width="4"/><path d="M49 26Q25 28 24 12Q43 10 49 26ZM51 22Q54 6 75 10Q74 28 51 22Z" fill="#C0DBA4" ${line}/><path d="M17 78Q6 56 24 54M78 62Q95 56 90 82" fill="none" stroke="#BDD9AB" stroke-width="6"/><path d="M29 83L35 87M68 81L61 86" stroke="#E3EBC7" stroke-width="4"/>`,
    stormCrow: () =>
      crow().replaceAll('#44485E', '#657E95').replaceAll('#383B50', '#476176') +
      `<path d="M31 60L12 43L2 47L9 60L1 65L17 77L31 71M69 60L88 43L98 47L91 60L99 65L83 77L69 71" fill="#A2C2D3" ${line}/><path d="M30 47L26 30L41 35L50 18L59 35L74 30L70 47Z" fill="#D4C996" ${line}/><path d="M32 44H68" stroke="#F2E7B7" stroke-width="3"/><path d="M45 79L51 73L48 81L55 81L48 91L50 83H43Z" fill="#F3DB93" ${line}/>`,
    gardenKing: () =>
      jelly().replaceAll('#9B7BFF', '#8C9FC0').replaceAll('#8463F0', '#647FA6') +
      `<path d="M18 80L20 46L35 41H65L80 46L84 81L71 91L65 84H35L29 91Z" fill="#748C87" ${line}/><path d="M30 65H70L67 87H33Z" fill="#A4BEB8" ${line}/><path d="M26 48L22 23L37 30L50 9L63 30L78 23L74 48Z" fill="#E2CA86" ${line}/><path d="M29 43H71" stroke="#FFF0BB" stroke-width="4"/><path d="M50 25L56 33L50 41L44 33Z" fill="#A2D4BF" ${line}/><path d="M37 60L44 63M63 60L56 63M45 76Q50 73 55 76" fill="none" ${line}/><circle cx="41" cy="68" r="3.5" fill="${ART_COLORS.eye}"/><circle cx="59" cy="68" r="3.5" fill="${ART_COLORS.eye}"/><path d="M9 62L20 55L31 63L27 84L19 94L11 84Z" fill="#B7D9CB" ${line}/><path d="M80 56L91 63L89 84L81 93L72 83L71 64Z" fill="#B7D9CB" ${line}/>`,
  };
}
