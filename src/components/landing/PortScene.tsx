/**
 * Original line illustration of a container terminal: quay cranes, container
 * stacks, a vessel and shipping routes. Drawn for CargoTrust (no stock assets,
 * no real port depicted). Purely decorative, so it is hidden from screen readers.
 */
const BOX = ['#1D4A72', '#155E5C', '#6B4426', '#34506F', '#23607F', '#4A3D5C', '#2C5A47'];

function Stack({ x, y, cols, rows, seed = 0, w = 30, h = 13 }: { x: number; y: number; cols: number; rows: number; seed?: number; w?: number; h?: number }) {
  const cells = [];
  for (let c = 0; c < cols; c++) {
    const height = rows - ((c * 7 + seed) % 3 === 0 ? 1 : 0);
    for (let r = 0; r < height; r++) {
      const fill = BOX[(c * 3 + r * 5 + seed) % BOX.length];
      cells.push(<rect key={`${c}-${r}`} x={x + c * (w + 1)} y={y - (r + 1) * (h + 1)} width={w} height={h} fill={fill} stroke="#0A1B2D" strokeWidth=".8"/>);
    }
  }
  return <g>{cells}</g>;
}

function Crane({ x, scale = 1 }: { x: number; scale?: number }) {
  return (
    <g transform={`translate(${x} 0) scale(${scale})`} stroke="#3B6E9A" strokeWidth="3" fill="none" strokeLinecap="square">
      {/* legs */}
      <path d="M0 318V178M58 318V178M0 236h58M0 178h58M0 236l58-58M58 236 0 178"/>
      {/* boom and back-reach */}
      <path d="M-104 160h214M-104 172h214M-104 160v12M110 160v12" strokeWidth="2.5"/>
      <path d="M-30 160 29 104 88 160M29 104v-14" strokeWidth="2.5"/>
      <path d="M-104 166 29 104M110 166 29 104" strokeWidth="1.2" opacity=".7"/>
      {/* machinery house and trolley */}
      <rect x="10" y="140" width="38" height="18" fill="#1A3A5C" stroke="#3B6E9A" strokeWidth="1.5"/>
      <rect x="-70" y="172" width="16" height="8" fill="#22507A" stroke="none"/>
      <path d="M-62 180v46" strokeWidth="1" opacity=".8"/>
      <rect x="-76" y="226" width="28" height="6" fill="#B7791F" stroke="none"/>
    </g>
  );
}

export function PortScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ps-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E2740"/>
          <stop offset="1" stopColor="#091626"/>
        </linearGradient>
        <linearGradient id="ps-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#091626" stopOpacity="1"/>
          <stop offset=".35" stopColor="#091626" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* shipping routes */}
      <g fill="none" stroke="#3AAEA3" strokeWidth="1.2" opacity=".45">
        <path className="dash-anim" d="M420 210 C 640 40, 980 30, 1300 120"/>
        <path className="dash-anim" d="M640 230 C 860 120, 1100 110, 1420 60" style={{ animationDuration: '2.2s' }}/>
      </g>
      <g fill="#79CBC2" opacity=".7">
        <circle cx="420" cy="210" r="3"/><circle cx="1300" cy="120" r="3"/><circle cx="1420" cy="60" r="2.5"/>
      </g>

      {/* distant terminal skyline */}
      <path d="M560 318V292h40v-10h26v10h60v-18h30v18h90v-8h40v8h110v-14h46v14h120v-6h80v6h258v26z" fill="#0E2238"/>

      {/* quay */}
      <rect x="560" y="318" width="880" height="14" fill="#16314F"/>
      <path d="M560 318h880" stroke="#2A527B" strokeWidth="1.5"/>

      {/* container yard */}
      <Stack x={600} y={318} cols={9} rows={4} seed={1}/>
      <Stack x={905} y={318} cols={5} rows={3} seed={4}/>

      {/* quay cranes */}
      <Crane x={1130}/>
      <Crane x={1300}/>

      {/* sea */}
      <rect x="0" y="332" width="1440" height="88" fill="url(#ps-sea)"/>
      <g stroke="#1E3F61" strokeWidth="1.2" strokeLinecap="round" opacity=".9">
        <path d="M40 352h90M180 360h140M380 350h70M520 368h120M760 356h90M930 372h150M1160 358h110M1320 374h80"/>
        <path d="M110 384h60M300 392h110M610 388h80M840 398h120M1060 390h70M1250 400h100" opacity=".6"/>
      </g>

      {/* vessel */}
      <g className="animate-sail">
        <path d="M70 302h560l-30 44H118z" fill="#132C47" stroke="#2A527B" strokeWidth="1.5"/>
        <path d="M70 302h560" stroke="#B42318" strokeWidth="2" opacity=".6"/>
        <Stack x={150} y={302} cols={12} rows={3} seed={2} w={30} h={13}/>
        {/* bridge */}
        <rect x="548" y="246" width="48" height="56" fill="#1A3A5C" stroke="#2A527B" strokeWidth="1.5"/>
        <path d="M554 258h36M554 270h36" stroke="#79CBC2" strokeWidth="2" opacity=".55"/>
        <rect x="566" y="226" width="8" height="20" fill="#2A527B"/>
      </g>

      {/* soft fade on the left, behind the copy */}
      <rect x="0" y="0" width="1440" height="420" fill="url(#ps-fade)"/>
    </svg>
  );
}
