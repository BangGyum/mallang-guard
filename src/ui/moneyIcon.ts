export function moneyIcon(): SVGSVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 32 32');
  icon.setAttribute('aria-hidden', 'true');
  icon.classList.add('money-icon');
  icon.innerHTML =
    '<circle cx="16" cy="16" r="13" fill="#edc35a" stroke="#b98732" stroke-width="2"/><circle cx="16" cy="16" r="9" fill="#ffe5a0"/><path d="m16 8 2.4 5 5.6.8-4 4 .9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-4 5.6-.8Z" fill="#b98732"/>';
  return icon;
}
