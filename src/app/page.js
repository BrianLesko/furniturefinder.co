import RoomPair from "@/components/RoomPair";

function Mark() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#fff" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M12 36c0-6 4-10 10-10h20c6 0 10 4 10 10v6H12v-6z" fill="#ff6b4a" stroke="#1a1a1a" strokeWidth="3" />
      <path d="M10 42h44v4c0 3-2 5-5 5H15c-3 0-5-2-5-5v-4z" fill="#fff" stroke="#1a1a1a" strokeWidth="3" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <header>
        <a className="brand" href="/">
          <Mark />
          Furniture Finder
        </a>
        <nav className="nav">
          <a className="btn btn-ghost" href="#how">How it places</a>
          <a className="btn btn-hot" href="#rooms" style={{ fontSize: 18, padding: "8px 18px" }}>See a room</a>
        </nav>
      </header>

      <main>
        <section className="hero wrap">
          <h1>Furnish the photo</h1>
          <p className="lede">
            An empty listing photo makes a room look smaller than it is. Drop that photo in.
            Furniture Finder puts real pieces on the floor, in the light already in the picture.
          </p>
          <div className="hero-actions">
            <a className="btn btn-hot btn-lg" href="#rooms">See a room</a>
          </div>
          <p className="fine">Same walls. Same window. The sofa actually meets the floor.</p>
        </section>

        <RoomPair />

        <section className="block wrap" id="how">
          <h2 className="center-title">From the listing photo</h2>
          <p className="section-intro">
            Photo tools redraw a room. Houzz shows a room someone else styled.
            This starts from the photo you already have and keeps the architecture.
          </p>
          <div className="steps">
            <article className="step">
              <div className="num">1</div>
              <h3>Start empty</h3>
              <p>Use the listing photo as it was shot: bare floors, the window, the odd alcove. That photo is the room.</p>
            </article>
            <article className="step">
              <div className="num">2</div>
              <h3>Place, don&apos;t paste</h3>
              <p>Pieces sit on the floor plane. Scale comes from the baseboard and the window, not from a sticker dropped on top.</p>
            </article>
            <article className="step">
              <div className="num">3</div>
              <h3>Shop the result</h3>
              <p>Every sofa, lamp, and rug in the picture is a product. The furnished photo is also the shopping list.</p>
            </article>
          </div>
        </section>

        <section className="block wrap">
          <h2 className="center-title">Learned from the after photo</h2>
          <div className="facts">
            <div className="fact-list">
              <article className="fact">
                <div className="swatch" style={{ background: "#e7c98a" }} />
                <div>
                  <b>The floor line</b>
                  <p>Before-and-after pairs of the same room teach where furniture touches the ground, and where a rug has to stop.</p>
                </div>
              </article>
              <article className="fact">
                <div className="swatch" style={{ background: "#ffea63" }} />
                <div>
                  <b>The light in the photo</b>
                  <p>The window stays. New pieces take the sunlight and the shadow already in the listing, instead of a studio setup.</p>
                </div>
              </article>
              <article className="fact">
                <div className="swatch" style={{ background: "#ff6b4a" }} />
                <div>
                  <b>A real product</b>
                  <p>The thing in the picture is something you can buy, with a price, not a couch the model invented.</p>
                </div>
              </article>
            </div>
            <aside className="note">
              <p>
                Empty photos lie a little. The room is bigger once a sofa gives it a scale.
                That is the whole product.
              </p>
              <small>furniturefinder.co</small>
            </aside>
          </div>
        </section>

        <section className="block wrap">
          <h2 className="center-title">Pick a way the room can go</h2>
          <div className="looks">
            <article className="look">
              <div className="look-bar" style={{ background: "#e7c98a" }} />
              <div><b>Warm oak</b><span>Low wood, linen, one coral chair.</span></div>
            </article>
            <article className="look">
              <div className="look-bar" style={{ background: "#f7f1dc" }} />
              <div><b>Quiet linen</b><span>Pale upholstery, almost no metal.</span></div>
            </article>
            <article className="look">
              <div className="look-bar" style={{ background: "#4a9bd9" }} />
              <div><b>Rental ready</b><span>Pieces that survive a lease and a move.</span></div>
            </article>
            <article className="look">
              <div className="look-bar" style={{ background: "#fff" }} />
              <div><b>Gallery white</b><span>Fewer things. The window does the work.</span></div>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <span>Furniture Finder</span>
          <span>furniturefinder.co</span>
        </div>
      </footer>
    </>
  );
}
