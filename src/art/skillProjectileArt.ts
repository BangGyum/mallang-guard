// 꼬리와 중심을 한 장에 그려 동시 스킬에도 파티클 수가 늘지 않게 합니다.
export const SKILL_PROJECTILES = {
  crescentSlash:
    '<g stroke="none"><path d="M9 2Q65 17 54 60Q44 32 9 2Z" fill="#7CCFD8" opacity=".25"/><path d="M13 3Q61 20 51 59Q48 30 13 3Z" fill="#D7FFFF"/><path d="M5 13Q43 26 44 52Q32 29 5 13Z" fill="#85E1DE"/><path d="M24 13Q50 27 51 43" fill="none" stroke="#FFFFFF" stroke-width="2"/></g>',
  hammerWave:
    '<g fill="none" stroke-linecap="round"><path d="M9 8L35 32L9 56" stroke="#D8AA62" stroke-width="11" opacity=".3"/><path d="M18 7L45 32L18 57" stroke="#F8CE83" stroke-width="7"/><path d="M35 10L58 32L35 54" stroke="#FFF8D8" stroke-width="4"/><path d="M5 25L15 32L5 39" stroke="#E4B46B" stroke-width="4"/></g>',
  iceLance:
    '<g stroke="none"><path d="M0 21L37 14L64 32L37 50L0 43L17 32Z" fill="#84CDEB" opacity=".2"/><path d="M8 27L39 19L62 32L39 45L8 37L24 32Z" fill="#8ADDF3"/><path d="M23 29L41 23L62 32L41 35Z" fill="#F1FFFF"/><path d="M23 35L41 41L62 32L41 35Z" fill="#B9ECF7"/><path d="M0 14L16 18L8 23ZM2 47L18 45L10 52Z" fill="#C4F5FF"/></g>',
  cometRound:
    '<g stroke="none"><path d="M0 8L47 20L64 32L47 45L0 56L19 32Z" fill="#AD9FDF" opacity=".22"/><path d="M5 20L46 24L58 32L46 40L5 45L24 32Z" fill="#B6C7FC"/><path d="M44 17L49 26L61 32L49 37L44 47L39 37L28 32L39 27Z" fill="#F6F1FF"/><path d="M15 28L38 31L21 35Z" fill="#E3D9FF"/></g>',
  infernoRound:
    '<g stroke="none"><path d="M0 7Q24 11 34 14L23 0Q49 4 59 21Q74 40 49 54Q32 64 11 55L26 44Q7 44 0 33L20 29Z" fill="#E99B60" opacity=".25"/><path d="M0 13Q25 24 34 17L28 5Q58 9 62 31Q62 55 29 54L36 43Q13 48 5 36L24 31Z" fill="#EB7951"/><path d="M14 23Q34 33 40 20Q57 18 58 34Q55 49 34 47L44 36Q31 42 24 33Z" fill="#FFC86B"/><path d="M40 25Q56 25 54 36Q51 44 41 39L44 33L32 29Z" fill="#FFFADE"/></g>',
  chargedRail:
    '<g stroke="none"><path d="M0 26H47L64 32L47 38H0Z" fill="#91D6CA" opacity=".2"/><path d="M0 29H48L64 32L48 35H0Z" fill="#90DFCD"/><path d="M12 31H55L64 32L55 33H12Z" fill="#FCFFF2"/><path d="M14 24H39L45 26H14ZM5 38H32L38 40H5Z" fill="#C0F3DF" opacity=".75"/></g>',
  gravityCore:
    '<g stroke="none"><circle cx="34" cy="32" r="25" fill="#75C8BD" opacity=".14"/><circle cx="34" cy="32" r="17" fill="#4C858C"/><circle cx="34" cy="32" r="11" fill="#244A62"/><circle cx="35" cy="31" r="5" fill="#FFF2BF"/></g><g fill="none" stroke="#B1EBCE" stroke-width="3"><ellipse cx="34" cy="32" rx="27" ry="10" transform="rotate(-25 34 32)"/><path d="M20 13Q43 4 52 23M48 50Q25 60 15 40" stroke="#F2D99D" stroke-width="2"/></g>',
};
