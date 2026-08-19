import type { Metadata } from "next";
import { PageIntro, SubpageCTA, SubpageFrame } from "../site-chrome";

const DESC =
  "デザイン、システム、集客を一体で考えるデジタルパートナーREVANSについて。中小企業の「伝える」と「動かす」を、ひとつのチームで支援します。";

export const metadata: Metadata = {
  title: "私たちについて",
  description: DESC,
  alternates: { canonical: "/company" },
  openGraph: { url: "/company", title: "私たちについて｜REVANS", description: DESC },
};

const values = [
  ["01", "PURPOSE FIRST", "目的から考える", "何を作るかより先に、何を変えたいかを整理します。"],
  ["02", "SIMPLE USABILITY", "使いやすく整える", "複雑な仕組みほど、使う人にはシンプルに見える形を目指します。"],
  ["03", "ONE SYSTEM", "分断しない", "デザイン、システム、集客を別々にせず、ひとつの体験として設計します。"],
  ["04", "KEEP GROWING", "運用から育てる", "公開をゴールにせず、使われ方と数字を見ながら改善します。"],
];

export default function CompanyPage() {
  return (
    <SubpageFrame active="/company">
      <PageIntro index="02" label="ABOUT REVANS" accent="IDENTITY" title={<>作る会社ではなく、<br /><em>使われる仕組みを。</em></>} description="見える部分だけを整えるのではなく、現場で動き、事業に残り続ける仕組みまで設計する。それがREVANSの考え方です。" />

      <section className="company-statement">
        <div className="company-statement-r" aria-hidden="true">R</div>
        <div className="shell company-statement-inner" data-reveal="up">
          <p className="company-statement-en">DESIGN THE EXPERIENCE.<br />BUILD THE SYSTEM.<br /><span>MOVE THE BUSINESS.</span></p>
          <div><small>OUR MISSION</small><h2>中小企業の「伝える」と「動かす」を、ひとつのチームで支援する。</h2><p>Webサイト、AI、業務システム、集客。施策ごとに分断せず、事業のゴールから逆算して必要な形を作ります。</p></div>
        </div>
      </section>

      <section className="content-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>04 VALUES</span><div><p>OUR STANDARD</p><h2>REVANSが、<br />大切にしていること。</h2></div></div>
          <div className="value-grid" data-reveal="up">
            {values.map(([number, label, title, description]) => <article key={number}><div><span>{number}</span><small>{label}</small></div><h3>{title}</h3><p>{description}</p><b aria-hidden="true">R</b></article>)}
          </div>
        </div>
      </section>

      <section className="content-section company-profile-section">
        <div className="shell company-profile" data-reveal="up">
          <div><p className="eyebrow"><span /> PROFILE</p><h2>事業概要</h2><p>全国オンラインで、企画・制作・実装・運用まで対応しています。</p></div>
          <dl>
            <div><dt>名称</dt><dd>REVANS</dd></div>
            <div><dt>所在地</dt><dd>東京都世田谷区</dd></div>
            <div><dt>対応エリア</dt><dd>全国オンライン対応</dd></div>
            <div><dt>事業内容</dt><dd>Webサイト・LP制作 / AIシステム開発 / 業務システム・自動化 / 集客・運用支援</dd></div>
          </dl>
        </div>
      </section>
      <SubpageCTA />
    </SubpageFrame>
  );
}
