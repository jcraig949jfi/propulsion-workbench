/**
 * Mobile layout check. Drives the real Chrome on this machine at four device sizes and
 * MEASURES the three things that actually break a phone layout, rather than eyeballing a
 * screenshot:
 *
 *   hOverflow    the page scrolling sideways as a whole (only designated containers may scroll)
 *   iosZoomRisk  form fields under 16px, which make iOS Safari zoom on focus and never zoom back
 *   smallBtns    tap targets too small to hit reliably
 *
 * Usage:  npx vite preview --port 4321   then   node mobile-check.mjs http://localhost:4321/
 * Screenshots land in shots/ (gitignored).
 */
import puppeteer from 'puppeteer-core';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL=process.argv[2]||'http://localhost:4318/';
const devices=[['iphone-se',375,667],['iphone-14',390,844],['pixel-7',412,915],['ipad-mini',768,1024]];
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--hide-scrollbars']});
for(const [name,w,h] of devices){
  const p=await b.newPage();
  await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto(URL,{waitUntil:'networkidle0'});
  const m=await p.evaluate(()=>{
    const de=document.documentElement;
    const over=[...document.querySelectorAll('*')].filter(el=>{
      const r=el.getBoundingClientRect();
      return r.right>de.clientWidth+1 && getComputedStyle(el).position!=='fixed';
    }).filter(el=>!el.closest('.table-wrap,.chart-scroll,.tabs,.sticky-summary'))
      .map(el=>`${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]}@${Math.round(el.getBoundingClientRect().right)}`);
    // Only form FIELDS trigger iOS Safari's zoom-on-focus (and it never zooms back out).
    // Buttons are a legibility question, not a zoom one, so they are counted separately.
    const small=[...document.querySelectorAll('select,input,textarea')]
      .filter(el=>parseFloat(getComputedStyle(el).fontSize)<16 && !['range','checkbox','file'].includes(el.type)).length;
    // Compact in-table and full-width text buttons are acceptable below 40px; genuinely small
    // targets are the ones that are short AND narrow.
    const tiny=[...document.querySelectorAll('button')].filter(el=>{
      const r=el.getBoundingClientRect();
      return el.offsetParent!==null && r.height<36 && r.width<120;
    }).length;
    const ss=document.querySelector('.sticky-summary');
    return {scrollW:de.scrollWidth, clientW:de.clientWidth,
      overflow:[...new Set(over)].slice(0,6), subSixteen:small, smallTargets:tiny,
      stickyVisible: ss? getComputedStyle(ss).display!=='none' : false,
      stickyPos: ss? getComputedStyle(ss).position : null};
  });
  const ok = m.scrollW<=m.clientW+1;
  console.log(`${name.padEnd(11)} ${w}x${h}  hOverflow=${ok?'none':(m.scrollW-m.clientW)+'px'}  sticky=${m.stickyVisible?m.stickyPos:'hidden'}  iosZoomRisk=${m.subSixteen}  smallBtns=${m.smallTargets}`);
  if(m.overflow.length) console.log('              culprits:', m.overflow.join(', '));
  await p.screenshot({path:`shots/${name}.png`, fullPage:false});
  await p.close();
}
await b.close();
