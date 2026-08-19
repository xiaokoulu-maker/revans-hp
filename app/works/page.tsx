import type { Metadata } from "next";
import { ArrowIcon, PageIntro, SubpageCTA, SubpageFrame } from "../site-chrome";

const DESC = "REVANSの制作事例と、Web・AI・業務システムの支援イメージ。";

export const metadata: Metadata = {
  title: "制作事例",
  description: DESC,
  alternates: { canonical: "/works" },
  openGraph: { url: "/works", title: "制作事例｜REVANS", description: DESC },
};

const models = [
  ["WEB / LEAD GENERATION", "集客LP＋問い合わせ導線", "広告や検索から訪れた人が、迷わず相談できる情報設計と導線を作ります。"],
  ["AI / CONTENT", "AIブログ・コンテンツ運用", "企画、作成、確認、公開までの流れを整理し、継続しやすい形に整えます。"],
  ["SYSTEM / SALES", "営業CRM・案件管理", "顧客情報、進捗、予定、数字をまとめ、営業状況を一目で確認できるようにします。"],
];

export default function WorksPage() {
  return (
    <SubpageFrame active="/works">
      <PageIntro index="03" label="SELECTED WORKS" accent="WORKS" title={<>課題から設計した、<br /><em>使われるデジタル。</em></>} description="見た目だけではなく、情報の整理、問い合わせ導線、公開後の運用まで含めて制作します。" />

      <section className="content-section featured-work-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>CASE 01</span><div><p>FEATURED PROJECT</p><h2>協力会社募集LP</h2></div></div>
          <a className="featured-work" data-reveal="up" href="https://lp-sample-three.vercel.app" target="_blank" rel="noreferrer">
            <div className="featured-work-visual">
              <div className="featured-browser"><div className="featured-bar"><i /><i /><i /><small>partner recruitment / landing page</small></div><div className="featured-screen"><span>RECRUITING PARTNERS</span><h3>ともにつくる。<br />ともに成長する。</h3><b>ENTRY</b></div></div>
              <span className="featured-live"><i /> LIVE PROJECT</span>
              <b className="featured-r" aria-hidden="true">R</b>
            </div>
            <div className="featured-work-copy"><div><span>INDUSTRY</span><b>建設業</b></div><h2>情報を整理し、<br />応募までの導線を一本に。</h2><p>募集内容と会社の信頼性をわかりやすく整理し、問い合わせまで迷わず進めるランディングページとして設計しました。</p><span className="work-link">サイトを見る <ArrowIcon /></span></div>
          </a>
        </div>
      </section>

      <section className="content-section model-section">
        <div className="shell">
          <div className="sub-section-head" data-reveal="up"><span>PROJECT MODELS</span><div><p>WHAT WE CAN BUILD</p><h2>事業に合わせた、<br />支援イメージ。</h2></div></div>
          <div className="model-grid" data-reveal="up">
            {models.map(([label, title, description], index) => <article key={label}><span>0{index + 1}</span><small>{label}</small><h3>{title}</h3><p>{description}</p><b>PROJECT MODEL</b></article>)}
          </div>
          <p className="model-note">※ PROJECT MODELは制作実績ではなく、対応可能な支援内容のイメージです。</p>
        </div>
      </section>
      <SubpageCTA title="作りたいものより先に、変えたいことを聞かせてください。" />
    </SubpageFrame>
  );
}
