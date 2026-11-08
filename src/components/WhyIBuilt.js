const link = "font-bold text-ink underline decoration-hot decoration-2 underline-offset-4 hover:text-hot";

export default function WhyIBuilt({ as: Title = "h2", className = "" }) {
  return (
    <div>
      <Title className={`m-0 font-display text-[clamp(3rem,7vw,4.4rem)] leading-[0.95] font-normal tracking-[0.02em] text-ink ${className}`}>
        Why I built <span className="text-hot">Furniture Finder</span>
      </Title>
      <div className="mt-8 flex flex-col gap-5 text-[1.0625rem] leading-[1.7] text-ink">
        <p className="m-0">
          Hi, I&apos;m <a className={link} href="https://brianlesko.com">Brian</a>. I rent houses in Columbus, near Ohio State.
        </p>
        <p className="m-0">
          I learned that listing photos are your first impression. But taking good ones took a lot of planning and practice.
        </p>
        <p className="m-0">So, I built Furniture Finder with 3 things in mind:</p>
        <ul className="m-0 flex list-disc flex-col gap-3 pl-5 marker:text-hot">
          <li><b>Fix the photo you already have.</b> Straighten the walls a wide lens leans in. Keep the window light.</li>
          <li><b>Real furniture, at real size.</b> Every piece is one you can buy, set on the floor at its width, height, and depth.</li>
          <li><b>AI agent first.</b> Claude, ChatGPT, or Codex renders the room through the <a className={link} href="/docs/connect-an-agent">MCP server</a>.</li>
        </ul>
        <p className="m-0">Oh, and no wordmark on your photos. On all plans.</p>
      </div>
    </div>
  );
}
