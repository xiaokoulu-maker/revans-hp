import SiteMotion from "./site-motion";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "./site-chrome";

const services = [
  {
    number: "01",
    label: "WEB DESIGN",
    title: "Webサイト・LP制作",
    description:
      "見た目を整えるだけでなく、誰に・何を・どう伝えるかから設計。問い合わせにつながる導線までつくります。",
    tags: ["コーポレートサイト", "LP", "採用サイト"],
  },
  {
    number: "02",
    label: "AI DEVELOPMENT",
    title: "AIシステム開発",
    description:
      "問い合わせ対応、コンテンツ作成、社内ナレッジ活用など、現場で実際に使える形でAIを組み込みます。",
    tags: ["AIチャット", "AIブログ", "社内AI"],
  },
  {
    number: "03",
    label: "BUSINESS SYSTEM",
    title: "業務システム・自動化",
    description:
      "顧客管理や営業進捗、レポート作成など、手作業が多い業務をシンプルな仕組みに置き換えます。",
    tags: ["CRM", "ダッシュボード", "業務自動化"],
  },
  {
    number: "04",
    label: "GROWTH SUPPORT",
    title: "集客・運用支援",
    description:
      "Webサイトを公開して終わりにせず、広告・MEO・コンテンツを組み合わせて改善を続けます。",
    tags: ["Web広告", "MEO", "運用改善"],
  },
];

const process = [
  ["01", "HEAR", "現状を知る", "課題、業務、目標を整理し、優先順位を決めます。"],
  ["02", "DESIGN", "仕組みを設計する", "画面と導線、必要な機能をわかりやすくご提案します。"],
  ["03", "BUILD", "制作・実装する", "進捗を共有しながら、実際に使える形まで仕上げます。"],
  ["04", "GROW", "運用して育てる", "公開後の数字を見ながら、必要な改善を重ねます。"],
];

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h11M11 5l5 5-5 5" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="m5 10 3 3 7-7" />
  </svg>
);

export default function Home() {
  return (
    <main>
      <SiteMotion />
      <div className="page-grain" aria-hidden="true" />
      <div className="pointer-spotlight" aria-hidden="true" />
      <div className="cursor-ring" aria-hidden="true" />
      <div className="cursor-dot" aria-hidden="true" />
      <SiteHeader active="/" />

      <section className="hero" id="top">
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="hero-orb hero-orb-blue" aria-hidden="true" />
        <div className="hero-orb hero-orb-orange" aria-hidden="true" />
        <div className="hero-wordmark" aria-hidden="true">REVANS</div>
        <div className="scroll-rail" aria-hidden="true"><span>SCROLL TO EXPLORE</span><i /></div>
        <div className="hero-grid shell">
          <div className="hero-copy">
            <div className="hero-meta">
              <p className="eyebrow"><span /> WEB &amp; SYSTEM PARTNER</p>
              <span className="hero-meta-index">TOKYO / JAPAN</span>
            </div>
            <h1><span className="hero-line">WebとAIで、</span><br /><em>事業が進む仕組み</em><br /><span className="hero-line hero-line-last">をつくる。</span></h1>
            <p className="hero-lead">
              Webサイト制作からAIシステム、業務の自動化まで。<br className="desktop-only" />
              中小企業の「伝える」と「動かす」を、ひとつのチームで支援します。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/contact">
                無料で相談する <ArrowIcon />
              </Link>
              <Link className="button button-secondary" href="/services">
                できることを見る
              </Link>
            </div>
            <ul className="hero-points" aria-label="対応内容">
              <li><CheckIcon /> 全国オンライン対応</li>
              <li><CheckIcon /> 制作から運用まで一貫対応</li>
            </ul>
            <div className="availability"><i /><span>AVAILABLE FOR NEW PROJECTS</span><small>2026</small></div>
          </div>

          <div className="product-visual" aria-label="Webとシステムを連携するイメージ">
            <div className="visual-glow" />
            <div className="visual-outline-r" aria-hidden="true">R</div>
            <div className="visual-ring" aria-hidden="true"><i /><i /><i /></div>
            <div className="visual-kicker"><span>01</span><small>DESIGN<br />THE NEXT</small></div>
            <div className="window-card main-window">
              <div className="window-bar">
                <span /><span /><span />
                <small>revans / overview</small>
              </div>
              <div className="window-body">
                <div className="sidebar">
                  <b>R</b>
                  <i className="active" /><i /><i /><i />
                </div>
                <div className="dashboard">
                  <div className="dash-head">
                    <div><small>PROJECT</small><strong>Business Growth</strong></div>
                    <span>LIVE</span>
                  </div>
                  <div className="metric-row">
                    <div><small>WEB</small><b>Design</b><i className="up">↗</i></div>
                    <div><small>AI</small><b>System</b><i>●</i></div>
                    <div><small>DATA</small><b>Improve</b><i>＋</i></div>
                  </div>
                  <div className="chart-card">
                    <div className="chart-top"><span>Growth overview</span><small>Last 6 months</small></div>
                    <div className="chart-bars">
                      <i style={{ height: "32%" }} /><i style={{ height: "45%" }} />
                      <i style={{ height: "39%" }} /><i style={{ height: "61%" }} />
                      <i style={{ height: "58%" }} /><i style={{ height: "82%" }} />
                      <i className="accent" style={{ height: "94%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-card code-card">
              <div><span /> SYSTEM CONNECTED</div>
              <code><b>01</b> website.build()</code>
              <code><b>02</b> ai.automate()</code>
              <code className="blue"><b>03</b> data.improve()</code>
            </div>
            <div className="floating-card status-card">
              <span className="status-icon"><CheckIcon /></span>
              <div><small>PROJECT STATUS</small><b>Ready to grow</b></div>
            </div>
            <div className="visual-coordinate">35.6762° N&nbsp;&nbsp; 139.6503° E</div>
            <div className="hero-signature" aria-hidden="true"><b>R</b><span>REVANS<br />DIGITAL STUDIO</span></div>
          </div>
        </div>
        <div className="capability-bar">
          <div className="capability-marquee">
            <div className="capability-track">
              <div className="capability-inner">
                <span>WEB DESIGN</span><i /><span>AI DEVELOPMENT</span><i /><span>BUSINESS SYSTEM</span><i /><span>GROWTH SUPPORT</span><i />
              </div>
              <div className="capability-inner" aria-hidden="true">
                <span>WEB DESIGN</span><i /><span>AI DEVELOPMENT</span><i /><span>BUSINESS SYSTEM</span><i /><span>GROWTH SUPPORT</span><i />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section services" id="services">
        <div className="services-word" aria-hidden="true">CAPABILITIES</div>
        <div className="shell">
          <div className="section-heading split-heading" data-reveal="up">
            <div>
              <p className="eyebrow"><span /> SERVICES</p>
              <h2>事業を前に進める、<br />4つのデジタル支援。</h2>
            </div>
            <p>必要な施策をバラバラに発注するのではなく、課題に合わせて組み合わせます。小さく始めて、必要なところから広げられます。</p>
          </div>
          <div className="service-grid" data-reveal="up">
            {services.map((service) => (
              <article className="service-card" key={service.number}>
                <div className="service-top">
                  <span>{service.number}</span>
                  <small>{service.label}</small>
                </div>
                <div className={`service-symbol symbol-${service.number}`} aria-hidden="true"><i /><b /></div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <ul>{service.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
                <span className="card-arrow" aria-hidden="true"><ArrowIcon /></span>
                <span className="service-monogram" aria-hidden="true">R</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="manifesto" aria-label="REVANSの設計思想">
        <div className="manifesto-bg-mark" aria-hidden="true">R</div>
        <div className="manifesto-shell shell" data-reveal="up">
          <div className="manifesto-copy">
            <p className="eyebrow light"><span /> ONE TEAM, ONE SYSTEM</p>
            <h2>DESIGN THE EXPERIENCE.<br />BUILD THE SYSTEM.<br /><em>MOVE THE BUSINESS.</em></h2>
            <p>見える部分だけではなく、裏側で動く仕組みまで。<br />すべてをひとつの体験として設計します。</p>
          </div>
          <div className="system-map" aria-label="Web・AI・データが連携する仕組み">
            <div className="map-core"><span>R</span><small>REVANS CORE</small></div>
            <div className="map-node node-web"><span>01</span><b>WEB</b><small>Experience</small></div>
            <div className="map-node node-ai"><span>02</span><b>AI</b><small>Automation</small></div>
            <div className="map-node node-data"><span>03</span><b>DATA</b><small>Improvement</small></div>
            <i className="map-line line-one" /><i className="map-line line-two" /><i className="map-line line-three" />
          </div>
        </div>
      </section>

      <section className="section strength" id="strength">
        <div className="strength-word" aria-hidden="true">REVANS</div>
        <div className="strength-corner-mark" aria-hidden="true">R/02</div>
        <div className="shell strength-grid" data-reveal="up">
          <div className="strength-copy">
            <p className="eyebrow light"><span /> WHY REVANS</p>
            <h2>作る会社ではなく、<br /><em>使われる仕組み</em>を<br />つくる会社です。</h2>
            <p>デザイン、システム、集客を別々に考えない。事業のゴールから逆算し、公開後も使い続けられる形に整えます。</p>
            <Link className="text-link" href="/company">REVANSについて <ArrowIcon /></Link>
          </div>
          <div className="strength-list">
            <article><span>01</span><div><h3>目的から設計する</h3><p>「何を作るか」より先に、「何を変えたいか」を整理します。</p></div></article>
            <article><span>02</span><div><h3>Webとシステムを一体化</h3><p>見せるサイトと、裏側で動く仕組みをまとめて設計します。</p></div></article>
            <article><span>03</span><div><h3>運用できる形で渡す</h3><p>複雑にしすぎず、現場が使い続けられることを大切にします。</p></div></article>
            <article><span>04</span><div><h3>数字を見て改善する</h3><p>感覚だけに頼らず、問い合わせや利用状況を見て次を決めます。</p></div></article>
          </div>
        </div>
      </section>

      <section className="editorial-break">
        <div className="editorial-r" aria-hidden="true">R</div>
        <div className="editorial-code" aria-hidden="true">R/03 — OUR STANDARD</div>
        <div className="editorial-inner shell" data-reveal="up">
          <p className="editorial-en">SIMPLE ON THE SURFACE.<br /><span>POWERFUL UNDERNEATH.</span></p>
          <div className="editorial-jp">
            <h2>シンプルに見えて、<br /><em>中身は強い。</em></h2>
            <p>使う人にはわかりやすく。<br />事業を動かす仕組みは、深く、強く。</p>
          </div>
        </div>
      </section>

      <section className="section works" id="works">
        <div className="works-word" aria-hidden="true">SELECTED WORKS</div>
        <div className="shell">
          <div className="section-heading works-heading" data-reveal="up">
            <div><p className="eyebrow"><span /> WORKS</p><h2>制作事例</h2></div>
            <p>課題の整理から、Web制作・集客導線まで一貫して設計しています。</p>
          </div>
          <a className="case-study" data-reveal="up" href="https://lp-sample-three.vercel.app" target="_blank" rel="noreferrer">
            <div className="case-visual">
              <span className="case-live"><i /> LIVE PROJECT</span>
              <div className="case-browser">
                <div className="case-bar"><span /><span /><span /></div>
                <div className="case-page">
                  <div className="case-nav"><b>BUILD</b><i /><i /><i /></div>
                  <div className="case-hero-mini"><small>RECRUITING PARTNERS</small><strong>ともにつくる。<br />ともに成長する。</strong><span>ENTRY</span></div>
                  <div className="case-cards"><i /><i /><i /></div>
                </div>
              </div>
              <span className="case-label">WEB / LANDING PAGE</span>
            </div>
            <div className="case-info">
              <div><span>CASE 01</span><span>建設業</span></div>
              <h3>協力会社募集LP</h3>
              <p>情報を整理し、問い合わせまでの導線を一本化。信頼感と行動のしやすさを両立したランディングページ。</p>
              <span className="case-link">サイトを見る <ArrowIcon /></span>
            </div>
          </a>
        </div>
      </section>

      <section className="brand-band" aria-label="REVANSの制作プロセス">
        <div className="brand-band-orbit" aria-hidden="true"><span>R</span></div>
        <div className="brand-band-row row-solid" aria-hidden="true">
          <span>IDEA</span><i>×</i><span>DESIGN</span><i>×</i><span>SYSTEM</span><i>×</i><span>GROWTH</span>
        </div>
        <div className="brand-band-row row-outline" aria-hidden="true">
          <span>IDEA</span><i>×</i><span>DESIGN</span><i>×</i><span>SYSTEM</span><i>×</i><span>GROWTH</span>
        </div>
        <div className="brand-band-caption shell">
          <span>REVANS DIGITAL CRAFT</span>
          <span>STRATEGY TO OPERATION</span>
        </div>
      </section>

      <section className="section process" id="process">
        <div className="process-word" aria-hidden="true">04 STEPS</div>
        <div className="shell">
          <div className="section-heading split-heading" data-reveal="up">
            <div><p className="eyebrow"><span /> PROCESS</p><h2>相談から運用まで、<br />迷わない進め方。</h2></div>
            <p>専門用語を並べず、今どこまで進んでいるかを共有します。初めてのWeb制作やシステム導入でもご安心ください。</p>
          </div>
          <div className="process-grid" data-reveal="up">
            {process.map(([number, label, title, description]) => (
              <article key={number}>
                <div><span>{number}</span><small>{label}</small></div>
                <h3>{title}</h3><p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="contact-section">
        <div className="contact-orbit orbit-one" /><div className="contact-orbit orbit-two" />
        <div className="contact-word" aria-hidden="true">REVANS</div>
        <div className="contact-corner corner-top" aria-hidden="true">R / CONTACT</div>
        <div className="contact-corner corner-bottom" aria-hidden="true">35.6762° N / 139.6503° E</div>
        <div className="shell contact-inner" data-reveal="up">
          <p className="eyebrow light"><span /> LET&apos;S TALK</p>
          <h2>まだ言葉になっていない課題から、<br />一緒に整理します。</h2>
          <p>Webサイトを作りたい。AIを業務に入れたい。今のやり方を効率化したい。<br />まずは現在の状況をお聞かせください。</p>
          <Link className="button contact-button" href="/contact">無料で相談する <ArrowIcon /></Link>
          <small>オンライン相談 / 全国対応</small>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
