import { ART_COLORS } from './palette';

const line = `stroke="${ART_COLORS.outline}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
const steel = '#526577';
const light = '#D5E3E9';

function vest(color: string, accent: string) {
  return `<path d="M30 71L39 74H61L70 71L72 85Q50 95 28 85Z" fill="${color}" ${line}/><path d="M39 74V88M61 74V88" stroke="${light}" stroke-width="3"/><rect x="44" y="78" width="12" height="6" rx="1" fill="${accent}" ${line}/>`;
}

function rifle(accent: string, long = false) {
  return `<g ${line}><path d="M29 72H40L47 69H75V79H58L55 89H48L49 79H40L29 82Z" fill="${steel}"/><path d="M74 72H${long ? 95 : 89}V77H74Z" fill="${light}"/><path d="M${long ? 93 : 87} 69V79"/><rect x="53" y="63" width="${long ? 20 : 11}" height="6" rx="1" fill="${steel}"/><path d="M53 65H${long ? 71 : 62}" stroke="${accent}" stroke-width="3"/><path d="M62 72H72V77H62Z" fill="${accent}"/><path d="M39 77L44 81M64 80L70 80" stroke="#D9B99B" stroke-width="5"/></g>`;
}

export function combatEyes(y = 60): string {
  return `<path d="M35 ${y - 6}L44 ${y - 4}M56 ${y - 4}L65 ${y - 6}" fill="none" ${line}/><ellipse cx="40" cy="${y}" rx="3.3" ry="3.8" fill="${ART_COLORS.eye}"/><ellipse cx="60" cy="${y}" rx="3.3" ry="3.8" fill="${ART_COLORS.eye}"/><path d="M47 ${y + 8}H53" ${line}/>`;
}

export const COMBAT_GEAR = {
  squirrel:
    vest('#496D66', '#EABC67') +
    `<path d="M29 44Q49 32 71 44" fill="none" stroke="${steel}" stroke-width="6"/><path d="M27 51V63L35 67" fill="none" ${line}/><rect x="23" y="51" width="8" height="10" rx="2" fill="${steel}" ${line}/>` +
    rifle('#EABC67'),
  cat:
    vest('#4D5C7B', '#E88D92') +
    `<g ${line}><path d="M24 70L16 73L20 84L30 83L33 74Z" fill="${light}"/><path d="M70 75L87 31L95 27L96 39L76 78Z" fill="${light}"/><path d="M75 71L91 36" stroke="#82DAD7" stroke-width="3"/><path d="M67 73L82 79" stroke="#D5AE63" stroke-width="5"/><path d="M72 79L69 88" stroke="${steel}" stroke-width="6"/></g>`,
  bear:
    vest('#4F677D', '#8BCED2') +
    `<g ${line}><path d="M10 67L25 61L40 67L37 86L25 94L13 86Z" fill="${steel}"/><path d="M18 70L25 67L32 70L30 82L25 87L20 82Z" fill="${light}"/><path d="M79 64V89" stroke="${steel}" stroke-width="7"/><path d="M69 48H91L96 54V65H69Z" fill="${steel}"/><path d="M69 51H76V63H69Z" fill="${light}"/><path d="M86 52V61M91 53V61" stroke="#8BCED2" stroke-width="3"/></g>`,
  penguin:
    vest('#475E71', '#93DCE5') +
    `<g ${line}><path d="M29 45Q50 28 73 45L69 50H30Z" fill="${steel}"/><rect x="52" y="40" width="21" height="11" rx="2" fill="#91D4D8"/><path d="M57 43L63 48" stroke="#E7FFFF" stroke-width="2"/></g>` +
    rifle('#93DCE5', true),
  sheep:
    vest('#646582', '#B6A3F4') +
    `<g ${line}><path d="M79 90L84 49" stroke="${steel}" stroke-width="7"/><path d="M79 44L86 32L93 44L86 55Z" fill="#B6A3F4"/><path d="M76 38V53L84 59M96 38V53L88 59" fill="none" stroke="${steel}" stroke-width="4"/><path d="M86 39V48" stroke="#F2EFFF" stroke-width="3"/><path d="M26 76L20 68L15 73L22 83Z" fill="${light}"/></g>`,
  bunny:
    vest('#427C78', '#A0E1C4') +
    `<g ${line}><path d="M29 46Q50 35 71 46" fill="none" stroke="${steel}" stroke-width="5"/><rect x="25" y="48" width="8" height="12" rx="2" fill="${steel}"/><path d="M27 58L31 65H36M70 44V34" fill="none"/><circle cx="70" cy="33" r="2" fill="#A0E1C4"/></g>` +
    rifle('#A0E1C4'),
  mole:
    vest('#666D61', '#D9AB66') +
    `<g ${line}><path d="M28 47Q28 27 50 27Q72 27 72 47Z" fill="${steel}"/><path d="M29 45H71" stroke="${light}" stroke-width="4"/><rect x="36" y="36" width="28" height="10" rx="2" fill="#D9AB66"/><path d="M50 37V45"/><path d="M30 76L39 72H91V82H56L53 90H46L47 81H38L30 85Z" fill="${steel}"/><path d="M66 71H94V76H66Z" fill="${light}"/><path d="M67 78H83" stroke="#D9AB66" stroke-width="5"/><path d="M91 69V83"/></g>`,
  snail:
    vest('#647077', '#A8D6B5') +
    `<g ${line}><path d="M69 38H85L90 44V62H67V44Z" fill="${steel}"/><path d="M72 44H84V57H72Z" fill="#A8D6B5"/><path d="M80 60Q94 68 70 75" fill="none" stroke="${steel}" stroke-width="5"/><path d="M35 74H63L68 69H93V83H65L58 88H47L48 81H35Z" fill="${steel}"/><path d="M73 71H86V81H73Z" fill="#A8D6B5"/><path d="M91 68V84" stroke="${light}" stroke-width="5"/></g>`,
  owl:
    `<g ${line}><path d="M31 71Q50 77 69 71L75 87Q68 94 61 89Q50 96 40 90Q27 96 23 87Z" fill="#F4F1E5"/><path d="M34 72Q50 77 66 72L64 84Q50 88 36 84Z" fill="#ABD7CD"/><path d="M30 78Q27 83 26 87M37 82L35 91M62 82L65 91" fill="none" stroke="#84AEA8" stroke-width="1.8"/><path d="M32 71Q39 67 45 73L50 77L55 73Q61 67 68 71L61 78H39Z" fill="#FFFDF5"/><path d="M46 75L35 71L37 80L46 78M54 75L63 71L61 80L54 78" fill="#C8B9E8"/><circle cx="50" cy="77" r="3.4" fill="#E8D4A2"/></g>` +
    `<g ${line}><path d="M20 65V45M13 43Q20 35 27 43L20 48Z" fill="${light}"/><path d="M43 77H72L77 67H94V83H72L65 90H45Z" fill="#6D8991"/><path d="M69 68H96V77H69Z" fill="#E0EFED"/><path d="M94 65V80" stroke="${steel}" stroke-width="5"/><rect x="62" y="70" width="17" height="6" rx="2" fill="#B9E2D8"/><path d="M50 78L56 85" stroke="#E8D4C1" stroke-width="5"/><path d="M78 81L70 87L73 92" fill="none" stroke="#D5C7EB" stroke-width="3"/></g>`,
  wolf:
    vest('#586D7B', '#E8C585') +
    `<g ${line}><path d="M28 48Q50 37 72 48" fill="none" stroke="${steel}" stroke-width="5"/><rect x="23" y="48" width="9" height="12" rx="2" fill="${steel}"/><path d="M27 60L34 65H39" fill="none"/><path d="M31 70Q50 75 70 69L65 76H37Z" fill="#B6DCCE"/><path d="M31 70L22 82L32 86L37 75" fill="#B6DCCE"/></g>` +
    rifle('#E8C585', true) +
    `<path d="M79 71H94M66 84L76 90" fill="none" stroke="${steel}" stroke-width="3" stroke-linecap="round"/>`,
};
