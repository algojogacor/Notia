import { StudyStreakStats } from '../types';

export function generateRecapCardSvg(
  stats: StudyStreakStats,
  totalNotesCount: number,
  totalSubjectsCount: number,
  subjects: Array<{name: string, color: string, notes_count: number}> = []
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Heatmap Generator
  let heatmapSvg = "";
  stats.heatmap.forEach((h, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 145 + col * 62;
    const y = 398 + row * 24;
    
    let fill = "#e9e0cf";
    let opacity = 1;
    
    if (h.isFuture) {
      fill = "#e9e0cf";
      opacity = 0.35;
    } else if (h.count === 1) {
      fill = "#d4a853";
      opacity = 0.4;
    } else if (h.count === 2) {
      fill = "#d4a853";
      opacity = 0.7;
    } else if (h.count >= 3) {
      fill = "#b07c24";
      opacity = 1;
    }
    
    heatmapSvg += `<rect x="${x}" y="${y}" width="40" height="18" rx="4" fill="${fill}" opacity="${opacity}" style="fill:${fill};stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:${opacity};font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>\n`;
  });

  // Subjects Generator
  let subjectsSvg = "";
  const topSubjects = [...subjects].sort((a, b) => b.notes_count - a.notes_count).slice(0, 3);
  const maxNotes = topSubjects.length > 0 ? topSubjects[0].notes_count : 1;
  let subjY = 578;
  
  topSubjects.forEach((s, idx) => {
    const barWidth = Math.max(10, (s.notes_count / maxNotes) * 380);
    const color = s.color || '#4c4689';
    const isThisWeek = idx === 0 ? " &#8226;  minggu ini" : "";
    
    subjectsSvg += `
      <rect x="145" y="${subjY}" width="6" height="42" rx="3" fill="${color}" style="fill:${color};stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
      <text x="160" y="${subjY + 18}" font-family="Georgia, serif" font-size="14" fill="#1A1410" font-weight="700" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:14px;font-weight:700;text-anchor:start;dominant-baseline:auto">${s.name}</text>
      <text x="160" y="${subjY + 35}" font-family="Georgia, serif" font-size="11" fill="#6B5E52" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:11px;font-weight:400;text-anchor:start;dominant-baseline:auto">${s.notes_count} catatan${isThisWeek}</text>
      
      <rect x="160" y="${subjY + 42}" width="380" height="5" rx="2" fill="#e9e0cf" style="fill:rgb(233, 224, 207);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
      <rect x="160" y="${subjY + 42}" width="${barWidth}" height="5" rx="2" fill="${color}" opacity="0.7" style="fill:${color};stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.7;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
    `;
    subjY += 60;
  });

  return `<svg width="100%" viewBox="0 0 680 900" role="img" style="" xmlns="http://www.w3.org/2000/svg" xmlns:c2pa="http://c2pa.org/manifest">
  <title style="fill:rgb(0, 0, 0);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">Notia Rekap Belajar Card</title>
  <desc style="fill:rgb(0, 0, 0);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto">Kartu rekap belajar mingguan bergaya buku catatan dengan heatmap, streak, dan statistik mata kuliah</desc>

  <defs>
    <clipPath id="cardClip">
      <rect x="60" y="40" width="560" height="820" rx="12"/>
    </clipPath>
    <pattern id="lines" x="0" y="0" width="560" height="28" patternUnits="userSpaceOnUse" patternTransform="translate(60,40)">
      <line x1="0" y1="27.5" x2="560" y2="27.5" stroke="#e5dbc7" stroke-width="0.7"/>
    </pattern>
    <pattern id="dots" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.6" fill="#c9b89a" opacity="0.35"/>
    </pattern>
  <mask id="imagine-text-gaps-5he0w5" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="680" height="900" fill="white"/><rect x="140.03997802734375" y="76.39984130859375" width="221.87356567382812" height="16.480209350585938" fill="black" rx="2"/><rect x="141" y="95.43942260742188" width="283.4740905761719" height="47.200721740722656" fill="black" rx="2"/><rect x="140.03997802734375" y="146.55978393554688" width="137.6368408203125" height="20.32027244567871" fill="black" rx="2"/><rect x="141" y="154.43902587890625" width="79.44619750976562" height="76.96121978759766" fill="black" rx="2"/><rect x="141" y="228.39984130859375" width="133.86709594726562" height="16.480209350585938" fill="black" rx="2"/><rect x="273.5474548339844" y="209.4798126220703" width="12.90508222579956" height="18.400240898132324" fill="black" rx="2"/><rect x="161" y="254.99960327148438" width="40.46054458618164" height="33.760498046875" fill="black" rx="2"/><rect x="161" y="292.39984130859375" width="61.565895080566406" height="15.520193099975586" fill="black" rx="2"/><rect x="291" y="254.99960327148438" width="23.585261344909668" height="33.760498046875" fill="black" rx="2"/><rect x="291" y="292.39984130859375" width="56.69081497192383" height="15.520193099975586" fill="black" rx="2"/><rect x="421" y="254.99960327148438" width="41.18055725097656" height="33.760498046875" fill="black" rx="2"/><rect x="421" y="292.39984130859375" width="102.1415786743164" height="15.520193099975586" fill="black" rx="2"/><rect x="140.03997802734375" y="347.4398193359375" width="154.2974395751953" height="17.440224647521973" fill="black" rx="2"/><rect x="143.99998474121094" y="378.39984130859375" width="24.35027313232422" height="15.520193099975586" fill="black" rx="2"/><rect x="206" y="378.39984130859375" width="22.27786636352539" height="15.520193099975586" fill="black" rx="2"/><rect x="268" y="378.39984130859375" width="25.8082275390625" height="15.520193099975586" fill="black" rx="2"/><rect x="330" y="378.39984130859375" width="28.790348052978516" height="15.520193099975586" fill="black" rx="2"/><rect x="391.03997802734375" y="378.39984130859375" width="28.685346603393555" height="15.520193099975586" fill="black" rx="2"/><rect x="454" y="378.39984130859375" width="24.402862548828125" height="15.520193099975586" fill="black" rx="2"/><rect x="516" y="378.39984130859375" width="26.105302810668945" height="15.520193099975586" fill="black" rx="2"/><rect x="140.03997802734375" y="516.3998413085938" width="39.963117599487305" height="15.520193099975586" fill="black" rx="2"/><rect x="270.9999694824219" y="516.3998413085938" width="37.124393463134766" height="15.520193099975586" fill="black" rx="2"/><rect x="140.03997802734375" y="555.4398193359375" width="185.79795837402344" height="17.440224647521973" fill="black" rx="2"/><rect x="156" y="581.519775390625" width="124.2181396484375" height="19.360257148742676" fill="black" rx="2"/><rect x="156" y="601.3997802734375" width="120.36090087890625" height="16.480209350585938" fill="black" rx="2"/><rect x="156" y="640.4797973632812" width="109.85820770263672" height="18.400240898132324" fill="black" rx="2"/><rect x="156" y="657.3998413085938" width="57.502601623535156" height="16.480209350585938" fill="black" rx="2"/><rect x="156" y="696.4797973632812" width="144.00489807128906" height="18.400240898132324" fill="black" rx="2"/><rect x="156" y="713.3998413085938" width="52.79013442993164" height="16.480209350585938" fill="black" rx="2"/><rect x="204.2827606201172" y="776.4797973632812" width="271.63458251953125" height="18.400240898132324" fill="black" rx="2"/><rect x="284.1145324707031" y="801.6796875" width="63.77093505859375" height="24.160337448120117" fill="black" rx="2"/></mask></defs>

  
  <rect x="60" y="40" width="560" height="820" rx="12" fill="#FAF7F2" style="fill:rgb(250, 247, 242);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <rect x="60" y="40" width="560" height="820" rx="12" fill="url(#dots)" style="stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <rect x="60" y="40" width="560" height="820" rx="12" fill="url(#lines)" clip-path="url(#cardClip)" style="stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <line x1="118" y1="40" x2="118" y2="860" stroke="#c98a70" stroke-width="1.2" opacity="0.6" style="fill:rgb(0, 0, 0);stroke:rgb(201, 138, 112);color:rgb(11, 11, 11);stroke-width:1.2px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.6;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <rect x="110" y="28" width="120" height="28" rx="3" fill="#b07c24" opacity="0.55" transform="rotate(-2, 170, 42)" style="fill:rgb(176, 124, 36);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.55;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="112" y="30" width="116" height="24" rx="2" fill="#d4a853" opacity="0.3" transform="rotate(-2, 170, 42)" style="fill:rgb(212, 168, 83);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.3;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <rect x="450" y="26" width="100" height="28" rx="3" fill="#6f8462" opacity="0.5" transform="rotate(1.5, 500, 40)" style="fill:rgb(111, 132, 98);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.5;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="452" y="28" width="96" height="24" rx="2" fill="#a8c299" opacity="0.25" transform="rotate(1.5, 500, 40)" style="fill:rgb(168, 194, 153);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.25;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <text x="145" y="88" font-family="Georgia, serif" font-size="11" fill="#6B5E52" letter-spacing="3" font-weight="400" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:11px;font-weight:400;text-anchor:start;dominant-baseline:auto">NOTIA  •  REKAP MINGGUAN</text>

  
  <text x="145" y="132" font-family="Georgia, serif" font-size="38" fill="#1A1410" font-weight="700" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:38px;font-weight:700;text-anchor:start;dominant-baseline:auto">Rekap Belajar</text>

  
  <text x="145" y="162" font-family="Georgia, serif" font-size="15" fill="#8a7060" font-style="italic" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:15px;font-weight:400;font-style:italic;text-anchor:start;dominant-baseline:auto">${dateStr}</text>

  
  <line x1="145" y1="178" x2="580" y2="178" stroke="#e5dbc7" stroke-width="1" mask="url(#imagine-text-gaps-5he0w5)" style="fill:rgb(0, 0, 0);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <text x="145" y="215" font-family="Georgia, serif" font-size="64" fill="#b07c24" font-weight="700" style="fill:rgb(176, 124, 36);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:64px;font-weight:700;text-anchor:start;dominant-baseline:auto">${stats.streak}</text>
  <text x="145" y="240" font-family="Georgia, serif" font-size="11" fill="#6B5E52" letter-spacing="2.5" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:11px;font-weight:400;text-anchor:start;dominant-baseline:auto">HARI BERUNTUN</text>

  
  <ellipse cx="280" cy="210" rx="18" ry="22" fill="#b45a3c" opacity="0.15" style="fill:rgb(180, 90, 60);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.15;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <ellipse cx="280" cy="214" rx="11" ry="15" fill="#b45a3c" opacity="0.25" style="fill:rgb(180, 90, 60);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.25;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <ellipse cx="280" cy="218" rx="6" ry="9" fill="#b07c24" opacity="0.6" style="fill:rgb(176, 124, 36);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.6;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <text x="280" y="223" font-family="Georgia, serif" font-size="13" fill="#b45a3c" text-anchor="middle" font-weight="700" style="fill:rgb(180, 90, 60);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:13px;font-weight:700;text-anchor:middle;dominant-baseline:auto">!</text>

  
  
  <rect x="145" y="258" width="118" height="58" rx="8" fill="#FAF7F2" stroke="#e5dbc7" stroke-width="1" style="fill:rgb(250, 247, 242);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="145" y="258" width="6" height="58" rx="4" fill="#4c4689" style="fill:rgb(76, 70, 137);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <text x="165" y="281" font-family="Georgia, serif" font-size="26" fill="#1A1410" font-weight="700" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:26px;font-weight:700;text-anchor:start;dominant-baseline:auto">${totalNotesCount}</text>
  <text x="165" y="304" font-family="Georgia, serif" font-size="10" fill="#6B5E52" letter-spacing="1" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">CATATAN</text>

  
  <rect x="275" y="258" width="118" height="58" rx="8" fill="#FAF7F2" stroke="#e5dbc7" stroke-width="1" style="fill:rgb(250, 247, 242);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="275" y="258" width="6" height="58" rx="4" fill="#6f8462" style="fill:rgb(111, 132, 98);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <text x="295" y="281" font-family="Georgia, serif" font-size="26" fill="#1A1410" font-weight="700" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:26px;font-weight:700;text-anchor:start;dominant-baseline:auto">${totalSubjectsCount}</text>
  <text x="295" y="304" font-family="Georgia, serif" font-size="10" fill="#6B5E52" letter-spacing="1" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">MATKUL</text>

  
  <rect x="405" y="258" width="158" height="58" rx="8" fill="#FAF7F2" stroke="#e5dbc7" stroke-width="1" style="fill:rgb(250, 247, 242);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="405" y="258" width="6" height="58" rx="4" fill="#b07c24" style="fill:rgb(176, 124, 36);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <text x="425" y="281" font-family="Georgia, serif" font-size="26" fill="#1A1410" font-weight="700" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:26px;font-weight:700;text-anchor:start;dominant-baseline:auto">${stats.bestStreak}</text>
  <text x="425" y="304" font-family="Georgia, serif" font-size="10" fill="#6B5E52" letter-spacing="1" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">REKOR TERBAIK</text>

  
  <line x1="145" y1="334" x2="580" y2="334" stroke="#e5dbc7" stroke-width="1" style="fill:rgb(0, 0, 0);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <text x="145" y="360" font-family="Georgia, serif" font-size="12" fill="#6B5E52" letter-spacing="1.5" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:12px;font-weight:400;text-anchor:start;dominant-baseline:auto">AKTIVITAS BELAJAR</text>

  
  <text x="148" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Sen</text>
  <text x="210" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Sel</text>
  <text x="272" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Rab</text>
  <text x="334" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Kam</text>
  <text x="396" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Jum</text>
  <text x="458" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Sab</text>
  <text x="520" y="390" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Min</text>

  ${heatmapSvg}

  <text x="145" y="528" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Jarang</text>
  <rect x="193" y="518" width="16" height="10" rx="2" fill="#e9e0cf" style="fill:rgb(233, 224, 207);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="213" y="518" width="16" height="10" rx="2" fill="#d4a853" opacity="0.4" style="fill:rgb(212, 168, 83);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.4;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="233" y="518" width="16" height="10" rx="2" fill="#d4a853" opacity="0.7" style="fill:rgb(212, 168, 83);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:0.7;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <rect x="253" y="518" width="16" height="10" rx="2" fill="#b07c24" style="fill:rgb(176, 124, 36);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <text x="275" y="528" font-family="Georgia, serif" font-size="10" fill="#8a7060" style="fill:rgb(138, 112, 96);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:10px;font-weight:400;text-anchor:start;dominant-baseline:auto">Sering</text>

  
  <line x1="145" y1="544" x2="580" y2="544" stroke="#e5dbc7" stroke-width="1" style="fill:rgb(0, 0, 0);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <text x="145" y="568" font-family="Georgia, serif" font-size="12" fill="#6B5E52" letter-spacing="1.5" style="fill:rgb(107, 94, 82);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:12px;font-weight:400;text-anchor:start;dominant-baseline:auto">MATA KULIAH TERAKTIF</text>

  ${subjectsSvg}

  <line x1="145" y1="754" x2="580" y2="754" stroke="#e5dbc7" stroke-width="1" style="fill:rgb(0, 0, 0);stroke:rgb(229, 219, 199);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <text x="340" y="790" font-family="Georgia, serif" font-size="13" fill="#1A1410" text-anchor="middle" font-style="italic" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:13px;font-weight:400;font-style:italic;text-anchor:middle;dominant-baseline:auto">dicatat dengan Notia, buku catatan hidupmu</text>

  
  <text x="316" y="820" font-family="Georgia, serif" font-size="18" fill="#1A1410" text-anchor="middle" font-weight="700" letter-spacing="1" style="fill:rgb(26, 20, 16);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:Georgia, serif;font-size:18px;font-weight:700;text-anchor:middle;dominant-baseline:auto">Notia</text>
  <circle cx="336" cy="815" r="3" fill="#b45a3c" style="fill:rgb(180, 90, 60);stroke:none;color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>

  
  <circle cx="90" cy="200" r="8" fill="#e9e0cf" stroke="#d4c9bb" stroke-width="1" style="fill:rgb(233, 224, 207);stroke:rgb(212, 201, 187);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <circle cx="90" cy="440" r="8" fill="#e9e0cf" stroke="#d4c9bb" stroke-width="1" style="fill:rgb(233, 224, 207);stroke:rgb(212, 201, 187);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
  <circle cx="90" cy="680" r="8" fill="#e9e0cf" stroke="#d4c9bb" stroke-width="1" style="fill:rgb(233, 224, 207);stroke:rgb(212, 201, 187);color:rgb(11, 11, 11);stroke-width:1px;stroke-linecap:butt;stroke-linejoin:miter;opacity:1;font-family:anthropic-sans, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, sans-serif;font-size:16px;font-weight:400;text-anchor:start;dominant-baseline:auto"/>
</svg>`;
}
