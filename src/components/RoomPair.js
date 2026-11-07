function Window() {
  return (
    <g>
      <rect x="332" y="28" width="150" height="118" rx="8" fill="#d7ecf8" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M407 28v118M332 87h150" stroke="#1a1a1a" strokeWidth="3" />
      <circle cx="438" cy="52" r="14" fill="#ffea63" stroke="#1a1a1a" strokeWidth="3" />
    </g>
  );
}

function RoomShell({ children }) {
  return (
    <svg viewBox="0 0 520 360" role="img">
      <rect width="520" height="360" fill="#f7f1dc" />
      <Window />
      <path d="M0 214h520l-40 146H40L0 214z" fill="#e7c98a" />
      <path d="M70 214l-28 146M150 214l-8 146M250 214v146M350 214l8 146M430 214l22 146" stroke="#d7b56d" strokeWidth="3" />
      <path d="M0 214h520" stroke="#1a1a1a" strokeWidth="3" />
      <polygon points="300,214 470,150 500,214" fill="#ffea63" opacity="0.55" />
      {children}
    </svg>
  );
}

export default function RoomPair() {
  return (
    <div className="wrap" id="rooms">
      <div className="pair">
        <figure className="frame">
          <RoomShell>
            <title>Empty listing photo</title>
          </RoomShell>
          <figcaption>
            <span>Empty</span>
            <span>Listing photo</span>
          </figcaption>
        </figure>
        <div className="arrow" aria-hidden="true">→</div>
        <figure className="frame">
          <RoomShell>
            <title>The same room with furniture placed in it</title>
            <ellipse cx="230" cy="308" rx="140" ry="24" fill="#ffd4c4" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="86" y="232" width="34" height="52" rx="12" fill="#ff6b4a" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="196" y="232" width="34" height="52" rx="12" fill="#ff6b4a" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="96" y="214" width="124" height="42" rx="14" fill="#ff6b4a" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="92" y="246" width="138" height="30" rx="12" fill="#ffb199" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="108" y="274" width="8" height="18" rx="2" fill="#1a1a1a" />
            <rect x="206" y="274" width="8" height="18" rx="2" fill="#1a1a1a" />
            <ellipse cx="300" cy="292" rx="34" ry="12" fill="#4a9bd9" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="296" y="292" width="8" height="24" fill="#1a1a1a" />
            <rect x="360" y="248" width="8" height="58" fill="#1a1a1a" />
            <path d="M348 252h32l-6-26h-20z" fill="#ffea63" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="412" y="278" width="28" height="22" rx="4" fill="#fff" stroke="#1a1a1a" strokeWidth="3" />
            <circle cx="418" cy="266" r="14" fill="#2f7d32" stroke="#1a1a1a" strokeWidth="3" />
            <circle cx="434" cy="258" r="16" fill="#3d9a42" stroke="#1a1a1a" strokeWidth="3" />
            <rect x="48" y="72" width="72" height="52" rx="6" fill="#fff" stroke="#1a1a1a" strokeWidth="3" />
            <path d="M60 108c16-18 30-4 42 4" fill="none" stroke="#ff6b4a" strokeWidth="3" />
          </RoomShell>
          <figcaption>
            <span>Furnished</span>
            <span>Same photo</span>
          </figcaption>
        </figure>
      </div>
      <div className="shop">
        <div className="piece"><b>Low sofa, oak legs</b><span>$890 · in the photo</span></div>
        <div className="piece"><b>Linen drum shade</b><span>$140 · in the photo</span></div>
        <div className="piece"><b>Blush flatweave</b><span>$320 · in the photo</span></div>
        <div className="piece"><b>Round side table</b><span>$260 · in the photo</span></div>
      </div>
    </div>
  );
}
